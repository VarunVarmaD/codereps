import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../config/db';
import { rateAttempt } from './reviews.service';

// Real DB, not mocked — matches how this repo verifies its migrations and SQL
// elsewhere (see M1's verification). TEST_USER_ID is the same dev-bypass user
// used throughout local verification (middleware/auth.ts's bypass sentinel).
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';

describe('rateAttempt', () => {
  let problemId: number;
  let eventId: string;

  beforeAll(async () => {
    const problemResult = await pool.query(`SELECT id FROM public.problems WHERE leetcode_slug = 'two-sum';`);
    problemId = problemResult.rows[0].id;

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
    await pool.end();
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
