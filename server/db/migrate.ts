import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export function listMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter(f => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map(file => {
      const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
      return {
        version: file.slice(0, 3),
        name: file.replace(/\.sql$/, ''),
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      };
    });
}

/** Applies pending versioned migrations, each one atomically. Returns applied names. */
export function runMigrations(db: Database.Database, dir = MIGRATIONS_DIR): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Map<string, { checksum: string; name: string }>(
    (db.prepare('SELECT version, name, checksum FROM schema_migrations').all() as any[]).map(r => [
      r.version,
      { checksum: r.checksum, name: r.name },
    ])
  );

  const newlyApplied: string[] = [];
  for (const migration of listMigrations(dir)) {
    const existing = applied.get(migration.version);
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `La migración ${migration.name} fue modificada después de aplicarse. Crea una nueva migración en lugar de editarla.`
        );
      }
      continue;
    }
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)').run(
        migration.version,
        migration.name,
        migration.checksum,
        new Date().toISOString()
      );
    })();
    newlyApplied.push(migration.name);
  }
  return newlyApplied;
}
