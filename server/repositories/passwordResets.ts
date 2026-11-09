import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { generateId } from '../db.js';

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const passwordResetsRepository = {
  /** Crea un token de un solo uso e invalida los anteriores del usuario. Devuelve el token en claro. */
  create(userId: string, ttlMinutes = 30): { token: string; expiresAt: string } {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
    const db = getDatabase();
    db.transaction(() => {
      db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(now.toISOString(), userId);
      db.prepare(
        'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(generateId('prt'), userId, hashResetToken(token), expiresAt, now.toISOString());
    })();
    return { token, expiresAt };
  },
  findValid(token: string): { id: string; user_id: string } | undefined {
    return getDatabase()
      .prepare('SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
      .get(hashResetToken(token), new Date().toISOString()) as any;
  },
  markUsed(id: string): boolean {
    return (
      getDatabase()
        .prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL')
        .run(new Date().toISOString(), id).changes > 0
    );
  },
};
