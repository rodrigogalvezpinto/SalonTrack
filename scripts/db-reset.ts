import fs from 'node:fs';
import path from 'node:path';
import { getSqliteDb } from '../server/sqlite.js';
import { seedDemoDataIfEmpty } from '../server/seedData.js';

console.log('⚠️ Reiniciando base de datos SQLite local...');
const dbPath = path.resolve('data/salontrack.sqlite');

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
