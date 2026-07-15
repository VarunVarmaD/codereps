import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../config/db';
import { getQueue, getStats } from './reviewStates.service';

// Real DB, not mocked — same rationale as reviews.service.test.ts. Assertions
// use before/after deltas rather than exact totals, since review_states is
// shared dev-DB state this suite doesn't fully own.
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';

async function getTestProblemId(slug: string): Promise<number> {
  const result = await pool.query(`SELECT id FROM public.problems WHERE leetcode_slug = $1;`, [slug]);
  return result.rows[0].id;
}

async function upsertReviewStateRow(problemId: number, repetitions: number, dueAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO public.review_states (user_id, problem_id, interval_days, ease_factor, repetitions, due_at)
     VALUES ($1, $2, 10, 2.10, $3, $4)
     ON CONFLICT (user_id, problem_id) DO UPDATE SET
       repetitions = EXCLUDED.repetitions, due_at = EXCLUDED.due_at;`,
    [TEST_USER_ID, problemId, repetitions, dueAt]
  );
}

async function deleteReviewStateRow(problemId: number): Promise<void> {
  await pool.query(`DELETE FROM public.review_states WHERE user_id = $1 AND problem_id = $2;`, [
    TEST_USER_ID,
    problemId,
  ]);
}

afterAll(async () => {
  await pool.end();
});

describe('getQueue', () => {
  it('dueOnly excludes a problem whose due_at is in the future', async () => {
    const problemId = await getTestProblemId('contains-duplicate');
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await upsertReviewStateRow(problemId, 4, future);
    try {
      const dueItems = await getQueue(TEST_USER_ID, { dueOnly: true });
      expect(dueItems.some((i) => i.id === problemId)).toBe(false);

      const allItems = await getQueue(TEST_USER_ID, { dueOnly: false });
      expect(allItems.some((i) => i.id === problemId)).toBe(true);
    } finally {
      await deleteReviewStateRow(problemId);
    }
  });

  it('dueOnly includes an overdue problem', async () => {
    const problemId = await getTestProblemId('maximum-subarray');
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await upsertReviewStateRow(problemId, 4, past);
    try {
      const dueItems = await getQueue(TEST_USER_ID, { dueOnly: true });
      expect(dueItems.some((i) => i.id === problemId)).toBe(true);
    } finally {
      await deleteReviewStateRow(problemId);
    }
  });
});

describe('getStats', () => {
  it('buckets repetitions >= 3 as mastered, not in-progress', async () => {
    const problemId = await getTestProblemId('best-time-to-buy-and-sell-stock');
    const before = await getStats(TEST_USER_ID);
    await upsertReviewStateRow(problemId, 4, new Date());
    try {
      const after = await getStats(TEST_USER_ID);
      expect(after.mastered).toBe(before.mastered + 1);
      expect(after.inProgress).toBe(before.inProgress);
      expect(after.tracked).toBe(before.tracked + 1);
    } finally {
      await deleteReviewStateRow(problemId);
    }
  });

  it('buckets repetitions in [1,2] as in-progress, not mastered', async () => {
    const problemId = await getTestProblemId('contains-duplicate');
    const before = await getStats(TEST_USER_ID);
    await upsertReviewStateRow(problemId, 1, new Date());
    try {
      const after = await getStats(TEST_USER_ID);
      expect(after.inProgress).toBe(before.inProgress + 1);
      expect(after.mastered).toBe(before.mastered);
    } finally {
      await deleteReviewStateRow(problemId);
    }
  });

  it('byDifficulty counts a tracked Easy problem in the easy bucket only', async () => {
    const problemId = await getTestProblemId('longest-common-prefix'); // Easy
    const before = await getStats(TEST_USER_ID);
    await upsertReviewStateRow(problemId, 1, new Date());
    try {
      const after = await getStats(TEST_USER_ID);
      expect(after.byDifficulty.easy).toBe(before.byDifficulty.easy + 1);
      expect(after.byDifficulty.medium).toBe(before.byDifficulty.medium);
      expect(after.byDifficulty.hard).toBe(before.byDifficulty.hard);
    } finally {
      await deleteReviewStateRow(problemId);
    }
  });

  it('accuracy counts only attempts from the last 30 days', async () => {
    const problemId = await getTestProblemId('valid-anagram');
    const before = await getStats(TEST_USER_ID);

    const recentEventId = '11111111-1111-1111-1111-111111111111';
    const oldEventId = '22222222-2222-2222-2222-222222222222';
    await pool.query(
      `INSERT INTO public.attempts (event_id, user_id, problem_id, verdict, active_seconds, submission_count, attempted_at)
       VALUES ($1, $2, $3, 'accepted', 300, 1, NOW())
       ON CONFLICT (event_id) DO NOTHING;`,
      [recentEventId, TEST_USER_ID, problemId]
    );
    await pool.query(
      `INSERT INTO public.attempts (event_id, user_id, problem_id, verdict, active_seconds, submission_count, attempted_at)
       VALUES ($1, $2, $3, 'wrong_answer', 300, 1, NOW() - INTERVAL '45 days')
       ON CONFLICT (event_id) DO NOTHING;`,
      [oldEventId, TEST_USER_ID, problemId]
    );

    try {
      const after = await getStats(TEST_USER_ID);
      expect(after.accuracy).not.toBeNull();
      expect(after.accuracy!.total).toBe((before.accuracy?.total ?? 0) + 1); // only the recent one counts
      expect(after.accuracy!.accepted).toBe((before.accuracy?.accepted ?? 0) + 1);
    } finally {
      await pool.query(`DELETE FROM public.attempts WHERE event_id = ANY($1::uuid[]);`, [
        [recentEventId, oldEventId],
      ]);
    }
  });
});
