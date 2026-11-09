import { getDatabase } from '../db/connection.js';

export type PlatformRole = 'CUSTOMER' | 'PROFESSIONAL' | 'PLATFORM_ADMIN';

export const rolesRepository = {
  listRoles(userId: string): PlatformRole[] {
    return (getDatabase().prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role').all(userId) as Array<{ role: PlatformRole }>).map(row => row.role);
  },
  addRole(userId: string, role: PlatformRole) {
    getDatabase()
      .prepare('INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES (?, ?, ?)')
      .run(userId, role, new Date().toISOString());
  },
  removeRole(userId: string, role: PlatformRole) {
    return getDatabase().prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?').run(userId, role).changes;
  },
  hasRole(userId: string, role: PlatformRole): boolean {
    return !!getDatabase().prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?').get(userId, role);
  },
  listUsersWithRoles() {
    return getDatabase()
      .prepare(`SELECT u.id, u.email, u.created_at, u.is_demo,
        COALESCE(json_group_array(ur.role) FILTER (WHERE ur.role IS NOT NULL), '[]') AS roles
        FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
        GROUP BY u.id ORDER BY u.created_at DESC`)
      .all()
      .map((row: any) => ({ ...row, is_demo: row.is_demo === 1, roles: JSON.parse(row.roles) }));
  },
};
