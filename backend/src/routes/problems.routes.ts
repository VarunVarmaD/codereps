import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { addProblemSchema } from '../schemas/addProblem.schema';
import { manualRateSchema } from '../schemas/manualRate.schema';
import { addProblemByUrl } from '../services/problems.service';
import { ensureTracked } from '../services/reviewStates.service';
import { rateManually } from '../services/reviews.service';
import { pool } from '../config/db';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/problems — add any LeetCode problem by URL. Upserts its metadata
 * and starts tracking it for the caller in one step — adding a problem here
 * always means "and I want to work on it."
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = addProblemSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
  }

  try {
    const problem = await addProblemByUrl(req.user!.id, parseResult.data.leetcodeUrl);
    res.status(201).json(problem);
  } catch (err: any) {
    console.error('Error adding problem:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/problems/:id/track — start tracking a problem already in the
 * catalog (e.g. from a curated set) without having attempted it yet.
 */
router.post('/:id/track', async (req: AuthenticatedRequest, res: Response) => {
  const problemId = parseInt(req.params.id, 10);
  if (Number.isNaN(problemId)) {
    return res.status(400).json({ error: 'Invalid problem id' });
  }

  const client = await pool.connect();
  try {
    await ensureTracked(client, req.user!.id, problemId);
    res.status(204).send();
  } catch (err: any) {
    console.error('Error tracking problem:', err.message);
    res.status(500).json({ error: 'Failed to track problem' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/problems/:id/rate — manually rate a tracked problem, for users who
 * don't use the extension. Unlike POST /api/reviews/:event_id/rate (extension,
 * rates an attempt that already exists), this creates the attempt and
 * schedules the next review in one step — see reviews.service.ts's rateManually.
 */
router.post('/:id/rate', async (req: AuthenticatedRequest, res: Response) => {
  const problemId = parseInt(req.params.id, 10);
  if (Number.isNaN(problemId)) {
    return res.status(400).json({ error: 'Invalid problem id' });
  }

  const parseResult = manualRateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid rating', details: parseResult.error.flatten() });
  }

  try {
    const next = await rateManually(req.user!.id, problemId, parseResult.data.quality);
    res.status(200).json(next);
  } catch (err: any) {
    console.error('Error rating problem manually:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
