// SM-2 variant, ported verbatim from the old inline logic in routes/problems.ts —
// same bootstrap intervals (1 / 4 / 10 days), same time-ratio modifier, same EF
// ceiling of 2.80. Only two things changed at the boundary, not the math:
//
//  1. Quality is now 1-5 (matches the extension's post-submission popup), translated
//     to the algorithm's internal 0-4 scale (Q = quality - 1) before running the
//     original formula.
//  2. The "expected duration" baseline (T_prev) is supplied by the caller instead of
//     being hardcoded per-difficulty in here — problems now have a real
//     `target_seconds` column for this (see migrations/0004_v1_pivot.up.sql), where
//     before there was nowhere to store it.

export interface PreviousReviewState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface ComputeNextReviewInput {
  quality: number; // 1-5
  activeSeconds: number;
  targetSeconds: number; // baseline for the time-ratio modifier
  previous: PreviousReviewState;
}

export interface NextReviewState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  dueAt: Date;
}

export function computeNextReview(input: ComputeNextReviewInput): NextReviewState {
  const Q = input.quality - 1; // 1-5 UI scale -> 0-4 algorithm scale

  const I = input.previous.intervalDays || 0;
  const EF = input.previous.easeFactor || 2.0;
  const S = input.previous.repetitions || 0;

  const T_prev = input.targetSeconds;
  const T_current = input.activeSeconds;

  // Step 1: Outcome
  const isSuccess = Q >= 3;

  // Step 2: Time Modifier (C_time)
  const ratio = T_current / T_prev;
  const R = Math.min(ratio, 3.0); // Noise floor limit of 3.0
  let C_time = 0.15 * (1 - R);
  if (C_time < -0.15) C_time = -0.15;
  if (C_time > 0.12) C_time = 0.12;

  // Step 3: Streak Component (C_streak)
  const C_streak = isSuccess ? 0.03 * Math.min(S, 5) : 0;

  let EF_new = EF;
  let I_new = I;
  let S_new = S;

  // Step 4: Failure & Success Paths
  if (!isSuccess) {
    S_new = 0;
    if (Q === 2) {
      // Soft failure
      EF_new = EF + (-0.1 + C_time);
      I_new = Math.max(1, Math.round(I * 0.4));
    } else {
      // Hard failure (Q == 0 or 1)
      EF_new = EF + (-0.2 + C_time);
      I_new = 1;
    }
  } else {
    S_new = S + 1;
    const base = Q === 3 ? -0.05 : 0.1;
    EF_new = EF + base + C_time + C_streak;

    // Step 5: Bootstrap vs General interval calculation
    if (S_new === 1) {
      I_new = 1;
    } else if (S_new === 2) {
      I_new = 4;
    } else if (S_new === 3) {
      I_new = 10;
    } else {
      I_new = Math.round(I * EF_new);
    }
  }

  // Clamp EF_new in range [1.30, 2.80]
  if (EF_new < 1.3) EF_new = 1.3;
  if (EF_new > 2.8) EF_new = 2.8;

  // Clamp I_new in range [1, 180]
  if (I_new < 1) I_new = 1;
  if (I_new > 180) I_new = 180;

  const dueAt = new Date(Date.now() + I_new * 24 * 60 * 60 * 1000);

  return {
    intervalDays: I_new,
    easeFactor: parseFloat(EF_new.toFixed(3)),
    repetitions: S_new,
    dueAt,
  };
}
