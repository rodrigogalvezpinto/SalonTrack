import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { checkMigrations, closeSqliteDb, getDatabasePath, getSqliteDb } from './sqlite.js';

export function createBackup(
  targetDir = path.resolve('data/backups'),
  prefix = 'salontrack_backup_'
): string {
  const backupDir = path.resolve(targetDir);
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupDir, `${prefix}${timestamp}.sqlite`);
  getSqliteDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  return file;
}

export function verifyBackup(file: string): { ok: true } | { ok: false; error: string } {
  if (!fs.existsSync(file)) return { ok: false, error: 'El archivo de respaldo no existe.' };

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const integrityRow = db.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined;
    const integrity = integrityRow ? Object.values(integrityRow)[0] : undefined;
    if (integrity !== 'ok') {
      return { ok: false, error: `La verificación de integridad SQLite falló: ${String(integrity)}.` };
    }

    const migrationProblems = checkMigrations(db);
    if (migrationProblems.length > 0) return { ok: false, error: migrationProblems.join('\n') };

    return { ok: true };
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `No se pudo verificar el respaldo: ${cause}` };
  } finally {
    try {
      db?.close();
    } catch {}
  }
}

export function restoreBackup(file: string): { restoredFrom: string; safetyBackup: string | null } {
  const backupFile = path.resolve(file);
  const verification = verifyBackup(backupFile);
  if (!verification.ok) throw new Error(`Respaldo inválido: ${verification.error}`);

  const databasePath = getDatabasePath();
  if (path.resolve(databasePath) === backupFile) {
    throw new Error('El respaldo debe ser distinto del archivo de base de datos actual.');
  }

  const safetyBackup = fs.existsSync(databasePath)
    ? createBackup(path.join(path.dirname(databasePath), 'backups'), 'pre_restore_')
    : null;

  closeSqliteDb();
  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  fs.copyFileSync(backupFile, databasePath);
  getSqliteDb();

  return { restoredFrom: backupFile, safetyBackup };
}
