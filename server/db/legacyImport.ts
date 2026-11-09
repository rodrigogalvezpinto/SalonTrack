import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getConfig } from '../config.js';
import { generateId } from '../db.js';
import { calculateNextDate, isValidIsoDateSafe } from './legacyHelpers.js';
import { getDatabase } from './connection.js';
import { recordAudit } from '../lib/audit.js';
import { DEMO_EMAIL, LEGACY_DEMO_USER_ID } from './seed.js';
import { ensureProfessionalSetup } from '../services/businesses.js';

type EntityName = 'users' | 'profiles' | 'clients' | 'services' | 'contact_logs' | 'subscriptions' | 'payments';
const ENTITIES: EntityName[] = ['users', 'profiles', 'clients', 'services', 'contact_logs', 'subscriptions', 'payments'];

export interface EntitySummary {
  source: number;
  inserted: number;
  already_present: number;
  skipped: number;
  verified: number;
}

export interface LegacyImportSummary {
  status: 'imported' | 'already_imported' | 'empty' | 'missing';
  source_file: string;
  source_sha256?: string;
  backup_file?: string;
  entities?: Record<EntityName, EntitySummary>;
  skipped_details?: string[];
}

const CLIENT_STATUSES = ['none', 'inactive', 'recontacted', 'reactivated', 'dismissed'];
const CHANNELS = ['whatsapp', 'call', 'sms'];
const CONTACT_STATUSES = ['contacted', 'pending', 'scheduled', 'no_reply'];
const PLANS = ['basic_monthly', 'pro_quarterly', 'annual'];
const SUB_STATUSES = ['trial', 'active', 'expired', 'pending'];
const PAYMENT_STATUSES = ['approved', 'pending', 'rejected'];

const pick = (value: unknown, allowed: string[], fallback: string) =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback;
const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const int = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/**
 * Importa el almacenamiento JSON v1 a SQLite.
 * Idempotente: usa los mismos IDs y nunca sobrescribe registros existentes en SQLite.
 * El JSON original no se modifica; se crea una copia en BACKUP_DIR antes de importar.
 */
