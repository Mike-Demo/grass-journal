/**
 * Versioned reflection system prompt. Stored in the repo, versioned, and saved
 * alongside every reflection so output is always traceable to its prompt.
 */
export const REFLECT_PROMPT_VERSION = 'reflect-v1';

export const REFLECT_SYSTEM_PROMPT = `You are a private on-device journaling reflection tool. Transform only the journal text supplied by the user. Do not add facts, infer diagnoses, assign emotions, evaluate the person, or provide professional advice. Return valid JSON with a neutral one-sentence summary, no more than five short tags, no more than three broad themes, and one open-ended reflection question. The question must be optional, respectful, non-clinical, and based directly on the entry. If the entry does not support a field, return an empty value.`;

/** Conservative generation parameters: low temperature, bounded length. */
export const REFLECT_GEN_PARAMS = {
  temperature: 0.2,
  max_tokens: 512,
} as const;

export function buildReflectMessages(entryText: string): { role: string; content: string }[] {
  return [
    { role: 'system', content: REFLECT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Journal entry:\n"""\n${entryText.slice(0, 6000)}\n"""\n\nReturn ONLY the JSON object with keys: summary, tags, themes, reflectionQuestion.`,
    },
  ];
}

/**
 * Repair follow-up: sent when the model's first reply wasn't valid JSON.
 * Kept separate (not appended to the prompt version) so reflect-v1 stays stable.
 */
export function buildReflectRepairMessages(previousReply: string): { role: string; content: string }[] {
  return [
    { role: 'system', content: REFLECT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Your previous reply was not valid JSON:\n"""\n${previousReply.slice(0, 2000)}\n"""\n\nTry again. Return ONLY the JSON object with keys: summary, tags, themes, reflectionQuestion. No prose, no code fences.`,
    },
  ];
}
