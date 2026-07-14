import { PoolClient } from 'pg';
import { pool } from '../config/db';
import type { AttemptEventInput } from '../schemas/eventBatch.schema';
import { upsertProblemMetadata } from './problems.service';

async function insertAttempt(client: PoolClient, userId: string, event: AttemptEventInput): Promise<void> {
  const problemId = await upsertProblemMetadata(client, event.problem);
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
