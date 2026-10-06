import { useEffect, useState } from 'react';
import { db, softDeleteEntry } from '../db';
import {
  AiBadge, Button, EmptyState, ScreenHeader,
  formatDateTime, formatDuration, formatBytes,
} from '../components/ui';
import { navigate, type Route } from '../lib/router';
import { useModels } from '../lib/hooks';
import { decodeTo16kMono } from '../audio/recorder';
import { transcribeAudio } from '../ai/transcribeClient';
import { reflectionClient } from '../ai/reflectClient';
import { exportSingleEntry } from '../lib/backup';
import type { JournalEntry, Reflection } from '../lib/types';

export default function EntryDetail({ route }: { route: Extract<Route, { name: 'entry' }> }) {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioBytes, setAudioBytes] = useState(0);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingReflection, setEditingReflection] = useState(false);
  const [editForm, setEditForm] = useState({ summary: '', tags: '', themes: '', question: '' });
  const [exportPass, setExportPass] = useState('');
  const [showExport, setShowExport] = useState(false);
  const models = useModels();

  const load = async () => {
    const e = await db.entries.get(route.id);
    setEntry(e ?? null);
    if (e?.audioBlobId) {
      const a = await db.audio.get(e.audioBlobId);
      if (a) {
        setAudioUrl(URL.createObjectURL(a.blob));
        setAudioBytes(a.byteLength);
      }
    }
  };
  useEffect(() => { load(); }, [route.id]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const save = async (patch: Partial<JournalEntry>) => {
    await db.entries.update(route.id, { ...patch, updatedAt: Date.now() });
    await load();
  };

  const transcriptionReady = models?.find((m) => m.modelType === 'transcription')?.status === 'ready';
  const reflectionReady = models?.find((m) => m.modelType === 'reflection')?.status === 'ready';

  const doTranscribe = async () => {
    if (!entry?.audioBlobId) return;
    setError(''); setBusy('transcribing'); setProgress(0);
    try {
      // Audio was already saved when recording stopped (principle 5) — safe to process.
      const a = await db.audio.get(entry.audioBlobId);
      if (!a) throw new Error('Recording not found.');
      await db.entries.update(entry.id, { transcriptStatus: 'transcribing' });
      setProgressDetail('Decoding audio…');
      const pcm = await decodeTo16kMono(a.blob);
      const text = await transcribeAudio(pcm, {
        onProgress: (stage, p, detail) => {
          setProgress(p);
          setProgressDetail(stage === 'download' ? `Loading model… ${p}%` : stage === 'transcribe' ? 'Transcribing…' : detail ?? '');
        },
      });
      await save({ transcriptText: text, transcriptStatus: 'done', transcriptionModel: 'whisper-tiny.en' });
    } catch (e) {
      await db.entries.update(entry.id, { transcriptStatus: 'failed' }).catch(() => {});
      setError(e instanceof Error ? e.message : 'Transcription failed. Your recording is safe.');
      await load();
    } finally {
      setBusy(''); setProgress(0); setProgressDetail('');
    }
  };

  const reflectSource = (entry?.bodyText?.trim() || entry?.transcriptText?.trim() || '');

  const doReflect = async (deterministic: boolean) => {
    if (!reflectSource) { setError('Add some text or a transcript first.'); return; }
    setError(''); setBusy('reflecting'); setProgress(0);
    try {
      const reflection: Reflection = deterministic
        ? reflectionClient.reflectDeterministic(reflectSource)
        : await reflectionClient.reflect(reflectSource, {
            onProgress: (p, detail) => { setProgress(p); setProgressDetail(detail ?? ''); },
          });
      await save({ reflection });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reflection failed. Your entry is unchanged.');
    } finally {
      setBusy(''); setProgress(0); setProgressDetail('');
    }
  };

  const startEditReflection = () => {
    if (!entry?.reflection) return;
    setEditForm({
      summary: entry.reflection.summary,
      tags: entry.reflection.tags.join(', '),
      themes: entry.reflection.themes.join(', '),
      question: entry.reflection.reflectionQuestion,
    });
    setEditingReflection(true);
  };

  const saveEditedReflection = async () => {
    if (!entry?.reflection) return;
    await save({
      reflection: {
        ...entry.reflection,
        summary: editForm.summary.trim(),
        tags: editForm.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5),
        themes: editForm.themes.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3),
        reflectionQuestion: editForm.question.trim(),
        userEdited: true,
        generatedAt: Date.now(),
      },
    });
    setEditingReflection(false);
  };

  const doDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await softDeleteEntry(route.id);
    navigate({ name: 'journal' });
  };

  const doExportSingle = async () => {
    setError('');
    try {
      const { blob, filename } = await exportSingleEntry(route.id, exportPass);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setShowExport(false); setExportPass('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  if (!entry) return <EmptyState title="Entry not found." body="It may have been deleted." action={<Button variant="secondary" onClick={() => navigate({ name: 'journal' })}>Back to journal</Button>} />;

  return (
    <div>
      <ScreenHeader title={entry.title || formatDateTime(entry.createdAt)} backTo={{ name: 'journal' }} />
      <div className="entry-meta">
        <span className="entry-type">{entry.entryType}</span>
        <time dateTime={new Date(entry.createdAt).toISOString()}>{formatDateTime(entry.createdAt)}</time>
        {entry.audioDuration != null && <span>🎙 {formatDuration(entry.audioDuration)}</span>}
      </div>

      {/* ORIGINAL CONTENT — always visually separated from AI output */}
      {(entry.bodyText || entry.audioBlobId) && (
        <section className="original-block" aria-label="Your original entry">
          <p className="kicker">Your words</p>
          {entry.bodyText && <p style={{ whiteSpace: 'pre-wrap' }}>{entry.bodyText}</p>}
          {audioUrl && (
            <div>
              <audio controls src={audioUrl} aria-label="Play your recording" />
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                {entry.audioMimeType} · {formatBytes(audioBytes)} · saved on this device
              </p>
            </div>
          )}
        </section>
      )}

      {/* TRANSCRIPT */}
      {entry.audioBlobId && (
        <section className="card" aria-label="Transcript">
          <h2>Transcript</h2>
          {entry.transcriptStatus === 'done' && entry.transcriptText ? (
            <>
              <p style={{ whiteSpace: 'pre-wrap' }}>{entry.transcriptText}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                Model: {entry.transcriptionModel ?? 'unknown'} · editable below
              </p>
              <div className="field">
                <label htmlFor="transcript-edit">Edit transcript</label>
                <textarea
                  id="transcript-edit"
                  value={entry.transcriptText}
                  onChange={(e) => save({ transcriptText: e.target.value })}
                  rows={4}
                />
              </div>
              <Button variant="ghost" onClick={() => save({ transcriptText: undefined, transcriptStatus: 'not-started', transcriptionModel: undefined })}>
                Remove transcript
              </Button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--ink-soft)' }}>
                {entry.transcriptStatus === 'transcribing' ? 'Transcribing…' :
                 entry.transcriptStatus === 'failed' ? 'Last attempt failed — your recording is safe.' :
                 'No transcript yet. Transcription is manual and runs on-device.'}
              </p>
              {transcriptionReady ? (
                <Button onClick={doTranscribe} disabled={busy !== ''} testId="entry-transcribe">
                  {busy === 'transcribing' ? 'Transcribing…' : '🎙 Transcribe on this device'}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate({ name: 'ai' })}>
                  Install transcription model
                </Button>
              )}
            </>
          )}
        </section>
      )}

      {/* REFLECTION */}
      <section className="card" aria-label="AI reflection">
        <h2>Reflection</h2>
        {entry.reflection && !editingReflection ? (
          <div className="ai-block">
            <p className="kicker">AI-generated — not your words</p>
            <AiBadge model={entry.reflection.model} />
            <p><strong>Summary:</strong> {entry.reflection.summary || <em>—</em>}</p>
            {entry.reflection.tags.length > 0 && <p><strong>Tags:</strong> {entry.reflection.tags.join(', ')}</p>}
            {entry.reflection.themes.length > 0 && <p><strong>Themes:</strong> {entry.reflection.themes.join(', ')}</p>}
            {entry.reflection.reflectionQuestion && <p><strong>To sit with:</strong> {entry.reflection.reflectionQuestion}</p>}
            {entry.reflection.userEdited && <p style={{ fontSize: '0.8rem' }}><em>Edited by you.</em></p>}
            <div className="btn-row">
              <Button variant="secondary" onClick={startEditReflection}>Edit</Button>
              <Button variant="ghost" onClick={() => save({ reflection: undefined })}>Delete</Button>
            </div>
          </div>
        ) : editingReflection ? (
          <div>
            <div className="field"><label htmlFor="r-summary">Summary</label><input id="r-summary" type="text" value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} /></div>
            <div className="field"><label htmlFor="r-tags">Tags (comma-separated, max 5)</label><input id="r-tags" type="text" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} /></div>
            <div className="field"><label htmlFor="r-themes">Themes (comma-separated, max 3)</label><input id="r-themes" type="text" value={editForm.themes} onChange={(e) => setEditForm({ ...editForm, themes: e.target.value })} /></div>
            <div className="field"><label htmlFor="r-q">Reflection question</label><input id="r-q" type="text" value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} /></div>
            <div className="btn-row">
              <Button onClick={saveEditedReflection}>Save edits</Button>
              <Button variant="ghost" onClick={() => setEditingReflection(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--ink-soft)' }}>
              A short, neutral reflection generated <strong>on this device</strong> from this entry only.
              Never overwrites your words.
            </p>
            {reflectionReady ? (
              <Button onClick={() => doReflect(false)} disabled={busy !== '' || !reflectSource} testId="entry-reflect">
                {busy === 'reflecting' ? 'Reflecting…' : '✦ Reflect on this device'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => navigate({ name: 'ai' })}>
                  Install reflection model
                </Button>
                <div style={{ marginTop: 8 }}>
                  <Button variant="ghost" onClick={() => doReflect(true)} disabled={busy !== '' || !reflectSource}>
                    Use simple on-device tags instead (no AI model)
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {(busy === 'transcribing' || busy === 'reflecting') && (
        <div className="card" role="status" aria-live="polite">
          <p>{progressDetail || 'Working…'} {progress}%</p>
          <div className="progress"><div style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {error && <div className="notice danger" role="alert"><p>{error}</p></div>}

      <div className="card">
        <h2>Manage</h2>
        <div className="btn-row">
          {entry.entryType !== 'voice' && (
            <Button variant="secondary" onClick={() => navigate({ name: 'write', id: entry.id })}>Edit text</Button>
          )}
          <Button variant="secondary" onClick={() => save({ favorite: !entry.favorite })} aria-pressed={entry.favorite}>
            {entry.favorite ? '★ Favorited' : '☆ Favorite'}
          </Button>
        </div>
        <div className="btn-row">
          <Button variant="ghost" onClick={() => setShowExport((s) => !s)}>Export this entry (encrypted)</Button>
          <Button variant="danger" onClick={doDelete} testId="entry-delete">
            {confirmDelete ? 'Tap again to confirm delete' : 'Delete entry'}
          </Button>
        </div>
        {showExport && (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="single-export-pass">Backup passphrase (min 8 characters)</label>
            <input id="single-export-pass" type="password" value={exportPass} onChange={(e) => setExportPass(e.target.value)} autoComplete="new-password" />
            <div style={{ marginTop: 8 }}>
              <Button onClick={doExportSingle} disabled={exportPass.length < 8}>Download encrypted file</Button>
            </div>
          </div>
        )}
        {confirmDelete && (
          <div className="notice danger"><p>The entry and its recording will be removed from this device. Your encrypted backups are unaffected.</p></div>
        )}
      </div>
    </div>
  );
}
