# Security audit triage backlog — 2026-10-21

This document contains ready-to-file issue titles and bodies for the findings from the 2026-10-21 static security audit. The GitHub issue-creation tool was unavailable in this session, so these issues have not been filed.

## Priority order

1. **[security][low] Bound Fable import file size, entry count, and entry lengths** — The import path accepts a user-selected untrusted file and can process an unbounded amount of input, potentially freezing the tab or filling the local journal store.
2. **[security][low] Authenticate the backup preview date** — A modified plaintext manifest date can mislead a user deciding whether to replace-restore, but the impact is limited to the displayed date and requires a restore flow.

These findings have separate root causes and should be tracked independently.

## Remediation issues

### `[security][low] Bound Fable import file size, entry count, and entry lengths`

**Body:**

Parent issue: [Security audit 2026-10-21 — prioritize findings and create remediation issues](https://github.com/Mike-Demo/grass-journal/issues/1)

### Evidence

`previewFableFile` and `importFableFile` in `src/lib/fableImport.ts` read the entire supplied file with `file.text()` and parse JSON or HTML without byte-size, entry-count, or per-entry length limits. The preview also spreads all parsed dates into `Math.min` and `Math.max`. Unlike the backup path, this import path does not apply bounds such as a 50,000-entry maximum and a 200,000-character body limit.

A crafted export can therefore use excessive memory or computation and freeze/crash the importing tab, or bulk-write an excessive number or size of entries into the importing user's local journal store.

### Root cause

The Fable import path has no input-size, entry-count, or per-entry length enforcement before parsing and writing, and date-range calculation uses spread arguments proportional to the input.

### Smallest fix

Apply the backup path's relevant size, count, and body-length bounds in `src/lib/fableImport.ts` before parsing and writing, and compute the preview date range iteratively rather than spreading all dates into `Math.min`/`Math.max`.

### `[security][low] Authenticate the backup preview date`

**Body:**

Parent issue: [Security audit 2026-10-21 — prioritize findings and create remediation issues](https://github.com/Mike-Demo/grass-journal/issues/1)

### Evidence

`decryptEnvelope` in `src/lib/backup.ts` verifies that the SHA-256 hash of the decrypted payload text matches the plaintext outer manifest's `contentHash`, then returns `env.manifest` unchanged. The encrypted payload contains its own `exportedAt`, but the outer manifest's `exportedAt` is not reconciled against it. Editing that outer date therefore does not invalidate the payload hash, while the restore preview displays the outer manifest date. This can mislead a user considering a destructive replace-restore; preview counts are derived from decrypted content.

### Root cause

`decryptEnvelope` returns the unauthenticated outer manifest verbatim after checking only the payload's content hash, without reconciling the manifest date with the decrypted payload date or using an authenticated embedded manifest for display.

### Smallest fix

Reconcile the outer manifest with the decrypted payload before returning it, using one shared timestamp, or embed the manifest in the encrypted payload and display only that authenticated copy.

## Needs-validation issue

### `[security][needs-validation] Audit leads to validate`

**Body:**

Parent issue: [Security audit 2026-10-21 — prioritize findings and create remediation issues](https://github.com/Mike-Demo/grass-journal/issues/1)

Checklist of audit leads that need production validation:

- [ ] **Framing protection depends on a meta-delivered policy and the watch page has no CSP in source.** Missing fact: Whether the production host sends a `Content-Security-Policy` header containing `frame-ancestors`, or an `X-Frame-Options` `DENY` or `SAMEORIGIN` header, for the root, watch, and go documents is not present in the repository and cannot be established from source.
