import { Button, ScreenHeader } from '../components/ui';
import { navigate } from '../lib/router';
import { updateSettings } from '../lib/hooks';

/**
 * Onboarding: no account, local storage, optional AI, backup responsibility,
 * experimental watch support. AI installation is never forced.
 */
export default function Onboarding() {
  const finish = async (aiEnabled: boolean) => {
    await updateSettings({ onboardingDone: true, privacyAcknowledged: true, aiEnabled });
    navigate(aiEnabled ? { name: 'ai' } : { name: 'home' });
  };

  return (
    <div>
      <ScreenHeader title="Welcome to Grass Journal" />
      <div className="card">
        <h2>Your thoughts stay with you.</h2>
        <ul>
          <li><strong>No account.</strong> Nothing to sign up for, nothing to log into.</li>
          <li><strong>On this device.</strong> Entries and recordings live in your browser's private storage — never on our servers, because there are none.</li>
          <li><strong>AI is optional.</strong> Transcription and reflection run on-device with open-source models you install yourself. The journal works fully without them.</li>
          <li><strong>Backups are yours.</strong> Encrypted export is built in — but <em>you</em> keep the file and the passphrase. Clearing browser storage can erase local data.</li>
          <li><strong>Watch mode is experimental.</strong> A compact capture screen exists for small-screen browsers, but we don't claim it works on every smartwatch.</li>
        </ul>
      </div>
      <div className="notice">
        <p><strong>First run needs internet</strong> — to load the app and, if you choose, download AI models. After that, everything works offline.</p>
      </div>
      <Button onClick={() => finish(false)} testId="onboarding-no-ai">
        Continue without AI
      </Button>
      <div className="btn-row">
        <Button variant="secondary" onClick={() => finish(true)} testId="onboarding-with-ai">
          Set up on-device AI
        </Button>
      </div>
      <p className="hint" style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
        You can install or remove AI models any time from AI Setup.
      </p>
    </div>
  );
}
