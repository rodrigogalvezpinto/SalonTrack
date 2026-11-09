import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getConfig } from '../config.js';
import { runMigrations } from './migrate.js';

export type DB = Database.Database;

let instance: DB | null = null;
let instanceFile: string | null = null;

export function openDatabase(file: string): DB {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  runMigrations(db);
  return db;
}

/** Opens (or reopens) the shared connection. Used at startup and by tests. */
export function initDatabase(file = getConfig().databaseFile): DB {
  closeDatabase();
  instance = openDatabase(file);
  instanceFile = file;
  return instance;
}

export function getDatabase(): DB {
  return instance ?? initDatabase();
}

export function getDatabaseFile(): string | null {
  return instanceFile;
}

export function closeDatabase() {
  if (instance) {
    instance.close();
    instance = null;
    instanceFile = null;
  }
}

/** Runs fn inside a single SQLite transaction (nested calls become savepoints). */
export function transaction<T>(fn: () => T): T {
  return getDatabase().transaction(fn)();
}
