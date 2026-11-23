import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { checkMigrations, closeSqliteDb, getDatabasePath, getSqliteDb } from './sqlite.js';

function buildBackupPath(targetDir: string, prefix: string): string {
  const backupDir = path.resolve(targetDir);
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupDir, `${prefix}${timestamp}.sqlite`);
}

export function createBackup(
  targetDir = path.join(path.dirname(getDatabasePath()), 'backups'),
  prefix = 'salontrack_backup_'
): string {
  const file = buildBackupPath(targetDir, prefix);
  getSqliteDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  return file;
}

function createRawSafetyBackup(databasePath: string, backupDir: string): string {
  const file = buildBackupPath(backupDir, 'pre_restore_');
  fs.copyFileSync(databasePath, file);
  for (const suffix of ['-wal', '-shm']) {
    const source = `${databasePath}${suffix}`;
    if (fs.existsSync(source)) fs.copyFileSync(source, `${file}${suffix}`);
  }
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

  const backupDir = path.join(path.dirname(databasePath), 'backups');
  let safetyBackup: string | null = null;
  if (fs.existsSync(databasePath)) {
    try {
      safetyBackup = createBackup(backupDir, 'pre_restore_');
    } catch {
      closeSqliteDb();
      safetyBackup = createRawSafetyBackup(databasePath, backupDir);
    }
  }

  const temporaryDatabasePath = `${databasePath}.restore-tmp`;
  try {
    fs.rmSync(temporaryDatabasePath, { force: true });
    fs.copyFileSync(backupFile, temporaryDatabasePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryDatabasePath, { force: true });
    } catch {}
    throw error;
  }

  closeSqliteDb();
  for (const filePath of [`${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  fs.renameSync(temporaryDatabasePath, databasePath);
  getSqliteDb();

  return { restoredFrom: backupFile, safetyBackup };
}
