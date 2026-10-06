/**
 * Transcription client (main thread). Spawns the worker, forwards audio, and
 * reports progress. Audio is passed by transferable copy — it never touches
 * the network.
 */
import { TRANSCRIBE_MODEL_ID } from './modelIds';

export type TranscribeEvents = {
  onProgress: (stage: 'init' | 'download' | 'transcribe', progress: number, detail?: string) => void;
};

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./transcription.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function terminateTranscriptionWorker() {
  worker?.terminate();
  worker = null;
}

/** Manually initiated transcription of a single audio sample. */
export function transcribeAudio(
  audio: Float32Array,
  events: TranscribeEvents,
  modelId: string = TRANSCRIBE_MODEL_ID,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      const m = e.data as
        | { type: 'progress'; stage: 'init' | 'download' | 'transcribe'; progress: number; detail?: string }
        | { type: 'ready'; modelId: string }
        | { type: 'result'; text: string; modelId: string }
        | { type: 'error'; message: string };
      if (m.type === 'progress') events.onProgress(m.stage, m.progress, m.detail);
      else if (m.type === 'result') {
        w.removeEventListener('message', onMessage);
        resolve(m.text);
      } else if (m.type === 'error') {
        w.removeEventListener('message', onMessage);
        reject(new Error(m.message));
      }
    };
    w.addEventListener('message', onMessage);
    // Transfer the buffer: zero-copy handoff, and the main thread loses access.
    w.postMessage({ type: 'transcribe', audio, modelId }, [audio.buffer as ArrayBuffer]);
  });
}

/** Warm the model (download + init) without transcribing — used by AI Setup. */
export function initTranscriptionModel(
  events: TranscribeEvents,
  modelId: string = TRANSCRIBE_MODEL_ID,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type: string; stage?: 'init' | 'download' | 'transcribe'; progress?: number; detail?: string; message?: string };
      if (m.type === 'progress') events.onProgress(m.stage ?? 'init', m.progress ?? 0, m.detail);
      else if (m.type === 'ready') {
        w.removeEventListener('message', onMessage);
        resolve();
      } else if (m.type === 'error') {
        w.removeEventListener('message', onMessage);
        reject(new Error(m.message ?? 'Model failed to load.'));
      }
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ type: 'init', modelId });
  });
}
