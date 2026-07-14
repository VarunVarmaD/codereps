import { describe, it, expect } from 'vitest';
import { backoffDelayMs } from './backoff';

describe('backoffDelayMs', () => {
  it('follows the 1m/5m/15m/30m schedule for the first four attempts', () => {
    expect(backoffDelayMs(1)).toBe(60_000);
    expect(backoffDelayMs(2)).toBe(300_000);
    expect(backoffDelayMs(3)).toBe(900_000);
    expect(backoffDelayMs(4)).toBe(1_800_000);
  });

  it('caps at 30 minutes for any further attempt', () => {
    expect(backoffDelayMs(5)).toBe(1_800_000);
    expect(backoffDelayMs(50)).toBe(1_800_000);
  });

  it('treats a non-positive attempt count as the first step', () => {
    expect(backoffDelayMs(0)).toBe(60_000);
    expect(backoffDelayMs(-3)).toBe(60_000);
  });
});
