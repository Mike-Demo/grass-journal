# Security Policy

## Supported versions

Grass Journal is an MVP (0.1.0). Security reports are welcome against the latest
`main`. We aim to acknowledge reports within 3 business days.

## Reporting a vulnerability

Email the maintainer privately (see `package.json` / repo profile). Please include:

- what you found and where (file/route/commit),
- steps to reproduce,
- what an attacker could achieve (be concrete: read entries? corrupt backups? exfiltrate audio?).

**Please do not** open a public issue for a vulnerability that could expose
journal content. We will coordinate disclosure and credit you (or keep you
anonymous — your choice).

## What we promise cryptographically

- Backups: PBKDF2-HMAC-SHA256 (600,000 iterations, unique 16-byte salt) →
  AES-GCM-256 (unique 12-byte IV). Wrong passphrase or tampered ciphertext fails
  closed — AES-GCM authentication rejects it.
- Audio integrity: SHA-256 hash recorded at save time, verified on restore.
- Manifest integrity: SHA-256 content hash inside the authenticated payload.

## What we do NOT promise

- Local browser storage is **not** full-disk encryption.
- Anyone with an unlocked device may open the journal (no app lock in this version).
- Browser/OS/user action can delete local data — hence encrypted backups, which
  you must keep (and whose passphrase cannot be recovered).

## Threat model

See [`docs/threat-model.md`](docs/threat-model.md) — it covers storage deletion,
lost/stolen unlocked devices, malicious backup files, corrupted imports,
accidental deletion, model-download tampering, XSS, unintended network
transmission, and service-worker update failures.

## Dependency hygiene

- `package-lock.json` is committed. Review it on dependency PRs.
- No runtime CDN dependencies; no remote code execution; no `dangerouslySetInnerHTML`
  for entry content (React escapes by default — keep it that way).
- AI model weights come from public CDNs over HTTPS and are cache-pinned by the
  service worker only after explicit user install.
