import { randomBytes } from 'crypto';
import { pool } from '../config/db';
import { hashToken } from '../middleware/extensionAuth';

// No 0/O/1/I — avoids visual ambiguity when a user is typing a code by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_EXPIRY_MINUTES = 10;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export interface PairingCode {
  code: string;
  expiresAt: Date;
}

export async function generatePairingCode(userId: string): Promise<PairingCode> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
  await pool.query(`INSERT INTO public.pairing_codes (code, user_id, expires_at) VALUES ($1, $2, $3);`, [
    code,
    userId,
    expiresAt,
  ]);
  return { code, expiresAt };
}

export class PairingError extends Error {}

// Locks the code row so two near-simultaneous redemption attempts can't both
// succeed — the second one to reach the lock sees used_at already set.
export async function redeemPairingCode(code: string): Promise<{ token: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT user_id, used_at, expires_at FROM public.pairing_codes WHERE code = $1 FOR UPDATE;`,
      [code]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new PairingError('Invalid pairing code');
    }

    const row = result.rows[0];
    if (row.used_at !== null) {
      await client.query('ROLLBACK');
      throw new PairingError('Pairing code has already been used');
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query('ROLLBACK');
      throw new PairingError('Pairing code has expired');
    }

    await client.query(`UPDATE public.pairing_codes SET used_at = NOW() WHERE code = $1;`, [code]);

    const rawToken = randomBytes(32).toString('hex');
    await client.query(`INSERT INTO public.extension_tokens (user_id, token_hash) VALUES ($1, $2);`, [
      row.user_id,
      hashToken(rawToken),
    ]);

    await client.query('COMMIT');
    return { token: rawToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
