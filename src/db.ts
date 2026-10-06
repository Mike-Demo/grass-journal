import Dexie, { type Table } from 'dexie';
import type { AppSettings, AudioRecord, JournalEntry, ModelInstall } from './lib/types';
import { SCHEMA_VERSION } from './lib/types';

/**
 * IndexedDB via Dexie. Journal DATA lives here only — never in the HTTP cache.
 * Entry + audio are always written in a single transaction (principle 1: never
 * lose the original entry; principle 5: audio saved before transcription).
 */
export class GrassJournalDB extends Dexie {
  entries!: Table<JournalEntry, string>;
  audio!: Table<AudioRecord, string>;
  settings!: Table<AppSettings, string>;
  models!: Table<ModelInstall, string>;

  constructor() {
    super('grass-journal');
    this.version(1).stores({
      entries: 'id, createdAt, entryType, favorite, deletedAt',
      audio: 'id, journalEntryId, createdAt',
      settings: 'key',
      models: 'modelId',
    });
  }
}

export const db = new GrassJournalDB();

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  schemaVersion: SCHEMA_VERSION,
  theme: 'system',
  transcriptionModel: 'whisper-tiny-en',
  reflectionModel: 'qwen2.5-0.5b-instruct',
  aiEnabled: false,
  backupReminder: true,
  privacyAcknowledged: false,
  compactMode: 'auto',
  onboardingDone: false,
};

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app');
  if (s) return { ...DEFAULT_SETTINGS, ...s, key: 'app' };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch, key: 'app' as const };
  await db.settings.put(next);
  return next;
}

/** Atomic save of an entry and (optionally) its audio record. */
export async function saveEntryWithAudio(
  entry: JournalEntry,
  audio?: AudioRecord,
): Promise<void> {
  await db.transaction('rw', db.entries, db.audio, async () => {
    if (audio) await db.audio.put(audio);
    await db.entries.put(entry);
  });
}

/** Soft delete keeps the record recoverable from backup until "Delete all data". */
export async function softDeleteEntry(id: string): Promise<void> {
  await db.entries.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function hardDeleteEntry(id: string): Promise<void> {
  await db.transaction('rw', db.entries, db.audio, async () => {
    await db.audio.where('journalEntryId').equals(id).delete();
    await db.entries.delete(id);
  });
}

export async function listEntries(): Promise<JournalEntry[]> {
  // deletedAt is optional; filter in code rather than relying on index semantics.
  return db.entries
    .orderBy('createdAt')
    .reverse()
    .filter((e) => e.deletedAt == null)
    .toArray();
}

export async function searchEntries(query: string): Promise<JournalEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listEntries();
  const all = await listEntries();
  return all.filter(
    (e) =>
      e.bodyText.toLowerCase().includes(q) ||
      (e.title ?? '').toLowerCase().includes(q) ||
      (e.transcriptText ?? '').toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)),
  );
}
