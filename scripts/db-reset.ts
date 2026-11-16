import fs from 'node:fs';
import { getDatabasePath, getSqliteDb } from '../server/sqlite.js';
import { seedDemoDataIfEmpty } from '../server/seedData.js';

if (process.env.NODE_ENV === 'production') {
  console.error('No se puede reiniciar la base de datos en producción.');
  process.exit(1);
}

console.log('⚠️ Reiniciando base de datos SQLite local...');
const dbPath = getDatabasePath();

try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  const walPath = `${dbPath}-wal`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  const shmPath = `${dbPath}-shm`;
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
} catch (e) {
  console.warn('Note: Could not delete existing file:', e);
}

// Re-init
getSqliteDb();
seedDemoDataIfEmpty();
console.log('🎉 Base de datos reiniciada y re-inicializada con datos de prueba.');
