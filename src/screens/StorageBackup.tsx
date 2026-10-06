import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Button, ScreenHeader, formatBytes, formatDateTime } from '../components/ui';
import { navigate } from '../lib/router';
import { updateSettings, useSettings } from '../lib/hooks';
import { getStorageInfo, requestPersistence } from '../lib/capability';
import { exportBackup, parseBackupFile, previewRestore, restoreBackup, type BackupPreview, type RestoreMode } from '../lib/backup';
import { importFableFile, previewFableFile, type FablePreview, type FieldMapping } from '../lib/fableImport';
import { seedDemoData, clearDemoData } from '../demo/seed';

/**
 * Storage health + encrypted backup export / restore.
 * Restore is a two-step flow: preview (decrypt, validate, count) → confirm → write.
 */
export default function StorageBackup() {
  const settings = useSettings();
  const entryCount = useLiveQuery(() => db.entries.filter((e) => e.deletedAt == null).count(), []);
  const audioCount = useLiveQuery(() => db.audio.count(), []);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const [pass, setPass] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePass, setRestorePass] = useState('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [fableFile, setFableFile] = useState<File | null>(null);
  const [fablePreview, setFablePreview] = useState<FablePreview | null>(null);
  const [fableMapping, setFableMapping] = useState<FieldMapping | null>(null);

  const refresh = async () => setStorage(await getStorageInfo());
  useEffect(() => { refresh(); }, []);

  const doExport = async () => {
    setError(''); setBusy('export');
    try {
      const { blob, filename } = await exportBackup(pass);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      await updateSettings({ lastSuccessfulExportAt: Date.now() });
      setNotice(`Backup downloaded: ${filename}. Store it somewhere safe — the passphrase can't be recovered.`);
      setShowExport(false); setPass('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy('');
    }
  };

  const doPreview = async () => {
    setError(''); setPreview(null);
    if (!restoreFile) { setError('Choose a backup file first.'); return; }
    setBusy('preview');
    try {
      await parseBackupFile(restoreFile); // structural check first
      const p = await previewRestore(restoreFile, restorePass);
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that backup file.');
    } finally {
      setBusy('');
    }
  };

  const doRestore = async () => {
    if (!restoreFile || !preview) return;
    setError(''); setBusy('restore');
    try {
      const r = await restoreBackup(restoreFile, restorePass, restoreMode);
      setNotice(`Restore complete: ${r.restoredEntries} entries, ${r.restoredAudio} recordings${r.skippedDuplicates ? `, ${r.skippedDuplicates} duplicates skipped` : ''}.`);
      setPreview(null); setRestoreFile(null); setRestorePass('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed. Nothing was changed.');
    } finally {
      setBusy('');
    }
  };

  const doFablePreview = async () => {
    setError(''); setFablePreview(null);
    if (!fableFile) { setError('Choose your Fable export file first.'); return; }
    setBusy('fable-preview');
    try {
      const p = await previewFableFile(fableFile, fableFile.name);
      setFablePreview(p);
      setFableMapping(p.mapping);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy('');
    }
  };

  const doFableImport = async () => {
    if (!fableFile || !fableMapping || !fablePreview) return;
    setError(''); setBusy('fable-import');
    try {
      const r = await importFableFile(fableFile, fableMapping, fablePreview.source);
      setNotice(`Fable import complete: ${r.imported} entries imported${r.skipped ? `, ${r.skipped} skipped (empty or already here)` : ''}. They are tagged “fable-import”.`);
      setFablePreview(null); setFableFile(null); setFableMapping(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed. Nothing was changed.');
    } finally {
      setBusy('');
    }
  };

  const doWipe = async () => {
    if (!confirmWipe) { setConfirmWipe(true); return; }
    setBusy('wipe');
    try {
      await db.transaction('rw', db.entries, db.audio, async () => {
        await db.audio.clear();
        await db.entries.clear();
      });
      setNotice('All journal data on this device was deleted. Backups you exported are unaffected.');
      setConfirmWipe(false);
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <ScreenHeader title="Storage & backup" backTo={{ name: 'home' }} />
      <section className="card" aria-label="Storage health">
        <h2>On this device</h2>
        <dl className="kv">
          <dt>Entries</dt><dd>{entryCount ?? '…'}</dd>
          <dt>Recordings</dt><dd>{audioCount ?? '…'}</dd>
          <dt>Used</dt><dd>{storage.usage != null ? formatBytes(storage.usage) : 'unknown'}</dd>
          <dt>Quota</dt><dd>{storage.quota != null ? formatBytes(storage.quota) : 'not exposed by browser'}</dd>
          <dt>Persistence</dt>
          <dd>
            {storage.persisted ? 'Granted — the browser will try not to evict your data' : 'Not granted'}
            {!storage.persisted && (
              <div style={{ marginTop: 6 }}>
                <Button variant="secondary" onClick={async () => { await requestPersistence(); await refresh(); }}>
                  Request persistent storage
                </Button>
              </div>
            )}
          </dd>
          <dt>Last export</dt>
          <dd>{settings?.lastSuccessfulExportAt ? formatDateTime(settings.lastSuccessfulExportAt) : 'Never'}</dd>
        </dl>
        <div className="notice">
          <p><strong>Honest warning:</strong> browser storage can still be removed by the browser, the operating system, a device reset, or your own actions. Persistent storage helps, but it is not a guarantee. Keep encrypted backups.</p>
        </div>
      </section>

      <section className="card" aria-label="Export">
        <h2>Export journal</h2>
        <p>One encrypted file (AES-256-GCM, passphrase-derived key). We never store your passphrase — lose it and the backup is unreadable, even to us.</p>
        {!showExport ? (
          <Button onClick={() => setShowExport(true)} testId="export-open">Export journal</Button>
        ) : (
          <>
            <div className="field">
              <label htmlFor="export-pass">Backup passphrase (min 8 characters)</label>
              <input id="export-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
              <p className="hint">Write it down somewhere safe. It cannot be recovered.</p>
            </div>
            <div className="btn-row">
              <Button onClick={doExport} disabled={pass.length < 8 || busy === 'export'} testId="export-download">
                {busy === 'export' ? 'Encrypting…' : 'Download encrypted backup'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowExport(false); setPass(''); }}>Cancel</Button>
            </div>
          </>
        )}
      </section>

      <section className="card" aria-label="Restore">
        <h2>Restore journal</h2>
        <div className="field">
          <label htmlFor="restore-file">Backup file</label>
          <input id="restore-file" type="file" accept=".grassjournal,application/json" onChange={(e) => { setRestoreFile(e.target.files?.[0] ?? null); setPreview(null); }} />
        </div>
        <div className="field">
          <label htmlFor="restore-pass">Backup passphrase</label>
          <input id="restore-pass" type="password" value={restorePass} onChange={(e) => setRestorePass(e.target.value)} autoComplete="current-password" />
        </div>
        <Button variant="secondary" onClick={doPreview} disabled={!restoreFile || !restorePass || busy === 'preview'} testId="restore-preview">
          {busy === 'preview' ? 'Reading backup…' : 'Preview backup'}
        </Button>
        {preview && (
          <div className="notice ok" role="status">
            <p><strong>Backup from {formatDateTime(preview.manifest.exportedAt)}:</strong></p>
            <ul>
              <li>{preview.newEntryCount} new entries ({preview.duplicateIds.length} already on this device — skipped on merge)</li>
              <li>{preview.newAudioCount} recordings</li>
              <li>Integrity checks passed ✓</li>
            </ul>
            <div className="field">
              <label>Restore mode</label>
              <div className="btn-row" role="radiogroup" aria-label="Restore mode">
                <Button variant={restoreMode === 'merge' ? 'primary' : 'secondary'} onClick={() => setRestoreMode('merge')} aria-pressed={restoreMode === 'merge'}>
                  Merge
                </Button>
                <Button variant={restoreMode === 'replace' ? 'primary' : 'secondary'} onClick={() => setRestoreMode('replace')} aria-pressed={restoreMode === 'replace'}>
                  Replace
                </Button>
              </div>
              <p className="hint">{restoreMode === 'merge' ? 'Adds new entries; existing ones are kept.' : '⚠ Deletes everything on this device first, then restores.'}</p>
            </div>
            <div className="btn-row">
              <Button onClick={doRestore} disabled={busy === 'restore'} testId="restore-confirm">
                {busy === 'restore' ? 'Restoring…' : `Restore (${restoreMode})`}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>Cancel — nothing was changed</Button>
            </div>
          </div>
        )}
      </section>

      <section className="card" aria-label="Import from Fable">
        <h2>Import from Fable</h2>
        <p>
          Moving over from Fable (lifefable.me)? Download your export from Fable's
          Settings — it's a ZIP: extract it, then choose the
          <code> journal_export.html </code> inside (a JSON export works too).
          Only your entry text comes over — Fable's AI illustrations and scores
          stay behind, while Fable's one-word theme label is kept as a tag.
          Imported entries are tagged
          “fable-import” and keep their original dates.
        </p>
        <div className="field">
          <label htmlFor="fable-file">Fable export file (journal_export.html or .json)</label>
          <input
            id="fable-file"
            type="file"
            accept=".html,.json,text/html,application/json"
            onChange={(e) => { setFableFile(e.target.files?.[0] ?? null); setFablePreview(null); }}
          />
        </div>
        <Button variant="secondary" onClick={doFablePreview} disabled={!fableFile || busy === 'fable-preview'} testId="fable-preview">
          {busy === 'fable-preview' ? 'Reading…' : 'Preview import'}
        </Button>
        {fablePreview && fableMapping && (
          <div className="notice ok" role="status" style={{ marginTop: 12 }}>
            <p><strong>{fablePreview.entryCount} entries found</strong> in {fablePreview.fileName}
              {fablePreview.dateRange && (
                <> ({new Date(fablePreview.dateRange.min).toLocaleDateString()} – {new Date(fablePreview.dateRange.max).toLocaleDateString()})</>
              )}
              {fablePreview.duplicateCount > 0 && <>, {fablePreview.duplicateCount} already here</>}.
            </p>
            <p style={{ fontSize: '0.9rem' }}><em>Sample:</em> “{fablePreview.sampleText}…”</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
              Source: {fablePreview.source === 'html' ? 'Fable HTML export (fixed layout — title ← heading, date ← p.date, text ← article body)' : 'Fable JSON export (field mapping below)'}
            </p>
            {fablePreview.source === 'json' && (
            <>
            <div className="field">
              <label htmlFor="fable-text-field">Entry text field</label>
              <select
                id="fable-text-field"
                value={fableMapping.textField}
                onChange={(e) => setFableMapping({ ...fableMapping, textField: e.target.value })}
                style={{ minHeight: 'var(--tap)', width: '100%', font: 'inherit' }}
              >
                {fablePreview.observedKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fable-date-field">Date field</label>
              <select
                id="fable-date-field"
                value={fableMapping.dateField ?? ''}
                onChange={(e) => setFableMapping({ ...fableMapping, dateField: e.target.value || null })}
                style={{ minHeight: 'var(--tap)', width: '100%', font: 'inherit' }}
              >
                <option value="">(none — use import time)</option>
                {fablePreview.observedKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fable-title-field">Title field (optional)</label>
              <select
                id="fable-title-field"
                value={fableMapping.titleField ?? ''}
                onChange={(e) => setFableMapping({ ...fableMapping, titleField: e.target.value || null })}
                style={{ minHeight: 'var(--tap)', width: '100%', font: 'inherit' }}
              >
                <option value="">(none)</option>
                {fablePreview.observedKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            </>
            )}
            <div className="btn-row">
              <Button onClick={doFableImport} disabled={busy === 'fable-import'} testId="fable-import">
                {busy === 'fable-import' ? 'Importing…' : `Import ${fablePreview.entryCount} entries`}
              </Button>
              <Button variant="ghost" onClick={() => setFablePreview(null)}>Cancel — nothing was changed</Button>
            </div>
          </div>
        )}
      </section>

      {error && <div className="notice danger" role="alert"><p>{error}</p></div>}
      {notice && <div className="notice ok" role="status"><p>{notice}</p></div>}

      <section className="card" aria-label="Danger zone">
        <h2>Danger zone</h2>
        <Button variant="danger" onClick={doWipe} testId="wipe-all">
          {confirmWipe ? 'Tap again to delete ALL journal data' : 'Delete all data on this device'}
        </Button>
        {confirmWipe && (
          <div className="notice danger">
            <p>This permanently deletes every entry and recording on this device. Exported backup files are not affected. This cannot be undone.</p>
          </div>
        )}
      </section>

      <section className="card" aria-label="Demo data">
        <h2>Demo</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
          Load clearly-labeled sample entries (including a synthetic tone as demo audio) to try the app. Remove them any time.
        </p>
        <div className="btn-row">
          <Button variant="secondary" onClick={async () => { await seedDemoData(); setNotice('Demo entries added — look for the 🌱 marker.'); }}>Load demo data</Button>
          <Button variant="ghost" onClick={async () => { await clearDemoData(); setNotice('Demo entries removed.'); }}>Remove demo data</Button>
        </div>
        <div style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={() => navigate({ name: 'privacy' })}>Read the privacy model →</Button>
        </div>
      </section>
    </div>
  );
}
