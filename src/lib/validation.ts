import { z } from 'zod';
import { SCHEMA_VERSION } from './types';

/** Zod schemas: validate AI JSON, imported backups, and entries before save. */

export const reflectionSchema = z.object({
  summary: z.string().max(500),
  tags: z.array(z.string().max(60)).max(5),
  themes: z.array(z.string().max(80)).max(3),
  reflectionQuestion: z.string().max(500),
});

export type ValidatedReflection = z.infer<typeof reflectionSchema>;

/** Parse and sanitize model JSON output. Never throws: returns null on failure. */
export function parseReflectionJson(raw: string): ValidatedReflection | null {
  try {
    // Tolerate ```json fences some models emit.
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    const result = reflectionSchema.safeParse(parsed);
    if (!result.success) return null;
    return {
      summary: result.data.summary.trim(),
      tags: result.data.tags.map((t) => t.trim()).filter(Boolean),
      themes: result.data.themes.map((t) => t.trim()).filter(Boolean),
      reflectionQuestion: result.data.reflectionQuestion.trim(),
    };
  } catch {
    return null;
  }
}

export const journalEntrySchema = z.object({
  id: z.string().min(1).max(64),
  schemaVersion: z.number().int().min(1),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  entryType: z.enum(['text', 'voice', 'mixed', 'mood']),
  title: z.string().max(200).optional(),
  bodyText: z.string().max(200_000),
  audioBlobId: z.string().optional(),
  audioMimeType: z.string().max(120).optional(),
  audioDuration: z.number().nonnegative().optional(),
  transcriptText: z.string().max(200_000).optional(),
  transcriptStatus: z.enum(['none', 'not-started', 'transcribing', 'done', 'failed', 'unsupported']),
  transcriptionModel: z.string().max(120).optional(),
  reflection: z
    .object({
      summary: z.string().max(500),
      tags: z.array(z.string().max(60)).max(5),
      themes: z.array(z.string().max(80)).max(3),
      reflectionQuestion: z.string().max(500),
      model: z.string().max(120),
      promptVersion: z.string().max(40),
      generatedAt: z.number().int().positive(),
      userEdited: z.boolean(),
    })
    .optional(),
  tags: z.array(z.string().max(60)).max(30),
  favorite: z.boolean(),
  deletedAt: z.number().int().positive().optional(),
});

export const backupManifestSchema = z.object({
  format: z.literal('grass-journal-backup'),
  version: z.literal(1),
  appVersion: z.string().max(40),
  exportedAt: z.number().int().positive(),
  entryCount: z.number().int().nonnegative(),
  audioCount: z.number().int().nonnegative(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export const backupEnvelopeSchema = z.object({
  manifest: backupManifestSchema,
  crypto: z.object({
    kdf: z.literal('PBKDF2-SHA256'),
    iterations: z.number().int().min(100_000),
    salt: z.string().min(16), // base64
    iv: z.string().min(12), // base64
  }),
  ciphertext: z.string().min(32), // base64
});

export const backupPayloadSchema = z.object({
  entries: z.array(journalEntrySchema).max(50_000),
  audio: z.array(
    z.object({
      id: z.string().min(1).max(64),
      journalEntryId: z.string().min(1).max(64),
      mimeType: z.string().max(120),
      byteLength: z.number().int().nonnegative(),
      duration: z.number().nonnegative(),
      createdAt: z.number().int().positive(),
      integrityHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
      dataBase64: z.string().max(500_000_000),
    }),
  ).max(50_000),
  settings: z
    .object({
      theme: z.enum(['system', 'light', 'dark']).optional(),
      backupReminder: z.boolean().optional(),
    })
    .optional(),
  exportedAt: z.number().int().positive(),
});

export function newEntryId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isValidEntry(e: unknown): boolean {
  const r = journalEntrySchema.safeParse(e);
  return r.success && (r.data as { schemaVersion: number }).schemaVersion <= SCHEMA_VERSION;
}
