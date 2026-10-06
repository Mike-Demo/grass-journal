import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listEntries, searchEntries } from '../db';
import { EmptyState, ScreenHeader, formatDateTime } from '../components/ui';
import { href, navigate } from '../lib/router';
import type { JournalEntry } from '../lib/types';

function previewText(e: JournalEntry): string {
  // Never use AI-generated text as the only preview: prefer the user's words.
  if (e.bodyText.trim()) return e.bodyText.trim();
  if (e.transcriptText?.trim()) return e.transcriptText.trim();
  if (e.audioBlobId) return '🎙 Voice recording — no transcript yet.';
  return 'Empty entry.';
}

export default function JournalList() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JournalEntry[] | null>(null);
  const live = useLiveQuery(() => listEntries(), []);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const r = await searchEntries(query);
      if (!cancelled) setResults(r);
    }, 200);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [query, live]);

  const entries = results ?? live ?? [];

  return (
    <div>
      <ScreenHeader title="Journal" backTo={{ name: 'home' }} />
      <div className="field">
        <label htmlFor="journal-search" className="sr-only">Search entries on this device</label>
        <input
          id="journal-search"
          type="text"
          className="search-input"
          placeholder="Search your entries… (offline)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {entries.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          body="Your journal is empty. Capture a thought while it's fresh — it stays on this device."
          action={
            <div className="btn-row" style={{ maxWidth: 320, margin: '16px auto 0' }}>
              <button className="btn btn-primary" onClick={() => navigate({ name: 'record' })}>🎙 Record</button>
              <button className="btn btn-secondary" onClick={() => navigate({ name: 'write' })}>✎ Write</button>
            </div>
          }
        />
      ) : (
        <ul className="entry-list">
          {entries.map((e) => (
            <li key={e.id}>
              <a
                className="entry-card"
                href={href({ name: 'entry', id: e.id })}
                onClick={(ev) => { ev.preventDefault(); navigate({ name: 'entry', id: e.id }); }}
              >
                <div className="entry-meta">
                  <span className="entry-type">{e.entryType}</span>
                  <time dateTime={new Date(e.createdAt).toISOString()}>{formatDateTime(e.createdAt)}</time>
                  {e.favorite && <span className="fav" aria-label="Favorite">★</span>}
                  {e.reflection && <span aria-label="Has AI reflection">✦</span>}
                </div>
                {e.title && <p className="entry-title">{e.title}</p>}
                <p className="entry-preview">{previewText(e)}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
