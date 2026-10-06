/**
 * Transcription Web Worker — Transformers.js, Whisper tiny.en.
 * Audio never leaves this worker; there is no network call here at all.
 *
 * Adapter design: the message protocol below is engine-agnostic, so the
 * Transformers.js implementation can be swapped for browser-whisper (or a
 * multilingual whisper-tiny) later without touching the UI.
 */
/// <reference lib="webworker" />

import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { TRANSCRIBE_MODEL_ID } from './modelIds';
import { clampPercent, isIOS } from './progress';

type InMsg =
  | { type: 'init'; modelId?: string }
  | { type: 'transcribe'; audio: Float32Array; modelId?: string };

type OutMsg =
  | { type: 'progress'; stage: 'init' | 'download' | 'transcribe'; progress: number; detail?: string }
  | { type: 'ready'; modelId: string }
  | { type: 'result'; text: string; modelId: string }
  | { type: 'error'; message: string };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let currentModel = '';

async function getPipeline(modelId: string) {
  if (transcriber && currentModel === modelId) return transcriber;
  const post = (m: OutMsg) => (self as unknown as { postMessage(m: OutMsg): void }).postMessage(m);
  // iOS WebGPU is brand-new and unproven for this workload; WASM is the
  // conservative path there. Elsewhere, prefer WebGPU when present.
  const device = !isIOS() && (self as unknown as { navigator?: { gpu?: unknown } }).navigator?.gpu
    ? 'webgpu'
    : 'wasm';
  transcriber = (await pipeline('automatic-speech-recognition', modelId, {
    device: device as 'webgpu' | 'wasm',
    progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
      // v4 reports progress 0–100 per file ('progress') and aggregate
      // ('progress_total'); 'done'/'ready' mark completion.
      if (info.status === 'progress' || info.status === 'progress_total') {
        post({ type: 'progress', stage: 'download', progress: clampPercent(info.progress), detail: info.file });
      } else if (info.status === 'done' || info.status === 'ready') {
        post({ type: 'progress', stage: 'download', progress: 100, detail: info.file ?? 'finalizing' });
      }
    },
  } as never)) as unknown as AutomaticSpeechRecognitionPipeline;
  currentModel = modelId;
  return transcriber;
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const post = (m: OutMsg) => (self as unknown as { postMessage(m: OutMsg): void }).postMessage(m);
  const msg = e.data;
  try {
    if (msg.type === 'init' || msg.type === 'transcribe') {
      const modelId = msg.modelId ?? TRANSCRIBE_MODEL_ID;
      post({ type: 'progress', stage: 'init', progress: 0, detail: modelId });
      const pipe = await getPipeline(modelId);
      post({ type: 'ready', modelId });
      if (msg.type === 'transcribe') {
        post({ type: 'progress', stage: 'transcribe', progress: 0 });
        const out = (await pipe(msg.audio, {
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: false,
        } as never)) as unknown as { text?: string } | { text?: string }[];
        const text = Array.isArray(out)
          ? out.map((c) => c.text ?? '').join(' ')
          : (out.text ?? '');
        post({ type: 'result', text: text.trim(), modelId });
      }
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

export {};
