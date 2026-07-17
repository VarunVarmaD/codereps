import { randomUUID } from 'crypto';
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

// For users who never install the extension: the rating *is* the event, so
// unlike rateAttempt there's no pre-existing attempt row to update — this
// creates it and schedules the next review in one step.
export async function rateManually(userId: string, problemId: number, quality: number): Promise<NextReviewState> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const problemResult = await client.query(`SELECT target_seconds FROM public.problems WHERE id = $1;`, [
      problemId,
    ]);
    if (problemResult.rows.length === 0) {
      throw new Error(`Problem ${problemId} not found`);
    }
    const targetSeconds: number = problemResult.rows[0].target_seconds;

    // No real active-time signal for a manual rating. Defaulting to 0 would be
    // a real bug, not just imprecise: computeNextReview's time modifier is
    // ratio = activeSeconds / targetSeconds, and ratio=0 clamps to the MAXIMUM
    // possible ease-factor bonus (+0.12) — treating every manual rating as
    // "solved instantly." activeSeconds = targetSeconds gives ratio=1, i.e.
    // genuinely neutral (C_time=0), matching what we actually know: nothing.
    const previous = await getPreviousReviewState(client, userId, problemId);
    const next = computeNextReview({
      quality,
      activeSeconds: targetSeconds,
      targetSeconds,
      previous,
    });

    // Mirrors computeNextReview's own success threshold (Q = quality - 1,
    // isSuccess = Q >= 3, i.e. quality >= 4) rather than inventing a separate
    // one — keeps GET /api/stats's accuracy figure meaningful without a
    // second "did you pass?" question on top of the rating itself.
    const verdict = quality >= 4 ? 'accepted' : 'wrong_answer';

    await client.query(
      `INSERT INTO public.attempts (event_id, user_id, problem_id, verdict, active_seconds, submission_count, quality, attempted_at, is_manual)
       VALUES ($1, $2, $3, $4, $5, 1, $6, NOW(), TRUE);`,
      [randomUUID(), userId, problemId, verdict, targetSeconds, quality]
    );

    // No ensureTracked call needed: upsertReviewState is already
    // INSERT ... ON CONFLICT DO UPDATE, so it creates the row from scratch
    // (via computeNextReview's fresh-bootstrap defaults) if one doesn't exist.
    await upsertReviewState(client, userId, problemId, next);

    await client.query('COMMIT');
    return next;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
