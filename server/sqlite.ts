import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_FILE || path.resolve('data/salontrack.sqlite');

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let sqliteDbInstance: DatabaseSync | null = null;

export function getSqliteDb(): DatabaseSync {
  if (!sqliteDbInstance) {
    sqliteDbInstance = new DatabaseSync(DB_PATH);
    sqliteDbInstance.exec('PRAGMA foreign_keys = ON;');
    sqliteDbInstance.exec('PRAGMA journal_mode = WAL;');
    initMigrations(sqliteDbInstance);
  }
  return sqliteDbInstance;
}

function initMigrations(db: DatabaseSync) {
  // Migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  if (!appliedVersions.has(1)) {
    applyMigrationV1(db);
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      1,
      'initial_relational_schema_v2',
      new Date().toISOString()
    );
    console.log('✅ SQLite Migration v1 (SalonTrack 2.0 Schema) applied successfully.');
  }
}

function applyMigrationV1(db: DatabaseSync) {
  db.exec(`
    -- 1. Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- 2. User Profiles
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      country TEXT NOT NULL DEFAULT 'Chile',
      currency TEXT NOT NULL DEFAULT 'CLP',
      timezone TEXT NOT NULL DEFAULT 'America/Santiago',
      default_interval_days INTEGER NOT NULL DEFAULT 30,
      whatsapp_template TEXT,
      re_engagement_template TEXT,
      re_engagement_days_threshold INTEGER DEFAULT 90,
      notification_preferences TEXT, -- JSON
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

    -- 3. User Roles (Multiple roles per user)
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL, -- 'CUSTOMER', 'PROFESSIONAL', 'BUSINESS_OWNER', 'BUSINESS_ADMIN', 'BUSINESS_STAFF', 'PLATFORM_ADMIN'
      created_at TEXT NOT NULL,
      UNIQUE(user_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

    -- 4. Categories & Subcategories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      description TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(category_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);

    -- 5. Businesses (Negocios)
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      logo_url TEXT,
      cover_url TEXT,
      primary_category_id TEXT REFERENCES categories(id),
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      website TEXT,
      instagram TEXT,
      facebook TEXT,
      address TEXT,
      comuna TEXT,
      region TEXT DEFAULT 'Región Metropolitana',
      country TEXT DEFAULT 'Chile',
      latitude REAL,
      longitude REAL,
      modality TEXT NOT NULL DEFAULT 'salon', -- 'salon', 'home', 'remote', 'both'
      home_service_radius_km REAL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'PUBLISHED', -- 'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'INACTIVE'
      booking_mode TEXT NOT NULL DEFAULT 'AUTOMATIC', -- 'AUTOMATIC', 'MANUAL'
      min_advance_hours INTEGER NOT NULL DEFAULT 2,
      max_advance_days INTEGER NOT NULL DEFAULT 60,
      buffer_minutes INTEGER NOT NULL DEFAULT 10,
      cancellation_policy TEXT,
      cancellation_hours INTEGER DEFAULT 24,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
    CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
    CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
    CREATE INDEX IF NOT EXISTS idx_businesses_comuna ON businesses(comuna);

    -- 6. Business Members (Permisos internos)
    CREATE TABLE IF NOT EXISTS business_members (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'STAFF', -- 'OWNER', 'ADMIN', 'STAFF', 'RECEPTION'
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(business_id, user_id)
    );

    -- 7. Staff (Trabajadores / Profesionales del negocio)
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      specialty TEXT,
      bio TEXT,
      photo_url TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_staff_business_id ON staff(business_id);

    -- 8. Services (Catálogo de Servicios)
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      subcategory_id TEXT REFERENCES subcategories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      price_clp INTEGER NOT NULL,
      price_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed', 'from', 'variable', 'evaluation'
      duration_minutes INTEGER NOT NULL DEFAULT 45,
      prep_minutes INTEGER NOT NULL DEFAULT 0,
      clean_minutes INTEGER NOT NULL DEFAULT 5,
      modality TEXT NOT NULL DEFAULT 'salon', -- 'salon', 'home', 'remote', 'both'
      is_featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PUBLISHED', -- 'DRAFT', 'PUBLISHED', 'INACTIVE'
      display_order INTEGER NOT NULL DEFAULT 0,
      cancellation_policy TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
    CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

    -- 9. Staff Services (Asociación Trabajador <-> Servicio)
    CREATE TABLE IF NOT EXISTS staff_services (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      custom_duration_minutes INTEGER,
      custom_price_clp INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE(staff_id, service_id)
    );

    -- 10. Business Hours (Horarios de atención)
    CREATE TABLE IF NOT EXISTS business_hours (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
      open_time TEXT NOT NULL DEFAULT '09:00',
      close_time TEXT NOT NULL DEFAULT '19:00',
      is_closed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(business_id, day_of_week)
    );

    -- 11. Staff Availability (Horarios por trabajador)
    CREATE TABLE IF NOT EXISTS staff_availability (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '19:00',
      break_start TEXT,
      break_end TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(staff_id, day_of_week)
    );

    -- 12. Availability Blocks (Bloqueos de agenda, descansos, vacaciones)
    CREATE TABLE IF NOT EXISTS availability_blocks (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
      start_datetime TEXT NOT NULL, -- YYYY-MM-DDTHH:MM:SS
      end_datetime TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    -- 13. Bookings (Reservas de turnos)
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL, -- e.g. ST-2026-A1B2
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
      staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
      client_id TEXT, -- CRM Client reference if linked
      customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- User account if registered
      booking_date TEXT NOT NULL, -- YYYY-MM-DD
      start_time TEXT NOT NULL, -- HH:MM
      end_time TEXT NOT NULL, -- HH:MM
      duration_minutes INTEGER NOT NULL,
      amount_clp INTEGER NOT NULL,
      modality TEXT NOT NULL DEFAULT 'salon', -- 'salon', 'home', 'remote'
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'
      payment_method TEXT NOT NULL DEFAULT 'presential', -- 'presential', 'online'
      payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'refunded'
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_email TEXT,
      client_notes TEXT,
      internal_notes TEXT,
      confirmed_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_business_date ON bookings(business_id, booking_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_staff_date ON bookings(staff_id, booking_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

    -- 14. Booking Status History
    CREATE TABLE IF NOT EXISTS booking_status_history (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      changed_by_user_id TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    -- 15. Payments (Pagos de clientes y suscripciones)
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
      booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
      subscription_id TEXT,
      type TEXT NOT NULL DEFAULT 'booking_payment', -- 'booking_payment', 'subscription_payment'
      amount_clp INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CLP',
      provider TEXT NOT NULL DEFAULT 'local', -- 'local', 'mercadopago'
      provider_payment_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved', -- 'pending', 'approved', 'rejected', 'refunded'
      payment_method TEXT NOT NULL DEFAULT 'presential', -- 'cash', 'transfer', 'card', 'simulated_online'
      metadata TEXT, -- JSON
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
    CREATE INDEX IF NOT EXISTS idx_payments_business_id ON payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_payment_id);

    -- 16. Existing CRM: Clients
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      notes TEXT,
      preferred_contact TEXT DEFAULT 'whatsapp',
      re_engagement_status TEXT DEFAULT 'none',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
    CREATE INDEX IF NOT EXISTS idx_clients_business_id ON clients(business_id);

    -- 17. Existing CRM: Client Service History
    CREATE TABLE IF NOT EXISTS client_service_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      service_type TEXT NOT NULL,
      color_formula TEXT,
      tint_brand TEXT,
      service_date TEXT NOT NULL,
      amount_clp INTEGER NOT NULL,
      recommended_interval_days INTEGER NOT NULL DEFAULT 30,
      next_retouch_date TEXT NOT NULL,
      notes TEXT,
      booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_client_service_history_client_id ON client_service_history(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_service_history_next_date ON client_service_history(next_retouch_date);

    -- 18. Existing CRM: Contact Logs
    CREATE TABLE IF NOT EXISTS contact_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      contact_date TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      status TEXT NOT NULL DEFAULT 'contacted',
      notes TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contact_logs_client_id ON contact_logs(client_id);

    -- 19. Reviews & Reputation
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
      booking_id TEXT UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      response TEXT,
      response_date TEXT,
      is_reported INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

    -- 20. Favorites
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
      staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
      service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, business_id)
    );
    CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

    -- 21. Notifications (Centro de Notificaciones)
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      entity_type TEXT,
      entity_id TEXT,
      urgency TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

    -- 22. Subscriptions (Suscripción comercial de la plataforma)
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'pro_quarterly', -- 'basic_monthly', 'pro_quarterly', 'annual'
      status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'expired', 'pending'
      start_date TEXT NOT NULL,
      expiration_date TEXT NOT NULL,
      payment_provider TEXT NOT NULL DEFAULT 'mercadopago',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

    -- 23. Audit Logs (Trazabilidad y seguridad)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      business_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT, -- JSON
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);

    -- 24. Platform Settings
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
