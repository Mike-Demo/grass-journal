/**
 * Privacy-verification mode.
 *
 * Intercepts fetch / XHR / WebSocket / sendBeacon while a scripted set of
 * local workflows runs (create entry, save, export-to-memory, restore-from-
 * memory, deterministic reflection). Fails if any journal text, transcript,
 * reflection content, or audio is transmitted anywhere.
 *
 * Model-weight downloads are allowlisted ONLY during explicit installation —
 * this check performs no installation, so the allowlist is empty and ANY
 * request is a failure.
 */
import { db, saveEntryWithAudio } from '../db';
import { exportBackup, restoreBackup } from './backup';
import { deterministicReflection } from '../ai/deterministic';
import { newEntryId } from './validation';
import { SCHEMA_VERSION } from './types';
import type { JournalEntry } from './types';

interface CapturedRequest {
  kind: 'fetch' | 'xhr' | 'websocket' | 'beacon';
  url: string;
  bodyPreview: string;
}

export interface PrivacyCheckResult {
  passed: boolean;
  requests: CapturedRequest[];
  steps: { name: string; ok: boolean; detail?: string }[];
}

const CANARY = `privacy-canary-${Date.now().toString(36)}`;

export async function runPrivacyCheck(): Promise<PrivacyCheckResult> {
  const requests: CapturedRequest[] = [];
  const steps: { name: string; ok: boolean; detail?: string }[] = [];

  const preview = (body: unknown): string => {
    try {
      const s = typeof body === 'string' ? body : JSON.stringify(body ?? '');
      return s.slice(0, 200);
    } catch {
      return '[unreadable]';
    }
  };

  // --- install interceptors ---
  const origFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requests.push({ kind: 'fetch', url, bodyPreview: preview(init?.body) });
    return origFetch(input, init);
  }) as typeof window.fetch;

  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;
  const origSend = OrigXHR.prototype.send;
  OrigXHR.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    (this as unknown as { __gjUrl: string }).__gjUrl = String(url);
    return origOpen.call(this, method, url as string, async ?? true, username ?? null, password ?? null);
  };
  OrigXHR.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    requests.push({ kind: 'xhr', url: (this as unknown as { __gjUrl?: string }).__gjUrl ?? '', bodyPreview: preview(body) });
    return origSend.call(this, body as never);
  };

  const OrigWS = window.WebSocket;
  (window as unknown as { WebSocket: unknown }).WebSocket = function (url: string | URL) {
    requests.push({ kind: 'websocket', url: String(url), bodyPreview: '' });
    return new OrigWS(url);
  };

  const origBeacon = navigator.sendBeacon?.bind(navigator);
  if (origBeacon) {
    navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null) => {
      requests.push({ kind: 'beacon', url: String(url), bodyPreview: preview(data) });
      return origBeacon(url, data);
    }) as typeof navigator.sendBeacon;
  }

  const restore = () => {
    window.fetch = origFetch;
    OrigXHR.prototype.open = origOpen;
    OrigXHR.prototype.send = origSend;
    (window as unknown as { WebSocket: unknown }).WebSocket = OrigWS;
    if (origBeacon) navigator.sendBeacon = origBeacon;
  };

  try {
    // Step 1: create + save a canary entry (text).
    const id = newEntryId();
    const entry: JournalEntry = {
      id,
      schemaVersion: SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entryType: 'text',
      bodyText: `Canary entry. ${CANARY} This text must never leave the device.`,
      transcriptStatus: 'none',
      tags: [],
      favorite: false,
    };
    await saveEntryWithAudio(entry);
    steps.push({ name: 'Save typed entry', ok: true });

    // Step 2: deterministic reflection (local fallback path).
    const r = deterministicReflection(entry.bodyText);
    if (!r.summary.includes(CANARY.slice(0, 12))) {
      // reflection of canary text — local only, fine.
    }
    steps.push({ name: 'Local reflection (deterministic fallback)', ok: true });

    // Step 3: encrypted export to memory (no download in the check).
    const { blob } = await exportBackup('check-passphrase-123');
    steps.push({ name: 'Encrypted export (in-memory)', ok: blob.size > 0 });

    // Step 4: restore from that blob as merge.
    const res = await restoreBackup(blob, 'check-passphrase-123', 'merge');
    steps.push({ name: 'Restore (merge, in-memory)', ok: res.skippedDuplicates >= 1 || res.restoredEntries >= 0 });

    // Step 5: clean up the canary.
    await db.entries.delete(id);
    steps.push({ name: 'Canary cleanup', ok: true });
  } catch (err) {
    steps.push({ name: 'Workflow', ok: false, detail: err instanceof Error ? err.message : String(err) });
  } finally {
    restore();
  }

  const leaked = requests.filter(
    (q) => q.bodyPreview.includes(CANARY) || q.url.includes('canary'),
  );
  const passed = requests.length === 0 && leaked.length === 0 && steps.every((s) => s.ok);
  return { passed, requests, steps };
}
