/**
 * Small pure helpers for AI model progress + platform detection.
 * Kept dependency-free so they can be unit-tested without loading engines.
 */

/** Clamp any progress event to an honest 0–100. v4 reports 0–100 already;
 *  older/newer engines might report 0–1 — normalize both, never trust raw. */
export function clampPercent(p: unknown): number {
  const n = typeof p === 'number' && Number.isFinite(p) ? p : 0;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** True on iPhone/iPad/iPod (incl. iPadOS reporting as MacIntel). */
export function isIOSDevice(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  );
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isIOSDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0);
}
