import { getDatabase } from '../db/connection.js';
import type { ContactLog } from '../db.js';

export const contactLogsRepository = {
  listByUser(userId: string): ContactLog[] {
    return getDatabase().prepare('SELECT * FROM contact_logs WHERE user_id = ? ORDER BY contact_date DESC').all(userId) as ContactLog[];
  },
  listByClient(clientId: string, userId: string): ContactLog[] {
    return getDatabase()
      .prepare('SELECT * FROM contact_logs WHERE client_id = ? AND user_id = ? ORDER BY contact_date DESC')
      .all(clientId, userId) as ContactLog[];
  },
  insert(log: ContactLog) {
    getDatabase()
      .prepare(
        `INSERT INTO contact_logs (id, user_id, client_id, contact_date, channel, status, notes, created_at)
         VALUES (@id, @user_id, @client_id, @contact_date, @channel, @status, @notes, @created_at)`
      )
      .run({ ...log, notes: log.notes ?? '' });
  },
};
