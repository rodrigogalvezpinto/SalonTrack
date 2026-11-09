import path from 'node:path';

const KNOWN_INSECURE_SECRETS = new Set([
  'salontrack_dev_secret_chile_2026',
  'salontrack_secure_jwt_secret_chile_2026_change_in_production',
  'replace_for_local_development',
]);

const DEV_JWT_SECRET = 'salontrack_dev_secret_chile_2026';

export type ProviderName = 'local' | 'mercadopago';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  appUrl: string;
  jwtSecret: string;
  databaseFile: string;
  legacyJsonFile: string;
  backupDir: string;
  paymentProvider: ProviderName;
  emailProvider: 'local';
  whatsappProvider: 'local';
  seedDemoData: boolean;
}

function resolveDatabaseFile(): string {
  const raw = process.env.DATABASE_FILE?.trim();
  // Older .env files pointed DATABASE_FILE at the legacy JSON store.
  if (!raw || raw.endsWith('.json')) {
    return path.resolve('data/salontrack.sqlite');
  }
  return raw === ':memory:' ? raw : path.resolve(raw);
}

function resolveLegacyJsonFile(): string {
  const explicit = process.env.LEGACY_JSON_FILE?.trim();
  if (explicit) return path.resolve(explicit);
  const raw = process.env.DATABASE_FILE?.trim();
  if (raw && raw.endsWith('.json')) return path.resolve(raw);
  return path.resolve('data/salontrack.json');
}

function resolveJwtSecret(isProduction: boolean): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (isProduction) {
    if (!secret || secret.length < 32 || KNOWN_INSECURE_SECRETS.has(secret)) {
      throw new Error(
        'JWT_SECRET debe estar configurado en producción con al menos 32 caracteres y no puede ser un valor de ejemplo.'
      );
    }
    return secret;
  }
  return secret || DEV_JWT_SECRET;
}

export function getConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const paymentProvider = (process.env.PAYMENT_PROVIDER || 'local').trim().toLowerCase();
  const databaseFile = resolveDatabaseFile();

  return {
    nodeEnv,
    isProduction,
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    jwtSecret: resolveJwtSecret(isProduction),
    databaseFile,
    legacyJsonFile: resolveLegacyJsonFile(),
    backupDir: path.resolve(process.env.BACKUP_DIR || 'data/backups'),
    paymentProvider: paymentProvider === 'mercadopago' ? 'mercadopago' : 'local',
    emailProvider: 'local',
    whatsappProvider: 'local',
    seedDemoData: (process.env.SEED_DEMO_DATA ?? (isProduction ? 'false' : 'true')).toLowerCase() === 'true',
  };
}
