# Threat Model — Grass Journal 0.1.0

*Adversary-agnostic design goal: journal content must not leave the device
except inside a user-exported, passphrase-encrypted backup.*

## Assets

| Asset | Location | Protection |
|---|---|---|
| Journal entries (text) | IndexedDB | Browser origin isolation |
| Recordings (audio) | IndexedDB | Browser origin isolation + SHA-256 integrity hash |
| Transcripts | IndexedDB | Same as entries; user-editable/deletable |
| Reflections | IndexedDB | Labeled AI-generated; editable/deletable |
| Backup files | User's filesystem | AES-GCM-256, PBKDF2-SHA256 600k |
| AI model weights | Browser Cache Storage | Public data; no journal content |

## Threats & mitigations

### 1. Browser storage deletion (accidental or hostile)
The browser, OS, device reset, “clear site data,” or storage-pressure eviction can
erase IndexedDB. **Mitigations:** request `navigator.storage.persist()`; show quota
and persistence status; nag (gently, once) about encrypted export; never claim
storage is permanent — the UI says so explicitly.

### 2. Lost or stolen unlocked device
Anyone holding an unlocked device can open the journal — **there is no app lock in
this version**. Stated plainly in onboarding and `/#/privacy`. (Future: optional
passphrase lock with WebCrypto-wrapped keys.)

### 3. Malicious backup files
An attacker-crafted `.grassjournal` could try to inject oversized payloads, bad
schemas, or mismatched audio. **Mitigations:** envelope schema validation (zod)
before decryption; AES-GCM authentication rejects tampering; payload schema
validation after decryption; content-hash check; per-audio SHA-256 verification;
size caps (200k chars/entry, 50k entries); restore writes only inside one
transaction after all checks pass; preview step shows counts before any write.

### 4. Corrupted imports
Truncated downloads, bit rot. Same pipeline as (3): any failure aborts with
“nothing was changed.” Merge mode never deletes device data.

### 5. Accidental recording deletion
Recordings commit in the same transaction as their entry (all-or-nothing).
Delete requires two taps. Soft-delete keeps the record restorable from backup.
`MediaRecorder` uses 1s timeslices so an interrupted recording keeps its chunks.

### 6. Model download tampering
Weights download over HTTPS from Hugging Face CDNs, only on explicit install.
Transformers.js/WebLLM verify/sha-pin via their own manifests; the service worker
cache-pins them afterwards. A tampered weight file fails model init — it cannot
touch journal data (different storage, worker sandbox).

### 7. Cross-site scripting (XSS)
Entry text is rendered via React (escaped by default) — `dangerouslySetInnerHTML`
is never used for user content. AI JSON is schema-validated before storage and
rendered as text. CSP blocks inline remote scripts and third-party code.

### 8. Unintended network transmission
**The highest-priority threat.** Mitigations: no fetch/XHR/WebSocket call in any
journal workflow (enforced by architecture, not just policy); the in-app privacy
check (`runPrivacyCheck`) intercepts all four transports during scripted
save/reflect/export/restore flows and fails on any request; CSP `connect-src`
allowlist contains only model CDNs; model downloads are manual and labeled.

### 9. Service-worker update failures
Updates use `registerType: 'prompt'` — the user is notified, never force-reloaded.
No update is applied while recording or drafting (the banner offers “reload now”
explicitly). Journal data is not in the HTTP cache, so a bad SW cannot eat it.

## Explicitly out of scope / not claimed

- Full-disk encryption equivalence (we say local storage is *not* that).
- Protection against a compromised browser, OS, or physical memory forensics.
- Multi-device sync (would require solving key distribution — deliberately a non-goal).
- Coercion resistance (“unlock your journal”) — no duress mechanism exists.
