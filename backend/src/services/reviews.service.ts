import { pool } from '../config/db';
import { computeNextReview, NextReviewState } from './spacedRepetition.service';
import { getPreviousReviewState, upsertReviewState } from './reviewStates.service';

export type RateAttemptResult =
  | { alreadyRated: true }
  | { alreadyRated: false; next: NextReviewState };

// Locks the attempts row so a retried/double-clicked rating can't run
// computeNextReview twice for the same attempt — the second call sees
// quality already set and no-ops instead of double-compounding the ease factor.
export async function rateAttempt(userId: string, eventId: string, quality: number): Promise<RateAttemptResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const attemptResult = await client.query(
      `SELECT problem_id, active_seconds, quality
       FROM public.attempts
       WHERE event_id = $1 AND user_id = $2
       FOR UPDATE;`,
      [eventId, userId]
    );

    if (attemptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error(`No attempt found for event_id "${eventId}"`);
    }

    const attempt = attemptResult.rows[0];
    if (attempt.quality !== null) {
      await client.query('COMMIT');
      return { alreadyRated: true };
    }

    const problemResult = await client.query(`SELECT target_seconds FROM public.problems WHERE id = $1;`, [
      attempt.problem_id,
    ]);
    const targetSeconds: number = problemResult.rows[0].target_seconds;

    const previous = await getPreviousReviewState(client, userId, attempt.problem_id);
    const next = computeNextReview({
      quality,
      activeSeconds: attempt.active_seconds ?? targetSeconds,
      targetSeconds,
      previous,
    });

    await upsertReviewState(client, userId, attempt.problem_id, next);
    await client.query(`UPDATE public.attempts SET quality = $1 WHERE event_id = $2;`, [quality, eventId]);

    await client.query('COMMIT');
    return { alreadyRated: false, next };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
