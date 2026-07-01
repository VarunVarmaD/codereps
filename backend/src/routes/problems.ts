import { Router, Response } from 'express';
import { pool } from '../config/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Require authentication for all problem routes
router.use(requireAuth);

/**
 * GET /api/problems
 * Returns a list of all problems joined with the user's spaced repetition status.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const query = `
      SELECT 
        p.id, p.title, p.category, p.difficulty, p.leetcode_url,
        sri.interval_days, 
        sri.ease_factor::float as ease_factor, 
        sri.repetition_count, 
        sri.due_at, 
        sri.enabled,
        CASE 
          WHEN sri.id IS NULL THEN 'Untracked'
          WHEN sri.repetition_count = 0 THEN 'Learning'
          WHEN sri.due_at <= NOW() THEN 'Review'
          ELSE 'Mastered'
        END as status,
        (sri.id IS NOT NULL AND (sri.repetition_count = 0 OR sri.due_at <= NOW())) as due,
        CASE
          WHEN sri.id IS NULL THEN NULL
          ELSE CEIL(EXTRACT(EPOCH FROM (sri.due_at - NOW())) / 86400.0)
        END as days_left
      FROM public.problems p
      LEFT JOIN public.spaced_repetition_items sri 
        ON p.id = sri.problem_id AND sri.user_id = $1
      ORDER BY p.id ASC;
    `;
    
    const result = await pool.query(query, [userId]);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching problems list:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve problems' });
  }
});

/**
 * GET /api/problems/:id
 * Returns details of a specific problem with descriptions and current progress.
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  const problemId = parseInt(req.params.id, 10);

  if (isNaN(problemId)) {
    return res.status(400).json({ error: 'Invalid problem ID format' });
  }

  try {
    const query = `
      SELECT 
        p.id, p.title, p.category, p.difficulty, p.description, p.leetcode_url,
        sri.interval_days, 
        sri.ease_factor::float as ease_factor, 
        sri.repetition_count, 
        sri.due_at,
        CASE 
          WHEN sri.id IS NULL THEN 'Untracked'
          WHEN sri.repetition_count = 0 THEN 'Learning'
          WHEN sri.due_at <= NOW() THEN 'Review'
          ELSE 'Mastered'
        END as status
      FROM public.problems p
      LEFT JOIN public.spaced_repetition_items sri 
        ON p.id = sri.problem_id AND sri.user_id = $1
      WHERE p.id = $2;
    `;

    const result = await pool.query(query, [userId, problemId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error fetching problem details:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve problem details' });
  }
});

/**
 * POST /api/problems/:id/review
 * Submits a recall grade (0-4) and duration, and updates the SM-2 algorithm schedule.
 */
router.post('/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  const problemId = parseInt(req.params.id, 10);
  const { grade, durationSeconds } = req.body;

  if (isNaN(problemId)) {
    return res.status(400).json({ error: 'Invalid problem ID format' });
  }

  const Q = parseInt(grade, 10);
  if (isNaN(Q) || Q < 0 || Q > 4) {
    return res.status(400).json({ error: 'Invalid grade: Must be an integer between 0 and 4' });
  }

  const T_current = parseInt(durationSeconds, 10);
  if (isNaN(T_current) || T_current < 0) {
    return res.status(400).json({ error: 'Invalid duration: Must be a positive integer of seconds' });
  }

  try {
    // 1. Fetch current status and problem difficulty
    const selectQuery = `
      SELECT 
        p.difficulty,
        sri.interval_days, 
        sri.ease_factor::float as ease_factor, 
        sri.repetition_count,
        sri.last_duration_seconds
      FROM public.problems p
      LEFT JOIN public.spaced_repetition_items sri
        ON p.id = sri.problem_id AND sri.user_id = $1
      WHERE p.id = $2;
    `;
    const selectResult = await pool.query(selectQuery, [userId, problemId]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const row = selectResult.rows[0];
    const difficulty = row.difficulty;
    
    // Existing SR variables or defaults
    const I = row.interval_days || 0;
    const EF = row.ease_factor || 2.00; // Default Starting EF is 2.00
    const S = row.repetition_count || 0;
    
    // Calculate T_prev (last solve duration or difficulty benchmark default)
    let T_prev = row.last_duration_seconds;
    if (!T_prev) {
      if (difficulty === 'Easy') {
        T_prev = 600; // 10 minutes
      } else if (difficulty === 'Hard') {
        T_prev = 2100; // 35 minutes
      } else {
        T_prev = 1200; // 20 minutes (Medium and fallback)
      }
    }

    // Step 1: Outcome
    const isSuccess = Q >= 3;

    // Step 2: Time Modifier (C_time)
    const ratio = T_current / T_prev;
    const R = Math.min(ratio, 3.0); // Noise floor limit of 3.0
    let C_time = 0.15 * (1 - R);
    if (C_time < -0.15) C_time = -0.15;
    if (C_time > 0.12) C_time = 0.12;

    // Step 3: Streak Component (C_streak)
    const C_streak = isSuccess ? (0.03 * Math.min(S, 5)) : 0;

    let EF_new = EF;
    let I_new = I;
    let S_new = S;

    // Step 4: Failure & Success Paths
    if (!isSuccess) {
      S_new = 0;
      if (Q === 2) {
        // Soft failure
        EF_new = EF + (-0.10 + C_time);
        I_new = Math.max(1, Math.round(I * 0.40));
      } else {
        // Hard failure (Q == 0 or 1)
        EF_new = EF + (-0.20 + C_time);
        I_new = 1;
      }
    } else {
      S_new = S + 1;
      const base = (Q === 3) ? -0.05 : 0.10;
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
    if (EF_new < 1.30) EF_new = 1.30;
    if (EF_new > 2.80) EF_new = 2.80;

    // Clamp I_new in range [1, 180]
    if (I_new < 1) I_new = 1;
    if (I_new > 180) I_new = 180;

    // Calculate next due date
    const dueAt = new Date(Date.now() + I_new * 24 * 60 * 60 * 1000);

    // 4. Save review in a single transaction block
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      
      const upsertQuery = `
        INSERT INTO public.spaced_repetition_items (
          user_id, problem_id, interval_days, ease_factor, repetition_count, last_duration_seconds, due_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id, problem_id) 
        DO UPDATE SET 
          interval_days = EXCLUDED.interval_days,
          ease_factor = EXCLUDED.ease_factor,
          repetition_count = EXCLUDED.repetition_count,
          last_duration_seconds = EXCLUDED.last_duration_seconds,
          due_at = EXCLUDED.due_at,
          updated_at = NOW();
      `;
      await dbClient.query(upsertQuery, [userId, problemId, I_new, EF_new, S_new, T_current, dueAt]);

      const insertHistoryQuery = `
        INSERT INTO public.timeline_history (user_id, problem_id, grade, interval_days, duration_seconds, reviewed_at)
        VALUES ($1, $2, $3, $4, $5, NOW());
      `;
      await dbClient.query(insertHistoryQuery, [userId, problemId, Q, I_new, T_current]);

      await dbClient.query('COMMIT');
    } catch (txErr) {
      await dbClient.query('ROLLBACK');
      throw txErr;
    } finally {
      dbClient.release();
    }

    return res.json({
      message: 'Review recorded successfully',
      next_review: {
        interval_days: I_new,
        ease_factor: parseFloat(EF_new.toFixed(3)),
        repetition_count: S_new,
        due_at: dueAt.toISOString()
      }
    });

  } catch (err: any) {
    console.error('Error saving problem review:', err.message);
    return res.status(500).json({ error: 'Failed to save review details' });
  }
});

export default router;
