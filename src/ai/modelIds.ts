/** Model identifiers shared between workers and their clients (no heavy imports here). */
export const TRANSCRIBE_MODEL_ID = 'Xenova/whisper-tiny.en';

export interface ReflectionModelOption {
  /** Settings + db.models key, e.g. 'qwen2.5-0.5b-instruct'. */
  id: string;
  /** WebLLM prebuilt model id used to load the engine. */
  webllmId: string;
  title: string;
  description: string;
  approxSize: string;
  approxBytes: number;
}

export const REFLECTION_MODELS: ReflectionModelOption[] = [
  {
    id: 'qwen2.5-0.5b-instruct',
    webllmId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    title: 'Qwen2.5 0.5B Instruct',
    description:
      'Compact and quick to download. Writes a short neutral summary, tags, themes, and one optional question — from the selected entry only.',
    approxSize: '~450 MB',
    approxBytes: 450 * 1024 * 1024,
  },
  {
    id: 'gemma-2-2b-it',
    webllmId: 'gemma-2-2b-it-q4f16_1-MLC',
    title: 'Gemma 2 2B IT',
    description:
      "Google's open-weight model. A larger download that often writes richer reflections. Same job: summary, tags, themes, one optional question — all on-device.",
    approxSize: '~1.5 GB',
    approxBytes: 1536 * 1024 * 1024,
  },
];

export const DEFAULT_REFLECTION_MODEL_ID = 'qwen2.5-0.5b-instruct';

/** Resolve a stored reflection model id, falling back to the default. */
export function getReflectionModel(id: string | undefined): ReflectionModelOption {
  return (
    REFLECTION_MODELS.find((m) => m.id === id) ??
    REFLECTION_MODELS.find((m) => m.id === DEFAULT_REFLECTION_MODEL_ID)!
  );
}
