import { useEffect, useState } from 'react';
import { href, navigate, useRoute } from './lib/router';
import Home from './screens/Home';
import Onboarding from './screens/Onboarding';
import Record from './screens/Record';
import Editor from './screens/Editor';
import JournalList from './screens/JournalList';
import EntryDetail from './screens/EntryDetail';
import AISetup from './screens/AISetup';
import StorageBackup from './screens/StorageBackup';
import Privacy from './screens/Privacy';
import OpenSource from './screens/OpenSource';
import Compact from './screens/Compact';
import { useEnsureSettings, useSettings } from './lib/hooks';
import { applySWUpdate } from './lib/swUpdate';

export default function App() {
  const route = useRoute();
  const settings = useSettings();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEnsureSettings();

  useEffect(() => {
    // Safe update flow: notify, never force — and never mid-recording/draft.
    const onUpdate = () => setUpdateAvailable(true);
    window.addEventListener('gj:sw-update', onUpdate);
    return () => window.removeEventListener('gj:sw-update', onUpdate);
  }, []);

  // Compact mode: manual toggle wins; 'auto' follows very small screens.
  useEffect(() => {
    if (settings?.compactMode === 'on' && route.name === 'home') navigate({ name: 'compact' });
  }, [settings?.compactMode, route.name]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="topbar">
        <a className="brand" href={href({ name: 'home' })} onClick={(e) => { e.preventDefault(); navigate({ name: 'home' }); }}>
          <span aria-hidden="true">🌱</span> Grass Journal
        </a>
        <nav aria-label="Primary">
          <a className="nav-link" href={href({ name: 'journal' })} onClick={(e) => { e.preventDefault(); navigate({ name: 'journal' }); }}>Journal</a>
          <a className="nav-link" href={href({ name: 'record' })} onClick={(e) => { e.preventDefault(); navigate({ name: 'record' }); }}>Record</a>
        </nav>
      </div>
      {updateAvailable && (
        <div className="notice" role="status" style={{ margin: '8px 16px 0' }}>
          <p><strong>An update is ready.</strong> Tap below to apply it — never while you're recording or drafting.</p>
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={applySWUpdate}>
            Update now
          </button>
        </div>
      )}
      <main id="main" className="app">
        {route.name === 'home' && <Home />}
        {route.name === 'onboarding' && <Onboarding />}
        {route.name === 'record' && <Record />}
        {route.name === 'write' && <Editor route={route} />}
        {route.name === 'journal' && <JournalList />}
        {route.name === 'entry' && <EntryDetail route={route} />}
        {route.name === 'ai' && <AISetup />}
        {route.name === 'storage' && <StorageBackup />}
        {route.name === 'privacy' && <Privacy />}
        {route.name === 'open-source' && <OpenSource />}
        {route.name === 'compact' && <Compact />}
      </main>
    </>
  );
}
