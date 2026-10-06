/**
 * Grass Journal — versioned data schema (schemaVersion: 1).
 *
 * Principle: original content is authoritative; AI output is optional metadata.
 * Nothing here ever leaves the device except inside an encrypted backup file
 * the user explicitly exports.
 */

export const SCHEMA_VERSION = 1;

export type EntryType = 'text' | 'voice' | 'mixed' | 'mood';

export type TranscriptStatus =
  | 'none' // no audio / not applicable
  | 'not-started' // audio exists, transcription never attempted
  | 'transcribing'
  | 'done'
  | 'failed'
  | 'unsupported';

export interface Reflection {
  summary: string;
  tags: string[];
  themes: string[];
  reflectionQuestion: string;
  /** Model id that generated it, e.g. "Qwen2.5-0.5B-Instruct-q4f16_1-MLC". "deterministic-fallback" for the local heuristic. */
  model: string;
  /** Versioned system prompt id, e.g. "reflect-v1". */
  promptVersion: string;
  generatedAt: number;
  /** True once the user edits the AI text. */
  userEdited: boolean;
}

export interface JournalEntry {
  id: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  entryType: EntryType;
  title?: string;
  /** Original user-written text. Authoritative. Never overwritten by AI. */
  bodyText: string;
  audioBlobId?: string;
  audioMimeType?: string;
  audioDuration?: number;
  transcriptText?: string;
  transcriptStatus: TranscriptStatus;
  transcriptionModel?: string;
  reflection?: Reflection;
  tags: string[];
  favorite: boolean;
  /** Soft delete: hidden from lists, restorable via backup, purged on "Delete all data". */
  deletedAt?: number;
}

export interface AudioRecord {
  id: string;
  journalEntryId: string;
  blob: Blob;
  mimeType: string;
  byteLength: number;
  /** Seconds, rounded to 0.1. */
  duration: number;
  createdAt: number;
  /** SHA-256 hex of the raw bytes, where practical. Verified on restore. */
  integrityHash?: string;
}

export type ThemeName = 'system' | 'light' | 'dark';

export interface AppSettings {
  key: 'app';
  schemaVersion: number;
  theme: ThemeName;
  transcriptionModel: string; // e.g. "whisper-tiny-en"
  reflectionModel: string; // e.g. "qwen2.5-0.5b-instruct"
  aiEnabled: boolean;
  backupReminder: boolean;
  lastSuccessfulExportAt?: number;
  privacyAcknowledged: boolean;
  compactMode: 'auto' | 'on' | 'off';
  onboardingDone: boolean;
}

export type ModelStatus =
  | 'not-installed'
  | 'downloading'
  | 'ready'
  | 'failed'
  | 'unsupported';

export interface ModelInstall {
  modelId: string; // "whisper-tiny-en" | "qwen2.5-0.5b-instruct" | "gemma-2-2b-it"
  modelType: 'transcription' | 'reflection';
  status: ModelStatus;
  installedAt?: number;
  approximateBytes?: number;
  engine?: string; // "transformers.js" | "web-llm"
  lastVerifiedAt?: number;
  error?: string;
}

/** Versioned backup manifest (authenticated inside the encrypted payload). */
export interface BackupManifest {
  format: 'grass-journal-backup';
  version: 1;
  appVersion: string;
  exportedAt: number;
  entryCount: number;
  audioCount: number;
  /** SHA-256 hex over the canonical payload bytes (defense in depth; AES-GCM already authenticates). */
  contentHash: string;
}
