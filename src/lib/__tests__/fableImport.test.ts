import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import {
  findEntryArray,
  importFableFile,
  isFableHtml,
  parseFableDate,
  parseFableHtml,
  parseFableHtmlDate,
  previewFableFile,
} from '../fableImport';

const asFile = (obj: unknown, name = 'fable-export.json') =>
  new File([JSON.stringify(obj)], name, { type: 'application/json' });

const asHtmlFile = (html: string, name = 'journal_export.html') =>
  new File([html], name, { type: 'text/html' });

/** Synthetic HTML mirroring Fable's export layout (invented content). */
const htmlExportLike = `<!DOCTYPE html><html><head><title>Journal</title></head><body><main>
<article><div class="epic">Chapter One</div><h2>A test morning</h2>
<p class="date">July 11, 2026, 11:10 a.m.</p>
<div>First paragraph.<br><br>Second paragraph.</div>
<div class="images"><figure><img src="images/journal-00001.png"></figure></div>
<p>Wishing</p></article>
<article><div class="epic">Chapter One</div><h2>Evening note</h2>
<p class="date">Feb. 8, 2026, 10:42 p.m.</p>
<div>Short entry.</div>
<div class="images"><figure><img src="images/journal-00002.png"></figure></div>
<p>Struggle</p></article>
<article><div class="epic">Chapter Two</div><h2></h2><p class="date">not a date</p><div>   </div><p>Intel</p></article>
</main></body></html>`;

beforeEach(async () => {
  await db.entries.clear();
  await db.audio.clear();
});

describe('findEntryArray', () => {
  it('finds a top-level array', () => {
    expect(findEntryArray([{ text: 'a' }])?.length).toBe(1);
  });

  it('finds nested arrays under common keys', () => {
    expect(findEntryArray({ entries: [{ text: 'a' }] })?.length).toBe(1);
    expect(findEntryArray({ data: [{ content: 'b' }] })?.length).toBe(1);
  });

  it('returns null when nothing looks like entries', () => {
    expect(findEntryArray({ foo: 'bar' })).toBeNull();
    expect(findEntryArray([1, 2, 3])).toEqual([]);
  });
});

describe('parseFableDate', () => {
  it('parses ISO strings', () => {
    expect(parseFableDate('2026-09-15T10:30:00.000Z')).toBe(Date.parse('2026-09-15T10:30:00.000Z'));
  });

  it('parses epoch ms and epoch seconds', () => {
    expect(parseFableDate(1726396200000)).toBe(1726396200000);
    expect(parseFableDate(1726396200)).toBe(1726396200000);
  });

  it('rejects garbage', () => {
    expect(parseFableDate('not a date')).toBeNull();
    expect(parseFableDate(null)).toBeNull();
    expect(parseFableDate(-5)).toBeNull();
  });
});

describe('fable import end to end', () => {
  const exportLike = {
    entries: [
      { text: 'First fable entry', createdAt: '2026-09-01T08:00:00.000Z', title: 'Morning' },
      { content: 'Second entry, other field name', created_at: '2026-09-02T08:00:00.000Z' },
      { text: '   ' }, // empty → skipped
    ],
  };

  it('previews counts, dates, and the detected mapping', async () => {
    const p = await previewFableFile(asFile(exportLike), 'fable-export.json');
    expect(p.entryCount).toBe(2);
    expect(p.mapping.textField).toBe('text');
    expect(p.mapping.dateField).toBe('createdAt');
    expect(p.dateRange?.min).toBe(Date.parse('2026-09-01T08:00:00.000Z'));
    expect(p.sampleText).toContain('First fable entry');
  });

  it('imports entries with original dates and the fable-import tag', async () => {
    const p = await previewFableFile(asFile(exportLike), 'fable-export.json');
    const r = await importFableFile(asFile(exportLike), p.mapping, p.source);
    expect(r.imported).toBe(2);
    expect(r.skipped).toBe(1);
    const all = await db.entries.orderBy('createdAt').toArray();
    expect(all.length).toBe(2);
    expect(all[0].bodyText).toBe('First fable entry');
    expect(all[0].createdAt).toBe(Date.parse('2026-09-01T08:00:00.000Z'));
    expect(all[0].title).toBe('Morning');
    expect(all[0].tags).toContain('fable-import');
    expect(all[0].entryType).toBe('text');
  });

  it('skips duplicates on a second import', async () => {
    const p = await previewFableFile(asFile(exportLike), 'fable-export.json');
    await importFableFile(asFile(exportLike), p.mapping, p.source);
    const p2 = await previewFableFile(asFile(exportLike), 'fable-export.json');
    expect(p2.duplicateCount).toBe(2);
    const r2 = await importFableFile(asFile(exportLike), p2.mapping, p2.source);
    expect(r2.imported).toBe(0);
    expect(await db.entries.count()).toBe(2);
  });

  it('rejects non-JSON non-HTML files with a helpful message', async () => {
    const bad = new File(['not json'], 'x.json', { type: 'application/json' });
    await expect(previewFableFile(bad, 'x.json')).rejects.toThrow(/neither Fable JSON nor/i);
  });

  it('rejects files with no recognizable entries', async () => {
    await expect(previewFableFile(asFile({ hello: 'world' }), 'x.json')).rejects.toThrow(/no journal entries/i);
  });
});

