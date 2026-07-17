import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../config/db';
import { rateAttempt, rateManually } from './reviews.service';

// Real DB, not mocked — matches how this repo verifies its migrations and SQL
// elsewhere (see M1's verification). TEST_USER_ID is the same dev-bypass user
// used throughout local verification (middleware/auth.ts's bypass sentinel).
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';

async function getProblemId(slug: string): Promise<number> {
  const result = await pool.query(`SELECT id FROM public.problems WHERE leetcode_slug = $1;`, [slug]);
  return result.rows[0].id;
}

async function cleanupProblem(problemId: number): Promise<void> {
  await pool.query(`DELETE FROM public.attempts WHERE user_id = $1 AND problem_id = $2;`, [TEST_USER_ID, problemId]);
  await pool.query(`DELETE FROM public.review_states WHERE user_id = $1 AND problem_id = $2;`, [
    TEST_USER_ID,
    problemId,
  ]);
}

// Hoisted to file scope (not nested in one describe) — this file has multiple
// describe blocks, and pool.end() must only run once all of them are done.
afterAll(async () => {
  await pool.end();
});

describe('rateAttempt', () => {
  let problemId: number;
  let eventId: string;

  beforeAll(async () => {
    problemId = await getProblemId('two-sum');

    eventId = randomUUID();
    await pool.query(
      `INSERT INTO public.attempts (event_id, user_id, problem_id, verdict, active_seconds, submission_count)
       VALUES ($1, $2, $3, 'accepted', 900, 1);`,
      [eventId, TEST_USER_ID, problemId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM public.attempts WHERE event_id = $1;`, [eventId]);
    await pool.query(`DELETE FROM public.review_states WHERE user_id = $1 AND problem_id = $2;`, [
      TEST_USER_ID,
      problemId,
    ]);
  });

  it('schedules a real review the first time an attempt is rated', async () => {
    const result = await rateAttempt(TEST_USER_ID, eventId, 5);
    expect(result.alreadyRated).toBe(false);
    if (!result.alreadyRated) {
      expect(result.next.repetitions).toBe(1);
      expect(result.next.intervalDays).toBe(1);
    }
  });

  it('is a no-op on a second rating of the same attempt, not a second scheduling jump', async () => {
    const result = await rateAttempt(TEST_USER_ID, eventId, 1); // different quality — must be ignored
    expect(result.alreadyRated).toBe(true);

    const stateResult = await pool.query(
      `SELECT repetitions FROM public.review_states WHERE user_id = $1 AND problem_id = $2;`,
      [TEST_USER_ID, problemId]
    );
    expect(stateResult.rows[0].repetitions).toBe(1); // unchanged from the first rating
  });
});

describe('rateManually', () => {
  it('defaults activeSeconds to target_seconds — C_time is neutral (0), not the max bonus (+0.12)', async () => {
    const problemId = await getProblemId('valid-parentheses');
    try {
      // quality 5 -> Q=4, isSuccess, base=+0.10 (Q!==3), C_streak=0 (S=0 bootstrap).
      // If activeSeconds wrongly defaulted to 0, C_time would be +0.12 (the max
      // bonus) instead of 0, and easeFactor would land at 2.22, not 2.10.
      const next = await rateManually(TEST_USER_ID, problemId, 5);
      expect(next.easeFactor).toBeCloseTo(2.1, 3);
      expect(next.repetitions).toBe(1);
      expect(next.intervalDays).toBe(1);
    } finally {
      await cleanupProblem(problemId);
    }
  });

  it('derives verdict from the same success threshold as computeNextReview (quality >= 4 -> accepted)', async () => {
    const problemId = await getProblemId('merge-two-sorted-lists');
    try {
      await rateManually(TEST_USER_ID, problemId, 4);
      const accepted = await pool.query(
        `SELECT verdict, is_manual FROM public.attempts WHERE user_id = $1 AND problem_id = $2 ORDER BY attempted_at DESC LIMIT 1;`,
        [TEST_USER_ID, problemId]
      );
      expect(accepted.rows[0].verdict).toBe('accepted');
      expect(accepted.rows[0].is_manual).toBe(true);

      // quality 3 is a "soft failure" in computeNextReview (Q=2, isSuccess=false)
      // — the boundary worth asserting explicitly, since it could look like a
      // pass at a glance.
      await rateManually(TEST_USER_ID, problemId, 3);
      const softFailure = await pool.query(
        `SELECT verdict FROM public.attempts WHERE user_id = $1 AND problem_id = $2 ORDER BY attempted_at DESC LIMIT 1;`,
        [TEST_USER_ID, problemId]
      );
      expect(softFailure.rows[0].verdict).toBe('wrong_answer');
    } finally {
      await cleanupProblem(problemId);
    }
  });
});
