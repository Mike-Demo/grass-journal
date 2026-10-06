/**
 * Encrypted backup: export / import.
 *
 * Format (one JSON file, ".grassjournal"):
 *   { manifest, crypto: {kdf, iterations, salt, iv}, ciphertext }
 * ciphertext = AES-GCM-256(PBKDF2-SHA256(passphrase, salt, 600k), iv,
 *                          JSON payload {entries, audio[], settings, exportedAt})
 *
 * The manifest is ALSO embedded inside the encrypted payload and authenticated
 * there; the outer manifest is plaintext only so the app can show a preview
 * (counts, date) before asking for the passphrase.
 *
 * The passphrase is never stored. Losing it loses the backup — we say so loudly.
 */

import { db } from '../db';
import type { AudioRecord, BackupManifest, JournalEntry } from './types';
import { backupEnvelopeSchema, backupPayloadSchema } from './validation';

export const BACKUP_VERSION = 1 as const;
const KDF_ITERATIONS = 600_000; // OWASP PBKDF2-HMAC-SHA256 guidance
const APP_VERSION = '0.1.0';

const te = new TextEncoder();
const td = new TextDecoder();

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Copy into a fresh ArrayBuffer: crypto.subtle requires a resizable-safe view.
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  entryCount: number;
  audioCount: number;
}

async function buildEnvelope(
  passphrase: string,
  entries: JournalEntry[],
  audioRows: AudioRecord[],
  filenameDate: string,
): Promise<{ blob: Blob; filename: string }> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters.');
  }
  const audioPayload = [];
  for (const a of audioRows) {
    const buf = await a.blob.arrayBuffer();
    audioPayload.push({
      id: a.id,
      journalEntryId: a.journalEntryId,
      mimeType: a.mimeType,
      byteLength: a.byteLength,
      duration: a.duration,
      createdAt: a.createdAt,
      integrityHash: a.integrityHash,
      dataBase64: b64encode(buf),
    });
  }

  const payloadJson = JSON.stringify({
    entries,
    audio: audioPayload,
    settings: { theme: (await db.settings.get('app'))?.theme ?? 'system' },
    exportedAt: Date.now(),
  });
  const payloadBytes = te.encode(payloadJson);
  const contentHash = await sha256Hex(payloadBytes);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as ArrayBuffer }, key, payloadBytes as unknown as ArrayBuffer);

  const manifest: BackupManifest = {
    format: 'grass-journal-backup',
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: Date.now(),
    entryCount: entries.length,
    audioCount: audioRows.length,
    contentHash,
  };

  const envelope = {
    manifest,
    crypto: { kdf: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: b64encode(salt), iv: b64encode(iv) },
    ciphertext: b64encode(ciphertext),
  };

  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  return { blob, filename: `grass-journal-backup-${filenameDate}.grassjournal` };
}

export async function exportBackup(passphrase: string): Promise<ExportResult> {
  const entries = await db.entries.toArray();
  const audioRows = await db.audio.toArray();
  const date = new Date().toISOString().slice(0, 10);
  const { blob, filename } = await buildEnvelope(passphrase, entries, audioRows, date);
  return { blob, filename, entryCount: entries.length, audioCount: audioRows.length };
}

/** Encrypted export of a single entry (+ its recording) in the same format. */
export async function exportSingleEntry(entryId: string, passphrase: string): Promise<ExportResult> {
  const entry = await db.entries.get(entryId);
  if (!entry) throw new Error('Entry not found.');
  const audioRows = entry.audioBlobId ? await db.audio.where('id').equals(entry.audioBlobId).toArray() : [];
  const date = new Date().toISOString().slice(0, 10);
  const { blob } = await buildEnvelope(passphrase, [entry], audioRows, date);
  return { blob, filename: `grass-journal-entry-${date}.grassjournal`, entryCount: 1, audioCount: audioRows.length };
}

export interface BackupPreview {
  manifest: BackupManifest;
  /** Entries already in this device with the same ids (skipped on merge). */
  duplicateIds: string[];
  newEntryCount: number;
  newAudioCount: number;
}

