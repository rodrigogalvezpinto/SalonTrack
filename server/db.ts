import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getSqliteDb } from './sqlite.js';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  phone: string;
  country: string; // 'Chile'
  currency: string; // 'CLP'
  timezone: string; // 'America/Santiago'
  default_interval_days: number;
  whatsapp_template: string;
  re_engagement_template?: string;
  re_engagement_days_threshold?: number;
  notification_preferences?: {
    push_enabled: boolean;
    alert_time: string; // e.g. "09:00"
    notify_days_before: number; // e.g. 3
    sound_enabled?: boolean;
    push_subscription?: any;
  };
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  business_id?: string;
  full_name: string;
  phone: string;
  notes: string;
  preferred_contact?: string;
  re_engagement_status?: 'none' | 'inactive' | 'recontacted' | 'reactivated' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  client_id: string;
  service_type: string;
  color_formula?: string;
  tint_brand?: string;
  service_date: string; // YYYY-MM-DD
  amount_clp: number; // Integer CLP
  recommended_interval_days: number;
  next_retouch_date: string; // YYYY-MM-DD
  notes?: string;
  created_at: string;
}

export interface ContactLog {
  id: string;
  user_id: string;
  client_id: string;
  contact_date: string;
  channel: 'whatsapp' | 'call' | 'sms';
  status: 'contacted' | 'pending' | 'scheduled' | 'no_reply';
  notes?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'basic_monthly' | 'pro_quarterly' | 'annual';
  status: 'trial' | 'active' | 'expired' | 'pending';
  start_date: string;
  expiration_date: string;
  payment_provider: 'mercadopago' | 'transfer' | 'manual';
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount_clp: number;
  currency: string;
  provider: 'mercadopago' | 'local';
  provider_payment_id: string;
  status: 'approved' | 'pending' | 'rejected' | 'refunded';
  plan: string;
  created_at: string;
}

export interface DatabaseSchema {
  users: User[];
  profiles: Profile[];
  clients: Client[];
  services: Service[];
  contact_logs: ContactLog[];
  subscriptions: Subscription[];
  payments: Payment[];
}

const DB_FILE = process.env.DATABASE_FILE_JSON || path.resolve('data/salontrack.json');

let inMemoryDb: DatabaseSchema = {
  users: [],
  profiles: [],
  clients: [],
  services: [],
  contact_logs: [],
  subscriptions: [],
  payments: []
};

export function saveDb(data?: DatabaseSchema) {
  if (data) {
    inMemoryDb = data;
  }
  // Sync in-memory representation with SQLite CRM tables to ensure persistence
  syncInMemoryToSqlite(inMemoryDb);

  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    // Non-blocking JSON backup write
  }
}

