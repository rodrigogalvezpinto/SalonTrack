import { createBackup, verifyBackup } from '../server/backup.js';

const backup = createBackup();
console.log(`✅ Respaldo de SQLite creado en: ${backup}`);
const verification = verifyBackup(backup);
if (verification.ok) {
  console.log('✅ Respaldo verificado correctamente.');
} else {
  console.error(`❌ No se pudo verificar el respaldo: ${verification.error}`);
  process.exitCode = 1;
}
