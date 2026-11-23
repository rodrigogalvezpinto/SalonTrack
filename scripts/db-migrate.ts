import 'dotenv/config';
import { getSqliteDb } from '../server/sqlite.js';

console.log('🔄 Ejecutando migraciones de base de datos SQLite...');
const db = getSqliteDb();
const migrations = db.prepare(`
  SELECT version, name, applied_at, checksum
  FROM schema_migrations
  ORDER BY version ASC
`).all();
console.log('✅ Migraciones aplicadas:', migrations);
console.log('🎉 Base de datos actualizada con éxito.');
