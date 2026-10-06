import { useEffect, useState } from 'react';
import { db } from '../db';
import { Button, ScreenHeader } from '../components/ui';
import FeelingWheel, { FEELINGS } from '../components/FeelingWheel';
import { newEntryId } from '../lib/validation';
import { SCHEMA_VERSION } from '../lib/types';

/**
 * Compact check-in mode — the same experience as /watch/: a feeling wheel
 * plus a writing mode for people who'd rather type. (The standalone /watch/
 * page stays zero-framework, so the wheel behavior is mirrored, not shared.)
 * Voice recording lives in the full app's Record screen.
 *
 * Honest scope: designed for small-screen browsers. We do not claim it
 * installs or runs on every Wear OS or Apple Watch device.
 */
export default function Compact() {
  const [writeMode, setWriteMode] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState<number | null>(null);

  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const refreshCount = async () => {
    try {
      const n = await db.entries
        .where('createdAt')
        .aboveOrEqual(todayStart())
        .filter((e) => !e.deletedAt && (e.tags ?? []).includes('compact'))
        .count();
      setCount(n);
    } catch {
      setCount(null);
    }
  };

  useEffect(() => {
    void refreshCount();
  }, []);

  const flashSaved = (msg: string) => {
    setSavedFlash(msg);
    window.setTimeout(() => setSavedFlash(''), 2500);
  };

  const saveMood = async (i: number) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const now = Date.now();
      const f = FEELINGS[i];
      await db.entries.put({
        id: newEntryId(),
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        entryType: 'mood',
        bodyText: `${f.emoji} ${f.label}`,
        transcriptStatus: 'not-started',
        tags: ['compact', 'mood'],
        favorite: false,
      });
      flashSaved(`Saved ✓ ${f.emoji}`);
      void refreshCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveWriting = async () => {
    const body = text.trim();
    if (!body) {
      setError('Write something first.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const now = Date.now();
      await db.entries.put({
        id: newEntryId(),
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        entryType: 'text',
        bodyText: body,
        transcriptStatus: 'none',
        tags: ['compact'],
        favorite: false,
      });
      setText('');
      flashSaved('Saved ✓');
      void refreshCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="compact">
      <ScreenHeader title="⌚ Check in" backTo={{ name: 'home' }} />
      {!writeMode ? (
        <>
          <FeelingWheel onPick={(i) => void saveMood(i)} disabled={saving} />
          <p className="fw-hint">tap to open, tap a feeling to save</p>
          <div style={{ textAlign: 'center' }}>
            <Button variant="ghost" onClick={() => setWriteMode(true)} testId="compact-write-toggle" ariaLabel="Write instead">
              ✎ Write instead
            </Button>
          </div>
        </>
      ) : (
        <>
          <p aria-live="polite" style={{ textAlign: 'center' }}>Write it down</p>
          <div className="field">
            <label htmlFor="compact-write-box" className="sr-only">Write your entry</label>
            <textarea
              id="compact-write-box"
              data-testid="compact-write-box"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              aria-label="Journal entry text"
            />
          </div>
          <Button onClick={saveWriting} disabled={saving} testId="compact-write-save" ariaLabel="Save written entry">
            {saving ? 'Saving…' : 'Save entry'}
          </Button>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setWriteMode(false)} ariaLabel="Back to feelings">
              ← Feelings
            </Button>
          </div>
        </>
      )}
      {savedFlash && <p role="status" style={{ fontWeight: 700, color: 'var(--ok)', textAlign: 'center' }}>{savedFlash}</p>}
      {error && <div className="notice danger" role="alert"><p>{error}</p></div>}
      <p data-testid="compact-count" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', textAlign: 'center' }}>
        {count === null ? '' : count === 0 ? 'No check-ins yet today' : `${count} check-in${count === 1 ? '' : 's'} today`}
      </p>
    </div>
  );
}
