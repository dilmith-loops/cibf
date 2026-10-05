import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  const basePath = process.env.VITE_BASE_PATH || '/cibf/';
  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        base: basePath,
        scope: basePath,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'logo.png', 'header-logo.png', 'book-finder-logo.png', 'logo-icon.png', 'logo.jpeg', 'pwa-192x192.png', 'pwa-512x512.png', 'splash/splash-logo.jpg', 'splash/splash-bg.jpg', 'splash/splash-poster.jpg', 'splash/logo-clean.png'],
        manifest: {
          id: basePath,
          name: 'Sampath Book Finder',
          short_name: 'BookFinder',
          description: 'Official community book finder app for the Colombo Book Fair 2026, sponsored by Sampath Bank PLC.',
          theme_color: '#F37021',
          background_color: '#09090B',
          display: 'standalone',
          start_url: basePath,
          scope: basePath,
          icons: [
            {
              src: `${basePath}pwa-192x192.png`.replace('//', '/'),
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${basePath}pwa-512x512.png`.replace('//', '/'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${basePath}pwa-maskable-512x512.png`.replace('//', '/'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        name: 'dev-rewrite-cibf',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url) {
              if (req.url === '/cibf' || req.url === '/cibf/' || req.url === '/booktrack' || req.url === '/booktrack/') {
                req.url = '/';
              } else if (req.url.startsWith('/cibf/')) {
                req.url = req.url.replace(/^\/cibf/, '');
              } else if (req.url.startsWith('/booktrack/')) {
                req.url = req.url.replace(/^\/booktrack/, '');
              }
            }
            // Serve dist assets fallback for cached clients
            if (req.url && (req.url.startsWith('/assets/') || req.url.startsWith('/cibf/assets/') || req.url === '/registerSW.js' || req.url === '/manifest.webmanifest')) {
              const cleanedUrl = req.url.replace(/^\/cibf/, '');
              const localDistFile = path.resolve(__dirname, 'dist', cleanedUrl.slice(1));
              if (fs.existsSync(localDistFile)) {
                const ext = path.extname(localDistFile).toLowerCase();
                const mimeTypes: Record<string, string> = {
                  '.js': 'application/javascript',
                  '.css': 'text/css',
                  '.png': 'image/png',
                  '.jpg': 'image/jpeg',
                  '.jpeg': 'image/jpeg',
                  '.svg': 'image/svg+xml',
                  '.json': 'application/json',
                  '.webmanifest': 'application/manifest+json'
                };
                res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                return fs.createReadStream(localDistFile).pipe(res);
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
