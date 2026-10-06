# 🌱 Grass Journal

> **A personal project.** Built by Mike Demopoulos for personal use and shared
> publicly as-is. No warranties, no support queue — just the app as it runs.

A private, offline-first voice and text journal — as a Progressive Web App.

**Core promise: “Your thoughts stay with you.”**

No account. No backend. No cloud. No analytics. No ads. No remote transcription or
hosted AI. Entries, recordings, transcripts, and reflections live in IndexedDB on
your device. On-device AI (Whisper transcription, Qwen reflection) is optional,
manually triggered, and never blocks saving.

## Product principles (in priority order)

1. Never lose the original entry.
2. Never send journal content to an external service.
3. The journal works without AI.
4. AI never blocks saving.
5. Audio is saved before transcription begins.
6. Original content is authoritative; AI output is optional metadata.
7. No user account. 8. No cloud service.
8. Brief interactions — then back to real life.
9. Privacy claims are technically accurate.
10. Smartwatch support is experimental and never oversold.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (COOP/COEP headers set for WASM experiments)
npm test           # Vitest: 26 tests
npm run build      # production PWA in dist/
npm run preview    # serve the production build
```

**First run needs internet** — to load the app and, if you choose, download AI models.
After that everything works offline.

## What you can do

| Flow | Route |
|---|---|
| Onboarding (no account, local storage, optional AI) | `#/onboarding` |
| Home: record / write / journal + status chips | `#/` |
| Voice recording: big button, timer, instant local save | `#/record` |
| Text editor: autosave + save-state indicator | `#/write` |
| Journal list: newest first, offline search | `#/journal` |
| Entry detail: audio player, transcript, reflection, manage | `#/entry/:id` |
| AI setup: install/remove transcription & reflection models | `#/ai` |
| Storage & backup: health, encrypted export/restore, wipe | `#/storage` |
| Privacy model + runnable network-leak check | `#/privacy` |
| Compact capture mode (experimental small-screen) | `#/compact` — or the tiny watch page at `/watch/`, short URL `/go`, or `https://grass-journal-go.view.fast/` |

## Architecture

- **React + TypeScript + Vite**, `vite-plugin-pwa` (`generateSW`, prompt-based updates)
- **Dexie.js over IndexedDB** — the only place journal data lives. Entry + audio commit in one transaction.
- **MediaRecorder API** — 1s timeslices, best-MIME detection, SHA-256 integrity hash per recording.
- **Web Crypto API** — PBKDF2-SHA256 (600k iterations) → AES-GCM-256 encrypted backups with versioned manifest, integrity validation, merge/replace restore, duplicate protection.
- **Web Workers** — transcription (Transformers.js, Whisper tiny.en) and reflection (WebLLM, Qwen2.5-0.5B-Instruct quantized) run off the main thread.
- **Zero journal-content network requests** — verified by the in-app privacy check (`#/privacy`).
- **CSS only** — mobile-first, system fonts, no remote assets, `prefers-reduced-motion` respected.

See [`docs/architecture.md`](docs/architecture.md) for the diagram,
[`docs/privacy-architecture.md`](docs/privacy-architecture.md) for the data-flow story,
[`docs/threat-model.md`](docs/threat-model.md) for security analysis, and
[`docs/known-limitations.md`](docs/known-limitations.md) for honest boundaries,
and [`docs/browser-settings.md`](docs/browser-settings.md) for the best
per-browser settings (Edge, Safari, Firefox, Opera, Chrome).

## Local AI

| Capability | Engine | Model | Size* | Needs |
|---|---|---|---|---|
| Transcription | Transformers.js (worker) | Whisper Tiny English (`Xenova/whisper-tiny.en`) | ~150 MB | WASM (WebGPU if present) |
| Reflection | WebLLM (worker) | Qwen2.5-0.5B-Instruct `q4f16_1` | ~450 MB | WebGPU |

