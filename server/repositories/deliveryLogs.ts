import { getDatabase } from '../db/connection.js';
import { generateId } from '../db.js';

export interface DeliveryLogInput {
  userId?: string | null;
  channel: 'email' | 'whatsapp' | 'push' | 'internal';
  provider: string;
  recipient: string;
  subject?: string;
  body: string;
  status: 'simulated' | 'sent' | 'failed';
  error?: string;
}

export const deliveryLogsRepository = {
  insert(entry: DeliveryLogInput): string {
    const id = generateId('dlv');
    getDatabase()
      .prepare(
        `INSERT INTO notification_delivery_logs (id, user_id, channel, provider, recipient, subject, body, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, entry.userId ?? null, entry.channel, entry.provider, entry.recipient, entry.subject ?? null, entry.body, entry.status, entry.error ?? null, new Date().toISOString());
    return id;
  },
  listByUser(userId: string, limit = 50) {
    return getDatabase()
      .prepare('SELECT * FROM notification_delivery_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit);
  },
};
