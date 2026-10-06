import { ScreenHeader } from '../components/ui';

/**
 * Open source credits: the open-source software Grass Journal is built with.
 * Licenses verified against the installed packages (2026-10-06).
 *
 * The app's own source is public at
 * https://github.com/Mike-Demo/grass-journal (a personal project, MIT).
 */

const LIBRARIES: { name: string; license: string; what: string }[] = [
  { name: 'React + React DOM', license: 'MIT', what: 'User interface' },
  { name: 'Dexie.js', license: 'Apache-2.0', what: 'IndexedDB wrapper — where your journal lives' },
  { name: 'dexie-react-hooks', license: 'Apache-2.0', what: 'Live database queries in the UI' },
  { name: 'Transformers.js (@huggingface/transformers)', license: 'Apache-2.0', what: 'On-device Whisper transcription' },
  { name: 'WebLLM (@mlc-ai/web-llm)', license: 'Apache-2.0', what: 'On-device reflection with Qwen' },
  { name: 'Zod', license: 'MIT', what: 'Data validation' },
];

const MODELS: { name: string; license: string; what: string }[] = [
  { name: 'Whisper tiny.en (OpenAI)', license: 'MIT', what: 'Speech-to-text model, runs on your device' },
  { name: 'Qwen2.5-0.5B-Instruct (Alibaba)', license: 'Apache 2.0', what: 'Reflection model, runs on your device' },
];

const TOOLING = 'Vite, TypeScript, vite-plugin-pwa (Workbox), Vitest, Playwright — all MIT or Apache-2.0 — build and test the app. They ship no code to your device.';

export default function OpenSource() {
  return (
    <div>
      <ScreenHeader title="Open source credits" backTo={{ name: 'home' }} />
      <div className="card">
        <p>
          Grass Journal stands on open-source software. Everything below is
          used under its own license. The app's own source is public too:{' '}
          <a
            href="https://github.com/Mike-Demo/grass-journal"
            target="_blank"
            rel="noreferrer"
          >
            github.com/Mike-Demo/grass-journal
          </a>{' '}
          — a personal project, shared as-is under the MIT license.
        </p>
      </div>
      <div className="card">
        <h2>Libraries</h2>
        <ul>
          {LIBRARIES.map((l) => (
            <li key={l.name}>
              <strong>{l.name}</strong> — {l.license}. {l.what}.
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>AI models</h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          Open-weight models, downloaded only when you explicitly install them,
          run entirely on your device. Used — not trained — by us.
        </p>
        <ul>
          {MODELS.map((m) => (
            <li key={m.name}>
              <strong>{m.name}</strong> — {m.license}. {m.what}.
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Build tooling</h2>
        <p>{TOOLING}</p>
      </div>
    </div>
  );
}