\* approximate download size. Both are **manually initiated** and **optional**.
Without WebGPU, reflection is disabled gracefully and a deterministic on-device
keyword fallback is offered — never a remote model. The system prompt is versioned
(`reflect-v1`) in [`src/ai/prompts.ts`](src/ai/prompts.ts) and every reflection
records its model + prompt version. Reflection output is schema-validated before save.

Model licenses: [`docs/model-licenses.md`](docs/model-licenses.md).

## Encrypted backup format

`.grassjournal` — JSON envelope `{ manifest, crypto, ciphertext }`, AES-GCM-256 over
PBKDF2-SHA256(passphrase, unique salt, 600k). Manifest is authenticated inside the
payload (plus a SHA-256 content hash, defense in depth). Restore previews counts and
duplicates **before** anything is written; merge skips existing ids; replace wipes
first — only after explicit confirmation. The passphrase is never stored.

## Importing from Fable

Fable (lifefable.me) closes Oct 31, 2026. Storage & backup → **Import from Fable**:
Fable's download is a ZIP — extract it and choose the `journal_export.html`
inside (a JSON export works too). The importer parses the HTML articles
(title ← heading, date ← the date line like "July 11, 2026, 11:10 a.m.",
text ← the article body) and shows you a preview (count, date range, sample)
before anything is written. Fable's one-word theme label is kept as a tag on
each entry. JSON exports get field-mapping dropdowns to correct
before import. Only your entry text is imported — Fable's AI illustrations,
epics, and scores stay behind. Imports are tagged `fable-import`,
keep their original dates, and skip duplicates, so re-running an import is safe.
The HTML layout was verified against a real export (2026-10-05); the JSON path
stays tolerant of different layouts since Fable doesn't publish a schema — if
your file uses unusual field names, the preview shows every observed key.
`.grassjournal` — JSON envelope `{ manifest, crypto, ciphertext }`, AES-GCM-256 over
PBKDF2-SHA256(passphrase, unique salt, 600k). Manifest is authenticated inside the
payload (plus a SHA-256 content hash, defense in depth). Restore previews counts and
duplicates **before** anything is written; merge skips existing ids; replace wipes
first — only after explicit confirmation. The passphrase is never stored.

## Testing

- `npm test` — Vitest + React Testing Library + fake-indexeddb: crypto round-trips,
  tamper rejection, wrong-passphrase rejection, corrupt-backup rejection,
  merge/replace/dedupe semantics, audio integrity checks, reflection schema
  validation, deterministic fallback, save-indicator states.
- `npm run test:e2e` — Playwright smoke spec (home → write → autosave → reload persistence).

## Deployment

Any static host. Serve with a strict CSP (a `<meta>` policy ships in `index.html`;
prefer the HTTP header — see [`docs/privacy-architecture.md`](docs/privacy-architecture.md)).
No COOP/COEP headers required in production: transcription defaults to
single-threaded WASM. Never put journal content behind the service worker's HTTP
cache — it only caches the app shell and (explicitly installed) model weights.

## One-week build plan (how this MVP was sequenced)

- **Day 1** — foundation, PWA shell, IndexedDB schema, capability detection, AI spikes → [`docs/technical-spikes.md`](docs/technical-spikes.md)
- **Day 2** — durable text journal (autosave, list, detail, delete)
- **Day 3** — durable voice capture + compact mode
- **Day 4** — local transcription
- **Day 5** — local reflection
- **Day 6** — backup, privacy verification, resilience
- **Day 7** — accessibility, docs, screenshots, submission draft

## Non-goals (deliberately not built)

Accounts, cloud sync, social sharing, streaks, engagement notifications, emotion
detection, diagnosis, sentiment scoring, therapist simulation, location/GPS tracking,
background recording, auto-transcription, remote AI fallback, native watch apps,
multi-user, collaboration, servers of any kind.

## License

MIT — see [LICENSE](LICENSE). AI model weights carry their own licenses
([`docs/model-licenses.md`](docs/model-licenses.md)).
