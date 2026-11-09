import { getDatabase } from '../db/connection.js';
import type { Business } from '../services/businesses.js';

const ARRAY_FIELDS = ['specialties', 'home_service_communes'] as const;
const BOOLEAN_FIELDS = ['offers_in_store', 'offers_home_visit', 'offers_remote', 'hide_exact_address', 'is_demo'] as const;

function mapBusiness(row: any): Business | undefined {
  if (!row) return undefined;
  const business: any = { ...row };
  for (const field of ARRAY_FIELDS) business[field] = JSON.parse(row[field] || '[]');
  for (const field of BOOLEAN_FIELDS) business[field] = row[field] === 1;
  return business as Business;
}

function toRow(data: Partial<Business>) {
  const row: any = { ...data };
  for (const field of ARRAY_FIELDS) if (Array.isArray(row[field])) row[field] = JSON.stringify(row[field]);
  for (const field of BOOLEAN_FIELDS) if (row[field] !== undefined) row[field] = row[field] ? 1 : 0;
  return row;
}

export const businessesRepository = {
  insert(business: Business) {
    const fields = Object.keys(business);
    getDatabase()
      .prepare(`INSERT INTO businesses (${fields.join(', ')}) VALUES (${fields.map(field => `@${field}`).join(', ')})`)
      .run(toRow(business));
    return business;
  },
  findById(id: string): Business | undefined {
    return mapBusiness(getDatabase().prepare('SELECT * FROM businesses WHERE id = ?').get(id));
  },
  findBySlug(slug: string): Business | undefined {
    return mapBusiness(getDatabase().prepare('SELECT * FROM businesses WHERE slug = ?').get(slug));
  },
  update(id: string, changes: Partial<Business>): Business | undefined {
    const entries = Object.entries(toRow({ ...changes, updated_at: new Date().toISOString() }))
      .filter(([key]) => key !== 'id' && key !== 'created_at' && key !== 'created_by' && key !== 'is_demo');
    if (entries.length) {
      getDatabase()
        .prepare(`UPDATE businesses SET ${entries.map(([key]) => `${key} = @${key}`).join(', ')} WHERE id = @id`)
        .run({ ...Object.fromEntries(entries), id });
    }
    return this.findById(id);
  },
  listForUser(userId: string) {
    return getDatabase()
      .prepare(`SELECT b.*, bm.role AS my_role FROM businesses b
        JOIN business_members bm ON bm.business_id = b.id
        WHERE bm.user_id = ? AND bm.status = 'ACTIVE' ORDER BY b.name`)
      .all(userId)
      .map((row: any) => ({ ...mapBusiness(row), my_role: row.my_role }));
  },
  listPublished(options: { commune?: string; q?: string; limit: number; offset: number }) {
    const clauses = ["b.status = 'PUBLISHED'"];
    const params: any[] = [];
    if (options.commune) {
      clauses.push('b.commune = ?');
      params.push(options.commune);
    }
    if (options.q) {
      clauses.push('(b.name LIKE ? OR b.description LIKE ? OR b.primary_category LIKE ?)');
      const term = `%${options.q}%`;
      params.push(term, term, term);
    }
    params.push(options.limit, options.offset);
    return getDatabase()
      .prepare(`SELECT b.* FROM businesses b WHERE ${clauses.join(' AND ')} ORDER BY b.name LIMIT ? OFFSET ?`)
      .all(...params)
      .map((row: any) => mapBusiness(row)!);
  },
  listAll(options: { status?: string } = {}) {
    if (options.status) {
      return getDatabase()
        .prepare('SELECT b.*, (SELECT u.email FROM business_members bm JOIN users u ON u.id = bm.user_id WHERE bm.business_id = b.id AND bm.role = \'OWNER\' ORDER BY bm.status = \'ACTIVE\' DESC LIMIT 1) AS owner_email FROM businesses b WHERE b.status = ? ORDER BY b.created_at DESC')
        .all(options.status)
        .map((row: any) => ({ ...mapBusiness(row), owner_email: row.owner_email }));
    }
    return getDatabase()
      .prepare('SELECT b.*, (SELECT u.email FROM business_members bm JOIN users u ON u.id = bm.user_id WHERE bm.business_id = b.id AND bm.role = \'OWNER\' ORDER BY bm.status = \'ACTIVE\' DESC LIMIT 1) AS owner_email FROM businesses b ORDER BY b.created_at DESC')
      .all()
      .map((row: any) => ({ ...mapBusiness(row), owner_email: row.owner_email }));
  },
  slugExists(slug: string, exceptId?: string): boolean {
    return !!getDatabase().prepare('SELECT 1 FROM businesses WHERE slug = ? AND (? IS NULL OR id != ?)').get(slug, exceptId ?? null, exceptId ?? null);
  },
  deleteDemo(): number {
    return getDatabase().prepare('DELETE FROM businesses WHERE is_demo = 1').run().changes;
  },
};
