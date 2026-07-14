import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { pool } from '../config/db';

export interface ExtensionAuthenticatedRequest extends Request {
  user?: { id: string };
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Separate from middleware/auth.ts's requireAuth on purpose: that one verifies a
// Supabase session JWT (web app callers). This verifies a long-lived extension token
// issued via /api/pair, looked up by its hash in extension_tokens. Different callers,
// different credential shapes — never accept one where the other is expected.
export async function requireExtensionAuth(
  req: ExtensionAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const rawToken = authHeader.split(' ')[1];
  const tokenHash = hashToken(rawToken);

  try {
    const result = await pool.query(
      `UPDATE public.extension_tokens SET last_used_at = NOW()
       WHERE token_hash = $1
       RETURNING user_id;`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Invalid extension token' });
    }

    req.user = { id: result.rows[0].user_id };
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error during extension auth verification' });
  }
}
