import { useEffect, useRef, useState } from 'react';
import { Button, SaveIndicator, ScreenHeader, type SaveState } from '../components/ui';
import { navigate } from '../lib/router';
import { VoiceRecorder, type RecorderState } from '../audio/recorder';
import { detectCapabilities, type Capabilities } from '../lib/capability';
import { formatDuration } from '../components/ui';

/**
 * Voice recording screen. One big action, clear status, immediate local save.
 * Transcription never runs here — it is manual, from the entry detail screen.
 */
export default function Record() {
  const [recState, setRecState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const recRef = useRef<VoiceRecorder | null>(null);

  useEffect(() => {
    detectCapabilities().then(setCaps);
    const rec = new VoiceRecorder();
    recRef.current = rec;
    rec.onStateChange = (s, detail) => {
      setRecState(s);
      if (s === 'error') setError(detail ?? 'Recording error.');
      if (s === 'saving') setSaveState('saving');
    };
    rec.onTick = (ms) => setElapsed(ms);
    // Speak state changes for screen readers.
    return () => {
      // Principle 1: never lose the original. If the user navigates away
      // mid-recording, save — don't discard.
      if (recRef.current) {
        void recRef.current.stopAndSave().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    setConfirmDiscard(false);
    try {
      await recRef.current?.start();
    } catch {
      /* state already set to error */
    }
  };

  const stopAndSave = async () => {
    try {
      const { entry } = await recRef.current!.stopAndSave();
      setSaveState('saved');
      setElapsed(0);
      navigate({ name: 'entry', id: entry.id });
    } catch (e) {
      setSaveState('error');
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  const discard = () => {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    recRef.current?.discard();
    setElapsed(0);
    setConfirmDiscard(false);
    setSaveState('idle');
  };

  const recording = recState === 'recording';

  return (
    <div>
      <ScreenHeader title="Record a thought" backTo={{ name: 'home' }} />
      {caps && !caps.mediaRecorder && (
        <div className="notice danger" role="alert">
          <p><strong>Recording isn't supported</strong> on this browser (no MediaRecorder). You can still write entries — typed journaling is a full alternative.</p>
        </div>
      )}
      <div className="record-stage">
        <div aria-live="polite" className="sr-only">
          {recording ? 'Recording in progress' : recState === 'saving' ? 'Saving recording' : 'Recorder idle'}
        </div>
        {recording && (
          <p className="rec-indicator" aria-hidden="true">
            <span className="dot pulse" /> REC
          </p>
        )}
        <p className="record-timer" aria-label={`Elapsed time ${formatDuration(elapsed / 1000)}`}>
          {formatDuration(elapsed / 1000)}
        </p>
        {!recording ? (
          <button
            className="record-btn"
            onClick={start}
            disabled={recState === 'requesting' || recState === 'saving' || !caps?.mediaRecorder}
            aria-label="Start recording"
            data-testid="record-start"
          >
            {recState === 'requesting' ? '…' : '● Record'}
          </button>
        ) : (
          <button
            className="record-btn recording"
            onClick={stopAndSave}
            aria-label="Stop recording and save"
            data-testid="record-stop"
          >
            ■ Stop &amp; save
          </button>
        )}
        <div style={{ marginTop: 16 }}>
          <SaveIndicator state={saveState} />
        </div>
        {recording && (
          <div className="btn-row" style={{ maxWidth: 320, margin: '16px auto 0' }}>
            <Button variant="danger" onClick={discard} testId="record-discard">
              {confirmDiscard ? 'Tap again to discard' : 'Discard'}
            </Button>
          </div>
        )}
        {error && (
          <div className="notice danger" role="alert">
            <p>{error}</p>
          </div>
        )}
      </div>
      <div className="card">
        <h2>How it works</h2>
        <ul>
          <li>Your recording saves <strong>to this device</strong> the moment you stop.</li>
          <li>Transcription is <strong>manual</strong> — from the entry, after saving.</li>
          <li>Nothing is uploaded. There is nowhere to upload it <em>to</em>.</li>
        </ul>
        {caps && (
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
            Microphone permission: {caps.micPermission} · Format: {caps.mediaRecorder ? 'auto-selected best' : 'n/a'}
          </p>
        )}
      </div>
    </div>
  );
}
