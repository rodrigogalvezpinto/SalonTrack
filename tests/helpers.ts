import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/** Configura un entorno aislado (SQLite y respaldos en un directorio temporal). Llamar antes de usar la BD. */
export function setupTestEnv(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `salontrack-${name}-`));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_FILE = path.join(dir, 'test.sqlite');
  process.env.LEGACY_JSON_FILE = path.join(dir, 'legacy.json');
  process.env.BACKUP_DIR = path.join(dir, 'backups');
  process.env.PAYMENT_PROVIDER = 'local';
  delete process.env.JWT_SECRET;
  return dir;
}

export async function startServer(app: any): Promise<{ server: Server; baseUrl: string }> {
  const server: Server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export function makeClient(baseUrl: string) {
  return async function api(method: string, url: string, body?: unknown, token?: string) {
    const res = await fetch(baseUrl + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}
