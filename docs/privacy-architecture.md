# Privacy Architecture

## The one-sentence version

Journal content has no code path to the network. The network has no code path
to journal content.

## Where data lives

| Data | Where | Leaves the device? |
|---|---|---|
| Entries, transcripts, reflections | IndexedDB (`grass-journal` DB) | Never |
| Recordings | IndexedDB (Blob records) | Never |
| AI model weights | Cache Storage (`grass-journal-models`) | N/A — public weights, downloaded on explicit install |
| App shell | Cache Storage (service worker precache) | N/A — static app code |
| Backup files | Wherever the user saves them | Only as AES-GCM ciphertext, only when the user exports |

## When the network is used

1. **First load** — the app shell downloads from the static host. Standard PWA.
2. **AI model install** — only when the user taps *Install*. Weights come from
   `huggingface.co` / `cdn-lfs.huggingface.co` (the only `connect-src` hosts in
   the CSP). Progress is shown; cancellation is safe.
3. **Service-worker updates** — app code only, prompt-based, never forced
   mid-recording.

Everything else — saving, playback, search, transcription, reflection, export,
restore — is **100% local**.

## How we prove it (not just claim it)

- **In-app verification:** `#/privacy` → *Run privacy check*. The app
  monkey-patches `fetch`, `XMLHttpRequest`, `WebSocket`, and `sendBeacon`,
  runs scripted save / reflect / export / restore workflows with a canary
  string, then fails if any request was made or the canary appears in one.
- **CSP:** `connect-src 'self' https://huggingface.co https://cdn-lfs.huggingface.co
  https://*.huggingface.co` — even a bug can't exfiltrate to an arbitrary host
  without violating the policy. (Deliver the policy as an HTTP header in
  production; the `<meta>` tag ships as a baseline.)
- **No exfiltration SDKs:** no analytics, telemetry, crash reporting, remote
  fonts, avatars, social SDKs, or ad scripts — in dependencies or code.
- **Workers are sealed:** the transcription worker receives one audio buffer;
  the reflection worker receives one entry's text. Neither imports networking
  code; both run with no journal access.

## What “private” does not mean here

- It does not mean encrypted at rest in the browser (IndexedDB relies on
  browser/OS protections).
- It does not mean safe from someone holding your unlocked device.
- It does not mean immune to browser storage eviction — export backups.

See also: `docs/threat-model.md`, `SECURITY.md`.