describe('fable HTML export', () => {
  it('detects HTML by doctype', () => {
    expect(isFableHtml('<!DOCTYPE html><html></html>')).toBe(true);
    expect(isFableHtml('  <html><body></body></html>')).toBe(true);
    expect(isFableHtml('{"entries": []}')).toBe(false);
  });

  it('parses Fable HTML dates', () => {
    const t = parseFableHtmlDate('July 11, 2026, 11:10 a.m.');
    expect(t).not.toBeNull();
    const d = new Date(t!);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()])
      .toEqual([2026, 6, 11, 11, 10]);
    const t2 = parseFableHtmlDate('Feb. 8, 2026, 10:42 p.m.');
    const d2 = new Date(t2!);
    expect([d2.getFullYear(), d2.getMonth(), d2.getDate(), d2.getHours(), d2.getMinutes()])
      .toEqual([2026, 1, 8, 22, 42]);
    expect(parseFableHtmlDate('not a date')).toBeNull();
    expect(parseFableHtmlDate('')).toBeNull();
  });

  it('extracts title, date, and body — stripping images, skipping empties', () => {
    const entries = parseFableHtml(htmlExportLike);
    expect(entries.length).toBe(2);
    expect(entries[0].title).toBe('A test morning');
    expect(entries[0].text).toBe('First paragraph.\n\nSecond paragraph.');
    expect(entries[0].text).not.toContain('journal-00001.png');
    expect(entries[0].text).not.toContain('Wishing');
    const d = new Date(entries[0].createdAt!);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 11]);
    expect(entries[1].title).toBe('Evening note');
    expect(entries[0].theme).toBe('Wishing');
    expect(entries[1].theme).toBe('Struggle');
  });

  it('previews and imports HTML end to end with original dates', async () => {
    const p = await previewFableFile(asHtmlFile(htmlExportLike), 'journal_export.html');
    expect(p.source).toBe('html');
    expect(p.entryCount).toBe(2);
    expect(p.sampleText).toContain('First paragraph.');
    const r = await importFableFile(asHtmlFile(htmlExportLike), p.mapping, p.source);
    expect(r.imported).toBe(2);
    expect(r.skipped).toBe(1); // the empty third article
    const all = await db.entries.orderBy('createdAt').toArray();
    expect(all.length).toBe(2);
    expect(all[1].title).toBe('A test morning');
    expect(all[1].tags).toContain('fable-import');
    expect(all[1].tags).toContain('wishing');
    expect(all[0].tags).toContain('struggle');
    expect(all[1].bodyText).toBe('First paragraph.\n\nSecond paragraph.');
    // Second import is fully duplicate-skipped.
    const p2 = await previewFableFile(asHtmlFile(htmlExportLike), 'journal_export.html');
    expect(p2.duplicateCount).toBe(2);
  });
});
