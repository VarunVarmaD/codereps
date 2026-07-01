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
          WHEN sri.id IS NULL THEN 'New'
          WHEN sri.repetition_count = 0 THEN 'Learning'
          WHEN sri.due_at <= NOW() THEN 'Review'
          ELSE 'Mastered'
        END as status,
        COALESCE(sri.due_at <= NOW(), TRUE) as due
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
          WHEN sri.id IS NULL THEN 'New'
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
 * Submits a recall grade (1-5) and updates the SM-2 algorithm schedule.
 */
router.post('/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;
  const problemId = parseInt(req.params.id, 10);
  const { grade } = req.body;

  if (isNaN(problemId)) {
    return res.status(400).json({ error: 'Invalid problem ID format' });
  }

  const numericGrade = parseInt(grade, 10);
  if (isNaN(numericGrade) || numericGrade < 1 || numericGrade > 5) {
    return res.status(400).json({ error: 'Invalid grade: Must be an integer between 1 and 5' });
  }

  try {
    // 1. Fetch current status
    const selectQuery = `
      SELECT interval_days, ease_factor::float as ease_factor, repetition_count
      FROM public.spaced_repetition_items
      WHERE user_id = $1 AND problem_id = $2;
    `;
    const selectResult = await pool.query(selectQuery, [userId, problemId]);
    const existing = selectResult.rows[0];

    let interval = 1;
    let easeFactor = 2.50;
    let repetitions = 0;

    if (existing) {
      interval = existing.interval_days;
      easeFactor = existing.ease_factor;
      repetitions = existing.repetition_count;
    }

    // 2. SM-2 calculation
    if (numericGrade >= 3) {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }

    // Adjust ease factor
    easeFactor = easeFactor + (0.1 - (5 - numericGrade) * (0.08 + (5 - numericGrade) * 0.02));
    if (easeFactor < 1.3) {
      easeFactor = 1.3;
    }

    // 3. Calculate due date
    const dueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    // 4. Save review inside a transaction block
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');
      
      // Upsert spaced repetition state
      const upsertQuery = `
        INSERT INTO public.spaced_repetition_items (user_id, problem_id, interval_days, ease_factor, repetition_count, due_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, problem_id) 
        DO UPDATE SET 
          interval_days = EXCLUDED.interval_days,
          ease_factor = EXCLUDED.ease_factor,
          repetition_count = EXCLUDED.repetition_count,
          due_at = EXCLUDED.due_at,
          updated_at = NOW();
      `;
      await dbClient.query(upsertQuery, [userId, problemId, interval, easeFactor, repetitions, dueAt]);

      // Add record to history audit timeline log
      const insertHistoryQuery = `
        INSERT INTO public.timeline_history (user_id, problem_id, grade, interval_days, reviewed_at)
        VALUES ($1, $2, $3, $4, NOW());
      `;
      await dbClient.query(insertHistoryQuery, [userId, problemId, numericGrade, interval]);

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
        interval_days: interval,
        ease_factor: parseFloat(easeFactor.toFixed(2)),
        repetition_count: repetitions,
        due_at: dueAt.toISOString()
      }
    });

  } catch (err: any) {
    console.error('Error saving problem review:', err.message);
    return res.status(500).json({ error: 'Failed to save review details' });
  }
});

export default router;