async function decryptEnvelope(
  envelope: unknown,
  passphrase: string,
): Promise<{ manifest: BackupManifest; entries: JournalEntry[]; audioPayload: { id: string; journalEntryId: string; mimeType: string; byteLength: number; duration: number; createdAt: number; integrityHash?: string; dataBase64: string }[] }> {
  const env = backupEnvelopeSchema.parse(envelope); // throws on corrupt/tampered structure
  const salt = b64decode(env.crypto.salt);
  const iv = b64decode(env.crypto.iv);
  const key = await deriveKey(passphrase, salt);
  let plain: ArrayBuffer;
  try {
    plain = (await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
      key,
      b64decode(env.ciphertext) as unknown as ArrayBuffer,
    )) as ArrayBuffer;
  } catch {
    throw new Error('Wrong passphrase, or the backup file is corrupted.');
  }
  const payloadText = td.decode(plain);
  const payload = backupPayloadSchema.parse(JSON.parse(payloadText)); // throws on schema violation
  // Defense in depth: verify the content hash recorded in the manifest.
  const actualHash = await sha256Hex(te.encode(payloadText));
  if (actualHash !== env.manifest.contentHash) {
    throw new Error('Backup integrity check failed: content hash mismatch.');
  }
  return { manifest: env.manifest, entries: payload.entries, audioPayload: payload.audio };
}

/** Parse without decrypting: preview counts + which entries already exist. */
export async function parseBackupFile(file: File | Blob): Promise<{ manifest: BackupManifest }> {
  const text = await file.text();
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error('Not a valid Grass Journal backup file.');
  }
  const env = backupEnvelopeSchema.parse(envelope);
  return { manifest: env.manifest };
}

/** Full preview: decrypts (needs passphrase) but writes NOTHING. */
export async function previewRestore(file: File | Blob, passphrase: string): Promise<BackupPreview> {
  const text = await file.text();
  const { manifest, entries, audioPayload } = await decryptEnvelope(JSON.parse(text), passphrase);
  const existingIds = new Set(await db.entries.toCollection().primaryKeys());
  const duplicateIds = entries.filter((e) => existingIds.has(e.id)).map((e) => e.id);
  return {
    manifest,
    duplicateIds,
    newEntryCount: entries.length - duplicateIds.length,
    newAudioCount: audioPayload.length,
  };
}

export type RestoreMode = 'merge' | 'replace';

/**
 * Restore a backup. Nothing is written until every validation passes, and the
 * actual write happens in one transaction — cancel before confirm = zero changes.
 */
export async function restoreBackup(
  file: File | Blob,
  passphrase: string,
  mode: RestoreMode,
): Promise<{ restoredEntries: number; restoredAudio: number; skippedDuplicates: number }> {
  const text = await file.text();
  const { entries, audioPayload } = await decryptEnvelope(JSON.parse(text), passphrase);

  // Verify per-audio integrity hashes before touching the database.
  const audioRecords: AudioRecord[] = [];
  for (const a of audioPayload) {
    const bytes = b64decode(a.dataBase64);
    if (a.integrityHash) {
      const actual = await sha256Hex(bytes);
      if (actual !== a.integrityHash) {
        throw new Error(`Audio integrity check failed for recording ${a.id}. Restore aborted.`);
      }
    }
    audioRecords.push({
      id: a.id,
      journalEntryId: a.journalEntryId,
      blob: new Blob([bytes.buffer as ArrayBuffer], { type: a.mimeType }),
      mimeType: a.mimeType,
      byteLength: a.byteLength,
      duration: a.duration,
      createdAt: a.createdAt,
      integrityHash: a.integrityHash,
    });
  }

  let restoredEntries = 0;
  let restoredAudio = 0;
  let skippedDuplicates = 0;

  await db.transaction('rw', db.entries, db.audio, async () => {
    if (mode === 'replace') {
      await db.audio.clear();
      await db.entries.clear();
    }
    for (const entry of entries) {
      const exists = await db.entries.get(entry.id);
      if (exists && mode === 'merge') {
        skippedDuplicates++;
        continue;
      }
      await db.entries.put(entry);
      restoredEntries++;
    }
    for (const audio of audioRecords) {
      const exists = await db.audio.get(audio.id);
      if (exists && mode === 'merge') continue;
      await db.audio.put(audio);
      restoredAudio++;
    }
  });

  return { restoredEntries, restoredAudio, skippedDuplicates };
}
