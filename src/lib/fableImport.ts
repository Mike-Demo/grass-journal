/**
 * Fable (lifefable.me) journal import.
 *
 * Two real formats are supported:
 * - HTML: `journal_export.html` from Fable's ZIP download. Layout verified
 *   against a real export (2026-10-05): each <article> holds an epic div
 *   (skipped), an <h2> title, a <p class="date"> like "July 11, 2026, 11:10 a.m.",
 *   a body div (images stripped), and a theme-word <p> (saved as a tag —
 *   the user asked for these explicitly).
 * - JSON: the API-style export. Fable doesn't publish its schema, so this
 *   path is deliberately tolerant: it finds the entry array wherever it
 *   lives, guesses the text/date/title fields from common names, shows the
 *   user exactly what it found, and lets them correct the mapping before
 *   anything is written.
 *
 * Only the user's own entry text is imported, plus Fable's theme word as a
 * tag (explicit user request). Fable's other AI-generated material
 * (illustrations, epics, prophecies, scores) is left behind — Grass Journal
 * treats AI output as optional metadata, and Fable's AI output belongs to Fable.
 */
import { db } from '../db';
import { sha256Hex } from './backup';
import { newEntryId } from './validation';
import { SCHEMA_VERSION, type JournalEntry } from './types';

const TEXT_FIELDS = [
  'text', 'content', 'body', 'entry', 'entryText', 'entry_text',
  'description', 'note', 'journalEntry', 'journal_entry', 'message',
];
const DATE_FIELDS = [
  'createdAt', 'created_at', 'date', 'timestamp', 'time', 'created',
  'dateCreated', 'date_created', 'occurredAt', 'entryDate',
];
const TITLE_FIELDS = ['title', 'heading', 'subject', 'name'];
const ARRAY_KEYS = [
  'entries', 'data', 'journal', 'items', 'logs', 'results',
  'journalEntries', 'journal_entries', 'days',
];

export interface FieldMapping {
  textField: string;
  dateField: string | null;
  titleField: string | null;
}

/** Normalized entry — the common shape both JSON and HTML parsers produce. */
export interface NormalizedFableEntry {
  text: string;
  createdAt: number | null;
  title?: string;
  /** Fable's AI theme word (HTML exports only), saved as a tag on request. */
  theme?: string;
}

export interface FablePreview {
  fileName: string;
  /** 'json' for the API-style export, 'html' for journal_export.html. */
  source: 'json' | 'html';
  entryCount: number;
  mapping: FieldMapping;
  /** Keys seen on entries, so the user can spot a missed field. */
  observedKeys: string[];
  dateRange: { min: number; max: number } | null;
  sampleText: string;
  /** Entries that would be skipped as duplicates of existing journal entries. */
  duplicateCount: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Find the entry array: top-level array, or nested under a common key. */
export function findEntryArray(json: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(json)) {
    return json.filter(isRecord);
  }
  if (isRecord(json)) {
    for (const key of ARRAY_KEYS) {
      const v = json[key];
      if (Array.isArray(v) && v.length > 0 && v.every(isRecord)) {
        return v as Record<string, unknown>[];
      }
    }
    // Last resort: the first array-of-objects property we find.
    for (const v of Object.values(json)) {
      if (Array.isArray(v) && v.length > 0 && v.every(isRecord)) {
        return v as Record<string, unknown>[];
      }
    }
  }
  return null;
}

function pickField(keys: string[], candidates: string[]): string | null {
  const lower = new Map(keys.map((k) => [k.toLowerCase(), k]));
  for (const c of candidates) {
    if (lower.has(c.toLowerCase())) return lower.get(c.toLowerCase())!;
  }
  return null;
}

