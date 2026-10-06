/**
 * Reflection Web Worker — WebLLM, quantized Qwen2.5 0.5B Instruct.
 * Receives ONLY the selected entry's text. Nothing else from the journal is
 * visible here, and nothing is sent anywhere: WebLLM runs fully in this worker.
 */
/// <reference lib="webworker" />

import { CreateMLCEngine, type MLCEngineInterface } from '@mlc-ai/web-llm';
import { REFLECT_GEN_PARAMS } from './prompts';
import { REFLECT_MODEL_ID } from './modelIds';

type InMsg =
  | { type: 'init' }
  | { type: 'reflect'; messages: { role: string; content: string }[] }
  | { type: 'reflect-repair'; messages: { role: string; content: string }[] };

type OutMsg =
  | { type: 'progress'; progress: number; detail?: string }
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string };

let engine: MLCEngineInterface | null = null;

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const post = (m: OutMsg) => (self as unknown as { postMessage(m: OutMsg): void }).postMessage(m);
  const msg = e.data;
  try {
    if (!engine) {
      post({ type: 'progress', progress: 0, detail: 'loading engine' });
      engine = await CreateMLCEngine(REFLECT_MODEL_ID, {
        initProgressCallback: (p: { progress?: number; text?: string }) => {
          post({ type: 'progress', progress: Math.round((p.progress ?? 0) * 100), detail: p.text });
        },
        logLevel: 'SILENT',
      });
    }
    post({ type: 'ready' });
    if (msg.type === 'reflect' || msg.type === 'reflect-repair') {
      // NOTE: no `response_format: json_object` — WebLLM's grammar matcher
      // (xgrammar WASM) fails to initialize on iOS WebKit
      // ("Cannot pass non-string to std::string"). We instruct JSON in the
      // prompt and schema-validate the reply instead; the client retries once
      // with a repair prompt when parsing fails.
      const reply = await engine.chat.completions.create({
        messages: msg.messages as { role: 'user' | 'system' | 'assistant'; content: string }[],
        temperature: REFLECT_GEN_PARAMS.temperature,
        max_tokens: REFLECT_GEN_PARAMS.max_tokens,
      });
      const text = reply.choices[0]?.message?.content ?? '';
      post({ type: 'result', text: typeof text === 'string' ? text : '' });
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

export {};
