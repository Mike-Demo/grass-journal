# Model Licenses

Grass Journal **does not bundle model weights**. Models download on explicit
user install from public CDNs. Their licenses apply to the weights, not to this
codebase (MIT).

## Transcription — Whisper Tiny English

- **Model:** `Xenova/whisper-tiny.en` (ONNX conversion of OpenAI Whisper tiny.en)
- **Upstream:** OpenAI Whisper — **MIT License**
- **Conversion:** Xenova / Hugging Face Transformers.js ecosystem
- **Size:** ~150 MB (approximate)
- **Notes:** English-only. Demonstration-grade accuracy; the adapter supports
  swapping in a multilingual tiny model later.

## Reflection — Qwen2.5 0.5B Instruct (quantized)

- **Model:** `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (MLC compilation)
- **Upstream:** Qwen2.5 — **Apache 2.0 License**
- **Runtime:** Apache TVM / MLC-LLM stack via WebLLM (Apache 2.0)
- **Size:** ~450 MB (approximate)
- **Notes:** Requires WebGPU. Runs fully in a Web Worker; no data leaves the device.

## Reflection (alternative) — Gemma 2 2B IT (quantized)

- **Model:** `gemma-2-2b-it-q4f16_1-MLC` (MLC compilation)
- **Upstream:** Gemma 2 — **Gemma Terms of Use** (Google; not Apache 2.0 — review the terms before redistributing weights)
- **Runtime:** Apache TVM / MLC-LLM stack via WebLLM (Apache 2.0)
- **Size:** ~1.5 GB (approximate)
- **Notes:** Requires WebGPU. User-selectable alternative to Qwen2.5 on the AI setup screen; Qwen remains the default.

## Runtime libraries (bundled with the app)

| Library | License |
|---|---|
| Transformers.js (`@huggingface/transformers`) | Apache 2.0 |
| WebLLM (`@mlc-ai/web-llm`) | Apache 2.0 |
| Dexie.js | Apache 2.0 |
| React | MIT |
| Vite / vite-plugin-pwa / Vitest | MIT |

Full texts live in the respective upstream repositories. If a license changes
upstream, update this file and the AI Setup screen copy.
