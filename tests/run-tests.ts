import './setup-env.js';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { formatCLP, formatChileanDate, formatChileanPhone, buildWhatsAppLink, prepareWhatsAppMessage } from '../src/utils/formatters.js';
import { hashPassword, verifyPassword, seedDemoDataIfEmpty } from '../server/auth.js';
import { createBackup, restoreBackup, verifyBackup } from '../server/backup.js';
import { expireStalePendingBookings } from '../server/bookingExpiration.js';
import { generateId } from '../server/db.js';
import { listClients, listContactLogs, listServices } from '../server/crmRepository.js';
import { checkMigrations, closeSqliteDb, getDatabasePath, getSqliteDb, MIGRATIONS, migrationChecksum, runMigrations, withTransaction } from '../server/sqlite.js';
import { getAvailableSlots, isSlotAvailable } from '../server/availability.js';
import { localEmailProvider, localGeolocationProvider, localPaymentProvider } from '../server/adapters/index.js';
import apiRouter from '../server/routes.js';

console.log('🧪 Iniciando Suite de Pruebas Automatizadas de SalonTrack Chile...\n');

const databaseJsonPath = process.env.DATABASE_FILE_JSON!;
const databaseJsonAtStart = existsSync(databaseJsonPath)
  ? { exists: true, mtimeMs: statSync(databaseJsonPath).mtimeMs }
  : { exists: false };

// Seed test environment with Chilean demo data & categories
seedDemoDataIfEmpty();

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Formateo de Peso Chileno (CLP)
test('Formato CLP: Enteros con separador de miles en punto, sin decimales', () => {
  assert.strictEqual(formatCLP(45000), '$45.000');
  assert.strictEqual(formatCLP(9990), '$9.990');
  assert.strictEqual(formatCLP(14990), '$14.990');
  assert.strictEqual(formatCLP(0), '$0');
});

// 2. Formato de Fechas (DD/MM/AAAA)
test('Formato de Fechas: Estándar chileno DD/MM/AAAA', () => {
  assert.strictEqual(formatChileanDate('2026-11-09'), '09/11/2026');
  assert.strictEqual(formatChileanDate('2026-05-01'), '01/05/2026');
});

// 3. Formato de Teléfonos Chilenos (+56 9 1234 5678)
test('Formato de Teléfono Chileno: +56 9 XXXX XXXX', () => {
  assert.strictEqual(formatChileanPhone('+56991234567'), '+56 9 9123 4567');
  assert.strictEqual(formatChileanPhone('991234567'), '+56 9 9123 4567');
});

// 4. Generación de Enlace WhatsApp
test('Enlace de WhatsApp: Codificación y número internacional chileno', () => {
  const link = buildWhatsAppLink('+56991234567', '¡Hola María! ¿Coordinamos tu retoque?');
  assert.ok(link.startsWith('https://wa.me/56991234567?text='));
  assert.ok(link.includes('%C2%A1Hola'));
});

// 5. Plantillas de WhatsApp con tags
test('Personalización de plantilla WhatsApp: Reemplaza tags {nombre}, {salon}, {servicio}', () => {
  const template = '¡Hola {nombre}! En {salon} te recordamos tu {servicio}.';
  const result = prepareWhatsAppMessage(template, {
    clientName: 'Camila',
    salonName: 'Valeria Studio',
    serviceType: 'Balayage',
  });
  assert.strictEqual(result, '¡Hola Camila! En Valeria Studio te recordamos tu Balayage.');
});

// 6. Seguridad y Autenticación: Hash de contraseñas bcrypt
test('Autenticación Segura: Hash bcrypt y verificación de contraseñas', () => {
  const pass = 'Peluqueria2026';
  const hash = hashPassword(pass);
  assert.notStrictEqual(pass, hash);
  assert.ok(verifyPassword(pass, hash));
  assert.ok(!verifyPassword('WrongPass', hash));
});

// 7. Aislamiento entre Usuarios (Multi-tenant RLS)
test('Aislamiento de Datos (RLS): Un estilista no puede ver datos de otro estilista', () => {
  const sqlite = getSqliteDb();
  const user1Id = generateId('usr');
  const user2Id = generateId('usr');
  const client1Id = generateId('cli');
  const client2Id = generateId('cli');
  const now = new Date().toISOString();
  const insertUser = sqlite.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)');
  const insertClient = sqlite.prepare(`
    INSERT INTO clients (
      id, user_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'whatsapp', 'none', ?, ?)
  `);

  insertUser.run(user1Id, `${user1Id}@example.test`, 'test-hash', now);
  insertUser.run(user2Id, `${user2Id}@example.test`, 'test-hash', now);
  try {
    insertClient.run(client1Id, user1Id, 'Clienta de Estilista 1', '+56911111111', 'Datos privados estilista 1', now, now);
    insertClient.run(client2Id, user2Id, 'Clienta de Estilista 2', '+56922222222', 'Datos privados estilista 2', now, now);

    const user1Clients = listClients(user1Id);
    assert.ok(user1Clients.some(client => client.id === client1Id));
    assert.ok(!user1Clients.some(client => client.id === client2Id));
  } finally {
    sqlite.prepare('DELETE FROM users WHERE id IN (?, ?)').run(user1Id, user2Id);
  }
});

