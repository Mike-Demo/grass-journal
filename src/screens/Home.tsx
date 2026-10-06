import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Button, NavLink } from '../components/ui';
import { markOnboardingRedirectDone, navigate, onboardingRedirectDone } from '../lib/router';
import { useSettings, useModels } from '../lib/hooks';
import { getStorageInfo } from '../lib/capability';

export default function Home() {
  const settings = useSettings();
  const models = useModels();
  const [online, setOnline] = useState(navigator.onLine);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number }>({});
  const entryCount = useLiveQuery(() => db.entries.filter((e) => e.deletedAt == null).count(), []);
  const audioCount = useLiveQuery(() => db.audio.count(), []);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    getStorageInfo().then(setStorage);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  useEffect(() => {
    if (settings && !settings.onboardingDone && !onboardingRedirectDone) {
      markOnboardingRedirectDone();
      navigate({ name: 'onboarding' });
    }
  }, [settings]);

  const transcription = models?.find((m) => m.modelType === 'transcription');
  const reflection = models?.find((m) => m.modelType === 'reflection');

  const modelStatus = (m?: { status: string }) =>
    !m || m.status === 'not-installed' ? 'Not installed'
    : m.status === 'ready' ? 'Ready'
    : m.status === 'downloading' ? 'Downloading…'
    : m.status === 'unsupported' ? 'Unsupported on this device'
    : 'Needs attention';

  return (
    <div>
      {!online && (
        <div className="offline-banner" role="alert">
          Offline — the journal works fully offline.
        </div>
      )}
      <section className="hero">
        <div className="sprout" aria-hidden="true">🌱</div>
        <h1>Grass Journal</h1>
        <p className="promise">“Your thoughts stay with you.”</p>
        <p>A private journal for walks, gardens, commutes, and quiet moments. No account. No cloud. No tracking.</p>
      </section>

      <div className="btn-row" style={{ marginBottom: 4 }}>
        <Button onClick={() => navigate({ name: 'record' })} testId="home-record" ariaLabel="Record a voice thought">
          🎙 Record thought
        </Button>
        <Button variant="secondary" onClick={() => navigate({ name: 'write' })} testId="home-write" ariaLabel="Write a text entry">
          ✎ Write entry
        </Button>
      </div>
      <div className="btn-row">
        <Button variant="secondary" onClick={() => navigate({ name: 'journal' })} testId="home-journal">
          📖 View journal
        </Button>
        <Button variant="ghost" onClick={() => navigate({ name: 'compact' })} ariaLabel="Open compact capture mode for small screens">
          ⌚ Compact mode
        </Button>
      </div>

      <div className="status-grid" aria-label="Journal status">
        <div className="status-chip">
          <span className="label">Entries</span>
          <span className="value">{entryCount ?? '…'}</span>
        </div>
        <div className="status-chip">
          <span className="label">Recordings</span>
          <span className="value">{audioCount ?? '…'}</span>
        </div>
        <div className="status-chip">
          <span className="label">Connection</span>
          <span className="value">{online ? 'Online' : 'Offline ✓'}</span>
        </div>
        <div className="status-chip">
          <span className="label">Transcription AI</span>
          <span className="value">{settings?.aiEnabled === false ? 'Off' : modelStatus(transcription)}</span>
        </div>
        <div className="status-chip">
          <span className="label">Reflection AI</span>
          <span className="value">{settings?.aiEnabled === false ? 'Off' : modelStatus(reflection)}</span>
        </div>
        <div className="status-chip">
          <span className="label">Last backup</span>
          <span className="value">
            {settings?.lastSuccessfulExportAt
              ? new Date(settings.lastSuccessfulExportAt).toLocaleDateString()
              : 'Never'}
          </span>
        </div>
      </div>

      {settings?.backupReminder && !settings?.lastSuccessfulExportAt && (entryCount ?? 0) > 0 && (
        <div className="notice">
          <p><strong>Back up your journal.</strong> Local browser data can be erased by the browser, the OS, or a device reset. <NavLink to={{ name: 'storage' }}>Export an encrypted backup</NavLink> — it takes a minute.</p>
        </div>
      )}

      <nav className="card" aria-label="More">
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Button variant="ghost" onClick={() => navigate({ name: 'ai' })}>AI setup</Button>
          <Button variant="ghost" onClick={() => navigate({ name: 'storage' })}>Storage &amp; backup</Button>
          <Button variant="ghost" onClick={() => navigate({ name: 'privacy' })}>Privacy</Button>
          <Button variant="ghost" onClick={() => navigate({ name: 'open-source' })} testId="home-open-source">Open source</Button>
        </div>
      </nav>
      {typeof storage.usage === 'number' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', textAlign: 'center' }}>
          Using {(storage.usage / 1048576).toFixed(1)} MB on this device
        </p>
      )}
    </div>
  );
}
