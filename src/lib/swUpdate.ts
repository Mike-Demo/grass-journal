/**
 * Service-worker update plumbing.
 *
 * vite-plugin-pwa is configured with registerType: 'prompt': a new worker
 * installs in the background and WAITS — it never takes over an open tab on
 * its own, and a plain reload won't activate it either. So we listen for the
 * need-refresh signal, show the in-app banner (App.tsx listens for
 * 'gj:sw-update'), and the banner button calls applySWUpdate(), which tells
 * the waiting worker to activate and then reloads.
 */
import { registerSW } from 'virtual:pwa-register';

let applyUpdate: ((reload: boolean) => void) | null = null;

export function initSWUpdates(): void {
  try {
    const update = registerSW({
      onNeedRefresh() {
        window.dispatchEvent(new Event('gj:sw-update'));
      },
    });
    applyUpdate = update;
  } catch {
    // SW unsupported (private mode, etc.) — app still works online.
  }
}

export function applySWUpdate(): void {
  if (applyUpdate) applyUpdate(true);
  else window.location.reload();
}
