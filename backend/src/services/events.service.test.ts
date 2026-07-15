import { randomUUID } from 'crypto';
import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../config/db';
import { recordAttempts } from './events.service';
import type { AttemptEventInput } from '../schemas/eventBatch.schema';

// Real DB, not mocked — same rationale as reviews.service.test.ts.
const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';
const SLUG = 'group-anagrams'; // dedicated slug — no other test file touches this one

function makeEvent(overrides: Partial<AttemptEventInput> = {}): AttemptEventInput {
  return {
    eventId: randomUUID(),
    problem: { slug: SLUG, title: 'Group Anagrams', difficulty: 'Medium', tags: ['Array'] },
    activeSeconds: 600,
    verdict: 'accepted',
    submissionCount: 1,
    quality: null,
    attemptedAt: new Date().toISOString(),
    isBackfilled: false,
    ...overrides,
  };
}

async function cleanup(eventIds: string[]) {
  await pool.query(`DELETE FROM public.attempts WHERE event_id = ANY($1::uuid[]);`, [eventIds]);
  await pool.query(
    `DELETE FROM public.review_states WHERE user_id = $1
     AND problem_id = (SELECT id FROM public.problems WHERE leetcode_slug = $2);`,
    [TEST_USER_ID, SLUG]
  );
}

afterAll(async () => {
  await pool.end();
});

describe('recordAttempts', () => {
  it('ensures the problem is tracked even when the attempt is never rated', async () => {
    const event = makeEvent();
    try {
      await recordAttempts(TEST_USER_ID, [event]);

      const result = await pool.query(
        `SELECT rs.repetitions FROM public.review_states rs
         JOIN public.problems p ON p.id = rs.problem_id
         WHERE rs.user_id = $1 AND p.leetcode_slug = $2;`,
        [TEST_USER_ID, SLUG]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].repetitions).toBe(0); // untouched bootstrap default — no rating happened
    } finally {
      await cleanup([event.eventId]);
    }
  });

  it('a second attempt on an already-tracked problem does not duplicate or reset the review_states row', async () => {
    const first = makeEvent();
    const second = makeEvent({ eventId: randomUUID(), submissionCount: 2 });
    try {
      await recordAttempts(TEST_USER_ID, [first]);
      await recordAttempts(TEST_USER_ID, [second]);

      const result = await pool.query(
        `SELECT rs.repetitions FROM public.review_states rs
         JOIN public.problems p ON p.id = rs.problem_id
         WHERE rs.user_id = $1 AND p.leetcode_slug = $2;`,
        [TEST_USER_ID, SLUG]
      );
      expect(result.rows).toHaveLength(1); // ON CONFLICT DO NOTHING — no duplicate row
    } finally {
      await cleanup([first.eventId, second.eventId]);
    }
  });
});
