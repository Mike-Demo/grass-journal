# Grass Journal — Day-1 Technical Spikes

Date: 2026-10-05. Spikes run as desk research against npm registry, Hugging Face Hub,
and project docs (no live inference benchmarked yet — see open risks).

## Spike 1 — Local transcription library

### 1a. `browser-whisper` (prototype candidate)

- npm: `browser-whisper` **1.1.0**, published **2026-05-31**, 13 versions, MIT,
  repo `tanpreetjolly/browser-whisper` (~175 stars).
- It is itself a thin wrapper: "No peer dependencies — `mediabunny` and
  `@huggingface/transformers` are used inside the library's workers."
- Its README documents the risks the product spec anticipated as real:
  - **COOP/COEP headers required** ("Threaded WASM needs cross-origin isolation"):
    `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin`
    must be served with every response (Vite server/preview config, Vercel `vercel.json`).
  - Troubleshooting docs cover `crossOriginIsolated === false`, failed model fetches
    from `cdn.jsdelivr.net`, blob-URL worker CSP conflicts — i.e. the library couples
    transcription to deployment-header and CSP configuration we would have to own anyway.
  - Demo app README last updated ~205 days ago (early 2026); library not updated since May 2026.
- Maintenance risk: single-maintainer project, small star count, and it pins/embeds its own
  `@huggingface/transformers` copy inside its workers — version control of the runtime is
  not ours.

### 1b. Hugging Face Transformers.js (direct, v4 line)

- `@xenova/transformers` is **stale** (latest 2.17.2, published 2024-05-29) — do not use.
  The successor is **`@huggingface/transformers`**, **4.3.0** published **2026-09-16**
  (Apache-2.0).
- Whisper support: `automatic-speech-recognition` pipeline with ONNX checkpoints;
  `Xenova/whisper-tiny.en` exists on the Hub (last modified 2025-12-16); WebGPU path is
  `pipeline("automatic-speech-recognition", "<model>", { device: "webgpu" })`, with automatic
  WASM fallback.
- Web Worker: the documented production pattern is to run pipelines inside a Worker
  (`whisper-web` / standard worker-thread examples); main thread only passes audio in/out.
- Model caching: downloaded files (tokenizer, ONNX weights) are stored in browser Cache
  Storage / IndexedDB by the runtime after first fetch — no manual persistence layer needed.
- COOP/COEP: **multithreaded WASM still needs cross-origin isolation** (`SharedArrayBuffer`),
  same as via browser-whisper. Mitigation: use WebGPU-first (no SAB needed), fall back to
  single-threaded WASM (~2x slower) when headers can't be served, or serve headers from our
  own Vite/static host. This is inherent to the runtime, not the wrapper.
- Size: Whisper Tiny ONNX English ≈ **~75–150 MB** (HF checkpoint incl. tokenizer/config);
  Base ≈ ~145 MB. (Spec estimate of ~150 MB incl. ONNX is consistent.)
- Multilingual adapter note: the same pipeline API works with `whisper-tiny` (multilingual);
  the adapter interface takes a model ID, so multilingual is a future model-ID swap.

### Spike 1 verdict

**Use `@huggingface/transformers` (v4.3.0) directly behind a swappable adapter interface,
NOT browser-whisper.** browser-whisper adds a wrapper around the same runtime while keeping
all the deployment/header/CSP risks and adding single-maintainer version-pinning risk.
We own the thin `TranscriptionEngine` interface (load / transcribe(Float32Array 16kHz mono) /
dispose / progress events), so the model ID and backend can change later without touching
the UI or storage layers. Transcription is manually initiated and runs in a Web Worker;
audio is committed to IndexedDB before transcription starts (principle 5).

## Spike 2 — Local reflection via WebLLM

- `@mlc-ai/web-llm` **0.2.85**, published **2026-09-08** — actively maintained (0.2.x series).
- Worker API: `CreateMLCEngine(modelId, { initProgressCallback }, webWorker?)` /
  `CreateWebWorkerMLCEngine(new Worker(...), modelId)` — engine lives in the Worker;
  chat via `engine.chat.completions.create({ messages, response_format: { type: "json_object" } })`.
  `response_format: json_object` is supported (verified in WebLLM docs/changelog).
- Model: **`Qwen2.5-0.5B-Instruct-q4f16_1-MLC`** exists in WebLLM's prebuilt app config.
  Weights + tokenizer + WebGPU WASM library ≈ **~400–500 MB** download
  (community packaging reports ~400 MB for Qwen 0.5B alone).
- Requirements: WebGPU (`navigator.gpu`); **iOS Safari has no WebGPU**, so reflection is
  unavailable on iPhones/iPads — the app must degrade gracefully there. ~90%+ availability
  on evergreen Chrome/Edge desktop; patchy on mobile/Android.
- GPU OOM is a real failure mode on low-VRAM devices — wrap engine load in try/catch and
  fall back.
- Generation plan: versioned system prompt in-repo, low `max_tokens`, temperature 0,
  schema validation of the JSON against the Reflection schema before saving; result is
  labeled AI-generated with model ID + prompt version. **Only the selected entry's text is
  passed — never the full journal.**
- Fallback (spec-required): if WebGPU or resources are unavailable, reflection is disabled
  with an honest explanation, and the app offers **deterministic local tag extraction**
  (regex/keyword based, runs on main thread, no model). **Never a remote model.**

### Spike 2 verdict

**WebLLM 0.2.85 + `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` is the reflection path, WebGPU-gated,
worker-hosted, manually initiated, with deterministic-tag-extraction fallback.**
Journal text/reflection UI works fully without it (principle 3). iOS/Safari users get the
fallback, not a broken loader.

## Cross-cutting findings

- **Model download hosts to allowlist / plan for:** `huggingface.co` (both engines),
  `cdn.jsdelivr.net` (ORT WASM runtime assets used by Transformers.js).
  Privacy verification must treat *model-asset downloads during installation* as allowed
  and flag any other request carrying journal content.
- **Sizes (one-time, cached in browser):** Whisper Tiny EN ≈ 75–150 MB; Qwen2.5-0.5B
  MLC ≈ 400–500 MB. Both downloads are user-initiated from the AI setup screen;
  onboarding must offer "Continue without AI" with zero downloads.
- **Both engines run in Web Workers.** Never block saving: transcription/reflection are
  manual actions; audio and text persist in IndexedDB transactions before AI runs.
- **Headers:** if we rely on multithreaded WASM anywhere, production hosting must send
  `COOP: same-origin` + `COEP: require-corp`. Preferred: WebGPU-first, single-threaded
  WASM fallback (no headers needed), so deployment is header-optional.

## Open risks

1. Neither inference path has been executed in our harness yet — Day-4/5 tasks must run a
   real transcribe + real reflection in Chromium with WebGPU and in airplane mode post-install.
2. Model Hub IDs and weights can be re-uploaded (e.g. `whisper-tiny.en` last modified
   2025-12-16) — pin exact revision/ETag when caching to detect tampering; add SRI-style
   integrity notes for the backup of model files if we bundle.
3. Memory pressure on Android Chrome for the 500 MB reflection model is the main
   "unsupported device" path — surface it via the compatibility checker, not a crash.
4. PWA install on smartwatches: not claimed anywhere; watch UI is capture-only,
   no model downloads.
