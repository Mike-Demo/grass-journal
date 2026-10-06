# Architecture — Grass Journal 0.1.0

```mermaid
flowchart TB
    subgraph Browser["Browser (single origin)"]
        subgraph UI["React UI (main thread)"]
            Home["Home<br/>status chips"]
            Rec["Record<br/>MediaRecorder"]
            Ed["Editor<br/>autosave"]
            List["Journal list<br/>offline search"]
            Detail["Entry detail<br/>player · transcript · reflection"]
            AISetup["AI setup<br/>install / remove"]
            Store["Storage & backup<br/>export / restore"]
            Priv["Privacy<br/>network-leak check"]
            Compact["Compact capture<br/>experimental"]
        end

        subgraph Workers["Web Workers"]
            TW["transcription.worker<br/>Transformers.js<br/>whisper-tiny.en"]
            RW["reflection.worker<br/>WebLLM<br/>Qwen2.5-0.5B q4f16_1"]
        end

        subgraph Data["On-device storage"]
            IDB[("IndexedDB (Dexie)<br/>entries · audio · settings · models")]
            Cache[("Cache Storage<br/>app shell (SW)<br/>model weights")]
        end

        Crypto["WebCrypto<br/>PBKDF2 → AES-GCM"]
    end

    subgraph Net["Network (rare, explicit)"]
        CDN["Hugging Face CDNs<br/>model weights ONLY<br/>on manual install"]
        Static["Static host<br/>app shell"]
    end

    UI -->|"entry+audio<br/>one transaction"| IDB
    Rec -->|"PCM 16kHz (transferable)"| TW
    Detail -->|"selected entry text ONLY"| RW
    TW -->|"transcript text"| Detail
    RW -->|"validated JSON"| Detail
    Store <-->|"encrypt / decrypt"| Crypto
    Crypto -->|"⁠.grassjournal file<br/>(user-handled)"| User((User))
    AISetup -->|"manual install"| CDN
    CDN -->|"weights"| Cache
    Static -->|"first load + SW updates"| Cache
    Priv -->|"intercepts fetch/XHR/WS/beacon<br/>asserts zero requests"| UI

    style IDB fill:#1d4d2b,color:#fff
    style Net fill:#f6e8e8,color:#333
```

## Data-flow rules (enforced, not aspirational)

1. **Journal data ↔ IndexedDB only.** The service worker caches the app shell and
   model weights — never entries, audio, transcripts, or reflections.
2. **Audio commits first.** `stopAndSave()` writes entry + audio in one Dexie
   transaction and resolves only after commit. Transcription is a separate,
   manual, later step.
3. **AI sees the minimum.** The transcription worker receives one audio sample;
   the reflection worker receives one entry's text. Neither can see the journal.
   Workers are terminated after use (reflection) or idle-reusable (transcription).
4. **AI output is metadata.** Reflections and transcripts are validated (zod),
   labeled with model + prompt version, editable, deletable — and never overwrite
   `bodyText`.
5. **Backups are user-mediated.** Encryption happens in-page; the file download
   is the only exfiltration path, and it requires the user's passphrase.
6. **No silent network.** The only `connect-src` hosts are model CDNs, hit only
   during explicit installs. The privacy screen proves the workflows are silent.

## Module map

| Path | Responsibility |
|---|---|
| `src/db.ts` | Dexie schema, transactions, settings |
| `src/lib/types.ts` | Versioned data schema |
| `src/lib/validation.ts` | zod schemas: entries, AI JSON, backup envelope |
| `src/lib/backup.ts` | AES-GCM export/restore, integrity, dedupe |
| `src/lib/netcheck.ts` | Privacy-verification interceptor |
| `src/lib/capability.ts` | WebGPU/WASM/mic/storage probing |
| `src/audio/recorder.ts` | MediaRecorder lifecycle, immediate commit |
| `src/ai/*.worker.ts` | Transcription / reflection engines |
| `src/ai/*Client.ts` | Worker clients (transferables, progress) |
| `src/ai/prompts.ts` | Versioned system prompt (`reflect-v1`) |
| `src/ai/deterministic.ts` | No-model keyword fallback |
| `src/screens/*` | The ten screens |
| `src/demo/seed.ts` | Labeled demo data (synthetic audio) |
