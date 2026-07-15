import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

// TARGET_BROWSER=firefox npm run build:firefox — crx's `browser: 'firefox'`
// option rewrites background.service_worker into Firefox's background.scripts
// form and handles Firefox's content-script matching quirks, so this stays a
// single manifest for both targets rather than two hand-maintained ones.
const targetBrowser = process.env.TARGET_BROWSER === 'firefox' ? 'firefox' : 'chrome';

export default defineConfig({
  plugins: [react(), crx({ manifest, browser: targetBrowser })],
  build: {
    outDir: targetBrowser === 'firefox' ? 'dist-firefox' : 'dist',
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
