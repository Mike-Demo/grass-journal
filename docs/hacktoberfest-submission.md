# Hacktoberfest Submission Draft — Grass Journal

> DRAFT — fill in repo URL / demo link before submitting.

## Project

**Grass Journal** — a private, offline-first voice & text journal PWA.
*Your thoughts stay with you.*

## What it is

A complete MVP: installable PWA, typed entries with autosave, voice recording
with instant on-device save, on-device Whisper transcription, on-device Qwen
reflection, encrypted (AES-GCM) backup export/restore, storage health, a runnable
privacy-verification mode, and an experimental compact capture screen for
small-screen browsers.

## Why it matters

Most journaling apps are cloud diaries with a privacy policy. Grass Journal is a
diary with an architecture: **no account, no backend, no analytics, no hosted AI
— journal content has no code path to the network**, and the app ships a
self-test that proves it.

## Tech highlights

- React + TypeScript + Vite + vite-plugin-pwa (offline-first, prompt-based updates)
- Dexie.js/IndexedDB with transactional entry+audio commits
- MediaRecorder with MIME detection, 1s timeslices, SHA-256 audio integrity
- Web Workers: Transformers.js (Whisper tiny.en) + WebLLM (Qwen2.5-0.5B q4f16_1)
- WebCrypto: PBKDF2-SHA256 (600k) → AES-GCM-256 backups, versioned manifest
- Versioned reflection prompt (`reflect-v1`), schema-validated JSON output
- 26 Vitest tests: crypto round-trips, tamper/wrong-passphrase/corrupt-backup
  rejection, merge/replace/dedupe, integrity checks, a11y-relevant UI states
- WCAG 2.2 AA-minded: keyboard nav, live regions, 48px targets, reduced motion

## Good first issues for contributors

- [ ] Multilingual Whisper Tiny adapter option (the interface is ready)
- [ ] `reflect-v2` prompt experiments (versioned, never in-place edits)
- [ ] App lock (passphrase-wrapped keys) — see threat model §2
- [ ] Playwright device matrix: Android Chrome install flow, iPad Safari
- [ ] Real-device smartwatch browser survey (honest compatibility table)

## Links

- Repo: <TODO>
- Live demo: <TODO>
- Docs: `docs/` (architecture, threat model, privacy, limitations, demo script)
- License: MIT (model weights carry their own licenses — see `docs/model-licenses.md`)
