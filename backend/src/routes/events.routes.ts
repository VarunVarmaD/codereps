import { Router, Response } from 'express';
import { requireExtensionAuth, ExtensionAuthenticatedRequest } from '../middleware/extensionAuth';
import { eventBatchSchema } from '../schemas/eventBatch.schema';
import { recordAttempts } from '../services/events.service';

const router = Router();

// Called by the extension's service worker, never the web app — extension-token auth.
router.use(requireExtensionAuth);

/**
 * POST /api/events
 * Accepts a batched array of attempt events from the extension. Idempotent per
 * event_id — safe for the extension to retry a batch it's not sure landed.
 */
router.post('/', async (req: ExtensionAuthenticatedRequest, res: Response) => {
  const parseResult = eventBatchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid event batch payload', details: parseResult.error.flatten() });
  }

  try {
    await recordAttempts(req.user!.id, parseResult.data.events);
    return res.status(202).json({ message: 'Events recorded' });
  } catch (err: any) {
    console.error('Error recording attempt events:', err.message);
    return res.status(500).json({ error: 'Failed to record events' });
  }
});

export default router;
