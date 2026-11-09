import { getDatabase } from '../db/connection.js';
import type { Client } from '../db.js';

function mapClient(row: any): Client | undefined {
  if (!row) return undefined;
  const client = { ...row };
  if (client.preferred_contact === null) delete client.preferred_contact;
  return client as Client;
}

export const clientsRepository = {
  listByUser(userId: string, search?: string): Client[] {
    const db = getDatabase();
    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      return (db
        .prepare('SELECT * FROM clients WHERE user_id = ? AND (lower(full_name) LIKE ? OR lower(phone) LIKE ?) ORDER BY created_at')
        .all(userId, q, q) as any[]).map(r => mapClient(r)!);
    }
    return (db.prepare('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at').all(userId) as any[]).map(r => mapClient(r)!);
  },
  findForUser(id: string, userId: string): Client | undefined {
    return mapClient(getDatabase().prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(id, userId));
  },
  insert(client: Client) {
    getDatabase()
      .prepare(
        `INSERT INTO clients (id, user_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at)
         VALUES (@id, @user_id, @full_name, @phone, @notes, @preferred_contact, @re_engagement_status, @created_at, @updated_at)`
      )
      .run({ ...client, preferred_contact: client.preferred_contact ?? null, re_engagement_status: client.re_engagement_status ?? 'none' });
  },
  update(client: Client) {
    getDatabase()
      .prepare(
        `UPDATE clients SET full_name = @full_name, phone = @phone, notes = @notes, re_engagement_status = @re_engagement_status,
         updated_at = @updated_at WHERE id = @id AND user_id = @user_id`
      )
      .run({ ...client, re_engagement_status: client.re_engagement_status ?? 'none' });
  },
  touch(id: string, userId: string) {
    getDatabase().prepare('UPDATE clients SET updated_at = ? WHERE id = ? AND user_id = ?').run(new Date().toISOString(), id, userId);
  },
  /** Elimina la clienta; el historial y contactos se eliminan por ON DELETE CASCADE. */
  deleteForUser(id: string, userId: string): boolean {
    return getDatabase().prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};
