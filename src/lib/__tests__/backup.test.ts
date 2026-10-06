/**
 * Backup crypto + restore semantics, against a fake IndexedDB.
 *
 * Covers: round-trip, wrong passphrase, tampered ciphertext, corrupt envelope,
 * merge dedupe, replace mode, audio integrity-hash verification.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, saveEntryWithAudio } from '../../db';
import { exportBackup, previewRestore, restoreBackup, sha256Hex } from '../backup';
import { newEntryId } from '../validation';
import { SCHEMA_VERSION, type AudioRecord, type JournalEntry } from '../types';

const PASS = 'correct-horse-battery-staple';

function makeEntry(over: Partial<JournalEntry> = {}): JournalEntry {
  const now = Date.now();
  return {
    id: newEntryId(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    entryType: 'text',
    bodyText: 'test entry body',
    transcriptStatus: 'none',
    tags: [],
    favorite: false,
    ...over,
  };
}

function makeAudio(entryId: string, bytes: Uint8Array): AudioRecord {
  return {
    id: newEntryId(),
    journalEntryId: entryId,
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    byteLength: bytes.length,
    duration: 1.5,
    createdAt: Date.now(),
  };
}

beforeEach(async () => {
  await db.transaction('rw', db.entries, db.audio, db.settings, db.models, async () => {
    await db.entries.clear();
    await db.audio.clear();
  });
});

describe('encrypted backup', () => {
  it('round-trips entries and audio through export → restore (replace)', async () => {
    const e = makeEntry({ bodyText: 'round trip canary' });
    const audioBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const a = makeAudio(e.id, audioBytes);
    a.integrityHash = await sha256Hex(audioBytes);
    e.audioBlobId = a.id;
    e.audioMimeType = a.mimeType;
    await saveEntryWithAudio(e, a);

    const { blob } = await exportBackup(PASS);
    // wipe, then restore
    await db.entries.clear();
    await db.audio.clear();
    const res = await restoreBackup(blob, PASS, 'replace');
    expect(res.restoredEntries).toBe(1);
    expect(res.restoredAudio).toBe(1);

    const restored = await db.entries.get(e.id);
    expect(restored?.bodyText).toBe('round trip canary');
    const restoredAudio = await db.audio.get(a.id);
    expect(restoredAudio?.byteLength).toBe(5);
    expect(new Uint8Array(await restoredAudio!.blob.arrayBuffer())).toEqual(audioBytes);
  });

  it('rejects a wrong passphrase', async () => {
    await saveEntryWithAudio(makeEntry());
    const { blob } = await exportBackup(PASS);
    await expect(restoreBackup(blob, 'wrong-passphrase!', 'merge')).rejects.toThrow(/passphrase|corrupt/i);
  });

  it('rejects tampered ciphertext (AES-GCM authentication)', async () => {
    await saveEntryWithAudio(makeEntry());
    const { blob } = await exportBackup(PASS);
    const env = JSON.parse(await blob.text());
    // Flip a character deep in the ciphertext.
    const ct: string = env.ciphertext;
    env.ciphertext = ct.slice(0, 100) + (ct[100] === 'A' ? 'B' : 'A') + ct.slice(101);
    const tampered = new Blob([JSON.stringify(env)], { type: 'application/json' });
    await expect(restoreBackup(tampered, PASS, 'merge')).rejects.toThrow();
  });

  it('rejects a structurally corrupt envelope before decrypting', async () => {
    const bad = new Blob(['{"manifest":{}}'], { type: 'application/json' });
    await expect(restoreBackup(bad, PASS, 'merge')).rejects.toThrow();
    const notJson = new Blob(['not json'], { type: 'application/json' });
    await expect(previewRestore(notJson, PASS)).rejects.toThrow();
  });

  it('merge skips duplicates; replace wipes first', async () => {
    const e = makeEntry({ bodyText: 'keep me' });
    await saveEntryWithAudio(e);
    const { blob } = await exportBackup(PASS);

    const preview = await previewRestore(blob, PASS);
    expect(preview.duplicateIds).toContain(e.id);
    expect(preview.newEntryCount).toBe(0);

    const merged = await restoreBackup(blob, PASS, 'merge');
    expect(merged.skippedDuplicates).toBe(1);
    expect(merged.restoredEntries).toBe(0);

    // Add a second device-side entry, then replace-restore: it must disappear.
    await saveEntryWithAudio(makeEntry({ bodyText: 'device-only' }));
    const replaced = await restoreBackup(blob, PASS, 'replace');
    expect(replaced.restoredEntries).toBe(1);
    const all = await db.entries.toArray();
    expect(all.map((x) => x.bodyText).sort()).toEqual(['keep me']);
  });

  it('aborts restore when an audio integrity hash mismatches', async () => {
    const e = makeEntry();
    const a = makeAudio(e.id, new Uint8Array([9, 9, 9]));
    a.integrityHash = '0'.repeat(64); // deliberately wrong
    e.audioBlobId = a.id;
    await saveEntryWithAudio(e, a);
    const { blob } = await exportBackup(PASS);
    await db.entries.clear();
    await db.audio.clear();
    await expect(restoreBackup(blob, PASS, 'replace')).rejects.toThrow(/integrity/i);
    // Nothing partial was written.
    expect(await db.entries.count()).toBe(0);
  });

  it('requires a passphrase of at least 8 characters', async () => {
    await expect(exportBackup('short')).rejects.toThrow(/8 characters/);
  });
});
