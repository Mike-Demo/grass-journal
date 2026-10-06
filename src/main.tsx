import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initSWUpdates } from './lib/swUpdate';

// Short URL: /go opens the tiny watch mode. The service worker's navigate
// fallback serves index.html for /go (the precache key is go/index.html),
// so handle it at boot — this also keeps /go working fully offline.
if (/^\/go\/?$/.test(window.location.pathname)) {
  window.location.replace('/watch/');
}

initSWUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
