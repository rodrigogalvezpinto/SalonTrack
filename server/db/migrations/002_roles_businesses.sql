ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN address TEXT;
ALTER TABLE user_profiles ADD COLUMN preferred_commune TEXT;
ALTER TABLE user_profiles ADD COLUMN preferred_latitude REAL;
ALTER TABLE user_profiles ADD COLUMN preferred_longitude REAL;

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'PROFESSIONAL', 'PLATFORM_ADMIN')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  cover_url TEXT,
  primary_category TEXT,
  specialties TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(specialties)),
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  address TEXT,
  commune TEXT,
  region TEXT,
  country TEXT NOT NULL DEFAULT 'Chile',
  latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  offers_in_store INTEGER NOT NULL DEFAULT 1 CHECK (offers_in_store IN (0, 1)),
  offers_home_visit INTEGER NOT NULL DEFAULT 0 CHECK (offers_home_visit IN (0, 1)),
  offers_remote INTEGER NOT NULL DEFAULT 0 CHECK (offers_remote IN (0, 1)),
  home_service_communes TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(home_service_communes)),
  home_service_radius_km INTEGER CHECK (home_service_radius_km IS NULL OR home_service_radius_km BETWEEN 1 AND 200),
  hide_exact_address INTEGER NOT NULL DEFAULT 0 CHECK (hide_exact_address IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'INACTIVE')),
  status_reason TEXT,
  published_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_commune ON businesses(commune);

CREATE TABLE business_members (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION')),
  display_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  specialties TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(specialties)),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, user_id)
);
CREATE INDEX idx_business_members_user_status ON business_members(user_id, status);

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('business_publication_requires_review', 'false', datetime('now'));

INSERT INTO user_roles (user_id, role, created_at)
SELECT id, 'CUSTOMER', created_at FROM users;
INSERT INTO user_roles (user_id, role, created_at)
SELECT id, 'PROFESSIONAL', created_at FROM users;

INSERT INTO businesses (
  id, slug, name, phone, whatsapp, is_demo, created_by, created_at, updated_at
)
SELECT
  'biz_' || lower(hex(randomblob(16))),
  'negocio-' || lower(hex(randomblob(4))),
  p.business_name,
  p.phone,
  p.phone,
  u.is_demo,
  u.id,
  p.created_at,
  p.updated_at
FROM users u
JOIN user_profiles p ON p.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM business_members bm WHERE bm.user_id = u.id
);

INSERT INTO business_members (
  id, business_id, user_id, role, display_name, created_at, updated_at
)
SELECT
  'mem_' || lower(hex(randomblob(16))),
  b.id,
  b.created_by,
  'OWNER',
  p.full_name,
  b.created_at,
  b.updated_at
FROM businesses b
JOIN user_profiles p ON p.user_id = b.created_by
WHERE b.status = 'DRAFT'
  AND b.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM business_members bm WHERE bm.user_id = b.created_by
  );
