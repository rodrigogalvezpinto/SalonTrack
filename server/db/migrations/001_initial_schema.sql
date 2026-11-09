-- SalonTrack 2.0 - Fase 1: esquema base equivalente al almacenamiento JSON v1.
-- Convenciones portables a PostgreSQL: IDs TEXT, fechas ISO-8601 TEXT, montos CLP INTEGER.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_users_email ON users(email);

CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Chile',
  currency TEXT NOT NULL DEFAULT 'CLP',
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  default_interval_days INTEGER NOT NULL DEFAULT 30 CHECK (default_interval_days BETWEEN 1 AND 365),
  whatsapp_template TEXT NOT NULL DEFAULT '',
  re_engagement_template TEXT,
  re_engagement_days_threshold INTEGER CHECK (re_engagement_days_threshold IS NULL OR re_engagement_days_threshold BETWEEN 1 AND 730),
  notification_preferences TEXT CHECK (notification_preferences IS NULL OR json_valid(notification_preferences)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  preferred_contact TEXT,
  re_engagement_status TEXT NOT NULL DEFAULT 'none'
    CHECK (re_engagement_status IN ('none', 'inactive', 'recontacted', 'reactivated', 'dismissed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_clients_user ON clients(user_id);
-- Permite claves foráneas compuestas que garantizan que el historial pertenece al mismo profesional.
CREATE UNIQUE INDEX ux_clients_id_user ON clients(id, user_id);

-- Historial de atenciones del CRM (en v1: colección "services").
CREATE TABLE client_service_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  color_formula TEXT NOT NULL DEFAULT '',
  tint_brand TEXT NOT NULL DEFAULT '',
  service_date TEXT NOT NULL,
  amount_clp INTEGER NOT NULL DEFAULT 0 CHECK (amount_clp >= 0),
  recommended_interval_days INTEGER NOT NULL CHECK (recommended_interval_days BETWEEN 1 AND 365),
  next_retouch_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id, user_id) REFERENCES clients(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_service_history_user_client ON client_service_history(user_id, client_id, service_date);

CREATE TABLE contact_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  contact_date TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'call', 'sms')),
  status TEXT NOT NULL DEFAULT 'contacted' CHECK (status IN ('contacted', 'pending', 'scheduled', 'no_reply')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id, user_id) REFERENCES clients(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_contact_logs_user_client ON contact_logs(user_id, client_id, contact_date);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('basic_monthly', 'pro_quarterly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'pending')),
  start_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  payment_provider TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Pagos de suscripciones de SalonTrack (separados de futuros pagos de reservas).
CREATE TABLE subscription_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_clp INTEGER NOT NULL CHECK (amount_clp >= 0),
  currency TEXT NOT NULL DEFAULT 'CLP',
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  plan TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_subscription_payments_provider_ref ON subscription_payments(provider, provider_payment_id);
CREATE INDEX idx_subscription_payments_user ON subscription_payments(user_id, created_at);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- Registro de envíos de los proveedores (locales o reales) de email/WhatsApp.
CREATE TABLE notification_delivery_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push', 'internal')),
  provider TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('simulated', 'sent', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_delivery_logs_user ON notification_delivery_logs(user_id, created_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Trazabilidad de importaciones desde el almacenamiento JSON v1.
CREATE TABLE legacy_imports (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  backup_file TEXT,
  summary TEXT NOT NULL CHECK (json_valid(summary)),
  imported_at TEXT NOT NULL
);
CREATE INDEX idx_legacy_imports_sha ON legacy_imports(source_sha256);
