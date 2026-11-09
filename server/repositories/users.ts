import { getDatabase } from '../db/connection.js';
import type { User } from '../db.js';

function mapUser(row: any): User | undefined {
  if (!row) return undefined;
  return { ...row, is_demo: row.is_demo === 1 };
}

export const usersRepository = {
  findById(id: string): User | undefined {
    return mapUser(getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id));
  },
  findByEmail(email: string): User | undefined {
    return mapUser(getDatabase().prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()));
  },
  count(): number {
    return (getDatabase().prepare('SELECT COUNT(*) AS n FROM users').get() as any).n;
  },
  insert(user: User) {
    getDatabase()
      .prepare(
        `INSERT INTO users (id, email, password_hash, is_demo, created_at, updated_at)
         VALUES (@id, @email, @password_hash, @is_demo, @created_at, @updated_at)`
      )
      .run({ ...user, is_demo: user.is_demo ? 1 : 0, updated_at: user.updated_at ?? user.created_at });
  },
  updatePassword(id: string, passwordHash: string) {
    getDatabase()
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), id);
  },
  deleteDemoUsers(): number {
    return getDatabase().prepare('DELETE FROM users WHERE is_demo = 1').run().changes;
  },
};
