import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// M1 skeleton: content script logs the problem slug, background is a stub.
// M2 adds the real permissions (network intercept needs no extra permission,
// it patches fetch/XHR in-page; storage is already here for the future queue).
export default defineManifest({
  manifest_version: 3,
  name: 'CodeReps — LeetCode Instrumentation',
  description: 'Captures your LeetCode practice and schedules spaced-repetition reviews in CodeReps.',
  version: pkg.version,
  // Icons deliberately omitted for the M1 skeleton — add real artwork before any
  // store listing (M4); an unpacked dev build doesn't need one.
  content_scripts: [
    {
      matches: ['https://leetcode.com/problems/*'],
      js: ['src/content/index.ts'],
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
  permissions: ['storage'],
  host_permissions: ['http://localhost:5001/*'],
});
