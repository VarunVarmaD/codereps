import { PoolClient } from 'pg';
import { pool } from '../config/db';
import type { NextReviewState } from './spacedRepetition.service';

export interface PreviousReviewStateRow {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

const DEFAULT_PREVIOUS: PreviousReviewStateRow = { intervalDays: 0, easeFactor: 2.0, repetitions: 0 };

export async function getPreviousReviewState(
  client: PoolClient,
  userId: string,
  problemId: number
): Promise<PreviousReviewStateRow> {
  const result = await client.query(
    `SELECT interval_days, ease_factor, repetitions FROM public.review_states
     WHERE user_id = $1 AND problem_id = $2;`,
    [userId, problemId]
  );
  if (result.rows.length === 0) return DEFAULT_PREVIOUS;

  const row = result.rows[0];
  return {
    intervalDays: row.interval_days,
    easeFactor: parseFloat(row.ease_factor),
    repetitions: row.repetitions,
  };
}

export async function upsertReviewState(
  client: PoolClient,
  userId: string,
  problemId: number,
  next: NextReviewState
): Promise<void> {
  await client.query(
    `INSERT INTO public.review_states (user_id, problem_id, interval_days, ease_factor, repetitions, due_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, problem_id) DO UPDATE SET
       interval_days = EXCLUDED.interval_days,
       ease_factor = EXCLUDED.ease_factor,
       repetitions = EXCLUDED.repetitions,
       due_at = EXCLUDED.due_at,
       updated_at = NOW();`,
    [userId, problemId, next.intervalDays, next.easeFactor, next.repetitions, next.dueAt]
  );
}

// Marks a problem as tracked before any attempt exists — e.g. added from a
// curated set or by URL. due_at defaults to NOW() (a fresh track means "I intend
// to do this"); a real rating (reviews.service.ts's rateAttempt) overwrites these
// bootstrap defaults the first time the problem is actually attempted.
export async function ensureTracked(client: PoolClient, userId: string, problemId: number): Promise<void> {
  await client.query(
    `INSERT INTO public.review_states (user_id, problem_id, due_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, problem_id) DO NOTHING;`,
    [userId, problemId]
  );
}

export interface QueueItem {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  leetcodeUrl: string;
  leetcodeSlug: string;
  tags: string[];
  dueAt: string;
  easeFactor: number;
  repetitions: number;
  intervalDays: number;
}

export async function getQueue(userId: string, options: { dueOnly: boolean }): Promise<QueueItem[]> {
  const dueFilter = options.dueOnly ? 'AND rs.due_at <= NOW()' : '';
  const result = await pool.query(
    `SELECT p.id, p.title, p.category, p.difficulty, p.leetcode_url, p.leetcode_slug, p.tags,
            rs.due_at, rs.ease_factor, rs.repetitions, rs.interval_days
     FROM public.review_states rs
     JOIN public.problems p ON p.id = rs.problem_id
     WHERE rs.user_id = $1 ${dueFilter}
     ORDER BY rs.due_at ASC;`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    difficulty: row.difficulty,
    leetcodeUrl: row.leetcode_url,
    leetcodeSlug: row.leetcode_slug,
    tags: row.tags ?? [],
    dueAt: row.due_at,
    easeFactor: parseFloat(row.ease_factor),
    repetitions: row.repetitions,
    intervalDays: row.interval_days,
  }));
}

export interface Stats {
  dueToday: number;
  inProgress: number;
  tracked: number;
  mastered: number;
  recentActivity: { quality: number; attemptedAt: string; problemTitle: string }[];
  byDifficulty: { easy: number; medium: number; hard: number };
  accuracy: { accepted: number; total: number } | null;
}

// Buckets mirror the SM-2 phase transitions already in spacedRepetition.service.ts
// (S_new 1/2/3 -> bootstrap intervals, then EF-driven growth) rather than a
// separately invented status taxonomy. repetitions === 0 (never yet passed a
// review) isn't in any bucket on purpose.
export async function getStats(userId: string): Promise<Stats> {
  const bucketResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE due_at <= NOW()) AS due_today,
       COUNT(*) FILTER (WHERE repetitions BETWEEN 1 AND 2) AS in_progress,
       COUNT(*) AS tracked,
       COUNT(*) FILTER (WHERE repetitions >= 3) AS mastered
     FROM public.review_states
     WHERE user_id = $1;`,
    [userId]
  );

  const activityResult = await pool.query(
    `SELECT a.quality, a.attempted_at, p.title
     FROM public.attempts a
     JOIN public.problems p ON p.id = a.problem_id
     WHERE a.user_id = $1 AND a.quality IS NOT NULL
     ORDER BY a.attempted_at DESC
     LIMIT 20;`,
    [userId]
  );

  const difficultyResult = await pool.query(
    `SELECT p.difficulty, COUNT(*)::int AS count
     FROM public.review_states rs
     JOIN public.problems p ON p.id = rs.problem_id
     WHERE rs.user_id = $1
     GROUP BY p.difficulty;`,
    [userId]
  );

  const accuracyResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE verdict = 'accepted') AS accepted,
       COUNT(*) AS total
     FROM public.attempts
     WHERE user_id = $1 AND attempted_at >= NOW() - INTERVAL '30 days';`,
    [userId]
  );

  const byDifficulty: Stats['byDifficulty'] = { easy: 0, medium: 0, hard: 0 };
  for (const r of difficultyResult.rows) {
    const key: string = r.difficulty?.toLowerCase();
    if (key === 'easy' || key === 'medium' || key === 'hard') byDifficulty[key] = r.count;
  }

  const accuracyRow = accuracyResult.rows[0];
  const accuracyTotal = parseInt(accuracyRow.total, 10);
  const accuracy = accuracyTotal === 0 ? null : { accepted: parseInt(accuracyRow.accepted, 10), total: accuracyTotal };

  const row = bucketResult.rows[0];
  return {
    dueToday: parseInt(row.due_today, 10),
    inProgress: parseInt(row.in_progress, 10),
    tracked: parseInt(row.tracked, 10),
    mastered: parseInt(row.mastered, 10),
    recentActivity: activityResult.rows.map((r) => ({
      quality: r.quality,
      attemptedAt: r.attempted_at,
      problemTitle: r.title,
    })),
    byDifficulty,
    accuracy,
  };
}