export function importLegacyJson(file = getConfig().legacyJsonFile, options: { force?: boolean } = {}): LegacyImportSummary {
  if (!fs.existsSync(file)) return { status: 'missing', source_file: file };

  const raw = fs.readFileSync(file, 'utf-8');
  const data = JSON.parse(raw);
  const total = ENTITIES.reduce((n, e) => n + (Array.isArray(data[e]) ? data[e].length : 0), 0);
  if (total === 0) return { status: 'empty', source_file: file };

  const sha = crypto.createHash('sha256').update(raw).digest('hex');
  const db = getDatabase();
  const previous = db.prepare('SELECT id FROM legacy_imports WHERE source_sha256 = ?').get(sha);
  if (previous && !options.force) return { status: 'already_imported', source_file: file, source_sha256: sha };

  const backupDir = getConfig().backupDir;
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `salontrack-legacy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.copyFileSync(file, backupFile);

  const entities = Object.fromEntries(
    ENTITIES.map(e => [e, { source: Array.isArray(data[e]) ? data[e].length : 0, inserted: 0, already_present: 0, skipped: 0, verified: 0 }])
  ) as Record<EntityName, EntitySummary>;
  const skippedDetails: string[] = [];
  const skip = (entity: EntityName, id: unknown, reason: string) => {
    entities[entity].skipped++;
    skippedDetails.push(`${entity}:${String(id)} -> ${reason}`);
  };
  const exists = (table: string, id: string) => !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);
  const now = new Date().toISOString();
  const newlyInsertedUsers = new Set<string>();

  const run = (entity: EntityName, table: string, id: string, insert: () => number) => {
    if (exists(table, id)) {
      entities[entity].already_present++;
      return;
    }
    if (insert() > 0) entities[entity].inserted++;
    else skip(entity, id, 'restricción de integridad (duplicado o dato inválido)');
  };

  db.transaction(() => {
    for (const u of data.users ?? []) {
      if (!u?.id || !u?.email || !u?.password_hash) { skip('users', u?.id, 'campos obligatorios faltantes'); continue; }
      const email = String(u.email).trim().toLowerCase();
      const isDemo = u.id === LEGACY_DEMO_USER_ID || email === DEMO_EMAIL ? 1 : 0;
      const userExisted = exists('users', u.id) || !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
      run('users', 'users', u.id, () =>
        db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(u.id, email, u.password_hash, isDemo, str(u.created_at, now), str(u.updated_at, str(u.created_at, now))).changes
      );
      if (!userExisted && exists('users', u.id)) newlyInsertedUsers.add(u.id);
    }

    for (const p of data.profiles ?? []) {
      if (!p?.id || !exists('users', p.user_id)) { skip('profiles', p?.id, 'usuario inexistente'); continue; }
      run('profiles', 'user_profiles', p.id, () =>
        db.prepare(`INSERT OR IGNORE INTO user_profiles (id, user_id, full_name, business_name, phone, country, currency, timezone,
            default_interval_days, whatsapp_template, re_engagement_template, re_engagement_days_threshold, notification_preferences,
            created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(
            p.id, p.user_id, str(p.full_name, 'Sin nombre'), str(p.business_name, str(p.full_name, 'Mi salón')), str(p.phone),
            str(p.country, 'Chile'), str(p.currency, 'CLP'), str(p.timezone, 'America/Santiago'),
            int(p.default_interval_days, 30, 1, 365), str(p.whatsapp_template),
            typeof p.re_engagement_template === 'string' ? p.re_engagement_template : null,
            p.re_engagement_days_threshold != null ? int(p.re_engagement_days_threshold, 90, 1, 730) : null,
            p.notification_preferences ? JSON.stringify(p.notification_preferences) : null,
            str(p.created_at, now), str(p.updated_at, now)
          ).changes
      );
    }

    for (const userId of newlyInsertedUsers) {
      const profile = db.prepare('SELECT full_name, business_name, phone FROM user_profiles WHERE user_id = ?').get(userId) as
        | { full_name: string; business_name: string; phone: string }
        | undefined;
      if (!profile) continue;
      const user = db.prepare('SELECT is_demo FROM users WHERE id = ?').get(userId) as { is_demo: number };
      ensureProfessionalSetup(userId, {
        businessName: profile.business_name,
        phone: profile.phone,
        fullName: profile.full_name,
        isDemo: user.is_demo === 1,
      });
    }

    for (const c of data.clients ?? []) {
      if (!c?.id || !exists('users', c.user_id)) { skip('clients', c?.id, 'usuario inexistente'); continue; }
      run('clients', 'clients', c.id, () =>
        db.prepare(`INSERT OR IGNORE INTO clients (id, user_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(c.id, c.user_id, str(c.full_name, 'Sin nombre'), str(c.phone), str(c.notes), c.preferred_contact ?? null,
            pick(c.re_engagement_status, CLIENT_STATUSES, 'none'), str(c.created_at, now), str(c.updated_at, str(c.created_at, now))).changes
      );
    }

    const clientOwned = (clientId: string, userId: string) =>
      !!db.prepare('SELECT 1 FROM clients WHERE id = ? AND user_id = ?').get(clientId, userId);

    for (const s of data.services ?? []) {
      if (!s?.id || !clientOwned(s.client_id, s.user_id)) { skip('services', s?.id, 'clienta inexistente o de otro usuario'); continue; }
      if (!isValidIsoDateSafe(s.service_date)) { skip('services', s.id, 'service_date inválida'); continue; }
      const interval = int(s.recommended_interval_days, 30, 1, 365);
      const next = isValidIsoDateSafe(s.next_retouch_date) ? s.next_retouch_date : calculateNextDate(s.service_date, interval);
      run('services', 'client_service_history', s.id, () =>
        db.prepare(`INSERT OR IGNORE INTO client_service_history (id, user_id, client_id, service_type, color_formula, tint_brand,
            service_date, amount_clp, recommended_interval_days, next_retouch_date, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(s.id, s.user_id, s.client_id, str(s.service_type, 'Servicio'), str(s.color_formula), str(s.tint_brand), s.service_date,
            int(s.amount_clp, 0, 0, 100_000_000), interval, next, str(s.notes), str(s.created_at, now)).changes
      );
    }

    for (const l of data.contact_logs ?? []) {
      if (!l?.id || !clientOwned(l.client_id, l.user_id)) { skip('contact_logs', l?.id, 'clienta inexistente o de otro usuario'); continue; }
      run('contact_logs', 'contact_logs', l.id, () =>
        db.prepare(`INSERT OR IGNORE INTO contact_logs (id, user_id, client_id, contact_date, channel, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(l.id, l.user_id, l.client_id, str(l.contact_date, now), pick(l.channel, CHANNELS, 'whatsapp'),
            pick(l.status, CONTACT_STATUSES, 'contacted'), str(l.notes), str(l.created_at, now)).changes
      );
    }

    for (const s of data.subscriptions ?? []) {
      if (!s?.id || !exists('users', s.user_id)) { skip('subscriptions', s?.id, 'usuario inexistente'); continue; }
      run('subscriptions', 'subscriptions', s.id, () =>
        db.prepare(`INSERT OR IGNORE INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(s.id, s.user_id, pick(s.plan, PLANS, 'pro_quarterly'), pick(s.status, SUB_STATUSES, 'expired'),
            str(s.start_date, now), str(s.expiration_date, now), str(s.payment_provider, 'mercadopago'),
            str(s.created_at, now), str(s.created_at, now)).changes
      );
    }

    for (const p of data.payments ?? []) {
      if (!p?.id || !exists('users', p.user_id) || !p.provider_payment_id) { skip('payments', p?.id, 'usuario o referencia inexistente'); continue; }
      run('payments', 'subscription_payments', p.id, () =>
        db.prepare(`INSERT OR IGNORE INTO subscription_payments (id, user_id, amount_clp, currency, provider, provider_payment_id, status, plan, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(p.id, p.user_id, int(p.amount_clp, 0, 0, 100_000_000), str(p.currency, 'CLP'), str(p.provider, 'mercadopago'),
            String(p.provider_payment_id), pick(p.status, PAYMENT_STATUSES, 'pending'), str(p.plan), str(p.created_at, now)).changes
      );
    }

    const tableOf: Record<EntityName, string> = {
      users: 'users', profiles: 'user_profiles', clients: 'clients', services: 'client_service_history',
      contact_logs: 'contact_logs', subscriptions: 'subscriptions', payments: 'subscription_payments',
    };
    for (const e of ENTITIES) {
      entities[e].verified = (data[e] ?? []).filter((r: any) => r?.id && exists(tableOf[e], r.id)).length;
    }

    db.prepare(`INSERT INTO legacy_imports (id, source_file, source_sha256, backup_file, summary, imported_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(generateId('imp'), file, sha, backupFile, JSON.stringify({ entities, skipped_details: skippedDetails }), now);
    recordAudit({ action: 'legacy_json.imported', entityType: 'legacy_import', metadata: { file, sha, entities } });
  })();

  return { status: 'imported', source_file: file, source_sha256: sha, backup_file: backupFile, entities, skipped_details: skippedDetails };
}
