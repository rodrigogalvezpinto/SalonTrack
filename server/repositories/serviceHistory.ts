import { getDatabase } from '../db/connection.js';
import type { Service } from '../db.js';

export const serviceHistoryRepository = {
  listByUser(userId: string): Service[] {
    return getDatabase()
      .prepare('SELECT * FROM client_service_history WHERE user_id = ? ORDER BY service_date DESC, created_at DESC')
      .all(userId) as Service[];
  },
  listByClient(clientId: string, userId: string): Service[] {
    return getDatabase()
      .prepare('SELECT * FROM client_service_history WHERE client_id = ? AND user_id = ? ORDER BY service_date DESC, created_at DESC')
      .all(clientId, userId) as Service[];
  },
  insert(service: Service) {
    getDatabase()
      .prepare(
        `INSERT INTO client_service_history (id, user_id, client_id, service_type, color_formula, tint_brand, service_date,
           amount_clp, recommended_interval_days, next_retouch_date, notes, created_at)
         VALUES (@id, @user_id, @client_id, @service_type, @color_formula, @tint_brand, @service_date,
           @amount_clp, @recommended_interval_days, @next_retouch_date, @notes, @created_at)`
      )
      .run({ ...service, color_formula: service.color_formula ?? '', tint_brand: service.tint_brand ?? '', notes: service.notes ?? '' });
  },
  deleteForUser(id: string, userId: string): boolean {
    return getDatabase().prepare('DELETE FROM client_service_history WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};
