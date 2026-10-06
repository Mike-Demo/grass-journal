# Contributing to Grass Journal

Thanks for caring about private software. This project is intentionally small —
please keep it that way.

## Ground rules

1. **Privacy first.** Any PR that transmits journal content off-device, adds
   analytics/telemetry/tracking, or loads remote code, fonts, or assets will be
   rejected. The privacy check (`#/privacy` → “Run privacy check”) must pass.
2. **Original content is authoritative.** AI output is optional metadata. Never
   let a model overwrite, “correct,” or rephrase the user's words silently.
3. **AI never blocks saving.** Transcription and reflection are manual,
   cancellable, and failure-safe. Audio must be committed before transcription.
4. **No new network hosts** without discussion. The CSP allowlist is tiny on purpose.
5. **Accessibility is a feature.** Keyboard operability, visible focus, live-region
   announcements, 48px targets, no color-only status. Test with a screen reader
   before claiming a11y.
6. **Honest claims.** Don't promise watch support, iOS WebGPU, or “unlosable”
   storage you haven't tested. Update `docs/known-limitations.md` instead.

## Development

```bash
npm install
npm run dev      # Vite dev server (sets COOP/COEP for WASM experiments)
npm test         # unit + component tests
npm run typecheck
npm run build    # must succeed with no new precache warnings
```

### Adding a transcription model

The transcription adapter is engine-agnostic by design. To add e.g. multilingual
Whisper Tiny:

1. Add the model id to `src/ai/modelIds.ts`.
2. Keep the worker message protocol (`init` / `transcribe` / `progress` / `result` / `error`) unchanged.
3. Surface it in `src/screens/AISetup.tsx` with engine, size, and license.
4. Document the license in `docs/model-licenses.md`.

### Changing the reflection prompt

Prompts are versioned. Never edit `reflect-v1` in place — add `reflect-v2` in
`src/ai/prompts.ts`, keep the old constant, and note the change in the PR. Every
stored reflection records its `promptVersion`.

### Backup format changes

Bump `BACKUP_VERSION`, keep a reader for the previous version, and add
round-trip + corruption tests in `src/lib/__tests__/backup.test.ts`.

## Pull requests

- Small, focused, with tests for behavior changes.
- Run `npm test`, `npm run typecheck`, `npm run build` before opening.
- Describe the privacy impact (or “none”) in the PR body.
- Update docs when behavior or limitations change.

## Code of conduct

Be kind. This is a journaling app — many contributors and users care deeply about
privacy because they have reasons. Assume good reasons.
