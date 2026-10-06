import { useEffect, useRef, useState } from 'react';
import { Button, ScreenHeader } from '../components/ui';
import { setModelStatus, useModels } from '../lib/hooks';
import { detectCapabilities, type Capabilities } from '../lib/capability';
import { initTranscriptionModel, terminateTranscriptionWorker } from '../ai/transcribeClient';
import { TRANSCRIBE_MODEL_ID } from '../ai/modelIds';
import { isIOS } from '../ai/progress';
import type { ModelInstall } from '../lib/types';

interface ModelCard {
  modelId: string;
  modelType: 'transcription' | 'reflection';
  title: string;
  description: string;
  approxSize: string;
  engine: string;
  requiresWebGPU: boolean;
}

const CARDS: ModelCard[] = [
  {
    modelId: 'whisper-tiny-en',
    modelType: 'transcription',
    title: 'Speech transcription',
    description: 'Whisper Tiny English (open source, ~39M params). Turns your recordings into text, on-device. Manually triggered per entry.',
    approxSize: '~150 MB',
    engine: 'Transformers.js (WebGPU when available, WebAssembly fallback)',
    requiresWebGPU: false,
  },
  {
    modelId: 'qwen2.5-0.5b-instruct',
    modelType: 'reflection',
    title: 'Reflection',
    description: 'Qwen2.5 0.5B Instruct, quantized (open weights). Writes a short neutral summary, tags, themes, and one optional question — from the selected entry only.',
    approxSize: '~450 MB',
    engine: 'WebLLM (requires WebGPU)',
    requiresWebGPU: true,
  },
];

