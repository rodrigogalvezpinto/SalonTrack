import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve('data/salontrack.sqlite');
const backupDir = path.resolve('data/backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, `salontrack_backup_${timestamp}.sqlite`);

if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, target);
  console.log(`✅ Respaldo de SQLite creado exitosamente en: ${target}`);
} else {
  console.log('⚠️ Base de datos salontrack.sqlite aún no creada.');
}
