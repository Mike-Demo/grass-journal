/** Minimal hash router — no dependency, works offline from any static host. */
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'onboarding' }
  | { name: 'record' }
  | { name: 'write'; id?: string }
  | { name: 'journal' }
  | { name: 'entry'; id: string }
  | { name: 'ai' }
  | { name: 'storage' }
  | { name: 'privacy' }
  | { name: 'open-source' }
  | { name: 'compact' };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const params = new URLSearchParams(query ?? '');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'onboarding') return { name: 'onboarding' };
  if (parts[0] === 'record') return { name: 'record' };
  if (parts[0] === 'write') return { name: 'write', id: parts[1] || params.get('id') || undefined };
  if (parts[0] === 'journal') return { name: 'journal' };
  if (parts[0] === 'entry' && parts[1]) return { name: 'entry', id: parts[1] };
  if (parts[0] === 'ai') return { name: 'ai' };
  if (parts[0] === 'storage') return { name: 'storage' };
  if (parts[0] === 'privacy') return { name: 'privacy' };
  if (parts[0] === 'open-source') return { name: 'open-source' };
  if (parts[0] === 'compact') return { name: 'compact' };
  return { name: 'home' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home': return '#/';
    case 'onboarding': return '#/onboarding';
    case 'record': return '#/record';
    case 'write': return r.id ? `#/write/${r.id}` : '#/write';
    case 'journal': return '#/journal';
    case 'entry': return `#/entry/${r.id}`;
    case 'ai': return '#/ai';
    case 'storage': return '#/storage';
    case 'privacy': return '#/privacy';
    case 'open-source': return '#/open-source';
    case 'compact': return '#/compact';
  }
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

/** Guard: auto-redirect to onboarding at most once per page load, so a
 *  just-completed onboarding can't bounce back on stale settings. */
export let onboardingRedirectDone = false;
export function markOnboardingRedirectDone() {
  onboardingRedirectDone = true;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
