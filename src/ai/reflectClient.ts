/**
 * Reflection client (main thread).
 *
 * Privacy rule enforced here: buildReflectMessages() receives exactly one
 * entry's text. The worker is constructed fresh per call so no journal state
 * can leak between reflections.
 *
 * JSON robustness without the grammar backend: WebLLM's xgrammar WASM matcher
 * fails to initialize on iOS WebKit, so we instruct JSON in the prompt,
 * schema-validate the reply, and retry once with a repair prompt on failure.
 */
import { buildReflectMessages, buildReflectRepairMessages, REFLECT_PROMPT_VERSION } from './prompts';
import { parseReflectionJson, type ValidatedReflection } from '../lib/validation';
import { deterministicReflection } from './deterministic';
import { getReflectionModel } from './modelIds';
import { getSettings } from '../db';
import type { Reflection } from '../lib/types';

export type ReflectEvents = {
  onProgress: (progress: number, detail?: string) => void;
};

type WorkerOut =
  | { type: 'progress'; progress: number; detail?: string }
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string };

/** Load the selected model into a fresh worker. Resolves when ready. */
function initWorker(
  worker: Worker,
  webllmId: string,
  events: ReflectEvents,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data as WorkerOut;
      if (m.type === 'progress') events.onProgress(m.progress, m.detail);
      else if (m.type === 'ready') {
        worker.removeEventListener('message', onMessage);
        resolve();
      } else if (m.type === 'error') {
        worker.removeEventListener('message', onMessage);
        reject(new Error(m.message));
      }
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ type: 'init', webllmId });
  });
}

function askWorker(
  worker: Worker,
  kind: 'reflect' | 'reflect-repair',
  messages: { role: string; content: string }[],
  events: ReflectEvents,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data as WorkerOut;
      if (m.type === 'progress') events.onProgress(m.progress, m.detail);
      else if (m.type === 'result') {
        worker.removeEventListener('message', onMessage);
        resolve(m.text);
      } else if (m.type === 'error') {
        worker.removeEventListener('message', onMessage);
        reject(new Error(m.message));
      }
    };
    worker.addEventListener('message', onMessage);
    // Only this entry's text crosses the boundary — never the whole journal.
    worker.postMessage({ type: kind, messages });
  });
}

export class ReflectionClient {
  /** Generate a reflection for ONE entry's text using the local LLM. */
  async reflect(entryText: string, events: ReflectEvents): Promise<Reflection> {
    const text = entryText.trim();
    if (!text) throw new Error('Nothing to reflect on yet.');
    const option = getReflectionModel((await getSettings()).reflectionModel);
    const worker = new Worker(new URL('./reflection.worker.ts', import.meta.url), { type: 'module' });
    try {
      await initWorker(worker, option.webllmId, events);
      const raw = await askWorker(worker, 'reflect', buildReflectMessages(text), events);
      let parsed: ValidatedReflection | null = parseReflectionJson(raw);
      if (!parsed) {
        // One repair attempt with the same loaded engine — cheap, no re-download.
        events.onProgress(0, 'Repairing JSON…');
        const retry = await askWorker(worker, 'reflect-repair', buildReflectRepairMessages(raw), events);
        parsed = parseReflectionJson(retry);
      }
      if (!parsed) throw new Error('The model returned invalid JSON twice. Nothing was saved — try again or use the simple on-device tags.');
      return {
        ...parsed,
        model: option.id,
        promptVersion: REFLECT_PROMPT_VERSION,
        generatedAt: Date.now(),
        userEdited: false,
      };
    } finally {
      worker.terminate();
    }
  }

  /** Offline-safe fallback: clearly labeled, no model involved. */
  reflectDeterministic(entryText: string): Reflection {
    return deterministicReflection(entryText);
  }
}

export const reflectionClient = new ReflectionClient();
