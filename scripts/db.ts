import 'dotenv/config';
import { getConfig } from '../server/config.js';
import { initDatabase, getDatabase, closeDatabase } from '../server/db/connection.js';
import { seedDemoData, resetDemoData, DEMO_EMAIL, DEMO_PASSWORD } from '../server/db/seed.js';
import { backupDatabase, restoreDatabase } from '../server/db/backup.js';
import { importLegacyJson } from '../server/db/legacyImport.js';
import { usersRepository } from '../server/repositories/users.js';
import { rolesRepository } from '../server/repositories/roles.js';

const [command, arg] = process.argv.slice(2);

async function main() {
  const config = getConfig();
  switch (command) {
    case 'migrate': {
      initDatabase(config.databaseFile);
      const rows = getDatabase().prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all();
      console.log(`Base de datos: ${config.databaseFile}`);
      console.table(rows);
      break;
    }
    case 'seed': {
      initDatabase(config.databaseFile);
      console.log(seedDemoData() ? 'Datos demo cargados.' : 'Los datos demo ya existían; no se modificó nada.');
      console.log(`Cuenta demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
      break;
    }
    case 'reset': {
      initDatabase(config.databaseFile);
      const { removedUsers } = resetDemoData();
      console.log(`Datos demo reiniciados (${removedUsers} cuenta(s) demo eliminadas y recreadas). Los datos reales no se tocaron.`);
      break;
    }
    case 'backup': {
      initDatabase(config.databaseFile);
      console.log(`Respaldo creado: ${await backupDatabase(arg)}`);
      break;
    }
    case 'restore': {
      if (!arg) throw new Error('Uso: npm run db:restore -- <ruta-al-respaldo.sqlite>');
      const result = await restoreDatabase(arg, config.databaseFile);
      console.log(`Base restaurada desde ${result.restoredFrom}.`);
      if (result.safetyBackup) console.log(`Copia de seguridad previa: ${result.safetyBackup}`);
      initDatabase(config.databaseFile);
      break;
    }
    case 'import-json': {
      initDatabase(config.databaseFile);
      const summary = importLegacyJson(arg || config.legacyJsonFile, { force: process.argv.includes('--force') });
      console.log(`Estado: ${summary.status} (${summary.source_file})`);
      if (summary.entities) console.table(summary.entities);
      if (summary.skipped_details?.length) console.warn('Omitidos:', summary.skipped_details);
      break;
    }
    case 'grant-admin': {
      if (!arg) throw new Error('Uso: npm run admin:grant -- <correo>');
      initDatabase(config.databaseFile);
      const user = usersRepository.findByEmail(arg);
      if (!user) throw new Error('No existe una cuenta con ese correo.');
      rolesRepository.addRole(user.id, 'PLATFORM_ADMIN');
      console.log(`Rol PLATFORM_ADMIN otorgado a ${user.email}.`);
      break;
    }
    default:
      console.log('Comandos: migrate | seed | reset | backup [destino] | restore <archivo> | import-json [archivo] [--force] | grant-admin <correo>');
      process.exitCode = 1;
  }
  closeDatabase();
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
