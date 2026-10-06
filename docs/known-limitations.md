# Known Limitations — Grass Journal 0.1.0

Honest boundaries. If it's listed here, we chose not to overclaim it.

## Platform & AI

- **Reflection needs WebGPU.** On browsers/devices without WebGPU (notably iOS
  Safari as of this writing), the reflection model is disabled gracefully. The
  journal, recording, transcription (WASM), backup, and restore all still work.
  A deterministic keyword fallback is offered instead — never a remote model.
- **Model downloads are large** (~150 MB transcription, ~450 MB reflection,
  approximate). They require connectivity and free storage; progress and errors
  are shown, and “insufficient storage” surfaces as an install failure, not a
  silent break.
- **Whisper tiny.en is English-only and small.** Transcription quality is
  “demonstration grade.” The adapter is designed for a multilingual tiny model
  later; it is not bundled now.
- **Transcription on iOS is experimental.** iPhone/iPad browsers impose strict
  per-tab memory limits; loading the ~150 MB Whisper model into WASM can exceed
  them and crash the tab (the browser shows a generic "can't open this page"
  error). Your recordings are never at risk — they are committed to IndexedDB
  before transcription is ever attempted, and you can transcribe later in a
  desktop browser. The app forces the conservative WASM path (not WebGPU) on iOS
  and guards against double-tap installs, which were found to double memory use.
  Observed 2026-10-05 on Edge for iOS; Safari/WebKit share the same OS limits.
- **Single-threaded WASM by default.** We don't require COOP/COEP headers in
  production. Multithreaded inference is an experiment, not a promise.
- **First-run model verification is best-effort.** `lastVerifiedAt` records the
  last successful init; we don't re-hash multi-hundred-MB weights on every launch.

## Smartwatch / small screens
- **Experimental.** Two small-screen options:
  - **Feeling wheel** (`/watch/`) — a standalone ~11KB page, zero framework.
    A self-reported mood check-in: tap the 💭 button and 8 feeling orbs pop
    out; tap one to save a `mood` entry. (Tap-only by design — on watchOS the
    web viewer's long-press gesture opens a new tab, so press-and-hold is
    unusable there.) Writes directly to the same IndexedDB as the main app
    via raw IndexedDB (schema mirrored from the app's Dexie v1 definition),
    so check-ins appear in the journal. No AI, no network, no onboarding,
    no microphone needed — this is why it works on Apple Watch, where watchOS
    gives web pages no mic access at all. A "✎ Write instead" toggle opens a
    minimal typing view that saves plain text entries to the same database.
    Short URLs `/go` and
    `https://grass-journal-go.view.fast/` point here.
  - **Compact mode** (`#/compact`) — the same check-in as `/watch/`, inside the
    full app: feeling wheel plus writing mode. (v21: the voice recorder moved
    out — voice recording lives on the full app's Record screen.)
- **Same-origin by design.** The short URLs redirect to the main app origin,
  so captures land in the same IndexedDB as the full app. A separate origin
  would strand recordings in a separate database.
- **We do not claim** the PWA installs on every Wear OS or Apple Watch device,
  or that watch browsers support MediaRecorder/IndexedDB. Those vary by vendor
  and OS version and were not exhaustively tested.
- **Verified 2026-10-06 (real Apple Watch):** the watchOS web viewer (opened via
  a Messages link — there is no real browser on Apple Watch) does **not**
  expose the microphone to web pages at all. `getUserMedia`/`MediaRecorder`
  are unavailable, so no website can record audio there; this is an Apple
  platform restriction, not an app bug. The watch page detects this and says
  so plainly instead of failing silently. Everything else worked on the watch:
  the page loaded, IndexedDB opened, the UI rendered. Only a native watchOS
  app could capture audio on Apple Watch — future work, not on the roadmap.
- The intended watch flow today: **capture on the small screen → process later
  on a capable device** (manual backup transfer; a companion app is future work).

## Storage durability

- **Browser storage can be lost.** Eviction, “clear site data,” OS cleanup,
  device reset, or user action can erase IndexedDB. `persist()` is requested but
  not guaranteed. The app says this in onboarding, storage, and privacy screens.
- **No sync.** There is deliberately no cloud sync; moving journals between
  devices is via encrypted backup files you carry yourself.

## Security scope

- **No app lock.** Anyone with an unlocked device can open the journal.
- **Not full-disk encryption.** Stated wherever storage is discussed.
- Backups are only as safe as your passphrase and where you keep the file.

## Compatibility (tested vs. assumed)

- **Built and unit-tested** in this repo: crypto round-trips, restore semantics,
  schema validation, UI states (Vitest, 50 tests), production PWA build with a
  398KB precache (AI engines cached on demand), 4 Playwright smoke tests.
- **Not yet run here:** real-device microphone recording, actual Whisper/WebLLM
  model downloads and inference, install prompts on Android/iOS, and watch
  browsers. The code paths are implemented against documented platform APIs;
  device testing is the next milestone (see demo script).

### Device testing checklist

- [ ] iPhone: record a voice entry → play it back → install transcription model
      (Wi-Fi) → transcribe. If the tab crashes during install, the recording
      is still safe; retry on desktop.
- [ ] iPhone: install reflection model → "Reflect on this device" on an entry.
- [ ] **WebGPU off** (Settings → Apps → Safari → Advanced → Feature Flags):
      AI Setup must mark reflection unsupported and the entry screen must offer
      the deterministic keyword fallback — no crash, no hang. Toggle back on
      afterwards. (Feature flags are for testing only; never a user workaround.)
- [ ] **Service Workers off** (same screen): app still works while online and
      is honest about offline being unavailable.
- [ ] Airplane mode after first load: typing, recording, and backup export all
      work offline.
- [ ] `/watch/` feeling wheel on a small-screen browser: tap 💭 → orbs pop out →
      tap a feeling → "Saved ✓" → today's count increments → entry appears in
      the full app's journal. (Apple Watch tested 2026-10-06:
      page/IndexedDB/UI all work; watchOS gives web pages no microphone
      access, which is why the wheel replaces recording there. Tap-only —
      watchOS long-press opens a new tab.)
- [ ] Fable `journal_export.html`: preview shows the right count/date range
      before importing; theme words arrive as tags.
