/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// NOTE on COOP/COEP: Transformers.js multithreaded WASM wants SharedArrayBuffer,
// which needs these headers. We ship single-threaded WASM by default (no headers
// needed); dev server sets them so the multithreaded path can be evaluated.
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            injectRegister: 'auto',
            strategies: 'generateSW',
            includeAssets: ['favicon.svg', 'icons/*.png', 'offline.html'],
            manifest: {
                name: 'Grass Journal',
                short_name: 'Grass',
                description: 'A private, offline-first voice and text journal. Your thoughts stay with you.',
                id: 'grass-journal',
                start_url: './',
                scope: './',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#0e1a12',
                theme_color: '#1d4d2b',
                categories: ['lifestyle', 'productivity', 'health'],
                icons: [
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    {
                        src: 'icons/icon-maskable-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                // App shell: cache-first. Journal DATA lives in IndexedDB, never in the
                // HTTP cache — the service worker must not cache private content.
                globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
                // iOS splash screens are large and only fetched on PWA launch —
                // serve them statically, don't bloat the precache.
                // Lean first install: AI engines are large (WebLLM ~6MB, ONNX WASM
                // ~26MB) and most sessions never touch them. They are EXCLUDED from
                // precache and cached on first use instead (see runtimeCaching below),
                // so the offline-ready app shell stays under ~1MB.
                globIgnores: ['assets/*.worker-*.js', 'assets/*.wasm', 'splash/**'],
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                navigateFallback: 'index.html',
                // Discovery + static files must never be swallowed by the app shell:
                // crawlers and audits fetch these as navigations too.
                navigateFallbackDenylist: [/^\/icons\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/llms\.txt$/, /^\/carbon\.txt$/, /^\/\.well-known\//],
                runtimeCaching: [
                    {
                        // AI engine chunks + WASM: fetched only when a model is
                        // installed or used, then cached for offline use.
                        urlPattern: /\/assets\/[^/]*\.(worker-[^/]*\.js|wasm)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'grass-journal-engines',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Local AI model weights — the ONLY remote assets the app ever
                        // fetches, and only during explicit model installation.
                        urlPattern: /^https:\/\/(huggingface\.co|cdn-lfs\.huggingface\.co|.*\.huggingface\.co)\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'grass-journal-models',
                            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
                // Never cache anything else from the network.
            },
            devOptions: { enabled: true, type: 'module' },
        }),
    ],
    worker: { format: 'es' },
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    build: {
        target: 'es2022',
        sourcemap: false,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        globals: true,
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
});
