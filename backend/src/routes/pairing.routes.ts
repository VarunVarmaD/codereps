import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { pairRequestSchema } from '../schemas/pairingCode.schema';
import { generatePairingCode, redeemPairingCode, PairingError } from '../services/pairing.service';

const router = Router();

/**
 * POST /api/pairing-codes — web app, requireAuth. Mints a short-lived code the
 * user types into the extension popup.
 */
router.post('/pairing-codes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pairing = await generatePairingCode(req.user!.id);
    res.status(201).json({ code: pairing.code, expiresAt: pairing.expiresAt });
  } catch (err: any) {
    console.error('Error generating pairing code:', err.message);
    res.status(500).json({ error: 'Failed to generate pairing code' });
  }
});

/**
 * POST /api/pair — no auth; the code itself is the credential. The extension
 * calls this once, right after the user pastes the code into the popup.
 */
router.post('/pair', async (req, res: Response) => {
  const parseResult = pairRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid pairing request', details: parseResult.error.flatten() });
  }

  try {
    const { token } = await redeemPairingCode(parseResult.data.code);
    res.status(200).json({ token });
  } catch (err: any) {
    if (err instanceof PairingError) {
      return res.status(410).json({ error: err.message });
    }
    console.error('Error redeeming pairing code:', err.message);
    res.status(500).json({ error: 'Failed to redeem pairing code' });
  }
});

export default router;
