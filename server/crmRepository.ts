import type { DatabaseSync } from 'node:sqlite';
import { Client, ContactLog, Payment, Profile, Service, Subscription, User, generateId } from './db.js';
import { getSqliteDb, withTransaction } from './sqlite.js';

const CLIENT_COLUMNS = `
  id, user_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at
`;
const SERVICE_COLUMNS = `
  id, user_id, client_id, service_type, color_formula, tint_brand, service_date,
  amount_clp, recommended_interval_days, next_retouch_date, notes, created_at
`;
const CONTACT_LOG_COLUMNS = `
  id, user_id, client_id, contact_date, channel, status, notes, created_at
`;
const SUBSCRIPTION_COLUMNS = `
  id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at
`;
const PAYMENT_COLUMNS = `
  id, user_id, amount_clp, currency, provider, provider_payment_id, status, metadata, created_at
`;

function mapProfile(row: any): Profile | null {
  if (!row) return null;
  let notificationPreferences = {};
  try {
    notificationPreferences = row.notification_preferences ? JSON.parse(row.notification_preferences) : {};
  } catch {}
  return {
    id: row.id,
    user_id: row.user_id,
    full_name: row.full_name,
    business_name: row.business_name || row.full_name,
    phone: row.phone,
    country: row.country,
    currency: row.currency,
    timezone: row.timezone,
    default_interval_days: row.default_interval_days,
    whatsapp_template: row.whatsapp_template,
    re_engagement_template: row.re_engagement_template,
    re_engagement_days_threshold: row.re_engagement_days_threshold,
    notification_preferences: notificationPreferences as Profile['notification_preferences'],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPayment(row: any): Payment {
  let plan = 'pro_quarterly';
  try {
    plan = JSON.parse(row.metadata || '{}').plan || plan;
  } catch {}
  return {
    id: row.id,
    user_id: row.user_id,
    amount_clp: row.amount_clp,
    currency: row.currency,
    provider: row.provider,
    provider_payment_id: row.provider_payment_id,
    status: row.status,
    plan,
    created_at: row.created_at,
  };
}

function getClientFrom(db: DatabaseSync, userId: string, clientId: string): Client | null {
  return (db.prepare(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ? AND user_id = ?`)
    .get(clientId, userId) as Client | undefined) || null;
}

function insertClient(db: DatabaseSync, client: Client, businessId?: string) {
  db.prepare(`
    INSERT INTO clients (
      id, user_id, business_id, full_name, phone, notes, preferred_contact,
      re_engagement_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', 'none', ?, ?)
  `).run(
    client.id,
    client.user_id,
    businessId || null,
    client.full_name,
    client.phone,
    client.notes || '',
    client.created_at,
    client.updated_at,
  );
}

function insertServiceRecord(db: DatabaseSync, service: Service, businessId?: string, bookingId?: string) {
  db.prepare(`
    INSERT INTO client_service_history (
      id, user_id, business_id, client_id, service_type, color_formula, tint_brand,
      service_date, amount_clp, recommended_interval_days, next_retouch_date, notes, booking_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    service.id,
    service.user_id,
    businessId || null,
    service.client_id,
    service.service_type,
    service.color_formula || '',
    service.tint_brand || '',
    service.service_date,
    service.amount_clp || 0,
    service.recommended_interval_days || 30,
    service.next_retouch_date,
    service.notes || '',
    bookingId || null,
    service.created_at,
  );
}

export function getUser(userId: string): User | null {
  return (getSqliteDb().prepare('SELECT id, email, password_hash, created_at FROM users WHERE id = ?')
    .get(userId) as User | undefined) || null;
}

export function createProfileRecord(profile: {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  whatsapp_template: string;
  created_at: string;
}) {
  getSqliteDb().prepare(`
    INSERT INTO user_profiles (
      id, user_id, full_name, phone, country, currency, timezone, default_interval_days,
      whatsapp_template, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?, ?)
  `).run(
    profile.id,
    profile.user_id,
    profile.full_name,
    profile.phone,
    profile.whatsapp_template,
    profile.created_at,
    profile.created_at,
  );
}

export function getProfile(userId: string): Profile | null {
  const row = getSqliteDb().prepare(`
    SELECT p.id, p.user_id, p.full_name,
      COALESCE((
        SELECT b.name
        FROM businesses b
        WHERE b.owner_id = p.user_id
        ORDER BY b.created_at ASC
        LIMIT 1
      ), p.full_name) AS business_name,
      p.phone, p.country, p.currency, p.timezone, p.default_interval_days,
      p.whatsapp_template, p.re_engagement_template, p.re_engagement_days_threshold,
      p.notification_preferences, p.created_at, p.updated_at
    FROM user_profiles p
    WHERE p.user_id = ?
  `).get(userId);
  return mapProfile(row);
}

export function updateProfileDetails(
  userId: string,
  updates: {
    full_name?: string;
    phone?: string;
    default_interval_days?: number;
    whatsapp_template?: string;
    re_engagement_template?: string;
    re_engagement_days_threshold?: number;
  },
) {
  getSqliteDb().prepare(`
    UPDATE user_profiles
    SET full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        default_interval_days = COALESCE(?, default_interval_days),
        whatsapp_template = COALESCE(?, whatsapp_template),
        re_engagement_template = COALESCE(?, re_engagement_template),
        re_engagement_days_threshold = COALESCE(?, re_engagement_days_threshold),
        updated_at = ?
    WHERE user_id = ?
  `).run(
    updates.full_name?.trim() || null,
    updates.phone?.trim() || null,
    updates.default_interval_days ? Number(updates.default_interval_days) : null,
    updates.whatsapp_template ?? null,
    updates.re_engagement_template ?? null,
    updates.re_engagement_days_threshold ? Number(updates.re_engagement_days_threshold) : null,
    new Date().toISOString(),
    userId,
  );
  return getProfile(userId);
}

export function updateProfileTemplate(userId: string, template?: string, thresholdDays?: number): Profile | null {
  if (!getProfile(userId)) return null;
  getSqliteDb().prepare(`
    UPDATE user_profiles
    SET re_engagement_template = COALESCE(?, re_engagement_template),
        re_engagement_days_threshold = COALESCE(?, re_engagement_days_threshold),
        updated_at = ?
    WHERE user_id = ?
  `).run(template === undefined ? null : template, thresholdDays === undefined ? null : Number(thresholdDays), new Date().toISOString(), userId);
  return getProfile(userId);
}

export function updateNotificationPreferences(
  userId: string,
  updates: {
    push_enabled?: unknown;
    alert_time?: string;
    notify_days_before?: number;
    sound_enabled?: unknown;
    push_subscription?: unknown;
  },
): Profile | null {
  const profile = getProfile(userId);
  if (!profile) return null;
  const preferences = {
    push_enabled: updates.push_enabled !== undefined ? Boolean(updates.push_enabled) : true,
    alert_time: updates.alert_time || '09:00',
    notify_days_before: Number(updates.notify_days_before) || 3,
    sound_enabled: updates.sound_enabled !== undefined ? Boolean(updates.sound_enabled) : true,
    push_subscription: updates.push_subscription || profile.notification_preferences?.push_subscription,
  };
  const updatedAt = new Date().toISOString();
  getSqliteDb().prepare(`
    UPDATE user_profiles
    SET notification_preferences = ?, updated_at = ?
    WHERE user_id = ?
  `).run(JSON.stringify(preferences), updatedAt, userId);
  return { ...profile, notification_preferences: preferences, updated_at: updatedAt };
}

export function listClients(userId: string): Client[] {
  return getSqliteDb().prepare(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE user_id = ?`)
    .all(userId) as unknown as Client[];
}

export function getClient(userId: string, clientId: string): Client | null {
  return getClientFrom(getSqliteDb(), userId, clientId);
}

export function createClientWithInitialService(client: Client, service: Service | null) {
  return withTransaction(db => {
    insertClient(db, client);
    if (service) insertServiceRecord(db, service);
    return { client, service };
  });
}

export function updateClient(
  userId: string,
  clientId: string,
  updates: { full_name: string; phone: string; notes?: string },
): Client | null {
  const client = getClient(userId, clientId);
  if (!client) return null;
  const updatedClient: Client = {
    ...client,
    full_name: updates.full_name.trim(),
    phone: updates.phone.trim(),
    notes: updates.notes !== undefined ? updates.notes.trim() : client.notes,
    updated_at: new Date().toISOString(),
  };
  getSqliteDb().prepare(`
    UPDATE clients
    SET full_name = ?, phone = ?, notes = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(updatedClient.full_name, updatedClient.phone, updatedClient.notes, updatedClient.updated_at, clientId, userId);
  return updatedClient;
}

export function deleteClient(userId: string, clientId: string): boolean {
  return withTransaction(db =>
    db.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(clientId, userId).changes > 0
  );
}

export function createServiceRecord(service: Service): boolean {
  return withTransaction(db => {
    if (!getClientFrom(db, service.user_id, service.client_id)) return false;
    insertServiceRecord(db, service);
    db.prepare('UPDATE clients SET updated_at = ? WHERE id = ? AND user_id = ?')
      .run(service.created_at, service.client_id, service.user_id);
    return true;
  });
}

export function listServices(userId: string, clientId?: string): Service[] {
  if (clientId) {
    return getSqliteDb().prepare(`
      SELECT ${SERVICE_COLUMNS}
      FROM client_service_history
      WHERE user_id = ? AND client_id = ?
      ORDER BY service_date DESC
    `).all(userId, clientId) as unknown as Service[];
  }
  return getSqliteDb().prepare(`
    SELECT ${SERVICE_COLUMNS}
    FROM client_service_history
    WHERE user_id = ?
    ORDER BY service_date DESC
  `).all(userId) as unknown as Service[];
}

export function deleteServiceRecord(userId: string, serviceId: string): boolean {
  return withTransaction(db =>
    db.prepare('DELETE FROM client_service_history WHERE id = ? AND user_id = ?').run(serviceId, userId).changes > 0
  );
}

export function createContactLog(log: ContactLog): boolean {
  const db = getSqliteDb();
  if (!getClientFrom(db, log.user_id, log.client_id)) return false;
  db.prepare(`
    INSERT INTO contact_logs (id, user_id, client_id, contact_date, channel, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(log.id, log.user_id, log.client_id, log.contact_date, log.channel, log.status, log.notes || '', log.created_at);
  return true;
}

export function listContactLogs(userId: string, clientId?: string): ContactLog[] {
  if (clientId) {
    return getSqliteDb().prepare(`
      SELECT ${CONTACT_LOG_COLUMNS}
      FROM contact_logs
      WHERE user_id = ? AND client_id = ?
      ORDER BY contact_date DESC
    `).all(userId, clientId) as unknown as ContactLog[];
  }
  return getSqliteDb().prepare(`
    SELECT ${CONTACT_LOG_COLUMNS}
    FROM contact_logs
    WHERE user_id = ?
    ORDER BY contact_date DESC
  `).all(userId) as unknown as ContactLog[];
}

export function findOrCreateBookingClient(
  db: DatabaseSync,
  userId: string,
  businessId: string,
  fullName: string,
  phone: string,
  now: string,
): { id: string } {
  const client = db.prepare(`
    SELECT id
    FROM clients
    WHERE user_id = ? AND business_id = ? AND (phone = ? OR full_name = ?)
    ORDER BY rowid
    LIMIT 1
  `).get(userId, businessId, phone, fullName) as { id: string } | undefined;
  if (client) return client;

  const id = generateId('cli');
  insertClient(db, {
    id,
    user_id: userId,
    business_id: businessId,
    full_name: fullName,
    phone,
    notes: 'Clienta registrada automáticamente desde reserva marketplace',
    created_at: now,
    updated_at: now,
  }, businessId);
  return { id };
}

export function createBookingServiceRecord(
  db: DatabaseSync,
  service: Service,
  businessId: string,
  bookingId: string,
) {
  insertServiceRecord(db, service, businessId, bookingId);
}

export function hasBookingServiceRecord(db: DatabaseSync, bookingId: string): boolean {
  return Boolean(db.prepare(`
    SELECT id FROM client_service_history
    WHERE booking_id = ?
    LIMIT 1
  `).get(bookingId));
}

export function createBookingPayment(
  db: DatabaseSync,
  payment: {
    userId: string | null;
    businessId: string;
    bookingId: string;
    amountClp: number;
    provider: string;
    providerPaymentId: string;
    status: string;
    paymentMethod: string;
    metadata?: string;
    createdAt: string;
    replace?: boolean;
  },
) {
  db.prepare(`
    INSERT ${payment.replace ? 'OR REPLACE ' : ''}INTO payments (
      id, user_id, business_id, booking_id, type, amount_clp, currency, provider,
      provider_payment_id, status, payment_method, metadata, created_at
    ) VALUES (?, ?, ?, ?, 'booking_payment', ?, 'CLP', ?, ?, ?, ?, ?, ?)
  `).run(
    generateId('pay'),
    payment.userId,
    payment.businessId,
    payment.bookingId,
    payment.amountClp,
    payment.provider,
    payment.providerPaymentId,
    payment.status,
    payment.paymentMethod,
    payment.metadata || null,
    payment.createdAt,
  );
}

export function setReEngagementStatus(
  userId: string,
  clientId: string,
  status: NonNullable<Client['re_engagement_status']>,
  notes?: string,
): { client: Client; log: ContactLog } | null {
  return withTransaction(db => {
    const client = getClientFrom(db, userId, clientId);
    if (!client) return null;
    const now = new Date().toISOString();
    db.prepare('UPDATE clients SET re_engagement_status = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(status, now, clientId, userId);
    const log: ContactLog = {
      id: generateId('log'),
      user_id: userId,
      client_id: clientId,
      contact_date: now,
      channel: 'whatsapp',
      status: status === 'reactivated' ? 'scheduled' : 'contacted',
      notes: notes || `Módulo Re-engagement: Marcada como ${status}`,
      created_at: now,
    };
    db.prepare(`
      INSERT INTO contact_logs (id, user_id, client_id, contact_date, channel, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(log.id, userId, clientId, log.contact_date, log.channel, log.status, log.notes || '', log.created_at);
    return { client: { ...client, re_engagement_status: status, updated_at: now }, log };
  });
}

export function getSubscription(userId: string): Subscription | null {
  return (getSqliteDb().prepare(`
    SELECT ${SUBSCRIPTION_COLUMNS}
    FROM subscriptions
    WHERE user_id = ?
    ORDER BY rowid
    LIMIT 1
  `).get(userId) as Subscription | undefined) || null;
}

export function getLatestSubscriptionRecord(userId: string) {
  return getSqliteDb().prepare(`
    SELECT ${SUBSCRIPTION_COLUMNS}
    FROM subscriptions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId) || null;
}

export function createTrialSubscription(userId: string, startDate = new Date().toISOString(), expirationDate?: string): Subscription {
  const expiration = expirationDate || (() => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 14);
    return date.toISOString();
  })();
  const subscription: Subscription = {
    id: generateId('sub'),
    user_id: userId,
    plan: 'pro_quarterly',
    status: 'trial',
    start_date: startDate,
    expiration_date: expiration,
    payment_provider: 'mercadopago',
    created_at: startDate,
  };
  getSqliteDb().prepare(`
    INSERT INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(subscription.id, userId, subscription.plan, subscription.status, subscription.start_date, subscription.expiration_date, subscription.payment_provider, subscription.created_at);
  return subscription;
}

export function getOrCreateSubscription(userId: string): Subscription {
  return getSubscription(userId) || createTrialSubscription(userId);
}

export function listPayments(userId: string): Payment[] {
  return getSqliteDb().prepare(`
    SELECT ${PAYMENT_COLUMNS}
    FROM payments
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId).map(mapPayment);
}

export function getApprovedPaymentRevenue(): number {
  const row = getSqliteDb().prepare(`
    SELECT COALESCE(SUM(amount_clp), 0) AS total
    FROM payments
    WHERE status = 'approved'
  `).get() as { total: number };
  return row.total;
}

export function listSubscriptionPayments(userId: string): Payment[] {
  return getSqliteDb().prepare(`
    SELECT ${PAYMENT_COLUMNS}
    FROM payments
    WHERE user_id = ? AND type = 'subscription_payment'
    ORDER BY created_at DESC
  `).all(userId).map(mapPayment);
}

export function activateLicense(
  userId: string,
  planId: Subscription['plan'],
  planPrice: number,
  durationDays: number,
  providerPaymentId: string,
): { kind: 'created'; payment: Payment; subscription: Subscription } | { kind: 'duplicate'; payment: Payment } | { kind: 'conflict' } {
  return withTransaction(db => {
    const existing = db.prepare(`
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE provider_payment_id = ?
      ORDER BY created_at
      LIMIT 1
    `).get(providerPaymentId) as any;
    if (existing) {
      if (existing.user_id !== userId) return { kind: 'conflict' };
      return { kind: 'duplicate', payment: mapPayment(existing) };
    }

    const payment: Payment = {
      id: generateId('pay'),
      user_id: userId,
      amount_clp: planPrice,
      currency: 'CLP',
      provider: 'mercadopago',
      provider_payment_id: providerPaymentId,
      status: 'approved',
      plan: planId,
      created_at: new Date().toISOString(),
    };
    db.prepare(`
      INSERT INTO payments (
        id, user_id, type, amount_clp, currency, provider, provider_payment_id,
        status, payment_method, metadata, created_at
      ) VALUES (?, ?, 'subscription_payment', ?, 'CLP', 'mercadopago', ?, 'approved', 'simulated_online', ?, ?)
    `).run(payment.id, userId, planPrice, providerPaymentId, JSON.stringify({ plan: planId }), payment.created_at);

    const now = new Date();
    const subscriptionRow = db.prepare(`
      SELECT ${SUBSCRIPTION_COLUMNS}
      FROM subscriptions
      WHERE user_id = ?
      ORDER BY rowid
      LIMIT 1
    `).get(userId) as Subscription | undefined;
    let subscription: Subscription;
    const currentExpiration = subscriptionRow ? new Date(subscriptionRow.expiration_date) : new Date();
    const baseDate = currentExpiration.getTime() > now.getTime() ? currentExpiration : now;
    baseDate.setDate(baseDate.getDate() + durationDays);
    if (subscriptionRow) {
      subscription = {
        ...subscriptionRow,
        plan: planId,
        status: 'active',
        expiration_date: baseDate.toISOString(),
      };
      db.prepare(`
        UPDATE subscriptions
        SET plan = ?, status = 'active', expiration_date = ?
        WHERE id = ? AND user_id = ?
      `).run(subscription.plan, subscription.expiration_date, subscription.id, userId);
    } else {
      subscription = {
        id: generateId('sub'),
        user_id: userId,
        plan: planId,
        status: 'active',
        start_date: now.toISOString(),
        expiration_date: baseDate.toISOString(),
        payment_provider: 'mercadopago',
        created_at: now.toISOString(),
      };
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(subscription.id, userId, subscription.plan, subscription.status, subscription.start_date, subscription.expiration_date, subscription.payment_provider, subscription.created_at);
    }
    return { kind: 'created', payment, subscription };
  });
}
