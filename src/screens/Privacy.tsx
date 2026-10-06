import { useState } from 'react';
import { Button, ScreenHeader } from '../components/ui';
import { runPrivacyCheck, type PrivacyCheckResult } from '../lib/netcheck';

/**
 * Privacy screen: plain-language privacy model + a runnable verification that
 * the save/export/restore workflows make zero network requests.
 */
export default function Privacy() {
  const [result, setResult] = useState<PrivacyCheckResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      setResult(await runPrivacyCheck());
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="Privacy" backTo={{ name: 'home' }} />
      <div className="card">
        <h2>Where your data lives</h2>
        <ul>
          <li><strong>Entries, recordings, transcripts, and reflections</strong> are stored in IndexedDB — a private database inside <em>your browser, on this device</em>.</li>
          <li><strong>AI models</strong> you install are cached by your browser on this device.</li>
          <li><strong>Encrypted backups</strong> live wherever <em>you</em> put the file. We never see them.</li>
        </ul>
      </div>
      <div className="card">
        <h2>When the network is used</h2>
        <ul>
          <li><strong>First load:</strong> the app itself downloads once, then works offline.</li>
          <li><strong>Model installation:</strong> only when you tap install, weights download from public open-source CDNs (Hugging Face).</li>
          <li><strong>Never:</strong> entries, transcripts, reflections, and audio are <em>never</em> transmitted. There is no account, no analytics, no telemetry, no tracking pixel, no remote font, no ad script, no hosted AI.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Limits, honestly</h2>
        <ul>
          <li>Clearing browser storage — by you, the browser, the OS, or a device reset — can erase the journal. Export encrypted backups.</li>
          <li>Local storage is <strong>not</strong> the same as full-disk encryption.</li>
          <li>Anyone who can unlock your device may be able to open the journal. There is no app lock in this version.</li>
          <li>If you lose both your device data <em>and</em> your backup (or its passphrase), the journal is gone.</li>
        </ul>
      </div>
      <section className="card" aria-label="Privacy verification">
        <h2>Verify it yourself</h2>
        <p>
          Run a scripted check: the app saves an entry, reflects locally, encrypts a backup,
          and restores it — while every network request is intercepted. It fails if anything
          journal-related leaves the device.
        </p>
        <Button onClick={run} disabled={running} testId="privacy-run-check">
          {running ? 'Running check…' : 'Run privacy check'}
        </Button>
        {result && (
          <div className={result.passed ? 'notice ok' : 'notice danger'} role="status" style={{ marginTop: 12 }}>
            <p><strong>{result.passed ? '✓ Passed — zero network requests during the test.' : '✗ Failed.'}</strong></p>
            <ul>
              {result.steps.map((s) => (
                <li key={s.name}>{s.ok ? '✓' : '✗'} {s.name}{s.detail ? ` — ${s.detail}` : ''}</li>
              ))}
            </ul>
            {result.requests.length > 0 && (
              <>
                <p><strong>Intercepted requests ({result.requests.length}):</strong></p>
                <ul>
                  {result.requests.map((r, i) => (
                    <li key={i}><code>{r.kind}</code> {r.url}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
