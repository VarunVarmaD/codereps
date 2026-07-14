import { describe, it, expect } from 'vitest';
import { ActiveTimeAccumulator } from './activeTime';

describe('ActiveTimeAccumulator', () => {
  it('accumulates time only while running, and reset() reports whole seconds', () => {
    let now = 0;
    const clock = () => now;
    const tracker = new ActiveTimeAccumulator(clock);

    tracker.start();
    now += 2_500; // 2.5s running
    tracker.stop();
    now += 10_000; // 10s paused — must not count
    tracker.start();
    now += 1_700; // 1.7s running

    expect(tracker.reset()).toBe(Math.round((2_500 + 1_700) / 1000)); // 4s
  });

  it('reset() leaves a fresh running segment behind if one was in progress', () => {
    let now = 0;
    const clock = () => now;
    const tracker = new ActiveTimeAccumulator(clock);

    tracker.start();
    now += 5_000;
    expect(tracker.reset()).toBe(5);
    expect(tracker.isRunning).toBe(true);

    now += 3_000;
    expect(tracker.reset()).toBe(3);
  });

  it('reset() with nothing accumulated and not running reports 0', () => {
    const tracker = new ActiveTimeAccumulator(() => 0);
    expect(tracker.reset()).toBe(0);
    expect(tracker.isRunning).toBe(false);
  });

  it('start()/stop() are idempotent — calling twice in a row does not double-count or lose the segment', () => {
    let now = 0;
    const clock = () => now;
    const tracker = new ActiveTimeAccumulator(clock);

    tracker.start();
    tracker.start(); // no-op, segment already running
    now += 1_000;
    tracker.stop();
    tracker.stop(); // no-op, already stopped

    expect(tracker.reset()).toBe(1);
  });
});
