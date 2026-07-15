import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// M2: two content scripts. The MAIN-world one patches window.fetch inside the
// page's own JS context — an isolated-world script can't see LeetCode's own fetch
// calls, only its own, since isolated worlds share the DOM but not JS objects.
// It must run at document_start, before LeetCode's app code fires its first request.
export default defineManifest({
  manifest_version: 3,
  name: 'CodeReps — LeetCode Instrumentation',
  description: 'Captures your LeetCode practice and schedules spaced-repetition reviews in CodeReps.',
  version: pkg.version,
  // Icons deliberately omitted for the M1/M2 skeleton — add real artwork before any
  // store listing (M4); an unpacked dev build doesn't need one.
  content_scripts: [
    {
      matches: ['https://leetcode.com/problems/*'],
      js: ['src/inject/network-patch.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['https://leetcode.com/problems/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
    // Broader than the two above on purpose — the opt-in history backfill (M4)
    // can be triggered from any leetcode.com page, not just a problem page, so
    // this listener needs to be present wherever an open leetcode.com tab is.
    {
      matches: ['https://leetcode.com/*'],
      js: ['src/content/backfill.ts'],
      run_at: 'document_idle',
    },
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  permissions: ['storage', 'alarms'],
  // leetcode.com is here (not just in content_scripts.matches) because
  // chrome.tabs.query({ url }) needs an explicit host permission to see tab
  // URLs at all — content-script match patterns grant injection, not tab
  // visibility. Without this, the backfill trigger's tab lookup silently
  // returns tabs with no url property and never matches.
  host_permissions: ['http://localhost:5001/*', 'https://leetcode.com/*'],
});
