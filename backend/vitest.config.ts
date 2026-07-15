import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist/**', 'node_modules/**'],
    // Several test files share one real dev Postgres DB keyed by the same
    // fixed dev-bypass user id. getStats()-style aggregate assertions read
    // and write across the whole user's review_states, so running files in
    // parallel workers lets one file's insert/cleanup race another's
    // before/after snapshot. Not a mocking situation — run files serially.
    fileParallelism: false,
  },
});
