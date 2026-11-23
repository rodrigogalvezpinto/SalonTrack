import { generateId } from './db.js';
import { getSqliteDb } from './sqlite.js';

export type PlatformAdminGrantResult =
  | { status: 'granted'; userId: string }
  | { status: 'already_granted'; userId: string }
  | { status: 'not_found' };

export function grantPlatformAdmin(email: string): PlatformAdminGrantResult {
  const normalizedEmail = email.trim().toLowerCase();
  const db = getSqliteDb();
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as { id: string } | undefined;
  if (!user) return { status: 'not_found' };

  const existingRole = db.prepare(
    "SELECT id FROM user_roles WHERE user_id = ? AND role = 'PLATFORM_ADMIN'"
  ).get(user.id);
  if (existingRole) return { status: 'already_granted', userId: user.id };

  const result = db.prepare(`
    INSERT OR IGNORE INTO user_roles (id, user_id, role, created_at)
    VALUES (?, ?, 'PLATFORM_ADMIN', ?)
  `).run(generateId('role'), user.id, new Date().toISOString());

  return Number(result.changes) > 0
    ? { status: 'granted', userId: user.id }
    : { status: 'already_granted', userId: user.id };
}
