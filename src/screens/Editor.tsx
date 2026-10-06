import { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { Button, SaveIndicator, ScreenHeader, formatDateTime, type SaveState } from '../components/ui';
import { navigate, type Route } from '../lib/router';
import { newEntryId } from '../lib/validation';
import { SCHEMA_VERSION, type JournalEntry } from '../lib/types';

/**
 * Text editor with draft autosave. Every keystroke is debounced into IndexedDB;
 * the save indicator always tells the truth.
 */
export default function Editor({ route }: { route: Extract<Route, { name: 'write' }> }) {
  const entryId = route.id;
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const firstEdit = useRef(true);
  const isNew = useRef(!entryId);
  const entryRef = useRef<JournalEntry | null>(null);
  const bodyRef = useRef('');
  const titleRef = useRef('');

  useEffect(() => {
    (async () => {
      if (entryId) {
        const e = await db.entries.get(entryId);
        if (e) {
          setEntry(e);
          setTitle(e.title ?? '');
          setBody(e.bodyText);
          setSaveState('saved');
        }
      } else {
        const now = Date.now();
        const e: JournalEntry = {
          id: newEntryId(),
          schemaVersion: SCHEMA_VERSION,
          createdAt: now,
          updatedAt: now,
          entryType: 'text',
          bodyText: '',
          transcriptStatus: 'none',
          tags: [],
          favorite: false,
        };
        await db.entries.put(e);
        setEntry(e);
        entryRef.current = e;
        setSaveState('saved');
      }
      setLoaded(true);
    })();
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      // Don't litter the journal with untouched new entries.
      if (isNew.current && !bodyRef.current.trim() && !titleRef.current.trim() && entryRef.current) {
        void db.entries.delete(entryRef.current.id);
      }
    };
  }, [entryId]);

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (!entry) return;
    if (firstEdit.current && !nextBody && !nextTitle) return; // don't churn on load
    firstEdit.current = false;
    setSaveState('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await db.entries.update(entry.id, {
          title: nextTitle.trim() || undefined,
          bodyText: nextBody,
          updatedAt: Date.now(),
        });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 600);
  };

  const onTitle = (v: string) => { setTitle(v); titleRef.current = v; scheduleSave(v, body); };
  const onBody = (v: string) => { setBody(v); bodyRef.current = v; scheduleSave(title, v); };

  if (!loaded || !entry) return <p aria-live="polite">Loading editor…</p>;

  return (
    <div>
      <ScreenHeader title={entryId ? 'Edit entry' : 'New entry'} backTo={{ name: 'journal' }} />
      <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
        Started {formatDateTime(entry.createdAt)}
      </p>
      <div className="field">
        <label htmlFor="entry-title">Title (optional)</label>
        <input
          id="entry-title"
          type="text"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="A few words about this moment"
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="entry-body">Your thoughts</label>
        <textarea
          id="entry-body"
          value={body}
          onChange={(e) => onBody(e.target.value)}
          placeholder="Write freely. This stays on your device."
          aria-describedby="autosave-hint"
        />
        <p className="hint" id="autosave-hint">Autosaves as you type.</p>
      </div>
      <SaveIndicator state={saveState} />
      <div className="btn-row">
        <Button variant="secondary" onClick={() => navigate({ name: 'entry', id: entry.id })}>
          Done — view entry
        </Button>
      </div>
    </div>
  );
}
