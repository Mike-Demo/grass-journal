import { describe, expect, it } from 'vitest';
import { deterministicReflection, extractTags } from '../deterministic';

describe('extractTags', () => {
  it('is deterministic and ignores stopwords', () => {
    const text = 'Walked through the garden. The garden was quiet and the garden smelled like rain.';
    const a = extractTags(text);
    const b = extractTags(text);
    expect(a).toEqual(b);
    expect(a).toContain('garden');
    expect(a).not.toContain('the');
    expect(a.length).toBeLessThanOrEqual(5);
  });

  it('returns empty for empty input', () => {
    expect(extractTags('')).toEqual([]);
  });

  it('never invents emotions or diagnoses', () => {
    const tags = extractTags('I feel terrible and broken today, everything is awful');
    // Heuristic only surfaces words actually present.
    for (const t of tags) {
      expect('i feel terrible and broken today, everything is awful'.includes(t)).toBe(true);
    }
  });
});

describe('deterministicReflection', () => {
  it('labels itself as the deterministic fallback', () => {
    const r = deterministicReflection('Ate soup. It was warm.');
    expect(r.model).toBe('deterministic-fallback');
    expect(r.userEdited).toBe(false);
    expect(r.promptVersion).toBe('reflect-v1');
    expect(typeof r.generatedAt).toBe('number');
  });

  it('handles empty entries without crashing', () => {
    const r = deterministicReflection('   ');
    expect(r.summary).toBeTruthy();
    expect(r.tags).toEqual([]);
  });
});
