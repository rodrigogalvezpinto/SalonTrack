import { restoreBackup } from '../server/backup.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const backupFile = args.find(arg => arg !== '--force');

if (!backupFile) {
  console.error('Uso: npm run db:restore -- <archivo> [--force]');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !force) {
  console.error('La restauración en producción requiere el argumento --force.');
  process.exit(1);
}

console.warn('⚠️ Detén el servidor antes de restaurar la base de datos.');
const result = restoreBackup(backupFile);
console.log(`✅ Base de datos restaurada desde: ${result.restoredFrom}`);
if (result.safetyBackup) {
  console.log(`✅ Respaldo de seguridad previo: ${result.safetyBackup}`);
} else {
  console.log('No se creó respaldo de seguridad previo porque la base de datos no existía.');
}
