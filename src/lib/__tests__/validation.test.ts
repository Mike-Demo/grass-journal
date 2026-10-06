import { describe, expect, it } from 'vitest';
import { parseReflectionJson, journalEntrySchema, backupEnvelopeSchema } from '../validation';

describe('parseReflectionJson', () => {
  const valid = JSON.stringify({
    summary: 'A quiet morning walk.',
    tags: ['walk', 'morning'],
    themes: ['nature'],
    reflectionQuestion: 'What did the quiet make room for?',
  });

  it('accepts valid model JSON', () => {
    const r = parseReflectionJson(valid);
    expect(r).not.toBeNull();
    expect(r!.summary).toBe('A quiet morning walk.');
    expect(r!.tags).toEqual(['walk', 'morning']);
  });

  it('tolerates ```json fences', () => {
    const r = parseReflectionJson('```json\n' + valid + '\n```');
    expect(r).not.toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(parseReflectionJson('not json at all')).toBeNull();
  });

  it('rejects schema violations (too many tags, wrong types)', () => {
    const bad = JSON.stringify({
      summary: 'x',
      tags: ['a', 'b', 'c', 'd', 'e', 'f'], // max 5
      themes: [],
      reflectionQuestion: '',
    });
    expect(parseReflectionJson(bad)).toBeNull();
    const wrongType = JSON.stringify({ summary: 42, tags: [], themes: [], reflectionQuestion: '' });
    expect(parseReflectionJson(wrongType)).toBeNull();
  });

  it('trims whitespace from fields', () => {
    const r = parseReflectionJson(JSON.stringify({
      summary: '  hi  ', tags: [' a ', ''], themes: [], reflectionQuestion: '',
    }));
    expect(r!.summary).toBe('hi');
    expect(r!.tags).toEqual(['a']);
  });
});

describe('journalEntrySchema', () => {
  const base = {
    id: 'e1',
    schemaVersion: 1,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    entryType: 'text',
    bodyText: 'hello',
    transcriptStatus: 'none',
    tags: [],
    favorite: false,
  };

  it('accepts a minimal valid entry', () => {
    expect(journalEntrySchema.safeParse(base).success).toBe(true);
  });

  it('rejects unknown entry types and oversized bodies', () => {
    expect(journalEntrySchema.safeParse({ ...base, entryType: 'video' }).success).toBe(false);
    expect(journalEntrySchema.safeParse({ ...base, bodyText: 'x'.repeat(200_001) }).success).toBe(false);
  });

  it('rejects a reflection that violates the AI schema', () => {
    const withBadReflection = {
      ...base,
      reflection: {
        summary: 's', tags: ['a','b','c','d','e','f'], themes: [], reflectionQuestion: '',
        model: 'm', promptVersion: 'reflect-v1', generatedAt: 1, userEdited: false,
      },
    };
    expect(journalEntrySchema.safeParse(withBadReflection).success).toBe(false);
  });
});

describe('backupEnvelopeSchema', () => {
  it('rejects envelopes with wrong format/version', () => {
    expect(backupEnvelopeSchema.safeParse({ manifest: { format: 'nope', version: 1 } }).success).toBe(false);
  });
});
