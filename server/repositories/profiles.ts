import { getDatabase } from '../db/connection.js';
import type { Profile } from '../db.js';

const COLUMNS = [
  'id', 'user_id', 'full_name', 'business_name', 'phone', 'country', 'currency', 'timezone',
  'default_interval_days', 'whatsapp_template', 're_engagement_template', 're_engagement_days_threshold',
  'notification_preferences', 'created_at', 'updated_at',
] as const;

function mapProfile(row: any): Profile | undefined {
  if (!row) return undefined;
  const profile: any = { ...row };
  profile.notification_preferences = row.notification_preferences ? JSON.parse(row.notification_preferences) : undefined;
  if (profile.re_engagement_template === null) delete profile.re_engagement_template;
  if (profile.re_engagement_days_threshold === null) delete profile.re_engagement_days_threshold;
  if (profile.notification_preferences === undefined) delete profile.notification_preferences;
  return profile as Profile;
}

function toRow(profile: Profile) {
  return {
    ...profile,
    re_engagement_template: profile.re_engagement_template ?? null,
    re_engagement_days_threshold: profile.re_engagement_days_threshold ?? null,
    notification_preferences: profile.notification_preferences ? JSON.stringify(profile.notification_preferences) : null,
  };
}

export const profilesRepository = {
  findByUserId(userId: string): Profile | undefined {
    return mapProfile(getDatabase().prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId));
  },
  insert(profile: Profile) {
    getDatabase()
      .prepare(`INSERT INTO user_profiles (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(c => '@' + c).join(', ')})`)
      .run(toRow(profile));
  },
  update(profile: Profile): Profile {
    const updated = { ...profile, updated_at: new Date().toISOString() };
    getDatabase()
      .prepare(
        `UPDATE user_profiles SET ${COLUMNS.filter(c => c !== 'id' && c !== 'user_id' && c !== 'created_at')
          .map(c => `${c} = @${c}`)
          .join(', ')} WHERE user_id = @user_id`
      )
      .run(toRow(updated));
    return updated;
  },
};
