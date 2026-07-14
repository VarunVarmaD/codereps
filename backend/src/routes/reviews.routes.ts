import { Router, Response } from 'express';
import { requireExtensionAuth, ExtensionAuthenticatedRequest } from '../middleware/extensionAuth';
import { rateAttemptSchema } from '../schemas/rateAttempt.schema';
import { rateAttempt } from '../services/reviews.service';

const router = Router();

router.use(requireExtensionAuth);

/**
 * POST /api/reviews/:event_id/rate — called by the extension after the user
 * rates an attempt's quality (1-5) in the in-page overlay. Idempotent: rating
 * an already-rated attempt is a no-op, not a second scheduling jump.
 */
router.post('/:event_id/rate', async (req: ExtensionAuthenticatedRequest, res: Response) => {
  const parseResult = rateAttemptSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid rating', details: parseResult.error.flatten() });
  }

  try {
    const result = await rateAttempt(req.user!.id, req.params.event_id, parseResult.data.quality);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error rating attempt:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
