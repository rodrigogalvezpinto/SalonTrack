import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.DATABASE_FILE || !process.env.DATABASE_FILE_JSON) {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'salontrack-tests-'));
  process.env.DATABASE_FILE ||= join(tempDirectory, 'salontrack.sqlite');
  process.env.DATABASE_FILE_JSON ||= join(tempDirectory, 'salontrack.json');
  process.on('exit', () => rmSync(tempDirectory, { recursive: true, force: true }));
}