/** Parse ISO strings, epoch ms, and epoch seconds. Null when unparseable. */
export function parseFableDate(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: 10 digits = seconds, 13 = ms.
    const ms = value < 1e12 ? value * 1000 : value;
    return ms > 0 && ms < 4102444800000 ? Math.round(ms) : null; // before year 2100
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

const HTML_MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Parse the date format used in Fable's HTML export (journal_export.html):
 * "July 11, 2026, 11:10 a.m." / "Feb. 16, 2026, 2:58 p.m."
 * Interpreted in the viewer's local timezone — the export carries no zone.
 */
export function parseFableHtmlDate(s: string): number | null {
  const m = /^\s*([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+([ap])\.m\.\s*$/i.exec(s);
  if (!m) return null;
  const month = HTML_MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  let hour = parseInt(m[4], 10) % 12;
  if (m[6].toLowerCase() === 'p') hour += 12;
  const t = new Date(parseInt(m[3], 10), month, parseInt(m[2], 10), hour, parseInt(m[5], 10)).getTime();
  return Number.isNaN(t) ? null : t;
}

/** True when the file text looks like Fable's HTML export rather than JSON. */
export function isFableHtml(text: string): boolean {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
}

/**
 * Parse Fable's HTML export (journal_export.html from the ZIP).
 *
 * Real layout, verified against a 2026-10-05 sample export (22 entries):
 *   <article>
 *     <div class="epic">…</div>      (chapter grouping — not imported)
 *     <h2>…</h2>                    (entry title)
 *     <p class="date">July 11, 2026, 11:10 a.m.</p>
 *     <div>…<br><br>…<div class="images">…</div></div>  (body; images stripped)
 *     <p>…</p>                      (Fable's AI theme word — not imported)
 *   </article>
 *
 * Only the user's own title + body text is extracted. Fable's AI material
 * (illustrations, theme words, epics) is left behind.
 */
export function parseFableHtml(htmlText: string): NormalizedFableEntry[] {
  if (typeof DOMParser === 'undefined') {
    throw new Error('HTML parsing is not available in this browser.');
  }
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const entries: NormalizedFableEntry[] = [];
  for (const article of doc.querySelectorAll('article')) {
    const title = article.querySelector('h2')?.textContent?.trim().slice(0, 200) || undefined;
    const dateText = article.querySelector('p.date')?.textContent?.trim() ?? '';
    // Fable's AI theme word: the plain <p> (no class) after the body.
    // Saved as a tag — the user asked for these explicitly (2026-10-05).
    const themePs = [...article.querySelectorAll('p:not(.date)')];
    const theme = themePs.length
      ? themePs[themePs.length - 1].textContent?.trim().slice(0, 40) || undefined
      : undefined;
    // Body = the direct-child div that isn't the epic header or the images
    // block. The images block nests INSIDE the body div, so strip it first.
    let bodyEl: Element | null = null;
    for (const child of article.children) {
      if (child.tagName === 'DIV' && !child.classList.contains('epic') && !child.classList.contains('images')) {
        bodyEl = child;
        break;
      }
    }
    let text = '';
    if (bodyEl) {
      const clone = bodyEl.cloneNode(true) as Element;
      clone.querySelectorAll('.images, figure, img').forEach((n) => n.remove());
      // Walk nodes: text runs plus <br> as newlines.
      const parts: string[] = [];
      const walk = (node: Node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 3) parts.push(child.textContent ?? '');
          else if (child.nodeName === 'BR') parts.push('\n');
          else walk(child);
        }
      };
      walk(clone);
      text = parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (!text) continue;
    entries.push({ text, createdAt: parseFableHtmlDate(dateText), title, theme });
  }
  return entries;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Extract a field value tolerantly: the mapped field first, then any other
 * known candidate present on the row. Exports are often heterogeneous —
 * Fable mixes short user entries with AI-enriched ones.
 */
function extractField(
  row: Record<string, unknown>,
  mapped: string | null,
  candidates: string[],
): unknown {
  const ordered = [mapped, ...candidates].filter((c): c is string => !!c);
  const seen = new Set<string>();
  for (const c of ordered) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const actual = Object.keys(row).find((k) => k.toLowerCase() === key);
    if (actual != null) {
      const v = row[actual];
      if (v != null && String(v).trim() !== '') return v;
    }
  }
  return undefined;
}

const extractText = (row: Record<string, unknown>, m: FieldMapping): string =>
  asText(extractField(row, m.textField, TEXT_FIELDS)).trim();

const extractDate = (row: Record<string, unknown>, m: FieldMapping): number | null =>
  parseFableDate(extractField(row, m.dateField, DATE_FIELDS));

const extractTitle = (row: Record<string, unknown>, m: FieldMapping): string | undefined => {
  const t = asText(extractField(row, m.titleField, TITLE_FIELDS)).trim().slice(0, 200);
  return t || undefined;
};

async function duplicateKeys(): Promise<Set<string>> {
  const existing = await db.entries.toArray();
  return new Set(existing.map((e) => `${e.createdAt}|${e.bodyText}`));
}

async function buildPreview(
  fileName: string,
  source: 'json' | 'html',
  entries: NormalizedFableEntry[],
  mapping: FieldMapping,
  observedKeys: string[],
): Promise<FablePreview> {
  const dates = entries.map((e) => e.createdAt).filter((d): d is number => d != null);
  const existingKeys = await duplicateKeys();
  let duplicateCount = 0;
  for (const e of entries) {
    if (e.createdAt != null && existingKeys.has(`${e.createdAt}|${e.text}`)) duplicateCount++;
  }
  return {
    fileName,
    source,
    entryCount: entries.length,
    mapping,
    observedKeys: observedKeys.slice(0, 24),
    dateRange: dates.length ? { min: Math.min(...dates), max: Math.max(...dates) } : null,
    sampleText: entries[0]?.text.slice(0, 160) ?? '',
    duplicateCount,
  };
}

export async function previewFableFile(file: File | Blob, fileName: string): Promise<FablePreview> {
  const text = await file.text();
  if (isFableHtml(text)) {
    const entries = parseFableHtml(text);
    if (entries.length === 0) {
      throw new Error('No journal entries found in that HTML file. It may use a layout this importer does not recognize yet.');
    }
    return buildPreview(fileName, 'html', entries, {
      textField: 'article body',
      dateField: 'p.date',
      titleField: 'h2',
    }, ['article', 'div.epic (skipped)', 'h2', 'p.date', 'div body', 'p theme → tag', 'div.images (skipped)']);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That file is neither Fable JSON nor the journal_export.html from a Fable ZIP export. If yours is a ZIP, extract it first and choose journal_export.html (or the .json, if present).');
  }
  const rows = findEntryArray(json);
  if (!rows || rows.length === 0) {
    throw new Error('No journal entries found in that file. It may use a layout this importer does not recognize yet.');
  }
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const mapping: FieldMapping = {
    textField: pickField(keys, TEXT_FIELDS) ?? keys[0],
    dateField: pickField(keys, DATE_FIELDS),
    titleField: pickField(keys, TITLE_FIELDS),
  };
  const entries: NormalizedFableEntry[] = [];
  for (const r of rows) {
    const body = extractText(r, mapping);
    if (!body) continue;
    entries.push({ text: body, createdAt: extractDate(r, mapping), title: extractTitle(r, mapping) });
  }
  return buildPreview(fileName, 'json', entries, mapping, keys);
}

/**
 * Import the file using the (possibly user-corrected) mapping.
 * Writes nothing until parsing succeeds; skips empties and duplicates.
 * The `source` must come from the matching preview — HTML ignores the
 * field mapping (its layout is fixed).
 */
export async function importFableFile(
  file: File | Blob,
  mapping: FieldMapping,
  source: 'json' | 'html',
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  let entries: NormalizedFableEntry[];
  let skipped = 0;
  if (source === 'html' || isFableHtml(text)) {
    entries = parseFableHtml(text);
    if (typeof DOMParser !== 'undefined') {
      // Articles with no extractable body text count as skipped empties.
      const articleCount = new DOMParser().parseFromString(text, 'text/html').querySelectorAll('article').length;
      skipped += Math.max(0, articleCount - entries.length);
    }
  } else {
    const rows = findEntryArray(JSON.parse(text));
    if (!rows) throw new Error('No journal entries found in that file.');
    entries = [];
    for (const r of rows) {
      const body = extractText(r, mapping);
      if (!body) { skipped++; continue; }
      entries.push({ text: body, createdAt: extractDate(r, mapping), title: extractTitle(r, mapping) });
    }
  }
  if (entries.length === 0) throw new Error('No journal entries found in that file.');

  const existingKeys = await duplicateKeys();
  const toImport: JournalEntry[] = [];
  for (const e of entries) {
    const createdAt = e.createdAt ?? Date.now();
    if (existingKeys.has(`${createdAt}|${e.text}`)) { skipped++; continue; }
    const now = Date.now();
    const tags = ['fable-import'];
    if (e.theme) tags.push(e.theme.toLowerCase());
    toImport.push({
      id: newEntryId(),
      schemaVersion: SCHEMA_VERSION,
      createdAt,
      updatedAt: now,
      entryType: 'text',
      title: e.title,
      bodyText: e.text,
      transcriptStatus: 'none',
      tags,
      favorite: false,
    });
    existingKeys.add(`${createdAt}|${e.text}`);
  }

  // Content fingerprints for the import report (not stored).
  await Promise.all(toImport.map((e) => sha256Hex(new TextEncoder().encode(e.bodyText))));

  await db.transaction('rw', db.entries, async () => {
    await db.entries.bulkAdd(toImport);
  });
  return { imported: toImport.length, skipped };
}
