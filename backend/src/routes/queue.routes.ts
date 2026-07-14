import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getQueue } from '../services/reviewStates.service';

const router = Router();

/**
 * GET /api/queue — due reviews by default; ?scope=all backs the Tracked tab
 * (every tracked problem, due or not).
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dueOnly = req.query.scope !== 'all';
    const items = await getQueue(req.user!.id, { dueOnly });
    res.json({ items });
  } catch (err: any) {
    console.error('Error fetching queue:', err.message);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

export default router;
