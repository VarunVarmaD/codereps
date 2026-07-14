import { describe, it, expect } from 'vitest';
import { computeNextReview } from './spacedRepetition.service';

describe('computeNextReview', () => {
  it('happy path: a fluent (quality 5) review on-pace advances EF, streak bonus, and bootstraps to the third interval step', () => {
    const result = computeNextReview({
      quality: 5, // -> internal Q=4
      activeSeconds: 900,
      targetSeconds: 900, // ratio 1.0 -> C_time = 0
      previous: { intervalDays: 10, easeFactor: 2.0, repetitions: 2 },
    });

    // isSuccess (Q=4 >= 3), S_new = 3 -> third-success bootstrap interval = 10
    expect(result.repetitions).toBe(3);
    expect(result.intervalDays).toBe(10);
    // base (+0.10, since Q !== 3) + C_time (0) + C_streak (0.03 * min(2,5) = 0.06)
    expect(result.easeFactor).toBeCloseTo(2.0 + 0.1 + 0.06, 3);
    expect(result.dueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('hard failure (quality 1) resets the streak to 0, the interval to 1, and drops EF, regardless of prior repetitions', () => {
    const result = computeNextReview({
      quality: 1, // -> internal Q=0 (hard failure)
      activeSeconds: 900,
      targetSeconds: 900, // ratio 1.0 -> C_time = 0
      previous: { intervalDays: 30, easeFactor: 2.2, repetitions: 5 },
    });

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    // hard failure: EF + (-0.20 + C_time(0))
    expect(result.easeFactor).toBeCloseTo(2.2 - 0.2, 3);
  });
});
