// Split in two on purpose: ActiveTimeAccumulator is pure (no DOM, injectable
// clock) so it's directly unit-testable; trackActiveTime() is the real browser
// wiring around it and is exercised by the Playwright end-to-end pass instead.

export class ActiveTimeAccumulator {
  private accumulatedMs = 0;
  private segmentStartedAt: number | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  start(): void {
    if (this.segmentStartedAt !== null) return;
    this.segmentStartedAt = this.now();
  }

  stop(): void {
    if (this.segmentStartedAt === null) return;
    this.accumulatedMs += this.now() - this.segmentStartedAt;
    this.segmentStartedAt = null;
  }

  get isRunning(): boolean {
    return this.segmentStartedAt !== null;
  }

  /**
   * Whole seconds accumulated since the last reset() (or construction). Leaves
   * a fresh running segment behind if one was in progress, so a submission
   * mid-engagement doesn't lose the time before the next one starts.
   */
  reset(): number {
    const wasRunning = this.isRunning;
    if (wasRunning) this.stop();
    const seconds = Math.round(this.accumulatedMs / 1000);
    this.accumulatedMs = 0;
    if (wasRunning) this.start();
    return seconds;
  }
}

const IDLE_THRESHOLD_MS = 60_000;

export function trackActiveTime(): ActiveTimeAccumulator {
  const tracker = new ActiveTimeAccumulator();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const isEngaged = () => !document.hidden && document.hasFocus();

  const armIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => tracker.stop(), IDLE_THRESHOLD_MS);
  };

  const resumeIfEngaged = () => {
    if (isEngaged()) {
      tracker.start();
      armIdleTimer();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) tracker.stop();
    else resumeIfEngaged();
  });
  window.addEventListener('blur', () => tracker.stop());
  window.addEventListener('focus', resumeIfEngaged);
  for (const type of ['mousemove', 'keydown', 'scroll'] as const) {
    window.addEventListener(
      type,
      () => {
        resumeIfEngaged();
        armIdleTimer();
      },
      { passive: true }
    );
  }

  resumeIfEngaged();
  return tracker;
}
