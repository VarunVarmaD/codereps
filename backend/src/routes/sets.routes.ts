import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { pool } from '../config/db';

const router = Router();

router.use(requireAuth);

/** GET /api/sets — list curated sets (NeetCode 250 today, more will land here later). */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.slug, s.name, s.description, COUNT(psi.problem_id)::int AS problem_count
       FROM public.problem_sets s
       LEFT JOIN public.problem_set_items psi ON psi.set_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at ASC;`
    );
    res.json({ sets: result.rows });
  } catch (err: any) {
    console.error('Error fetching sets:', err.message);
    res.status(500).json({ error: 'Failed to fetch sets' });
  }
});

/**
 * GET /api/sets/:slug/problems — a set's problems, left-joined with the
 * caller's review_states so the Sheet tab can show tracked/due state per problem.
 */
router.get('/:slug/problems', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.category, p.difficulty, p.leetcode_url, p.leetcode_slug, p.tags,
              rs.due_at, rs.ease_factor, (rs.user_id IS NOT NULL) AS tracked
       FROM public.problem_set_items psi
       JOIN public.problems p ON p.id = psi.problem_id
       LEFT JOIN public.review_states rs ON rs.problem_id = p.id AND rs.user_id = $2
       WHERE psi.set_id = (SELECT id FROM public.problem_sets WHERE slug = $1)
       ORDER BY psi.position;`,
      [req.params.slug, req.user!.id]
    );
    res.json({ problems: result.rows });
  } catch (err: any) {
    console.error('Error fetching set problems:', err.message);
    res.status(500).json({ error: 'Failed to fetch set problems' });
  }
});

export default router;