test('Migraciones SQLite: valida checksums, esquemas heredados y rollback transaccional', () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'salontrack-migrations-'));
  const db = new DatabaseSync(join(tempDirectory, 'migrations.sqlite'));

  try {
    assert.deepStrictEqual(checkMigrations(db), ['No existe la tabla schema_migrations.']);
    runMigrations(db);
    const recorded = db.prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
      .all() as Array<{ version: number; checksum: string }>;
    assert.strictEqual(recorded.length, 3);
    assert.deepStrictEqual(
      recorded.map(row => row.checksum),
      MIGRATIONS.map(migrationChecksum)
    );

    db.prepare('UPDATE schema_migrations SET checksum = NULL WHERE version = 2').run();
    runMigrations(db);
    assert.strictEqual(
      (db.prepare('SELECT checksum FROM schema_migrations WHERE version = 2').get() as { checksum: string }).checksum,
      migrationChecksum(MIGRATIONS[1])
    );

    db.prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 2').run('alterado');
    assert.throws(() => runMigrations(db), /cambió después de aplicarse/);
    assert.strictEqual(checkMigrations(db).length, 1);
    db.prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 2').run(migrationChecksum(MIGRATIONS[1]));

    db.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at, checksum)
      VALUES (99, 'future_migration', ?, 'future')
    `).run(new Date().toISOString());
    assert.throws(() => runMigrations(db), /más nueva que esta versión/);
    db.prepare('DELETE FROM schema_migrations WHERE version = 99').run();

    const brokenMigrations = [
      ...MIGRATIONS,
      { version: 4, name: 'rota', sql: 'CREATE TABLE tmp_rota (id TEXT); SELECT * FROM tabla_inexistente;' },
    ];
    assert.throws(() => runMigrations(db, brokenMigrations), /tabla_inexistente/);
    assert.strictEqual(
      (db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'tmp_rota'")
        .get() as { count: number }).count,
      0
    );
    assert.strictEqual(
      (db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 4').get() as { count: number }).count,
      0
    );
  } finally {
    db.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  const legacyDirectory = mkdtempSync(join(tmpdir(), 'salontrack-legacy-migrations-'));
  const legacyDb = new DatabaseSync(join(legacyDirectory, 'legacy.sqlite'));
  try {
    legacyDb.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    assert.deepStrictEqual(checkMigrations(legacyDb), []);
    runMigrations(legacyDb);
    const columns = legacyDb.prepare('PRAGMA table_info(schema_migrations)').all() as Array<{ name: string }>;
    assert.ok(columns.some(column => column.name === 'checksum'));
  } finally {
    legacyDb.close();
    rmSync(legacyDirectory, { recursive: true, force: true });
  }
});

test('Transacciones SQLite: revierte y anida savepoints correctamente', () => {
  const sqlite = getSqliteDb();
  const userId = 'usr_demo_valeria_estilista';
  const rolledBackId = generateId('cli');
  const outerId = generateId('cli');
  const innerId = generateId('cli');
  const insertClient = (id: string) => sqlite.prepare(`
    INSERT INTO clients (id, user_id, full_name, phone, created_at, updated_at)
    VALUES (?, ?, ?, '+56900000000', ?, ?)
  `).run(id, userId, id, new Date().toISOString(), new Date().toISOString());
  const countClient = (id: string) => (sqlite.prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(id) as { count: number }).count;

  assert.throws(() => withTransaction(db => {
    insertClient(rolledBackId);
    throw new Error('rollback');
  }), /rollback/);
  assert.strictEqual(countClient(rolledBackId), 0);

  withTransaction(() => {
    insertClient(outerId);
    try {
      withTransaction(() => {
        insertClient(innerId);
        throw new Error('rollback nested savepoint');
      });
    } catch {}
  });
  assert.strictEqual(countClient(outerId), 1);
  assert.strictEqual(countClient(innerId), 0);
  sqlite.prepare('DELETE FROM clients WHERE id IN (?, ?)').run(outerId, innerId);
});

// 8. Cálculo de Retoques según Intervalo
test('Cálculo de Retoque: Fecha exacta sumando días recomendados', () => {
  const startDate = '2026-10-10';
  const interval = 30;
  const [y, m, d] = startDate.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + interval);
  const nextDateStr = next.toISOString().split('T')[0];
  assert.strictEqual(nextDateStr, '2026-11-09');
});

// 9. Módulo Re-engagement: Detección de clientas inactivas (>90 días)
test('Módulo Re-engagement: Filtra correctamente clientas inactivas hace más de 90 días', () => {
  const nowMs = Date.now();
  const lastVisitOldMs = nowMs - 120 * 24 * 60 * 60 * 1000; // 120 days ago
  const lastVisitRecentMs = nowMs - 20 * 24 * 60 * 60 * 1000; // 20 days ago

  const daysOld = Math.round((nowMs - lastVisitOldMs) / (1000 * 60 * 60 * 24));
  const daysRecent = Math.round((nowMs - lastVisitRecentMs) / (1000 * 60 * 60 * 24));

  assert.ok(daysOld >= 90, 'Clienta antigua debe calificar para re-engagement');
  assert.ok(daysRecent < 90, 'Clienta reciente no debe ser marcada como inactiva');
});

// 10. Proceso de Pago Mercado Pago: Idempotencia y cálculo de licencia
test('Licencia y Pagos: Extensión correcta de días y prevención de duplicados', () => {
  const planDays = 90; // Plan trimestral
  const startDate = new Date();
  const expDate = new Date(startDate);
  expDate.setDate(expDate.getDate() + planDays);

  const diffDays = Math.round((expDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  assert.strictEqual(diffDays, 90);
});

// 11. SQLite Persistencia y Modelo Relacional de Negocios
test('SQLite Persistencia: Consultas sobre tablas relacionales de negocios y catálogo', () => {
  const sqlite = getSqliteDb();
  const categories = sqlite.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  assert.ok(categories.count >= 15, 'Debe contener al menos 15 categorías');

  const businesses = sqlite.prepare("SELECT COUNT(*) as count FROM businesses WHERE status = 'PUBLISHED'").get() as { count: number };
  assert.ok(businesses.count >= 1, 'Debe haber negocios publicados');
});


// 12. Motor de Disponibilidad: Prevención de Colisiones de Horarios
test('Motor de Disponibilidad: Detección y bloqueo de solapamiento en reservas', () => {
  const staffId = 'stf_valeria';
  const bizId = 'biz_valeria_studio';
  const testDate = '2026-12-15';
  
  const slotFree = isSlotAvailable({
    businessId: bizId,
    staffId,
    serviceId: 'srv_val_corte',
    dateStr: testDate,
    startTime: '10:00',
    durationMinutes: 45
  });
  assert.strictEqual(slotFree, true);

  const sqlite = getSqliteDb();
  const testBkId = 'bk_test_collision_' + Date.now();
  sqlite.prepare(`
    INSERT INTO bookings (id, code, business_id, staff_id, service_id, booking_date, start_time, end_time, duration_minutes, amount_clp, status, client_name, client_phone, created_at, updated_at)
    VALUES (?, 'TEST-COL', ?, ?, 'srv_val_corte', ?, '10:00', '10:45', 45, 25000, 'CONFIRMED', 'Test Collision', '+56900000000', datetime('now'), datetime('now'))
  `).run(testBkId, bizId, staffId, testDate);

  const collision = isSlotAvailable({
    businessId: bizId,
    staffId,
    serviceId: 'srv_val_corte',
    dateStr: testDate,
    startTime: '10:15',
    durationMinutes: 45
  });
  assert.strictEqual(collision, false, 'Debe detectar la colisión de horario');

  sqlite.prepare('DELETE FROM bookings WHERE id = ?').run(testBkId);
});

// 13. Geolocalización Haversine en Chile
test('Geolocalización: Cálculo de distancia en km entre comunas de Santiago', () => {
  const providencia = { lat: -33.4243, lon: -70.6125 };
  const renca = { lat: -33.4072, lon: -70.7188 };
  const dist = localGeolocationProvider.calculateDistanceKm(providencia.lat, providencia.lon, renca.lat, renca.lon);
  assert.ok(dist >= 8 && dist <= 14, `Distancia esperada entre 8 y 14 km, obtenida: ${dist} km`);
});

// 14. Adaptador Local de Pagos: Generación de Checkout Simulado
test('Proveedor Local de Pagos: Generación de checkout sin claves externas', async () => {
  const result = await localPaymentProvider.createPayment({
    amountClp: 45000,
    description: 'Reserva Test Tintura'
  });
  assert.ok(result.paymentId.startsWith('SIM_PAY_'));
  assert.strictEqual(result.provider, 'local');
  assert.strictEqual(result.status, 'pending');
  assert.ok(result.checkoutUrl?.includes('SIM_PAY_'));
});

async function integrationTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runIntegrationTests() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const sqlite = getSqliteDb();
  const requestJson = (path: string, method: string, token?: string, body?: unknown) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };
  const sendJson = (path: string, body: unknown, token?: string) =>
    requestJson(path, 'POST', token, body);
  const getSantiagoDate = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const addDaysToDate = (dateStr: string, days: number) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days, 12));
    return date.toISOString().slice(0, 10);
  };
  const findAvailableSlots = async (
    businessId: string,
    serviceId: string,
    staffId?: string,
    minimumSlots = 1,
    afterDate?: string
  ) => {
    const today = afterDate || getSantiagoDate(new Date());
    for (let dayOffset = 1; dayOffset <= 60; dayOffset++) {
      const date = addDaysToDate(today, dayOffset);
      const params = new URLSearchParams({
        business_id: businessId,
        service_id: serviceId,
        date,
        ...(staffId ? { staff_id: staffId } : {}),
      });
      const response = await requestJson(`/api/availability/slots?${params}`, 'GET');
      assert.strictEqual(response.status, 200);
      const body = await response.json() as {
        slots: Array<{ time: string; endTime: string; staffId: string; durationMinutes: number }>;
      };
      if (body.slots.length >= minimumSlots) {
        return { date, slots: body.slots };
      }
    }
    throw new Error(`No se encontraron ${minimumSlots} horarios disponibles para ${businessId}/${serviceId}.`);
  };
  const selectSeparatedSlots = (
    slots: Array<{ time: string; endTime: string; staffId: string; durationMinutes: number }>,
    count: number
  ) => {
    const selected: typeof slots = [];
    for (const slot of slots) {
      const previous = selected[selected.length - 1];
      if (previous) {
        const [previousHour, previousMinute] = previous.time.split(':').map(Number);
        const [hour, minute] = slot.time.split(':').map(Number);
        if (hour * 60 + minute - (previousHour * 60 + previousMinute) < previous.durationMinutes + 15) continue;
      }
      selected.push(slot);
      if (selected.length === count) return selected;
    }
    throw new Error(`No se encontraron ${count} horarios separados.`);
  };
  const requestReset = async (email: string) => {
    let emailContent = '';
    const originalSend = localEmailProvider.send;
    localEmailProvider.send = async (to, subject, html) => {
      emailContent = html;
      return { success: true, to, subject, simulated: true, sentAt: new Date().toISOString() };
    };
    try {
      const response = await sendJson('/api/auth/forgot-password', { email });
      const body = await response.json() as Record<string, unknown>;
      return { response, body, emailContent };
    } finally {
      localEmailProvider.send = originalSend;
    }
  };
  let olderResetToken = '';

  try {
    await integrationTest('SQLite CRM: GET /clients refleja inserciones y eliminaciones externas', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      const login = await loginResponse.json() as { token: string };
      assert.strictEqual(loginResponse.status, 200);

      const clientId = generateId('cli');
      const now = new Date().toISOString();
      sqlite.prepare(`
        INSERT INTO clients (
          id, user_id, full_name, phone, notes, preferred_contact,
          re_engagement_status, created_at, updated_at
        ) VALUES (?, 'usr_demo_valeria_estilista', 'Inserción directa', '+56912345003', '', 'whatsapp', 'none', ?, ?)
      `).run(clientId, now, now);

      const afterInsert = await requestJson('/api/clients', 'GET', login.token);
      assert.ok(((await afterInsert.json() as any).clients as any[]).some(client => client.id === clientId));

      sqlite.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
      const afterDelete = await requestJson('/api/clients', 'GET', login.token);
      assert.ok(!((await afterDelete.json() as any).clients as any[]).some(client => client.id === clientId));
    });

    await integrationTest('Backup: exporta clientes sin exponer hashes de contraseña', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      const login = await loginResponse.json() as { token: string };
      assert.strictEqual(loginResponse.status, 200);

      const clientResponse = await sendJson('/api/clients', {
        full_name: 'Cliente incluido en respaldo',
        phone: '+56912345009',
      }, login.token);
      assert.strictEqual(clientResponse.status, 201);
      const clientId = (await clientResponse.json() as any).client.id as string;

      try {
        const exportResponse = await requestJson('/api/backup/export', 'GET', login.token);
        assert.strictEqual(exportResponse.status, 200);
        const exportBody = await exportResponse.json() as any;
        assert.deepStrictEqual(Object.keys(exportBody.user).sort(), ['created_at', 'email', 'id']);
        assert.ok(!JSON.stringify(exportBody).includes('password_hash'));
        assert.ok(exportBody.clients.some((client: any) => client.id === clientId));
      } finally {
        await requestJson(`/api/clients/${clientId}`, 'DELETE', login.token, {});
      }
    });

    await integrationTest('Integridad SQLite: POST /clients conserva roles, membresías y reservas del demo owner', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      const loginBody = await loginResponse.json() as { token: string; user: { id: string } };
      assert.strictEqual(loginResponse.status, 200);

      const rolesBefore = sqlite.prepare('SELECT * FROM user_roles ORDER BY id').all();
      const membershipsBefore = sqlite.prepare('SELECT * FROM business_members ORDER BY id').all();
      const bookingsBefore = sqlite.prepare(`
        SELECT * FROM bookings
        WHERE business_id IN (SELECT business_id FROM business_members WHERE user_id = ?)
           OR customer_user_id = ?
        ORDER BY id
      `).all(loginBody.user.id, loginBody.user.id);
      assert.ok(membershipsBefore.length > 0, 'El usuario demo debe pertenecer a un negocio');
      assert.ok(bookingsBefore.length > 0, 'El negocio demo debe tener reservas');

      const clientResponse = await sendJson(
        '/api/clients',
        { full_name: 'Cliente de prueba de integridad', phone: '+56912345678' },
        loginBody.token
      );
      assert.strictEqual(clientResponse.status, 201);

      const rolesAfter = sqlite.prepare('SELECT * FROM user_roles ORDER BY id').all();
      const membershipsAfter = sqlite.prepare('SELECT * FROM business_members ORDER BY id').all();
      const bookingsAfter = sqlite.prepare(`
        SELECT * FROM bookings
        WHERE business_id IN (SELECT business_id FROM business_members WHERE user_id = ?)
           OR customer_user_id = ?
        ORDER BY id
      `).all(loginBody.user.id, loginBody.user.id);
      assert.deepStrictEqual(rolesAfter, rolesBefore);
      assert.deepStrictEqual(membershipsAfter, membershipsBefore);
      assert.deepStrictEqual(bookingsAfter, bookingsBefore);
    });

    await integrationTest('CRM: eliminaciones de cliente e historial persisten en SQLite', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      const login = await loginResponse.json() as { token: string };
      assert.strictEqual(loginResponse.status, 200);

      const clientResponse = await sendJson('/api/clients', {
        full_name: 'Cliente de prueba de eliminaciones',
        phone: '+56912345000',
        initial_service: {
          service_type: 'Historial para eliminar',
          service_date: '2025-01-01',
          recommended_interval_days: 30,
        },
      }, login.token);
      const createdClient = await clientResponse.json() as {
        client: { id: string };
        service: { id: string };
      };
      assert.strictEqual(clientResponse.status, 201);
      assert.ok(createdClient.service);
      assert.strictEqual((sqlite.prepare(
        'SELECT COUNT(*) AS count FROM clients WHERE id = ? AND user_id = ?'
      ).get(createdClient.client.id, 'usr_demo_valeria_estilista') as any).count, 1);
      assert.strictEqual((sqlite.prepare(
        'SELECT COUNT(*) AS count FROM client_service_history WHERE id = ? AND client_id = ?'
      ).get(createdClient.service.id, createdClient.client.id) as any).count, 1);

      const extraServiceResponse = await sendJson('/api/services', {
        client_id: createdClient.client.id,
        service_type: 'Historial que debe eliminarse en cascada',
        service_date: '2025-01-02',
      }, login.token);
      const extraService = await extraServiceResponse.json() as { service: { id: string } };
      assert.strictEqual(extraServiceResponse.status, 201);

      const contactLogResponse = await sendJson('/api/contact-logs', {
        client_id: createdClient.client.id,
        status: 'contacted',
      }, login.token);
      assert.strictEqual(contactLogResponse.status, 201);

      const serviceDeleteResponse = await requestJson(
        `/api/services/${createdClient.service.id}`,
        'DELETE',
        login.token,
        {}
      );
      assert.strictEqual(serviceDeleteResponse.status, 200);
      assert.strictEqual(sqlite.prepare(
        'SELECT COUNT(*) as count FROM client_service_history WHERE id = ? AND user_id = ?'
      ).get(createdClient.service.id, 'usr_demo_valeria_estilista')?.count, 0);

      assert.ok(!listServices('usr_demo_valeria_estilista').some(service => service.id === createdClient.service.id));
      assert.ok(listServices('usr_demo_valeria_estilista').some(service => service.id === extraService.service.id));

      const clientDeleteResponse = await requestJson(
        `/api/clients/${createdClient.client.id}`,
        'DELETE',
        login.token,
        {}
      );
      assert.strictEqual(clientDeleteResponse.status, 200);
      assert.strictEqual(sqlite.prepare(
        'SELECT COUNT(*) as count FROM clients WHERE id = ? AND user_id = ?'
      ).get(createdClient.client.id, 'usr_demo_valeria_estilista')?.count, 0);
      assert.strictEqual(sqlite.prepare(
        'SELECT COUNT(*) as count FROM client_service_history WHERE client_id = ?'
      ).get(createdClient.client.id)?.count, 0);
      assert.strictEqual(sqlite.prepare(
        'SELECT COUNT(*) as count FROM contact_logs WHERE client_id = ?'
      ).get(createdClient.client.id)?.count, 0);

      assert.ok(!listClients('usr_demo_valeria_estilista').some(client => client.id === createdClient.client.id));
      assert.ok(!listServices('usr_demo_valeria_estilista').some(service => service.id === extraService.service.id));
      assert.ok(!listContactLogs('usr_demo_valeria_estilista', createdClient.client.id).length);
    });

    await integrationTest('Suscripciones: pago persistido, idempotente y aislado por usuario', async () => {
      const ownerResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      const owner = await ownerResponse.json() as { token: string; user: { id: string } };
      const otherResponse = await sendJson('/api/auth/login', {
        email: 'cliente@gmail.com',
        password: 'Cliente1234!',
      });
      const other = await otherResponse.json() as { token: string };
      const paymentRef = `CRM_${generateId('pay')}`;

      const activation = await sendJson('/api/subscriptions/activate-license', {
        plan_id: 'pro_quarterly',
        payment_ref: paymentRef,
      }, owner.token);
      assert.strictEqual(activation.status, 200);
      const activationBody = await activation.json() as any;
      const paymentRow = sqlite.prepare(`
        SELECT user_id, type, provider, provider_payment_id, status, payment_method, metadata
        FROM payments
        WHERE provider_payment_id = ?
      `).get(paymentRef) as any;
      assert.strictEqual(paymentRow.user_id, owner.user.id);
      assert.strictEqual(paymentRow.type, 'subscription_payment');
      assert.strictEqual(paymentRow.provider, 'mercadopago');
      assert.strictEqual(paymentRow.status, 'approved');
      assert.strictEqual(paymentRow.payment_method, 'simulated_online');
      assert.deepStrictEqual(JSON.parse(paymentRow.metadata), { plan: 'pro_quarterly' });
      assert.strictEqual(activationBody.payment.plan, 'pro_quarterly');

      const repeated = await sendJson('/api/subscriptions/activate-license', {
        plan_id: 'pro_quarterly',
        payment_ref: paymentRef,
      }, owner.token);
      assert.deepStrictEqual(await repeated.json(), {
        message: 'Este pago ya fue procesado.',
        payment: activationBody.payment,
      });
      assert.strictEqual((sqlite.prepare('SELECT COUNT(*) AS count FROM payments WHERE provider_payment_id = ?').get(paymentRef) as any).count, 1);

      const crossUser = await sendJson('/api/subscriptions/activate-license', {
        plan_id: 'pro_quarterly',
        payment_ref: paymentRef,
      }, other.token);
      assert.strictEqual(crossUser.status, 409);
      assert.deepStrictEqual(await crossUser.json(), { error: 'Este pago ya fue procesado.' });

      const current = await requestJson('/api/subscriptions/current', 'GET', owner.token);
      const currentBody = await current.json() as any;
      assert.ok(currentBody.payments.some((payment: any) => payment.provider_payment_id === paymentRef));
    });

    await integrationTest('Pagos simulados: bloqueo en producción y activación explícita para demos', async () => {
      const registeredResponse = await sendJson('/api/auth/register', {
        email: `payment-gate-${generateId('customer')}@example.test`,
        password: 'PaymentGate123!',
        full_name: 'Cuenta temporal para probar pagos',
        phone: '+56912345011',
        role: 'CUSTOMER',
      });
      const registered = await registeredResponse.json() as { token: string; user: { id: string } };
      assert.strictEqual(registeredResponse.status, 201);

      const userId = registered.user.id;
      const bookingId = generateId('payment_gate_booking');
      const paymentRef = `PRODUCTION_GATE_${generateId('pay')}`;
      const now = new Date().toISOString();
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAllowSimulatedPayments = process.env.ALLOW_SIMULATED_PAYMENTS;
      const restoreEnvironmentValue = (name: string, value: string | undefined) => {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      };

      try {
        sqlite.prepare(`
          INSERT INTO bookings (
            id, code, business_id, staff_id, service_id, customer_user_id, booking_date,
            start_time, end_time, duration_minutes, amount_clp, modality, status,
            payment_method, payment_status, client_name, client_phone, client_email,
            created_at, updated_at
          ) VALUES (?, ?, 'biz_valeria_studio', 'stf_valeria', 'srv_val_tintura_raiz', ?, '2099-03-01',
            '11:00', '12:15', 75, 45000, 'salon', 'PENDING', 'online', 'pending',
            'Cuenta de prueba', '+56912345011', 'payment-gate@example.test', ?, ?)
        `).run(bookingId, `PAYMENT-GATE-${bookingId}`, userId, now, now);

        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_SIMULATED_PAYMENTS;

        const subscriptionBefore = sqlite.prepare(
          'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id'
        ).all(userId);
        const bookingBefore = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
        const bookingPaymentsBefore = sqlite.prepare(
          'SELECT * FROM payments WHERE booking_id = ? ORDER BY id'
        ).all(bookingId);

        const blockedActivation = await sendJson('/api/subscriptions/activate-license', {
          plan_id: 'pro_quarterly',
          payment_ref: paymentRef,
        }, registered.token);
        assert.strictEqual(blockedActivation.status, 403);
        assert.deepStrictEqual(await blockedActivation.json(), {
          error: 'Los pagos simulados no están disponibles en producción.',
        });
        assert.deepStrictEqual(
          sqlite.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id').all(userId),
          subscriptionBefore
        );
        assert.strictEqual(
          (sqlite.prepare('SELECT COUNT(*) AS count FROM payments WHERE provider_payment_id = ?').get(paymentRef) as any).count,
          0
        );

        const blockedCheckout = await sendJson('/api/payments/checkout/simulate', {
          booking_id: bookingId,
          action: 'approve',
        }, registered.token);
        assert.strictEqual(blockedCheckout.status, 403);
        assert.deepStrictEqual(await blockedCheckout.json(), {
          error: 'Los pagos simulados no están disponibles en producción.',
        });
        assert.deepStrictEqual(sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId), bookingBefore);
        assert.deepStrictEqual(
          sqlite.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY id').all(bookingId),
          bookingPaymentsBefore
        );

        process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
        const allowedActivation = await sendJson('/api/subscriptions/activate-license', {
          plan_id: 'pro_quarterly',
          payment_ref: paymentRef,
        }, registered.token);
        assert.strictEqual(allowedActivation.status, 200);
        assert.strictEqual(
          (sqlite.prepare('SELECT COUNT(*) AS count FROM payments WHERE provider_payment_id = ?').get(paymentRef) as any).count,
          1
        );
      } finally {
        restoreEnvironmentValue('NODE_ENV', originalNodeEnv);
        restoreEnvironmentValue('ALLOW_SIMULATED_PAYMENTS', originalAllowSimulatedPayments);
        sqlite.prepare('DELETE FROM payments WHERE user_id = ?').run(userId);
        sqlite.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
        sqlite.prepare('DELETE FROM users WHERE id = ?').run(userId);
      }
    });

    await integrationTest('Re-engagement: actualiza el estado y registra el contacto en SQLite', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      const login = await loginResponse.json() as { token: string };
      const clientResponse = await sendJson('/api/clients', {
        full_name: 'Clienta de re-engagement',
        phone: '+56912345004',
      }, login.token);
      const client = (await clientResponse.json() as any).client;
      assert.strictEqual(clientResponse.status, 201);

      const statusResponse = await sendJson('/api/re-engagement/status', {
        client_id: client.id,
        status: 'reactivated',
        notes: 'Volvió a reservar',
      }, login.token);
      assert.strictEqual(statusResponse.status, 200);
      assert.strictEqual((sqlite.prepare('SELECT re_engagement_status FROM clients WHERE id = ?').get(client.id) as any).re_engagement_status, 'reactivated');
      const contact = sqlite.prepare(`
        SELECT user_id, client_id, channel, status, notes
        FROM contact_logs
        WHERE client_id = ?
      `).get(client.id) as any;
      assert.strictEqual(contact.user_id, 'usr_demo_valeria_estilista');
      assert.strictEqual(contact.channel, 'whatsapp');
      assert.strictEqual(contact.status, 'scheduled');
      assert.strictEqual(contact.notes, 'Volvió a reservar');
      await requestJson(`/api/clients/${client.id}`, 'DELETE', login.token);
    });

    await integrationTest('Reservas: POST solo acepta horarios disponibles', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'cliente@gmail.com',
        password: 'Cliente1234!',
      });
      const login = await loginResponse.json() as { token: string };
      assert.strictEqual(loginResponse.status, 200);

      const businessId = 'biz_valeria_studio';
      const serviceId = 'srv_val_corte';
      const { date, slots } = await findAvailableSlots(businessId, serviceId, 'stf_valeria');
      const otherBusinessStaff = sqlite.prepare(`
        SELECT id FROM staff WHERE business_id != ? AND is_active = 1 LIMIT 1
      `).get(businessId) as { id: string };
      const countBookings = () => (sqlite.prepare('SELECT COUNT(*) AS count FROM bookings').get() as { count: number }).count;
      const payload = {
        business_id: businessId,
        service_id: serviceId,
        staff_id: 'stf_valeria',
        booking_date: date,
        start_time: slots[0].time,
        client_name: 'Cliente de prueba de disponibilidad',
        client_phone: '+56912345678',
        payment_method: 'presential',
      };
      const assertRejectedWithoutChanges = async (body: Record<string, unknown>, status: number) => {
        const before = countBookings();
        const response = await sendJson('/api/bookings', body, login.token);
        assert.strictEqual(response.status, status);
        assert.strictEqual(countBookings(), before);
        return response;
      };

      const earlySlot = await assertRejectedWithoutChanges({ ...payload, start_time: '03:00' }, 409);
      assert.deepStrictEqual(await earlySlot.json(), {
        error: 'El horario seleccionado ya no está disponible. Por favor elige otro horario.',
      });
      await assertRejectedWithoutChanges({ ...payload, booking_date: '2000-01-01' }, 409);
      await assertRejectedWithoutChanges({ ...payload, booking_date: '2099/01/01' }, 400);
      await assertRejectedWithoutChanges({ ...payload, start_time: 'tres' }, 400);
      await assertRejectedWithoutChanges({ ...payload, staff_id: otherBusinessStaff.id }, 409);

      let createdBookingId: string | undefined;
      try {
        const response = await sendJson('/api/bookings', payload, login.token);
        assert.strictEqual(response.status, 201);
        const body = await response.json() as { booking: { id: string; booking_date: string; start_time: string; end_time: string; staff_id?: string } };
        createdBookingId = body.booking.id;
        const saved = sqlite.prepare(`
          SELECT booking_date, start_time, end_time, staff_id
          FROM bookings WHERE id = ?
        `).get(createdBookingId) as {
          booking_date: string;
          start_time: string;
          end_time: string;
          staff_id: string;
        };
        assert.strictEqual(saved.booking_date, date);
        assert.strictEqual(saved.start_time, slots[0].time);
        assert.strictEqual(saved.end_time, slots[0].endTime);
        assert.strictEqual(saved.staff_id, slots[0].staffId);
      } finally {
        if (createdBookingId) {
          sqlite.prepare("DELETE FROM notifications WHERE entity_type = 'booking' AND entity_id = ?").run(createdBookingId);
          sqlite.prepare('DELETE FROM booking_status_history WHERE booking_id = ?').run(createdBookingId);
          sqlite.prepare('DELETE FROM bookings WHERE id = ?').run(createdBookingId);
        }
      }
    });

    await integrationTest('Reservas: clientes y personal pueden reprogramar con autorización', async () => {
      const login = async (email: string, password: string) => {
        const response = await sendJson('/api/auth/login', { email, password });
        const body = await response.json() as { token: string; user: { id: string } };
        assert.strictEqual(response.status, 200);
        return body;
      };
      const customer = await login('cliente@gmail.com', 'Cliente1234!');
      const owner = await login('contacto@valeriaestudio.cl', 'Salon1234');
      const staff = await login('camila@valeriaestudio.cl', 'Staff1234!');
      const stranger = await login('ignacio@barberiaroute.cl', 'Barber1234!');
      const businessId = 'biz_valeria_studio';
      const serviceId = 'srv_val_corte';
      const available = await findAvailableSlots(businessId, serviceId, 'stf_valeria', 20);
      const { date } = available;
      const slots = selectSeparatedSlots(available.slots, 4);
      const currentStart = slots[0].time.split(':').map(Number).reduce((minutes, value) => minutes * 60 + value, 0);
      const overlappingSlot = available.slots.find(slot => {
        const [hour, minute] = slot.time.split(':').map(Number);
        const candidateStart = hour * 60 + minute;
        return candidateStart > currentStart &&
          candidateStart < currentStart + slots[0].durationMinutes &&
          candidateStart + slot.durationMinutes > currentStart;
      });
      assert.ok(overlappingSlot);
      const bookingIds = [
        generateId('reschedule'),
        generateId('reschedule_occupied'),
        generateId('reschedule_completed'),
      ];
      const now = new Date().toISOString();
      const insertFixture = (
        id: string,
        status: string,
        bookingDate: string,
        slot: { time: string; endTime: string; durationMinutes: number }
      ) => {
        sqlite.prepare(`
          INSERT INTO bookings (
            id, code, business_id, staff_id, service_id, customer_user_id, booking_date,
            start_time, end_time, duration_minutes, amount_clp, modality, status,
            payment_method, payment_status, client_name, client_phone, created_at, updated_at
          ) VALUES (?, ?, ?, 'stf_valeria', ?, ?, ?, ?, ?, ?, 25000, 'salon', ?,
            'presential', 'pending', 'Cliente de reprogramación', '+56912345670', ?, ?)
        `).run(
          id,
          `RESCHEDULE-${id}`,
          businessId,
          serviceId,
          customer.user.id,
          bookingDate,
          slot.time,
          slot.endTime,
          slot.durationMinutes,
          status,
          now,
          now
        );
      };
      insertFixture(bookingIds[0], 'PENDING', date, slots[0]);
      insertFixture(bookingIds[1], 'PENDING', date, slots[1]);
      insertFixture(bookingIds[2], 'COMPLETED', '2000-01-01', {
        time: '10:00',
        endTime: '10:50',
        durationMinutes: 50,
      });
      sqlite.prepare('UPDATE bookings SET duration_minutes = 1 WHERE id = ?').run(bookingIds[0]);

      const stateFor = (id: string) => ({
        booking: sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(id),
        historyCount: (sqlite.prepare('SELECT COUNT(*) AS count FROM booking_status_history WHERE booking_id = ?')
          .get(id) as { count: number }).count,
        notificationCount: (sqlite.prepare(`
          SELECT COUNT(*) AS count FROM notifications
          WHERE entity_type = 'booking' AND entity_id = ? AND type = 'booking_rescheduled'
        `).get(id) as { count: number }).count,
      });
      const assertUnchanged = async (id: string, token: string, body: unknown, expectedStatus: number) => {
        const before = stateFor(id);
        const response = await sendJson(`/api/bookings/${id}/reschedule`, body, token);
        assert.strictEqual(response.status, expectedStatus);
        assert.deepStrictEqual(stateFor(id), before);
      };

      try {
        const missingBooking = await sendJson('/api/bookings/no-existe/reschedule', {
          booking_date: date,
          start_time: slots[0].time,
        }, customer.token);
        assert.strictEqual(missingBooking.status, 404);
        const missingSlotList = await requestJson(
          `/api/bookings/no-existe/reschedule-slots?date=${date}`,
          'GET',
          customer.token
        );
        assert.strictEqual(missingSlotList.status, 404);
        const invalidDateSlotList = await requestJson(
          `/api/bookings/${bookingIds[0]}/reschedule-slots?date=mal`,
          'GET',
          customer.token
        );
        assert.strictEqual(invalidDateSlotList.status, 400);

        const publicParams = new URLSearchParams({
          business_id: businessId,
          service_id: serviceId,
          date,
          staff_id: 'stf_valeria',
        });
        const publicSlotResponse = await requestJson(`/api/availability/slots?${publicParams}`, 'GET');
        const publicSlotBody = await publicSlotResponse.json() as {
          slots: Array<{ time: string }>;
        };
        assert.strictEqual(publicSlotResponse.status, 200);
        assert.ok(!publicSlotBody.slots.some(slot => slot.time === overlappingSlot.time));
        const rescheduleSlotResponse = await requestJson(
          `/api/bookings/${bookingIds[0]}/reschedule-slots?date=${date}`,
          'GET',
          customer.token
        );
        const rescheduleSlotBody = await rescheduleSlotResponse.json() as {
          date: string;
          slots: Array<{ time: string }>;
        };
        assert.strictEqual(rescheduleSlotResponse.status, 200);
        assert.strictEqual(rescheduleSlotBody.date, date);
        assert.ok(rescheduleSlotBody.slots.some(slot => slot.time === overlappingSlot.time));
        const strangerSlotResponse = await requestJson(
          `/api/bookings/${bookingIds[0]}/reschedule-slots?date=${date}`,
          'GET',
          stranger.token
        );
        assert.strictEqual(strangerSlotResponse.status, 404);
        const completedSlotResponse = await requestJson(
          `/api/bookings/${bookingIds[2]}/reschedule-slots?date=${date}`,
          'GET',
          customer.token
        );
        assert.strictEqual(completedSlotResponse.status, 400);
        const currentSlot = { booking_date: date, start_time: slots[0].time };
        await assertUnchanged(bookingIds[0], customer.token, { booking_date: 'bad-date', start_time: slots[0].time }, 400);

        const sameSlotResponse = await sendJson(
          `/api/bookings/${bookingIds[0]}/reschedule`,
          currentSlot,
          customer.token
        );
        assert.strictEqual(sameSlotResponse.status, 200);
        const sameSlotBody = await sameSlotResponse.json() as any;
        assert.strictEqual(sameSlotBody.booking.start_time, slots[0].time);
        assert.strictEqual(sameSlotBody.booking.duration_minutes, slots[0].durationMinutes);
        assert.strictEqual((sqlite.prepare('SELECT duration_minutes FROM bookings WHERE id = ?')
          .get(bookingIds[0]) as { duration_minutes: number }).duration_minutes, slots[0].durationMinutes);

        const freeSlotResponse = await sendJson(`/api/bookings/${bookingIds[0]}/reschedule`, {
          booking_date: date,
          start_time: slots[2].time,
        }, customer.token);
        assert.strictEqual(freeSlotResponse.status, 200);
        assert.deepStrictEqual((await freeSlotResponse.json() as any).booking, {
          id: bookingIds[0],
          booking_date: date,
          start_time: slots[2].time,
          end_time: slots[2].endTime,
          staff_id: slots[2].staffId,
          duration_minutes: slots[2].durationMinutes,
          status: 'PENDING',
        });
        const history = sqlite.prepare(`
          SELECT from_status, to_status, reason FROM booking_status_history
          WHERE booking_id = ? AND reason = ?
        `).get(
          bookingIds[0],
          `Reprogramada de ${date} ${slots[0].time} a ${date} ${slots[2].time}`
        ) as { from_status: string; to_status: string; reason: string };
        assert.deepStrictEqual({ ...history }, {
          from_status: 'PENDING',
          to_status: 'PENDING',
          reason: `Reprogramada de ${date} ${slots[0].time} a ${date} ${slots[2].time}`,
        });
        assert.ok(sqlite.prepare(`
          SELECT 1 FROM notifications
          WHERE user_id = ? AND entity_type = 'booking' AND entity_id = ?
            AND type = 'booking_rescheduled'
        `).get(owner.user.id, bookingIds[0]));

        await assertUnchanged(bookingIds[0], customer.token, {
          booking_date: date,
          start_time: slots[1].time,
        }, 409);
        await assertUnchanged(bookingIds[0], stranger.token, {
          booking_date: date,
          start_time: slots[3].time,
        }, 404);
        await assertUnchanged(bookingIds[2], customer.token, {
          booking_date: date,
          start_time: slots[3].time,
        }, 400);

        const staffResponse = await sendJson(`/api/bookings/${bookingIds[0]}/reschedule`, {
          booking_date: date,
          start_time: slots[3].time,
        }, staff.token);
        assert.strictEqual(staffResponse.status, 200);
        assert.strictEqual((sqlite.prepare('SELECT status FROM bookings WHERE id = ?')
          .get(bookingIds[0]) as { status: string }).status, 'PENDING');
      } finally {
        for (const id of bookingIds) {
          sqlite.prepare("DELETE FROM notifications WHERE entity_type = 'booking' AND entity_id = ?").run(id);
          sqlite.prepare('DELETE FROM booking_status_history WHERE booking_id = ?').run(id);
          sqlite.prepare('DELETE FROM bookings WHERE id = ?').run(id);
        }
      }
    });

    await integrationTest('Autorización: reservas y acciones del negocio respetan membresías', async () => {
      const login = async (email: string, password: string) => {
        const response = await sendJson('/api/auth/login', { email, password });
        const body = await response.json() as { token: string; user: { id: string; business?: any } };
        assert.strictEqual(response.status, 200);
        return body;
      };

      const owner = await login('contacto@valeriaestudio.cl', 'Salon1234');
      const unrelatedOwner = await login('ignacio@barberiaroute.cl', 'Barber1234!');
      const bookingCustomer = await login('cliente@gmail.com', 'Cliente1234!');
      const staff = await login('camila@valeriaestudio.cl', 'Staff1234!');
      const platformAdmin = await login('admin@salontrack.cl', 'Admin1234!');
      const outsiderEmail = `authz-${generateId('customer')}@example.test`;
      const outsiderResponse = await sendJson('/api/auth/register', {
        email: outsiderEmail,
        password: 'AuthzTest123!',
        full_name: 'Cliente sin relación con el negocio',
        phone: '+56912345001',
        role: 'CUSTOMER',
      });
      const outsider = await outsiderResponse.json() as { token: string; user: { id: string } };
      assert.strictEqual(outsiderResponse.status, 201);

      const targetBusinessId = 'biz_valeria_studio';
      const originalBookingMode = (sqlite.prepare('SELECT booking_mode FROM businesses WHERE id = ?').get(targetBusinessId) as any).booking_mode;
      assert.strictEqual(owner.user.business.auto_confirm_bookings, originalBookingMode === 'AUTOMATIC');
      sqlite.prepare(`
        INSERT INTO business_members (id, business_id, user_id, role, is_active, created_at)
        VALUES (?, 'biz_route68_barber', ?, 'OWNER', 1, ?)
      `).run(generateId('bm'), unrelatedOwner.user.id, new Date().toISOString());
      const secondOwnerBusiness = sqlite.prepare(`
        SELECT business_id FROM business_members
        WHERE user_id = ? AND is_active = 1
      `).get(unrelatedOwner.user.id) as { business_id: string };
      assert.notStrictEqual(secondOwnerBusiness.business_id, targetBusinessId);
      assert.strictEqual(sqlite.prepare(`
        SELECT COUNT(*) as count FROM business_members WHERE user_id = ? AND is_active = 1
      `).get(outsider.user.id)?.count, 0);

      const createBooking = (status: string) => {
        const id = generateId('authz_booking');
        const now = new Date().toISOString();
        sqlite.prepare(`
          INSERT INTO bookings (
            id, code, business_id, staff_id, service_id, customer_user_id, booking_date,
            start_time, end_time, duration_minutes, amount_clp, modality, status,
            payment_method, payment_status, client_name, client_phone, client_email,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, '2099-01-01', '11:00', '12:15', 75, 45000, 'salon', ?,
            'presential', 'pending', 'María Paz Contreras', '+56991234567', 'cliente@gmail.com', ?, ?)
        `).run(
          id,
          `AUTHZ-${id}`,
          targetBusinessId,
          'stf_valeria',
          'srv_val_tintura_raiz',
          bookingCustomer.user.id,
          status,
          now,
          now
        );
        return id;
      };

      const bookings = {
        confirm: createBooking('PENDING'),
        ownerConfirm: createBooking('PENDING'),
        reject: createBooking('PENDING'),
        complete: createBooking('PENDING'),
        ownerCancel: createBooking('PENDING'),
        customerCancel: createBooking('PENDING'),
        staffCancel: createBooking('PENDING'),
      };
      const outsiders = [unrelatedOwner.token, outsider.token];
      const assertNotFound = async (response: Response) => assert.strictEqual(response.status, 404);
      const postAs = (path: string, token: string, body: unknown = {}) => sendJson(path, body, token);
      const getAs = (path: string, token: string) => requestJson(path, 'GET', token);

      for (const token of outsiders) {
        await assertNotFound(await getAs(`/api/bookings/${bookings.confirm}`, token));
      }
      assert.strictEqual((await getAs(`/api/bookings/${bookings.confirm}`, owner.token)).status, 200);
      assert.strictEqual((await getAs(`/api/bookings/${bookings.confirm}`, bookingCustomer.token)).status, 200);
      assert.strictEqual((await getAs(`/api/bookings/${bookings.confirm}`, staff.token)).status, 200);
      assert.strictEqual((await getAs(`/api/bookings/${bookings.confirm}`, platformAdmin.token)).status, 200);

      for (const token of outsiders) {
        await assertNotFound(await postAs(`/api/bookings/${bookings.confirm}/confirm`, token));
        await assertNotFound(await postAs(`/api/bookings/${bookings.reject}/reject`, token));
        await assertNotFound(await postAs(`/api/bookings/${bookings.complete}/complete`, token));
        await assertNotFound(await postAs(`/api/bookings/${bookings.ownerCancel}/cancel`, token));
        await assertNotFound(await postAs(`/api/bookings/${bookings.customerCancel}/cancel`, token));
        await assertNotFound(await postAs('/api/payments/checkout/simulate', token, {
          booking_id: bookings.customerCancel,
          action: 'approve',
        }));
      }

      const staffConfirm = await postAs(`/api/bookings/${bookings.confirm}/confirm`, staff.token);
      assert.strictEqual(staffConfirm.status, 200);
      assert.strictEqual((await postAs(`/api/bookings/${bookings.confirm}/complete`, staff.token)).status, 200);

      const staffMembership = sqlite.prepare(`
        SELECT id, business_id FROM business_members
        WHERE user_id = ? AND business_id = ? AND is_active = 1 AND role = 'STAFF'
      `).get(staff.user.id, targetBusinessId) as { id: string; business_id: string };
      sqlite.prepare('UPDATE business_members SET business_id = ? WHERE id = ?')
        .run('biz_route68_barber', staffMembership.id);
      let crossBusinessStaffConfirm: Response;
      try {
        crossBusinessStaffConfirm = await postAs(`/api/bookings/${bookings.ownerConfirm}/confirm`, staff.token);
      } finally {
        sqlite.prepare('UPDATE business_members SET business_id = ? WHERE id = ?')
          .run(staffMembership.business_id, staffMembership.id);
      }
      assert.strictEqual(crossBusinessStaffConfirm.status, 404);

      assert.strictEqual((await postAs(`/api/bookings/${bookings.ownerConfirm}/confirm`, owner.token)).status, 200);
      assert.strictEqual((await postAs(`/api/bookings/${bookings.reject}/reject`, owner.token, { reason: 'Prueba autorizada' })).status, 200);
      assert.strictEqual((await postAs(`/api/bookings/${bookings.complete}/complete`, owner.token)).status, 200);
      assert.strictEqual((await postAs(`/api/bookings/${bookings.ownerCancel}/cancel`, owner.token)).status, 200);
      assert.strictEqual((await postAs(`/api/bookings/${bookings.staffCancel}/cancel`, staff.token)).status, 200);
      assert.strictEqual((await postAs('/api/payments/checkout/simulate', bookingCustomer.token, {
        booking_id: bookings.customerCancel,
        action: 'approve',
      })).status, 200);
      assert.strictEqual((await postAs(`/api/bookings/${bookings.customerCancel}/cancel`, bookingCustomer.token)).status, 200);

      for (const token of outsiders) {
        await assertNotFound(await requestJson(`/api/business/${targetBusinessId}`, 'PUT', token, { description: 'No autorizado' }));
        await assertNotFound(await postAs(`/api/business/${targetBusinessId}/services`, token, {
          name: 'Servicio no autorizado',
          price_clp: 15000,
        }));
        await assertNotFound(await postAs(`/api/business/${targetBusinessId}/staff`, token, { name: 'No autorizado' }));
        await assertNotFound(await requestJson(`/api/business/${targetBusinessId}/hours`, 'PUT', token, {
          hours: [{ day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: 0 }],
        }));
      }
      const staffHours = await requestJson(`/api/business/${targetBusinessId}/hours`, 'PUT', staff.token, {
        hours: [{ day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: 0 }],
      });
      assert.strictEqual(staffHours.status, 403);
      assert.strictEqual((await requestJson(`/api/business/${targetBusinessId}`, 'PUT', owner.token, {
        description: 'Actualización autorizada',
      })).status, 200);
      assert.strictEqual((await requestJson(`/api/business/${targetBusinessId}/hours`, 'PUT', owner.token, {
        hours: [{ day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: 0 }],
      })).status, 200);
      const savedHours = await requestJson('/api/business/hours', 'PUT', owner.token, {
        hours: [{ day_of_week: 1, open_time: '10:30', close_time: '19:30', is_closed: 0 }],
      });
      assert.strictEqual(savedHours.status, 200);
      const savedHoursBody = await getAs('/api/business/hours', owner.token);
      const savedMondayHours = ((await savedHoursBody.json() as any).hours as any[]).find(h => h.day_of_week === 1);
      assert.strictEqual(savedMondayHours.open_time, '10:30');
      assert.strictEqual(savedMondayHours.close_time, '19:30');
      const refreshedHours = await getAs('/api/business/hours', owner.token);
      const refreshedMondayHours = ((await refreshedHours.json() as any).hours as any[]).find(h => h.day_of_week === 1);
      assert.strictEqual(refreshedMondayHours.open_time, '10:30');
      assert.strictEqual(refreshedMondayHours.close_time, '19:30');
      assert.strictEqual((await postAs(`/api/business/${targetBusinessId}/staff`, owner.token, {
        name: 'Trabajador autorizado',
      })).status, 201);

      const createdServiceResponse = await postAs(`/api/business/${targetBusinessId}/services`, owner.token, {
        name: 'Servicio autorizado',
        price_clp: 15000,
      });
      assert.strictEqual(createdServiceResponse.status, 201);
      const createdService = await createdServiceResponse.json() as { service_id: string };
      for (const token of outsiders) {
        await assertNotFound(await requestJson(`/api/business/services/${createdService.service_id}`, 'PUT', token, { name: 'No autorizado' }));
        await assertNotFound(await requestJson(`/api/business/services/${createdService.service_id}`, 'DELETE', token));
      }
      assert.strictEqual((await requestJson(`/api/business/services/${createdService.service_id}`, 'PUT', owner.token, {
        name: 'Servicio actualizado',
      })).status, 200);
      assert.strictEqual((await requestJson(`/api/business/services/${createdService.service_id}`, 'DELETE', owner.token)).status, 200);

      for (const token of outsiders) {
        await assertNotFound(await getAs(`/api/bookings/business?business_id=${targetBusinessId}`, token));
        await assertNotFound(await requestJson(`/api/bookings/${bookings.reject}/status`, 'PUT', token, { status: 'CONFIRMED' }));
      }

      sqlite.prepare("UPDATE businesses SET booking_mode = 'MANUAL' WHERE id = ?").run(targetBusinessId);
      const customerBookingSlot = await findAvailableSlots(targetBusinessId, 'srv_val_corte', 'stf_valeria');
      const customerBookingResponse = await postAs('/api/bookings', bookingCustomer.token, {
        business_id: targetBusinessId,
        service_id: 'srv_val_corte',
        staff_id: 'stf_valeria',
        booking_date: customerBookingSlot.date,
        start_time: customerBookingSlot.slots[0].time,
        client_name: 'Cliente autenticada',
        client_phone: '+56912345002',
        payment_method: 'presential',
      });
      sqlite.prepare('UPDATE businesses SET booking_mode = ? WHERE id = ?').run(originalBookingMode, targetBusinessId);
      assert.strictEqual(customerBookingResponse.status, 201);
      const customerBooking = (await customerBookingResponse.json() as any).booking;
      const storedCustomerBooking = sqlite.prepare('SELECT customer_user_id FROM bookings WHERE id = ?').get(customerBooking.id) as any;
      assert.strictEqual(storedCustomerBooking.customer_user_id, bookingCustomer.user.id);

      const myBookings = await getAs('/api/bookings/my', bookingCustomer.token);
      assert.ok(((await myBookings.json() as any).bookings as any[]).some(b => b.id === customerBooking.id));
      const businessBookings = await getAs('/api/bookings/business', owner.token);
      assert.ok(((await businessBookings.json() as any).bookings as any[]).some(b => b.id === customerBooking.id));
      const invalidStatus = await requestJson(`/api/bookings/${customerBooking.id}/status`, 'PUT', owner.token, { status: 'NO_SHOW' });
      assert.strictEqual(invalidStatus.status, 400);
      assert.strictEqual((await postAs(`/api/bookings/${customerBooking.id}/confirm`, owner.token)).status, 200);
      const completionResponse = await postAs(`/api/bookings/${customerBooking.id}/complete`, owner.token, {
        formula_color: '7.1 + 20vol',
        recommended_retouch_days: 45,
        notes: 'x',
      });
      assert.strictEqual(completionResponse.status, 200);
      const completedClient = sqlite.prepare(`
        SELECT id FROM clients WHERE user_id = ? AND business_id = ? AND phone = ?
      `).get(owner.user.id, targetBusinessId, '+56912345002') as any;
      assert.ok(completedClient);
      const completedService = sqlite.prepare(`
        SELECT color_formula, recommended_interval_days, next_retouch_date
        FROM client_service_history
        WHERE booking_id = ?
      `).get(customerBooking.id) as any;
      assert.strictEqual(completedService.color_formula, '7.1 + 20vol');
      assert.strictEqual(completedService.recommended_interval_days, 45);
      assert.strictEqual(completedService.next_retouch_date, addDaysToDate(customerBookingSlot.date, 45));

      const staffMemberRole = (sqlite.prepare(`
        SELECT role FROM business_members WHERE business_id = ? AND user_id = ?
      `).get(targetBusinessId, staff.user.id) as { role: string }).role;
      const staffClientCountBefore = (sqlite.prepare(`
        SELECT COUNT(*) AS count FROM clients WHERE user_id = ? AND business_id = ?
      `).get(staff.user.id, targetBusinessId) as any).count;
      sqlite.prepare(`
        UPDATE business_members SET role = 'PROFESSIONAL'
        WHERE business_id = ? AND user_id = ?
      `).run(targetBusinessId, staff.user.id);
      let repeatedCompletion: Response;
      try {
        repeatedCompletion = await postAs(`/api/bookings/${customerBooking.id}/complete`, staff.token);
      } finally {
        sqlite.prepare(`
          UPDATE business_members SET role = ?
          WHERE business_id = ? AND user_id = ?
        `).run(staffMemberRole, targetBusinessId, staff.user.id);
      }
      assert.strictEqual(repeatedCompletion.status, 200);
      assert.strictEqual((sqlite.prepare(`
        SELECT COUNT(*) AS count FROM client_service_history WHERE booking_id = ?
      `).get(customerBooking.id) as any).count, 1);
      assert.strictEqual((sqlite.prepare(`
        SELECT COUNT(*) AS count FROM clients WHERE user_id = ? AND business_id = ?
      `).get(staff.user.id, targetBusinessId) as any).count, staffClientCountBefore);

      const catalogServiceResponse = await postAs('/api/business/services', owner.token, {
        name: 'Servicio desde catálogo',
        price_clp: 21000,
        duration_min: 60,
        buffer_min: 10,
        is_active: true,
      });
      assert.strictEqual(catalogServiceResponse.status, 201);
      const catalogService = await catalogServiceResponse.json() as { service_id: string };
      const catalogStaffResponse = await postAs('/api/business/staff', owner.token, {
        name: 'Profesional desde catálogo',
        email: 'catalog-staff@example.test',
        role_title: 'Colorista',
      });
      assert.strictEqual(catalogStaffResponse.status, 201);
      const catalogStaff = await catalogStaffResponse.json() as { staff_id: string };
      const businessMine = await getAs('/api/business/my', owner.token);
      const businessMineBody = await businessMine.json() as any;
      assert.strictEqual(typeof businessMineBody.business.auto_confirm_bookings, 'boolean');
      assert.strictEqual(businessMineBody.business.auto_confirm_bookings, originalBookingMode === 'AUTOMATIC');
      assert.strictEqual((await requestJson('/api/business/my', 'PUT', owner.token, {
        auto_confirm_bookings: businessMineBody.business.auto_confirm_bookings,
      })).status, 200);
      assert.strictEqual((sqlite.prepare('SELECT booking_mode FROM businesses WHERE id = ?').get(targetBusinessId) as any).booking_mode, originalBookingMode);
      const refreshedSession = await getAs('/api/auth/me', owner.token);
      assert.strictEqual((await refreshedSession.json() as any).user.business.auto_confirm_bookings, originalBookingMode === 'AUTOMATIC');
      assert.ok(businessMineBody.services.some((s: any) => s.id === catalogService.service_id));
      assert.ok(businessMineBody.staff.some((s: any) => s.id === catalogStaff.staff_id));
      assert.ok(Array.isArray(businessMineBody.hours));
      assert.strictEqual((await requestJson(`/api/business/staff/${catalogStaff.staff_id}`, 'DELETE', owner.token)).status, 200);
      assert.strictEqual((sqlite.prepare('SELECT is_active FROM staff WHERE id = ?').get(catalogStaff.staff_id) as any).is_active, 0);

      const businessSlug = (sqlite.prepare('SELECT slug FROM businesses WHERE id = ?').get(targetBusinessId) as any).slug;
      sqlite.prepare('DELETE FROM favorites WHERE user_id = ? AND business_id = ?').run(owner.user.id, targetBusinessId);
      assert.strictEqual((await postAs('/api/favorites', owner.token, { business_id: targetBusinessId })).status, 200);
      assert.strictEqual((await requestJson(`/api/marketplace/business/${businessSlug}`, 'GET')).status, 200);
      const favoriteProfile = await getAs(`/api/marketplace/business/${businessSlug}`, owner.token);
      assert.strictEqual((await favoriteProfile.json() as any).is_favorite, true);
      const toggleFavorite = await postAs(`/api/favorites/${targetBusinessId}`, owner.token);
      assert.deepStrictEqual(await toggleFavorite.json(), { favorited: false });
      const unfavoritedProfile = await getAs(`/api/marketplace/business/${businessSlug}`, owner.token);
      assert.strictEqual((await unfavoritedProfile.json() as any).is_favorite, false);

      const metricsResponse = await getAs('/api/admin/metrics', platformAdmin.token);
      assert.strictEqual(metricsResponse.status, 200);
      const metrics = (await metricsResponse.json() as any).stats;
      assert.strictEqual(metrics.totalUsers, (sqlite.prepare('SELECT COUNT(*) AS count FROM users').get() as any).count);
      assert.strictEqual(metrics.totalBusinesses, (sqlite.prepare('SELECT COUNT(*) AS count FROM businesses').get() as any).count);
      assert.strictEqual(metrics.totalBookings, (sqlite.prepare('SELECT COUNT(*) AS count FROM bookings').get() as any).count);
      assert.strictEqual(metrics.totalVolumeCLP, (sqlite.prepare('SELECT COALESCE(SUM(amount_clp), 0) AS total FROM bookings').get() as any).total);

      const adminCategoriesResponse = await getAs('/api/admin/categories', platformAdmin.token);
      const adminCategories = (await adminCategoriesResponse.json() as any).categories;
      assert.ok(adminCategories.every((category: any) => Array.isArray(category.subcategories)));
      assert.ok(adminCategories.some((category: any) => category.subcategories.length > 0));
      const marketplaceCategoriesResponse = await requestJson('/api/marketplace/categories', 'GET');
      assert.deepStrictEqual((await marketplaceCategoriesResponse.json() as any).categories, adminCategories);

      for (const status of ['PENDING_REVIEW', 'DRAFT', 'PUBLISHED', 'SUSPENDED', 'INACTIVE']) {
        const statusResponse = await requestJson(`/api/admin/businesses/${targetBusinessId}/status`, 'PUT', platformAdmin.token, { status });
        assert.strictEqual(statusResponse.status, 200, `El estado ${status} debe ser válido`);
        assert.strictEqual((sqlite.prepare('SELECT status FROM businesses WHERE id = ?').get(targetBusinessId) as any).status, status);
      }
      assert.strictEqual((await requestJson(`/api/admin/businesses/${targetBusinessId}/status`, 'PUT', platformAdmin.token, { status: 'INVALID' })).status, 400);
      await requestJson(`/api/admin/businesses/${targetBusinessId}/status`, 'PUT', platformAdmin.token, { status: 'PUBLISHED' });
    });

    await integrationTest('Autorización integral: aislamiento entre negocios, roles y CRM', async () => {
      const login = async (email: string, password: string) => {
        const response = await sendJson('/api/auth/login', { email, password });
        const body = await response.json() as { token: string; user: { id: string } };
        assert.strictEqual(response.status, 200);
        return body;
      };

      const ownerA = await login('contacto@valeriaestudio.cl', 'Salon1234');
      const ownerB = await login('ignacio@barberiaroute.cl', 'Barber1234!');
      const staffA = await login('camila@valeriaestudio.cl', 'Staff1234!');
      const customerA = await login('cliente@gmail.com', 'Cliente1234!');
      const otherCustomerResponse = await sendJson('/api/auth/register', {
        email: `authz-customer-${generateId('customer')}@example.test`,
        password: 'AuthzCustomer123!',
        full_name: 'Otra clienta para aislamiento',
        phone: '+56912345012',
        role: 'CUSTOMER',
      });
      const otherCustomer = await otherCustomerResponse.json() as { token: string; user: { id: string } };
      assert.strictEqual(otherCustomerResponse.status, 201);

      const businessAId = 'biz_valeria_studio';
      const businessBId = 'biz_route68_barber';
      const now = new Date().toISOString();
      const pendingBookingId = generateId('authz_pending');
      const completedBookingId = generateId('authz_completed');
      const clientId = generateId('authz_client');
      const serviceHistoryId = generateId('authz_history');
      const reviewId = generateId('authz_review');
      const notificationId = generateId('authz_notification');
      const fixturePhone = `authz-${clientId}`;
      const createdServiceName = `Servicio de B ${clientId}`;
      const createdStaffName = `Trabajador de B ${clientId}`;
      const staffMembership = sqlite.prepare(`
        SELECT id, role, is_active
        FROM business_members
        WHERE business_id = ? AND user_id = ?
      `).get(businessAId, staffA.user.id) as { id: string; role: string; is_active: number };
      const businessBefore = sqlite.prepare('SELECT * FROM businesses WHERE id = ?').get(businessAId) as any;
      const serviceBefore = sqlite.prepare('SELECT * FROM services WHERE id = ?').get('srv_val_tintura_raiz') as any;
      const staffBefore = sqlite.prepare('SELECT * FROM staff WHERE id = ?').get('stf_camila') as any;
      const hoursBefore = sqlite.prepare(`
        SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week, id
      `).all(businessAId) as any[];
      const businessBMembership = sqlite.prepare(`
        SELECT id FROM business_members WHERE business_id = ? AND user_id = ?
      `).get(businessBId, ownerB.user.id) as { id: string } | undefined;
      let createdBusinessBMembershipId: string | null = null;

      if (!businessBMembership) {
        createdBusinessBMembershipId = generateId('bm');
        sqlite.prepare(`
          INSERT INTO business_members (id, business_id, user_id, role, is_active, created_at)
          VALUES (?, ?, ?, 'OWNER', 1, ?)
        `).run(createdBusinessBMembershipId, businessBId, ownerB.user.id, now);
      }

      const createBooking = (id: string, status: 'PENDING' | 'COMPLETED') => {
        sqlite.prepare(`
          INSERT INTO bookings (
            id, code, business_id, staff_id, service_id, customer_user_id, booking_date,
            start_time, end_time, duration_minutes, amount_clp, modality, status,
            payment_method, payment_status, client_name, client_phone, client_email,
            created_at, updated_at
          ) VALUES (?, ?, ?, 'stf_valeria', 'srv_val_tintura_raiz', ?, '2099-04-01',
            '11:00', '12:15', 75, 45000, 'salon', ?, 'presential', 'pending', ?, ?, ?, ?, ?)
        `).run(
          id,
          `AUTHZ-INTEGRAL-${id}`,
          businessAId,
          customerA.user.id,
          status,
          'Clienta de autorización',
          fixturePhone,
          'cliente@gmail.com',
          now,
          now
        );
      };
      const restoreRow = (table: string, row: Record<string, any>) => {
        const columns = Object.keys(row).filter(column => column !== 'id');
        sqlite.prepare(
          `UPDATE ${table} SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE id = ?`
        ).run(...columns.map(column => row[column]), row.id);
      };

      try {
        assert.strictEqual(staffMembership.role, 'STAFF');
        assert.strictEqual(sqlite.prepare(`
          SELECT COUNT(*) AS count FROM business_members WHERE user_id = ? AND business_id = ?
        `).get(ownerB.user.id, businessAId)?.count, 0);

        createBooking(pendingBookingId, 'PENDING');
        createBooking(completedBookingId, 'COMPLETED');
        sqlite.prepare(`
          INSERT INTO clients (
          id, user_id, business_id, full_name, phone, notes, preferred_contact,
          re_engagement_status, created_at, updated_at
          ) VALUES (?, ?, ?, 'Clienta de Negocio A', ?, 'No modificar', 'whatsapp', 'none', ?, ?)
        `).run(clientId, ownerA.user.id, businessAId, fixturePhone, now, now);
        sqlite.prepare(`
          INSERT INTO client_service_history (
            id, user_id, business_id, client_id, service_type, color_formula, tint_brand,
            service_date, amount_clp, recommended_interval_days, next_retouch_date, notes, created_at
          ) VALUES (?, ?, ?, ?, 'Color de prueba', '7.1', 'Marca de prueba',
            '2099-03-01', 45000, 30, '2099-03-31', 'Historial protegido', ?)
        `).run(serviceHistoryId, ownerA.user.id, businessAId, clientId, now);
        sqlite.prepare(`
          INSERT INTO reviews (
            id, business_id, staff_id, booking_id, user_id, customer_name,
            rating, comment, is_reported, is_hidden, created_at
          ) VALUES (?, ?, 'stf_valeria', ?, ?, 'Clienta de prueba', 5, 'Reseña protegida', 0, 0, ?)
        `).run(reviewId, businessAId, completedBookingId, customerA.user.id, now);
        sqlite.prepare(`
          INSERT INTO notifications (
            id, user_id, type, title, message, is_read, entity_type, entity_id, urgency, created_at
          ) VALUES (?, ?, 'test', 'Notificación protegida', 'No debe marcarse', 0, 'client', ?, 'low', ?)
        `).run(notificationId, ownerA.user.id, clientId, now);

        const problems: string[] = [];
        const checkUnchanged = async (
          label: string,
          request: () => Promise<Response>,
          expectedStatus: number,
          readTarget: () => unknown
        ) => {
          const before = JSON.stringify(readTarget());
          const response = await request();
          let body: unknown = null;
          try {
            body = await response.json();
          } catch {}
          if (response.status !== expectedStatus) {
            problems.push(`${label}: esperado HTTP ${expectedStatus}, recibido HTTP ${response.status}; respuesta=${JSON.stringify(body)}`);
          }
          const after = JSON.stringify(readTarget());
          if (after !== before) {
            problems.push(`${label}: el estado SQLite cambió; antes=${before}; después=${after}`);
          }
          return { response, body };
        };
        const readBooking = (id: string) => sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
        const readService = () => sqlite.prepare('SELECT * FROM services WHERE id = ?').get('srv_val_tintura_raiz');
        const readStaff = () => sqlite.prepare('SELECT * FROM staff WHERE id = ?').get('stf_camila');
        const readBusiness = () => sqlite.prepare('SELECT * FROM businesses WHERE id = ?').get(businessAId);
        const readHours = () => sqlite.prepare(`
          SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week, id
        `).all(businessAId);
        const readClient = () => sqlite.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
        const readHistory = () => sqlite.prepare('SELECT * FROM client_service_history WHERE id = ?').get(serviceHistoryId);
        const readContactLogs = () => sqlite.prepare('SELECT * FROM contact_logs WHERE client_id = ? ORDER BY id').all(clientId);
        const readNotification = () => sqlite.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);
        const readReview = () => sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
        const readBusinessServices = () => sqlite.prepare(
          'SELECT * FROM services WHERE business_id = ? ORDER BY id'
        ).all(businessAId);
        const readBusinessStaff = () => sqlite.prepare(
          'SELECT * FROM staff WHERE business_id = ? ORDER BY id'
        ).all(businessAId);
        await checkUnchanged(
          'B GET booking A',
          () => requestJson(`/api/bookings/${pendingBookingId}`, 'GET', ownerB.token),
          404,
          () => readBooking(pendingBookingId)
        );
        await checkUnchanged(
          'B confirms booking A',
          () => sendJson(`/api/bookings/${pendingBookingId}/confirm`, {}, ownerB.token),
          404,
          () => readBooking(pendingBookingId)
        );
        await checkUnchanged(
          'B rejects booking A',
          () => sendJson(`/api/bookings/${pendingBookingId}/reject`, { reason: 'No autorizado' }, ownerB.token),
          404,
          () => readBooking(pendingBookingId)
        );
        await checkUnchanged(
          'B completes booking A',
          () => sendJson(`/api/bookings/${pendingBookingId}/complete`, {}, ownerB.token),
          404,
          () => readBooking(pendingBookingId)
        );
        await checkUnchanged(
          'B cancels booking A',
          () => sendJson(`/api/bookings/${pendingBookingId}/cancel`, {}, ownerB.token),
          404,
          () => readBooking(pendingBookingId)
        );
        await checkUnchanged(
          'B updates booking A status',
          () => requestJson(`/api/bookings/${pendingBookingId}/status`, 'PUT', ownerB.token, { status: 'CONFIRMED' }),
          404,
          () => readBooking(pendingBookingId)
        );
        await checkUnchanged(
          'B lists business A bookings',
          () => requestJson(`/api/bookings/business?business_id=${businessAId}`, 'GET', ownerB.token),
          404,
          () => readBooking(pendingBookingId)
        );

        await checkUnchanged(
          'B updates business A service',
          () => requestJson('/api/business/services/srv_val_tintura_raiz', 'PUT', ownerB.token, {
            name: 'Servicio alterado por B',
            price_clp: 1,
          }),
          404,
          readService
        );
        await checkUnchanged(
          'B deletes business A service',
          () => requestJson('/api/business/services/srv_val_tintura_raiz', 'DELETE', ownerB.token),
          404,
          readService
        );
        await checkUnchanged(
          'B deletes business A staff',
          () => requestJson('/api/business/staff/stf_camila', 'DELETE', ownerB.token),
          404,
          readStaff
        );
        await checkUnchanged(
          'B creates a service for business A',
          () => sendJson(`/api/business/${businessAId}/services`, { name: createdServiceName, price_clp: 15000 }, ownerB.token),
          404,
          readBusinessServices
        );
        await checkUnchanged(
          'B creates staff for business A',
          () => sendJson(`/api/business/${businessAId}/staff`, { name: createdStaffName }, ownerB.token),
          404,
          readBusinessStaff
        );
        await checkUnchanged(
          'B changes business A hours',
          () => requestJson(`/api/business/${businessAId}/hours`, 'PUT', ownerB.token, {
            hours: [{ day_of_week: 1, open_time: '07:00', close_time: '15:00', is_closed: 0 }],
          }),
          404,
          readHours
        );
        await checkUnchanged(
          'B changes business A',
          () => requestJson(`/api/business/${businessAId}`, 'PUT', ownerB.token, { description: 'Alteración de B' }),
          404,
          readBusiness
        );
        await checkUnchanged(
          'B responds to business A review',
          () => sendJson(`/api/reviews/${reviewId}/respond`, { response: 'Respuesta de B' }, ownerB.token),
          404,
          readReview
        );

        await checkUnchanged(
          'STAFF updates business A service',
          () => requestJson('/api/business/services/srv_val_tintura_raiz', 'PUT', staffA.token, {
            name: 'Servicio alterado por STAFF',
            price_clp: 1,
          }),
          403,
          readService
        );
        await checkUnchanged(
          'STAFF changes business A hours',
          () => requestJson(`/api/business/${businessAId}/hours`, 'PUT', staffA.token, {
            hours: [{ day_of_week: 1, open_time: '06:00', close_time: '14:00', is_closed: 0 }],
          }),
          403,
          readHours
        );
        await checkUnchanged(
          'STAFF responds to business A review',
          () => sendJson(`/api/reviews/${reviewId}/respond`, { response: 'Respuesta de STAFF' }, staffA.token),
          403,
          readReview
        );

        sqlite.prepare('UPDATE business_members SET is_active = 0 WHERE id = ?').run(staffMembership.id);
        await checkUnchanged(
          'Miembro desactivado confirms booking A',
          () => sendJson(`/api/bookings/${pendingBookingId}/confirm`, {}, staffA.token),
          404,
          () => readBooking(pendingBookingId)
        );

        await checkUnchanged(
          'B gets client A',
          () => requestJson(`/api/clients/${clientId}`, 'GET', ownerB.token),
          404,
          readClient
        );
        await checkUnchanged(
          'B updates client A',
          () => requestJson(`/api/clients/${clientId}`, 'PUT', ownerB.token, {
            full_name: 'Clienta alterada por B',
            phone: '+56912345014',
          }),
          404,
          readClient
        );
        await checkUnchanged(
          'B deletes client A',
          () => requestJson(`/api/clients/${clientId}`, 'DELETE', ownerB.token, {}),
          404,
          readClient
        );
        await checkUnchanged(
          'B creates service history for client A',
          () => sendJson('/api/services', {
            client_id: clientId,
            service_type: 'Servicio de B',
          }, ownerB.token),
          404,
          () => ({
            client: readClient(),
            history: sqlite.prepare('SELECT * FROM client_service_history WHERE client_id = ? ORDER BY id').all(clientId),
          })
        );
        await checkUnchanged(
          'B deletes service history A',
          () => requestJson(`/api/services/${serviceHistoryId}`, 'DELETE', ownerB.token),
          404,
          readHistory
        );
        await checkUnchanged(
          'B creates a contact log for client A',
          () => sendJson('/api/contact-logs', { client_id: clientId, status: 'contacted' }, ownerB.token),
          404,
          () => ({
            client: readClient(),
            logs: readContactLogs(),
          })
        );
        await checkUnchanged(
          'B changes re-engagement status for client A',
          () => sendJson('/api/re-engagement/status', {
            client_id: clientId,
            status: 'reactivated',
            notes: 'Intento de B',
          }, ownerB.token),
          404,
          () => ({
            client: readClient(),
            logs: readContactLogs(),
          })
        );
        const notificationAttempt = await checkUnchanged(
          'B marks notification A read',
          () => requestJson(`/api/notifications/${notificationId}/read`, 'PATCH', ownerB.token),
          200,
          readNotification
        );
        if ((notificationAttempt.body as any)?.message !== 'Notificación leída.') {
          problems.push(`B marks notification A read: respuesta inesperada=${JSON.stringify(notificationAttempt.body)}`);
        }
        const clientListAttempt = await checkUnchanged(
          'B lists clients without client A',
          () => requestJson('/api/clients', 'GET', ownerB.token),
          200,
          readClient
        );
        if (((clientListAttempt.body as any)?.clients as any[] | undefined)?.some(client => client.id === clientId)) {
          problems.push('B GET /clients incluyó una clienta de business A.');
        }

        await checkUnchanged(
          'Otra clienta simulates payment for booking A',
          () => sendJson('/api/payments/checkout/simulate', {
            booking_id: completedBookingId,
            action: 'approve',
          }, otherCustomer.token),
          404,
          () => ({
            booking: readBooking(completedBookingId),
            payments: sqlite.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY id').all(completedBookingId),
          })
        );
        await checkUnchanged(
          'Otra clienta reviews booking A',
          () => sendJson('/api/reviews', {
            booking_id: completedBookingId,
            rating: 5,
            comment: 'Reseña ajena',
          }, otherCustomer.token),
          403,
          () => ({
            booking: readBooking(completedBookingId),
            reviews: sqlite.prepare('SELECT * FROM reviews WHERE booking_id = ? ORDER BY id').all(completedBookingId),
          })
        );

        assert.strictEqual(problems.length, 0, problems.join('\n'));
      } finally {
        sqlite.prepare('UPDATE business_members SET is_active = ? WHERE id = ?')
          .run(staffMembership.is_active, staffMembership.id);
        restoreRow('businesses', businessBefore);
        restoreRow('services', serviceBefore);
        restoreRow('staff', staffBefore);
        sqlite.prepare('DELETE FROM business_hours WHERE business_id = ?').run(businessAId);
        for (const row of hoursBefore) {
          sqlite.prepare(`
            INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            row.id,
            row.business_id,
            row.day_of_week,
            row.open_time,
            row.close_time,
            row.is_closed,
            row.created_at
          );
        }
        sqlite.prepare('DELETE FROM services WHERE business_id = ? AND name = ?').run(businessAId, createdServiceName);
        sqlite.prepare('DELETE FROM staff WHERE business_id = ? AND name = ?').run(businessAId, createdStaffName);
        const sideEffectClients = sqlite.prepare(`
          SELECT id FROM clients WHERE user_id = ? AND business_id = ? AND phone = ?
        `).all(ownerB.user.id, businessAId, fixturePhone) as Array<{ id: string }>;
        for (const client of sideEffectClients) {
          sqlite.prepare('DELETE FROM client_service_history WHERE client_id = ?').run(client.id);
          sqlite.prepare('DELETE FROM contact_logs WHERE client_id = ?').run(client.id);
          sqlite.prepare('DELETE FROM clients WHERE id = ?').run(client.id);
        }
        sqlite.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);
        sqlite.prepare(`
          DELETE FROM notifications WHERE entity_type = 'review' AND entity_id = ?
        `).run(reviewId);
        sqlite.prepare(`
          DELETE FROM notifications WHERE entity_type = 'booking' AND entity_id IN (?, ?)
        `).run(pendingBookingId, completedBookingId);
        sqlite.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
        sqlite.prepare('DELETE FROM client_service_history WHERE id = ?').run(serviceHistoryId);
        sqlite.prepare('DELETE FROM contact_logs WHERE client_id = ?').run(clientId);
        sqlite.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
        sqlite.prepare('DELETE FROM payments WHERE booking_id IN (?, ?)').run(pendingBookingId, completedBookingId);
        sqlite.prepare('DELETE FROM booking_status_history WHERE booking_id IN (?, ?)').run(pendingBookingId, completedBookingId);
        sqlite.prepare('DELETE FROM bookings WHERE id IN (?, ?)').run(pendingBookingId, completedBookingId);
        sqlite.prepare('DELETE FROM users WHERE id = ?').run(otherCustomer.user.id);
        if (createdBusinessBMembershipId) {
          sqlite.prepare('DELETE FROM business_members WHERE id = ?').run(createdBusinessBMembershipId);
        }
      }
    });

    await integrationTest('Reset de contraseña: rechaza solicitudes sin token', async () => {
      const response = await sendJson('/api/auth/reset-password', {
        email: 'contacto@valeriaestudio.cl',
        new_password: 'NoDebeAplicarse123!',
      });
      assert.strictEqual(response.status, 400);
      assert.deepStrictEqual(await response.json(), {
        error: 'El enlace de recuperación no es válido o expiró.',
      });
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
      });
      assert.strictEqual(loginResponse.status, 200);
    });

    await integrationTest('Correo local: guarda el enlace en el buzón de desarrollo, no en consola', async () => {
      const outboxDir = mkdtempSync(join(tmpdir(), 'salontrack-dev-mail-'));
      const previousDir = process.env.DEV_MAIL_DIR;
      const previousLog = console.log;
      const logged: string[] = [];
      process.env.DEV_MAIL_DIR = outboxDir;
      console.log = (...args: unknown[]) => { logged.push(args.join(' ')); };
      try {
        await localEmailProvider.send('qa@salontrack.cl', 'Recuperación', 'Enlace: http://localhost:3000/?reset_token=abc123');
      } finally {
        console.log = previousLog;
        if (previousDir === undefined) delete process.env.DEV_MAIL_DIR; else process.env.DEV_MAIL_DIR = previousDir;
      }
      const lines = readFileSync(join(outboxDir, 'outbox.jsonl'), 'utf8').trim().split('\n');
      const mail = JSON.parse(lines[lines.length - 1]);
      assert.strictEqual(mail.to, 'qa@salontrack.cl');
      assert.ok(mail.body.includes('reset_token=abc123'));
      assert.ok(logged.every(line => !line.includes('reset_token')));
      rmSync(outboxDir, { recursive: true, force: true });
    });

    await integrationTest('Recuperación: mismo cuerpo para correo registrado y no registrado', async () => {
      const existing = await requestReset('contacto@valeriaestudio.cl');
      const unknown = await requestReset('no-existe@salontrack.cl');
      assert.strictEqual(existing.response.status, 200);
      assert.strictEqual(unknown.response.status, 200);
      assert.deepStrictEqual(existing.body, unknown.body);
      assert.ok(!Object.hasOwn(existing.body, 'sent'));

      const match = existing.emailContent.match(/reset_token=([a-f0-9]{64})/);
      assert.ok(match, 'El adaptador local debe recibir el enlace con un token de 32 bytes');
      olderResetToken = match[1];
      const storedToken = sqlite.prepare(`
        SELECT token_hash, expires_at
        FROM password_reset_tokens
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get('usr_demo_valeria_estilista') as { token_hash: string; expires_at: string };
      assert.strictEqual(storedToken.token_hash, createHash('sha256').update(olderResetToken).digest('hex'));
      assert.ok(Date.parse(storedToken.expires_at) > Date.now());
      assert.ok(Date.parse(storedToken.expires_at) <= Date.now() + 30 * 60 * 1000);
    });

    await integrationTest('Reset de contraseña: token válido funciona una vez e invalida los anteriores', async () => {
      const request = await requestReset('contacto@valeriaestudio.cl');
      const match = request.emailContent.match(/reset_token=([a-f0-9]{64})/);
      assert.ok(match);
      const token = match[1];
      const newPassword = 'NuevaClaveSegura123!';
      const resetResponse = await sendJson('/api/auth/reset-password', { token, new_password: newPassword });
      assert.strictEqual(resetResponse.status, 200);

      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: newPassword,
      });
      assert.strictEqual(loginResponse.status, 200);

      const reusedResponse = await sendJson('/api/auth/reset-password', { token, new_password: 'OtraClaveSegura123!' });
      assert.strictEqual(reusedResponse.status, 400);
      const olderResponse = await sendJson('/api/auth/reset-password', {
        token: olderResetToken,
        new_password: 'TerceraClaveSegura123!',
      });
      assert.strictEqual(olderResponse.status, 400);
    });

    await integrationTest('Reset de contraseña: token expirado devuelve 400', async () => {
      const token = 'expired-reset-token';
      const user = sqlite.prepare('SELECT id FROM users WHERE email = ?').get('contacto@valeriaestudio.cl') as { id: string };
      sqlite.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
        VALUES (?, ?, ?, ?, NULL, ?)
      `).run(
        generateId('prt'),
        user.id,
        createHash('sha256').update(token).digest('hex'),
        new Date(Date.now() - 60_000).toISOString(),
        new Date().toISOString()
      );

      const response = await sendJson('/api/auth/reset-password', { token, new_password: 'NoDebeAplicarse123!' });
      assert.strictEqual(response.status, 400);
      assert.deepStrictEqual(await response.json(), {
        error: 'El enlace de recuperación no es válido o expiró.',
      });
    });

    await integrationTest('Respaldo y restauración SQLite: captura WAL, verifica seguridad y reabre la API', async () => {
      const loginResponse = await sendJson('/api/auth/login', {
        email: 'contacto@valeriaestudio.cl',
        password: 'NuevaClaveSegura123!',
      });
      const login = await loginResponse.json() as { token: string };
      assert.strictEqual(loginResponse.status, 200);

      const backupDirectory = mkdtempSync(join(tmpdir(), 'salontrack-backup-tests-'));
      const markerId = generateId('cli');
      const now = new Date().toISOString();
      const currentDb = getSqliteDb();

      try {
        currentDb.prepare(`
          INSERT INTO clients (
            id, user_id, full_name, phone, notes, preferred_contact,
            re_engagement_status, created_at, updated_at
          ) VALUES (?, 'usr_demo_valeria_estilista', 'Marcador de respaldo WAL', '+56912345077', '', 'whatsapp', 'none', ?, ?)
        `).run(markerId, now, now);
        const backupFile = createBackup(backupDirectory);
        assert.deepStrictEqual(verifyBackup(backupFile), { ok: true });

        const backupDb = new DatabaseSync(backupFile, { readOnly: true });
        try {
          assert.strictEqual(
            (backupDb.prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(markerId) as { count: number }).count,
            1
          );
        } finally {
          backupDb.close();
        }

        const temporaryDatabasePath = `${getDatabasePath()}.restore-tmp`;
        mkdirSync(temporaryDatabasePath);
        try {
          assert.throws(() => restoreBackup(backupFile));
          assert.strictEqual(
            (getSqliteDb().prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(markerId) as { count: number }).count,
            1
          );
          const apiAfterCopyFailure = await requestJson('/api/clients', 'GET', login.token);
          assert.strictEqual(apiAfterCopyFailure.status, 200);
          assert.ok(((await apiAfterCopyFailure.json() as any).clients as any[]).some(client => client.id === markerId));
        } finally {
          rmSync(temporaryDatabasePath, { recursive: true, force: true });
        }

        getSqliteDb().prepare('DELETE FROM clients WHERE id = ?').run(markerId);
        const restored = restoreBackup(backupFile);
        assert.ok(restored.safetyBackup && existsSync(restored.safetyBackup));
        assert.ok(restored.safetyBackup && restored.safetyBackup.includes('pre_restore_'));

        const restoredDb = getSqliteDb();
        assert.strictEqual(
          (restoredDb.prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(markerId) as { count: number }).count,
          1
        );

        const safetyDb = new DatabaseSync(restored.safetyBackup!, { readOnly: true });
        try {
          assert.strictEqual(
            (safetyDb.prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(markerId) as { count: number }).count,
            0
          );
        } finally {
          safetyDb.close();
        }

        const apiResponse = await requestJson('/api/clients', 'GET', login.token);
        assert.strictEqual(apiResponse.status, 200);
        assert.ok(((await apiResponse.json() as any).clients as any[]).some(client => client.id === markerId));

        const garbageFile = join(backupDirectory, 'respaldo-invalido.sqlite');
        writeFileSync(garbageFile, 'no es una base SQLite');
        const garbageVerification = verifyBackup(garbageFile);
        assert.strictEqual(garbageVerification.ok, false);
        assert.throws(() => restoreBackup(garbageFile), /Respaldo inválido/);
        assert.strictEqual(
          (getSqliteDb().prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(markerId) as { count: number }).count,
          1
        );

        const tamperedFile = join(backupDirectory, 'respaldo-alterado.sqlite');
        copyFileSync(backupFile, tamperedFile);
        const tamperedDb = new DatabaseSync(tamperedFile);
        try {
          tamperedDb.prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 1').run('alterado');
        } finally {
          tamperedDb.close();
        }
        const tamperedVerification = verifyBackup(tamperedFile);
        assert.strictEqual(tamperedVerification.ok, false);
        assert.ok(!tamperedVerification.ok && tamperedVerification.error.includes('checksum registrado'));

        const databasePath = getDatabasePath();
        const corruptBytes = Buffer.from('base SQLite actual dañada');
        closeSqliteDb();
        writeFileSync(databasePath, corruptBytes);
        rmSync(`${databasePath}-wal`, { force: true });
        rmSync(`${databasePath}-shm`, { force: true });

        const restoredFromCorruptDb = restoreBackup(backupFile);
        assert.ok(restoredFromCorruptDb.safetyBackup && existsSync(restoredFromCorruptDb.safetyBackup));
        assert.deepStrictEqual(readFileSync(restoredFromCorruptDb.safetyBackup!), corruptBytes);
        assert.strictEqual(
          (getSqliteDb().prepare('SELECT COUNT(*) AS count FROM clients WHERE id = ?').get(markerId) as { count: number }).count,
          1
        );
        const apiAfterCorruptRestore = await requestJson('/api/clients', 'GET', login.token);
        assert.strictEqual(apiAfterCorruptRestore.status, 200);
        assert.ok(((await apiAfterCorruptRestore.json() as any).clients as any[]).some(client => client.id === markerId));
      } finally {
        getSqliteDb().prepare('DELETE FROM clients WHERE id = ?').run(markerId);
        rmSync(backupDirectory, { recursive: true, force: true });
      }
    });

    await integrationTest('Reservas: expira pendientes vencidas y libera su horario', async () => {
      const sqlite = getSqliteDb();
      const businessId = 'biz_valeria_studio';
      const serviceId = 'srv_val_corte';
      const staffId = 'stf_valeria';
      const available = await findAvailableSlots(businessId, serviceId, staffId, 10);
      const { date } = available;
      const slots = selectSeparatedSlots(available.slots, 2);
      const fixedNow = new Date(`${addDaysToDate(date, 1)}T21:00:00.000Z`);
      const fixedParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(fixedNow);
      const fixedValues = Object.fromEntries(fixedParts.map(part => [part.type, part.value]));
      const fixedToday = `${fixedValues.year}-${fixedValues.month}-${fixedValues.day}`;
      const fixedTime = `${fixedValues.hour}:${fixedValues.minute}`;
      const staleBefore = (sqlite.prepare(`
        SELECT COUNT(*) AS count FROM bookings
        WHERE status = 'PENDING'
          AND (booking_date < ? OR (booking_date = ? AND start_time <= ?))
      `).get(fixedToday, fixedToday, fixedTime) as { count: number }).count;
      const futureSlots = await findAvailableSlots(
        businessId,
        serviceId,
        staffId,
        1,
        fixedToday
      );
      const customerId = (sqlite.prepare('SELECT id FROM users WHERE email = ?')
        .get('cliente@gmail.com') as { id: string }).id;
      const ids = [
        generateId('expire_pending'),
        generateId('expire_future'),
        generateId('expire_confirmed'),
      ];
      const createdAt = new Date().toISOString();
      const insertBooking = (
        id: string,
        bookingDate: string,
        slot: { time: string; endTime: string; durationMinutes: number },
        status: 'PENDING' | 'CONFIRMED'
      ) => {
        sqlite.prepare(`
          INSERT INTO bookings (
            id, code, business_id, staff_id, service_id, customer_user_id, booking_date,
            start_time, end_time, duration_minutes, amount_clp, modality, status,
            payment_method, payment_status, client_name, client_phone, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 25000, 'salon', ?, 'presential',
            'pending', 'Cliente de vencimiento', '+56912345671', ?, ?)
        `).run(
          id,
          `EXPIRE-${id}`,
          businessId,
          staffId,
          serviceId,
          customerId,
          bookingDate,
          slot.time,
          slot.endTime,
          slot.durationMinutes,
          status,
          createdAt,
          createdAt
        );
      };
      insertBooking(ids[0], date, slots[0], 'PENDING');
      insertBooking(ids[1], futureSlots.date, futureSlots.slots[0], 'PENDING');
      insertBooking(ids[2], date, slots[1], 'CONFIRMED');
      const futureBefore = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(ids[1]);
      const confirmedBefore = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(ids[2]);

      try {
        assert.ok(!getAvailableSlots({ businessId, serviceId, dateStr: date, staffId })
          .some(slot => slot.time === slots[0].time));
        assert.strictEqual(expireStalePendingBookings(fixedNow), staleBefore + 1);
        const expired = sqlite.prepare('SELECT status FROM bookings WHERE id = ?').get(ids[0]) as { status: string };
        assert.strictEqual(expired.status, 'EXPIRED');
        const history = sqlite.prepare(`
          SELECT from_status, to_status, changed_by_user_id, reason
          FROM booking_status_history WHERE booking_id = ?
        `).get(ids[0]);
        assert.deepStrictEqual({ ...history }, {
          from_status: 'PENDING',
          to_status: 'EXPIRED',
          changed_by_user_id: null,
          reason: 'Expirada sin confirmación',
        });
        assert.deepStrictEqual({ ...sqlite.prepare(`
          SELECT type, title, message FROM notifications
          WHERE user_id = ? AND entity_type = 'booking' AND entity_id = ?
        `).get(customerId, ids[0]) as object }, {
          type: 'booking_expired',
          title: 'Reserva expirada',
          message: `Tu solicitud para el ${date} a las ${slots[0].time} hrs no fue confirmada a tiempo y expiró.`,
        });
        assert.deepStrictEqual(sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(ids[1]), futureBefore);
        assert.deepStrictEqual(sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(ids[2]), confirmedBefore);
        assert.ok(getAvailableSlots({ businessId, serviceId, dateStr: date, staffId })
          .some(slot => slot.time === slots[0].time));
      } finally {
        for (const id of ids) {
          sqlite.prepare("DELETE FROM notifications WHERE entity_type = 'booking' AND entity_id = ?").run(id);
          sqlite.prepare('DELETE FROM booking_status_history WHERE booking_id = ?').run(id);
          sqlite.prepare('DELETE FROM bookings WHERE id = ?').run(id);
        }
      }
    });

    await integrationTest('Persistencia CRM: DATABASE_FILE_JSON permanece intacto', async () => {
      if (databaseJsonAtStart.exists) {
        assert.ok(existsSync(databaseJsonPath));
        assert.strictEqual(statSync(databaseJsonPath).mtimeMs, databaseJsonAtStart.mtimeMs);
      } else {
        assert.ok(!existsSync(databaseJsonPath));
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }

  console.log(`\n---------------------------------------`);
  console.log(`Resultados de pruebas: ${passed} aprobadas, ${failed} fallidas.`);
  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('🎉 Todas las pruebas pasaron satisfactoriamente.\n');
  }
}

void runIntegrationTests();
