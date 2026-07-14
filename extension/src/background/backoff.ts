// Pure retry-delay schedule — unit-tested directly. Floors at 1 minute rather
// than the 30s originally sketched: chrome.alarms clamps delayInMinutes to a
// 1-minute minimum for installed (non-dev-mode) extensions, so a sub-minute
// step would silently become 1 minute anyway once this ships past local dev.
const SCHEDULE_MS = [60_000, 300_000, 900_000, 1_800_000] as const; // 1m, 5m, 15m, 30m cap

/** attempt is 1-indexed: the delay to wait before the Nth consecutive retry. */
export function backoffDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), SCHEDULE_MS.length - 1);
  return SCHEDULE_MS[index];
}