function syncInMemoryToSqlite(dbData: DatabaseSchema) {
  try {
    const db = getSqliteDb();

    // Sync users
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `);
    for (const u of dbData.users) {
      insertUser.run(u.id, u.email, u.password_hash, u.created_at || new Date().toISOString());
    }

    // Sync profiles
    const insertProfile = db.prepare(`
      INSERT OR REPLACE INTO user_profiles (
        id, user_id, full_name, phone, country, currency, timezone, default_interval_days,
        whatsapp_template, re_engagement_template, re_engagement_days_threshold, notification_preferences, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of dbData.profiles) {
      insertProfile.run(
        p.id,
        p.user_id,
        p.full_name,
        p.phone || '',
        p.country || 'Chile',
        p.currency || 'CLP',
        p.timezone || 'America/Santiago',
        p.default_interval_days || 30,
        p.whatsapp_template || '',
        p.re_engagement_template || '',
        p.re_engagement_days_threshold || 90,
        JSON.stringify(p.notification_preferences || {}),
        p.created_at || new Date().toISOString(),
        p.updated_at || new Date().toISOString()
      );
    }

    // Sync clients
    const insertClient = db.prepare(`
      INSERT OR REPLACE INTO clients (id, user_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?)
    `);
    for (const c of dbData.clients) {
      insertClient.run(c.id, c.user_id, c.full_name, c.phone, c.notes || '', c.re_engagement_status || 'none', c.created_at || new Date().toISOString(), c.updated_at || new Date().toISOString());
    }

    // Sync services history
    const insertService = db.prepare(`
      INSERT OR REPLACE INTO client_service_history (
        id, user_id, client_id, service_type, color_formula, tint_brand, service_date, amount_clp, recommended_interval_days, next_retouch_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of dbData.services) {
      insertService.run(s.id, s.user_id, s.client_id, s.service_type, s.color_formula || '', s.tint_brand || '', s.service_date, s.amount_clp || 0, s.recommended_interval_days || 30, s.next_retouch_date, s.notes || '', s.created_at || new Date().toISOString());
    }

    // Sync contact logs
    const insertLog = db.prepare(`
      INSERT OR REPLACE INTO contact_logs (id, user_id, client_id, contact_date, channel, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of dbData.contact_logs) {
      insertLog.run(l.id, l.user_id, l.client_id, l.contact_date, l.channel || 'whatsapp', l.status || 'contacted', l.notes || '', l.created_at || new Date().toISOString());
    }

    // Sync subscriptions
    const insertSub = db.prepare(`
      INSERT OR REPLACE INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const sub of dbData.subscriptions) {
      insertSub.run(sub.id, sub.user_id, sub.plan, sub.status, sub.start_date, sub.expiration_date, sub.payment_provider || 'mercadopago', sub.created_at || new Date().toISOString());
    }
  } catch (err) {
    console.error('Error syncing to SQLite:', err);
  }
}

export function loadDbFromSqlite(): DatabaseSchema {
  try {
    const db = getSqliteDb();

    const users = db.prepare('SELECT id, email, password_hash, created_at FROM users').all() as unknown as User[];
    
    const profileRows = db.prepare('SELECT * FROM user_profiles').all() as any[];
    const profiles: Profile[] = profileRows.map(p => {
      let notif = {};
      try { notif = p.notification_preferences ? JSON.parse(p.notification_preferences) : {}; } catch (e) {}
      return {
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        business_name: p.full_name,
        phone: p.phone,
        country: p.country,
        currency: p.currency,
        timezone: p.timezone,
        default_interval_days: p.default_interval_days,
        whatsapp_template: p.whatsapp_template,
        re_engagement_template: p.re_engagement_template,
        re_engagement_days_threshold: p.re_engagement_days_threshold,
        notification_preferences: notif as any,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    });

    const clients = db.prepare('SELECT id, user_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at FROM clients').all() as unknown as Client[];
    
    const services = db.prepare(`
      SELECT id, user_id, client_id, service_type, color_formula, tint_brand, service_date, amount_clp, recommended_interval_days, next_retouch_date, notes, created_at
      FROM client_service_history
    `).all() as unknown as Service[];

    const contact_logs = db.prepare('SELECT id, user_id, client_id, contact_date, channel, status, notes, created_at FROM contact_logs').all() as unknown as ContactLog[];

    const subscriptions = db.prepare('SELECT id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at FROM subscriptions').all() as unknown as Subscription[];

    const paymentRows = db.prepare('SELECT id, user_id, amount_clp, currency, provider, provider_payment_id, status, created_at FROM payments').all() as any[];
    const payments: Payment[] = paymentRows.map(p => ({
      id: p.id,
      user_id: p.user_id,
      amount_clp: p.amount_clp,
      currency: p.currency,
      provider: p.provider,
      provider_payment_id: p.provider_payment_id,
      status: p.status,
      plan: 'pro_quarterly',
      created_at: p.created_at,
    }));

    return {
      users,
      profiles,
      clients,
      services,
      contact_logs,
      subscriptions,
      payments,
    };
  } catch (err) {
    console.error('Error loading DB from SQLite, fallback to JSON:', err);
    if (fs.existsSync(DB_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      } catch (e) {}
    }
    return inMemoryDb;
  }
}

// Initialize on module load
inMemoryDb = loadDbFromSqlite();

export function getDb(): DatabaseSchema {
  return inMemoryDb;
}

export function refreshDb(): DatabaseSchema {
  inMemoryDb = loadDbFromSqlite();
  return inMemoryDb;
}

export function generateId(prefix = ''): string {
  return prefix ? `${prefix}_${crypto.randomUUID()}` : crypto.randomUUID();
}
