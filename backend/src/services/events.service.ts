import { PoolClient } from 'pg';
import { pool } from '../config/db';
import type { AttemptEventInput } from '../schemas/eventBatch.schema';

const TARGET_SECONDS_BY_DIFFICULTY: Record<string, number> = {
  Easy: 900,
  Medium: 1800,
  Hard: 2700,
};

// Any of LeetCode's problems can show up here, not just a pre-seeded set — first time
// a slug is seen it's inserted, every time after it's refreshed (title/difficulty/tags
// can change on LeetCode's end; target_seconds, once set, is left alone rather than
// reset on every event).
async function upsertProblem(client: PoolClient, problem: AttemptEventInput['problem']): Promise<number> {
  const targetSeconds = TARGET_SECONDS_BY_DIFFICULTY[problem.difficulty] ?? 1800;
  const result = await client.query(
    `INSERT INTO public.problems (title, category, difficulty, leetcode_slug, leetcode_url, tags, target_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (leetcode_slug) DO UPDATE SET
       title = EXCLUDED.title,
       difficulty = EXCLUDED.difficulty,
       tags = EXCLUDED.tags
     RETURNING id;`,
    [
      problem.title,
      problem.tags[0], // `category` predates tag-based modeling; kept NOT NULL, filled from the primary tag.
      problem.difficulty,
      problem.slug,
      `https://leetcode.com/problems/${problem.slug}/`,
      problem.tags,
      targetSeconds,
    ]
  );
  return result.rows[0].id;
}

async function insertAttempt(client: PoolClient, userId: string, event: AttemptEventInput): Promise<void> {
  const problemId = await upsertProblem(client, event.problem);
  await client.query(
    `INSERT INTO public.attempts (event_id, user_id, problem_id, active_seconds, verdict, submission_count, quality, attempted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id) DO NOTHING;`,
    [
      event.eventId,
      userId,
      problemId,
      event.activeSeconds,
      event.verdict,
      event.submissionCount,
      event.quality ?? null,
      event.attemptedAt,
    ]
  );
}

// One transaction for the whole batch: either all events in this POST land, or none do.
// Idempotency is per-event (ON CONFLICT (event_id) DO NOTHING), so retried batches
// that partially succeeded before are safe to resend in full.
export async function recordAttempts(userId: string, events: AttemptEventInput[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const event of events) {
      await insertAttempt(client, userId, event);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
