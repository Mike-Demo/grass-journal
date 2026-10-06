# Best Browser Settings for Grass Journal

Grass Journal is a local-first PWA: your entries live in the browser's
IndexedDB, the offline shell is cached by a service worker, and the AI models
download from a public CDN only when you install them. These settings make
each browser treat it well. Nothing here sends your journal anywhere — these
are all about storage durability, permissions, and downloads.

## Universal (every browser)

- **Install it, don't just bookmark it.** Use Install / Add to Home Screen /
  Add to Dock. Installed web apps get stronger storage-durability signals
  from the OS and their own window, separate from tab clutter.
- **Grant the microphone permanently** (not "ask every time") so recording
  never stalls on a permission prompt mid-thought.
- **Never journal in private/incognito windows.** Storage there is wiped when
  the session ends — by design, in every browser. Your entries would vanish.
- **Take updates when the banner appears.** The app notifies instead of
  force-reloading, so tap "Update now" — never while recording.
- **Install AI models on Wi-Fi**, not cellular (~150 MB transcription,
  ~450 MB reflection).
- **If a model download stalls or fails**, check content blockers / ad
  blockers: allowlist `huggingface.co`. The app fetches nothing else from
  third parties, so a blocked CDN is the usual culprit.
- **Keep one tab.** Two tabs installing models at once can exhaust mobile
  browser memory and crash the page.

## iOS — one section for all browsers

On iPhone and iPad **every browser uses WebKit**: Safari, Chrome, Edge,
Firefox, and Opera on iOS are all Safari under the skin. One set of rules:

- **Add to Home Screen** from the Share menu (works in all of them).
- **Settings → Apps → Safari → Advanced → Feature Flags: leave at defaults.**
  WebGPU ships on in iOS 26+, which is what the reflection model needs. These
  flags are for testing only — never a fix to hand users. (See the device
  testing checklist in `known-limitations.md` for the legitimate testing uses.)
- **Expect limits, not bugs:** iOS caps per-tab memory. Loading the 150 MB
  transcription model can exceed it and crash the tab — your recordings are
  always safe (they save before transcription is attempted). Transcription on
  iOS is experimental; the journal itself is fully usable.
- The app picks the conservative WASM path on iOS automatically.

## Safari (macOS)

- **Add to Dock** (File → Add to Dock) for the installed-app experience.
- **Settings → Websites → Microphone:** set grass-journal.view.fast to Allow.
- **Settings → Privacy:** content blockers apply per-site — if model installs
  fail, check the blocker isn't eating `huggingface.co`.
- Feature Flags: leave at defaults (see iOS section).

## Chrome (desktop & Android)

- **Install the app** via the install icon in the address bar.
- **Site settings → Microphone:** Allow. **Storage:** the app requests
  persistent storage itself; Chrome honors it for installed apps.
- **Android → Data Saver:** exempt the site or turn Data Saver off before
  installing models — it can throttle or stall multi-hundred-MB downloads.
- **Extensions:** ad blockers (uBlock Origin et al.) occasionally block CDN
  hosts — allowlist `huggingface.co` if installs fail.
- **Don't use Incognito** for the journal (see Universal).
- WebGPU ships on in Chrome; the app enables reflection automatically when
  it's present.

## Edge

- Chromium under the hood: follow the **Chrome** guidance above.
- **Settings → Privacy → Tracking prevention:** "Balanced" (the default) is
  fine. "Strict" can interfere with cross-site CDN fetches during model
  install — drop to Balanced for the install if needed.
- **Edge on iOS:** WebKit — see the iOS section, not this one.

## Firefox

- **Microphone:** allow persistently via the address-bar icon → Connection
  details → Permissions.
- **Enhanced Tracking Protection:** "Standard" is fine. "Strict" may block
  the model-weight CDN — the app's only third-party fetch.
- **Don't journal in Private Windows** (storage is ephemeral).
- Service workers are on by default (`dom.serviceWorkers.enabled`); leave it.
- **Firefox on iOS:** WebKit — see the iOS section, not this one.
- Note: the app feature-detects WebGPU and disables reflection honestly
  where it's absent — no settings change can conjure a missing GPU API.

## Opera

- Chromium under the hood: follow the **Chrome** guidance above.
- **Built-in ad blocker:** shield icon in the address bar — turn it off for
  the site (or allowlist `huggingface.co`) before installing models.
- **Android → Battery saver:** can throttle background tabs; recordings are
  foreground so this rarely matters, but disable it if a long recording
  behaves oddly.
- **Opera on iOS / Opera Touch:** WebKit — see the iOS section.

## If something still misbehaves

1. Note the browser, OS version, and what you were doing (recording,
   installing a model, importing).
2. Run the in-app **Privacy screen check** — it verifies zero network
   requests during normal use.
3. Check `known-limitations.md` — honest limits are documented there first.
