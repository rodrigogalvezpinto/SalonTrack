import { generateId } from './db.js';
import { getSqliteDb } from './sqlite.js';

export function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string,
  urgency: 'high' | 'medium' | 'low' = 'medium',
  createdAt = new Date().toISOString(),
): void {
  getSqliteDb().prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, is_read, entity_type, entity_id, urgency, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    generateId('notif'),
    userId,
    type,
    title,
    message,
    entityType || null,
    entityId || null,
    urgency,
    createdAt,
  );
}
