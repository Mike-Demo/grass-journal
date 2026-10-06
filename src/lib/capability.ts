/**
 * Capability detection. Used to disable AI gracefully and to explain honestly
 * what this device can and cannot do. Never inferred — always probed.
 */
export interface Capabilities {
  webgpu: boolean;
  wasm: boolean;
  mediaRecorder: boolean;
  audioWorklet: boolean;
  indexedDB: boolean;
  storageEstimate: boolean;
  persist: boolean;
  serviceWorker: boolean;
  share: boolean;
  smallScreen: boolean;
  micPermission: 'prompt' | 'granted' | 'denied' | 'unknown';
}

export async function detectCapabilities(): Promise<Capabilities> {
  let micPermission: Capabilities['micPermission'] = 'unknown';
  try {
    const perms = (navigator as unknown as { permissions?: { query(o: { name: string }): Promise<{ state: string }> } }).permissions;
    if (perms) {
      const r = await perms.query({ name: 'microphone' as never });
      if (r.state === 'granted' || r.state === 'denied' || r.state === 'prompt') micPermission = r.state;
    }
  } catch {
    /* permissions API unavailable */
  }

  return {
    webgpu: typeof (navigator as unknown as { gpu?: unknown }).gpu !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined',
    mediaRecorder:
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia,
    audioWorklet: typeof AudioContext !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined',
    storageEstimate: typeof navigator !== 'undefined' && !!navigator.storage?.estimate,
    persist: typeof navigator !== 'undefined' && !!navigator.storage?.persist,
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    share: typeof navigator !== 'undefined' && 'share' in navigator,
    smallScreen: typeof window !== 'undefined' && window.innerWidth < 360,
    micPermission,
  };
}

/** Pick the best MediaRecorder MIME type the browser actually supports. */
export function pickAudioMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/webm', 'webm'],
    ['audio/mp4', 'mp4'], // Safari
    ['audio/ogg;codecs=opus', 'ogg'],
  ] as const;
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return { mimeType: '', extension: 'webm' };
  }
  for (const [mimeType, extension] of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType, extension };
  }
  return { mimeType: '', extension: 'webm' }; // let the browser decide
}

export async function getStorageInfo(): Promise<{
  usage?: number;
  quota?: number;
  persisted?: boolean;
}> {
  const info: { usage?: number; quota?: number; persisted?: boolean } = {};
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      info.usage = est.usage;
      info.quota = est.quota;
    }
    if (navigator.storage?.persisted) {
      info.persisted = await navigator.storage.persisted();
    }
  } catch {
    /* ignore */
  }
  return info;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