export default function AISetup() {
  const models = useModels();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  /** Guard against double-tap installs: two simultaneous model loads can
   *  exhaust mobile browser memory and kill the tab. */
  const installingRef = useRef(false);

  useEffect(() => { detectCapabilities().then(setCaps); }, []);

  const statusOf = (id: string): ModelInstall | undefined => models?.find((m) => m.modelId === id);

  const installTranscription = async () => {
    if (installingRef.current) return;
    installingRef.current = true;
    setError('');
    // Drop any half-initialized worker before starting fresh.
    terminateTranscriptionWorker();
    await setModelStatus('whisper-tiny-en', 'transcription', { status: 'downloading', engine: 'transformers.js', error: undefined });
    try {
      await initTranscriptionModel({
        onProgress: (stage, p, d) => {
          setProgress((s) => ({ ...s, 'whisper-tiny-en': p }));
          setDetail((s) => ({ ...s, 'whisper-tiny-en': stage === 'download' ? `Downloading model… ${p}%` : d ?? stage }));
        },
      }, TRANSCRIBE_MODEL_ID);
      await setModelStatus('whisper-tiny-en', 'transcription', {
        status: 'ready', installedAt: Date.now(), lastVerifiedAt: Date.now(), approximateBytes: 150 * 1024 * 1024,
      });
    } catch (e) {
      await setModelStatus('whisper-tiny-en', 'transcription', { status: 'failed', error: e instanceof Error ? e.message : String(e) });
      setError('Transcription model failed to install. Check your connection and retry — the journal works fine without it.');
    } finally {
      installingRef.current = false;
    }
  };

  const installReflection = async () => {
    if (installingRef.current) return;
    installingRef.current = true;
    setError('');
    await setModelStatus('qwen2.5-0.5b-instruct', 'reflection', { status: 'downloading', engine: 'web-llm', error: undefined });
    const worker = new Worker(new URL('../ai/reflection.worker.ts', import.meta.url), { type: 'module' });
    try {
      await new Promise<void>((resolve, reject) => {
        const onMessage = (e: MessageEvent) => {
          const m = e.data as { type: string; progress?: number; detail?: string; message?: string };
          if (m.type === 'progress') {
            setProgress((s) => ({ ...s, 'qwen2.5-0.5b-instruct': m.progress ?? 0 }));
            setDetail((s) => ({ ...s, 'qwen2.5-0.5b-instruct': m.detail ?? 'Loading…' }));
          } else if (m.type === 'ready') {
            worker.removeEventListener('message', onMessage);
            resolve();
          } else if (m.type === 'error') {
            worker.removeEventListener('message', onMessage);
            reject(new Error(m.message ?? 'Engine failed to start.'));
          }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ type: 'init' });
      });
      await setModelStatus('qwen2.5-0.5b-instruct', 'reflection', {
        status: 'ready', installedAt: Date.now(), lastVerifiedAt: Date.now(), approximateBytes: 450 * 1024 * 1024,
      });
    } catch (e) {
      await setModelStatus('qwen2.5-0.5b-instruct', 'reflection', { status: 'failed', error: e instanceof Error ? e.message : String(e) });
      setError('Reflection model failed to install. The journal works fully without it.');
    } finally {
      installingRef.current = false;
      worker.terminate();
    }
  };

  const removeModel = async (card: ModelCard) => {
    // Best effort: drop cached weights, then the install record.
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => /transformers|mlc|web-llm|grass-journal-models/i.test(k)).map((k) => caches.delete(k)),
      );
    } catch { /* cache API unavailable */ }
    if (card.modelType === 'transcription') terminateTranscriptionWorker();
    await setModelStatus(card.modelId, card.modelType, {
      status: 'not-installed', installedAt: undefined, approximateBytes: undefined, error: undefined,
    });
    setProgress((s) => ({ ...s, [card.modelId]: 0 }));
  };

  const markUnsupported = async (card: ModelCard) => {
    await setModelStatus(card.modelId, card.modelType, { status: 'unsupported', error: 'WebGPU is not available on this device/browser.' });
  };

  useEffect(() => {
    if (!caps) return;
    for (const card of CARDS) {
      const st = statusOf(card.modelId);
      if (card.requiresWebGPU && !caps.webgpu && (!st || st.status === 'not-installed')) {
        void markUnsupported(card);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps, models === undefined]);

  return (
    <div>
      <ScreenHeader title="On-device AI setup" backTo={{ name: 'home' }} />
      <div className="notice">
        <p><strong>Optional, always.</strong> Both models run entirely on this device. Downloading them is the <em>only</em> time the app contacts the network for anything besides the app itself — and only when you tap install.</p>
      </div>
      {error && <div className="notice danger" role="alert"><p>{error}</p></div>}
      {caps && (
        <div className="card">
          <h2>This device</h2>
          <dl className="kv">
            <dt>WebGPU</dt><dd>{caps.webgpu ? 'Available' : 'Not available'}</dd>
            <dt>WebAssembly</dt><dd>{caps.wasm ? 'Available' : 'Not available'}</dd>
            <dt>Microphone</dt><dd>{caps.mediaRecorder ? `Supported (${caps.micPermission})` : 'Not supported'}</dd>
          </dl>
          {!caps.webgpu && (
            <p style={{ fontSize: '0.9rem' }}>Reflection needs WebGPU, so it will be disabled here — transcription can still use WebAssembly, and the journal itself is unaffected.</p>
          )}
        </div>
      )}
      {CARDS.map((card) => {
        const st = statusOf(card.modelId);
        const status = st?.status ?? 'not-installed';
        const unsupported = card.requiresWebGPU && caps && !caps.webgpu;
        return (
          <section className="card" key={card.modelId} aria-label={card.title}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <dl className="kv">
              <dt>Engine</dt><dd>{card.engine}</dd>
              <dt>Download</dt><dd>{card.approxSize} (approximate)</dd>
              <dt>Status</dt>
              <dd>
                {status === 'ready' ? 'Ready ✓'
                  : status === 'downloading' ? 'Downloading…'
                  : status === 'failed' ? 'Failed — retry available'
                  : status === 'unsupported' ? 'Unsupported on this device'
                  : 'Not installed'}
              </dd>
              {st?.installedAt && (<><dt>Installed</dt><dd>{new Date(st.installedAt).toLocaleDateString()}</dd></>)}
            </dl>
            {status === 'downloading' && (
              <div role="status" aria-live="polite" style={{ margin: '8px 0' }}>
                <p>{detail[card.modelId] ?? 'Downloading…'} {progress[card.modelId] ?? 0}%</p>
                <div className="progress"><div style={{ width: `${progress[card.modelId] ?? 0}%` }} /></div>
              </div>
            )}
            {st?.error && status !== 'downloading' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>Last error: {st.error}</p>
            )}
            {card.modelType === 'transcription' && isIOS() && status !== 'ready' && (
              <div className="notice" role="note">
                <p><strong>Experimental on iPhone/iPad.</strong> Loading a 150&nbsp;MB model can exceed
                this browser's memory limit and crash the tab. Your recordings are always safe —
                if transcription won't run here, install the app on a desktop browser later and
                transcribe there. Tap install once and let it finish.</p>
              </div>
            )}
            <div className="btn-row">
              {status === 'ready' ? (
                <Button variant="secondary" onClick={() => removeModel(card)}>Remove model</Button>
              ) : unsupported ? (
                <Button disabled>WebGPU unavailable</Button>
              ) : (
                <Button
                  onClick={() => (card.modelType === 'transcription' ? installTranscription() : installReflection())}
                  disabled={status === 'downloading'}
                >
                  {status === 'failed' ? 'Retry install' : `Install (${card.approxSize})`}
                </Button>
              )}
            </div>
            {status === 'ready' && card.modelType === 'reflection' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                No model? The entry screen still offers simple on-device keyword tags — no download, no AI.
              </p>
            )}
          </section>
        );
      })}
      <div className="notice ok">
        <p><strong>Privacy note:</strong> models are fetched from public open-source CDNs (Hugging Face). Only model weights download — your entries never upload.</p>
      </div>
    </div>
  );
}
