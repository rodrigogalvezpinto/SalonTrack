import { getDatabase } from '../db/connection.js';

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'PROFESSIONAL' | 'RECEPTION';
  display_name: string;
  title: string;
  specialties: string[];
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  email?: string;
}

function mapMember(row: any): BusinessMember | undefined {
  if (!row) return undefined;
  return { ...row, specialties: JSON.parse(row.specialties || '[]') };
}

export const membersRepository = {
  insert(member: BusinessMember) {
    getDatabase()
      .prepare(`INSERT INTO business_members
        (id, business_id, user_id, role, display_name, title, specialties, status, created_at, updated_at)
        VALUES (@id, @business_id, @user_id, @role, @display_name, @title, @specialties, @status, @created_at, @updated_at)`)
      .run({ ...member, specialties: JSON.stringify(member.specialties) });
    return member;
  },
  findById(id: string, businessId: string): BusinessMember | undefined {
    return mapMember(getDatabase().prepare('SELECT * FROM business_members WHERE id = ? AND business_id = ?').get(id, businessId));
  },
  findMembership(businessId: string, userId: string): BusinessMember | undefined {
    return mapMember(getDatabase().prepare('SELECT * FROM business_members WHERE business_id = ? AND user_id = ?').get(businessId, userId));
  },
  listByBusiness(businessId: string) {
    return getDatabase()
      .prepare(`SELECT bm.*, u.email FROM business_members bm JOIN users u ON u.id = bm.user_id
        WHERE bm.business_id = ? ORDER BY bm.created_at, bm.display_name`)
      .all(businessId)
      .map((row: any) => mapMember(row)!);
  },
  update(id: string, businessId: string, changes: Partial<BusinessMember>) {
    const row: any = { ...changes };
    if (Array.isArray(row.specialties)) row.specialties = JSON.stringify(row.specialties);
    row.updated_at = new Date().toISOString();
    const entries = Object.entries(row).filter(([key]) => !['id', 'business_id', 'user_id', 'created_at'].includes(key));
    if (entries.length) {
      getDatabase()
        .prepare(`UPDATE business_members SET ${entries.map(([key]) => `${key} = @${key}`).join(', ')} WHERE id = @id AND business_id = @business_id`)
        .run({ ...Object.fromEntries(entries), id, business_id: businessId });
    }
    return this.findById(id, businessId);
  },
  countActiveOwners(businessId: string): number {
    return (getDatabase().prepare("SELECT COUNT(*) AS n FROM business_members WHERE business_id = ? AND role = 'OWNER' AND status = 'ACTIVE'").get(businessId) as any).n;
  },
};
