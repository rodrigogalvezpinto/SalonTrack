import { getConfig } from './config.js';
import { initDatabase } from './db/connection.js';
import { importLegacyJson } from './db/legacyImport.js';
import { seedDemoDataIfEmpty } from './db/seed.js';

/** Abre SQLite, aplica migraciones, importa el JSON v1 (si corresponde) y siembra datos demo. */
export function bootstrapDatabase() {
  const config = getConfig();
  initDatabase(config.databaseFile);

  const legacy = importLegacyJson(config.legacyJsonFile);
  if (legacy.status === 'imported') {
    console.log(`📦 Datos JSON v1 importados a SQLite (respaldo: ${legacy.backup_file}).`);
    console.table(legacy.entities);
    if (legacy.skipped_details?.length) console.warn('Registros omitidos:', legacy.skipped_details);
  }

  if (config.seedDemoData) seedDemoDataIfEmpty();
  return config;
}
