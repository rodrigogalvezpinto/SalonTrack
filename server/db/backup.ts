import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getConfig } from '../config.js';
import { closeDatabase, getDatabase, getDatabaseFile } from './connection.js';

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Copia consistente en caliente usando la API de backup de SQLite. */
export async function backupDatabase(destination?: string): Promise<string> {
  const dest = path.resolve(destination || path.join(getConfig().backupDir, `salontrack-${timestamp()}.sqlite`));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await getDatabase().backup(dest);
  return dest;
}

export function verifyBackupFile(file: string): { ok: true; migrations: number } {
  if (!fs.existsSync(file)) throw new Error(`No existe el archivo de respaldo: ${file}`);
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`El respaldo está corrupto (integrity_check: ${integrity}).`);
    const hasMigrations = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
    if (!hasMigrations) throw new Error('El archivo no es un respaldo de SalonTrack (falta schema_migrations).');
    const migrations = (db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as any).n;
    return { ok: true, migrations };
  } finally {
    db.close();
  }
}

/**
 * Restaura un respaldo sobre DATABASE_FILE. Antes guarda una copia de seguridad de la base actual.
 * Debe ejecutarse con el servidor detenido.
 */
export async function restoreDatabase(source: string, target = getConfig().databaseFile): Promise<{ restoredFrom: string; safetyBackup: string | null }> {
  const src = path.resolve(source);
  verifyBackupFile(src);
  let safetyBackup: string | null = null;

  if (fs.existsSync(target)) {
    safetyBackup = path.join(getConfig().backupDir, `pre-restore-${timestamp()}.sqlite`);
    fs.mkdirSync(path.dirname(safetyBackup), { recursive: true });
    const current = new Database(target, { fileMustExist: true });
    await current.backup(safetyBackup);
    current.close();
  }

  if (getDatabaseFile() === target) closeDatabase();
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(target + suffix)) fs.rmSync(target + suffix);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  return { restoredFrom: src, safetyBackup };
}
