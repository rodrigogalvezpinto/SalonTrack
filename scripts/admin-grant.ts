import { grantPlatformAdmin } from '../server/admin.js';
import { closeSqliteDb } from '../server/sqlite.js';

const email = process.argv[2];

if (!email?.trim()) {
  console.error('Uso: npm run admin:grant -- <correo>');
  process.exitCode = 1;
} else {
  try {
    const result = grantPlatformAdmin(email);
    if (result.status === 'not_found') {
      console.error(`No existe un usuario registrado con el correo "${email}".`);
      process.exitCode = 1;
    } else if (result.status === 'already_granted') {
      console.log('El usuario ya tiene el rol PLATFORM_ADMIN.');
    } else {
      console.log(`Se agregó el rol PLATFORM_ADMIN al usuario "${email}".`);
    }
  } catch (error) {
    console.error('No se pudo asignar el rol PLATFORM_ADMIN:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    closeSqliteDb();
  }
}
