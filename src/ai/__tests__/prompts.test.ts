import { describe, expect, it } from 'vitest';
import { buildReflectMessages, buildReflectRepairMessages, REFLECT_PROMPT_VERSION } from '../prompts';

describe('reflect prompts', () => {
  it('keeps the prompt version stable', () => {
    expect(REFLECT_PROMPT_VERSION).toBe('reflect-v1');
  });

  it('builds messages containing only the supplied entry text', () => {
    const msgs = buildReflectMessages('my private thoughts');
    expect(msgs.length).toBe(2);
    expect(msgs[1].content).toContain('my private thoughts');
    expect(msgs[1].content).toMatch(/ONLY the JSON object/i);
  });

  it('builds a repair prompt that quotes the bad reply and demands JSON only', () => {
    const msgs = buildReflectRepairMessages('oops not json');
    expect(msgs[1].content).toContain('oops not json');
    expect(msgs[1].content).toMatch(/not valid JSON/i);
    expect(msgs[1].content).toMatch(/No prose, no code fences/i);
  });
});
