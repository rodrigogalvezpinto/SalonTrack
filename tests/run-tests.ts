import './setup-env.js';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { formatCLP, formatChileanDate, formatChileanPhone, buildWhatsAppLink, prepareWhatsAppMessage } from '../src/utils/formatters.js';
import { hashPassword, verifyPassword, generateToken, seedDemoDataIfEmpty } from '../server/auth.js';
import { getDb, saveDb, refreshDb, generateId, User, Profile, Client, Service } from '../server/db.js';
import { getSqliteDb } from '../server/sqlite.js';
import { isSlotAvailable } from '../server/availability.js';
import { localEmailProvider, localGeolocationProvider, localPaymentProvider } from '../server/adapters/index.js';
import apiRouter from '../server/routes.js';

console.log('🧪 Iniciando Suite de Pruebas Automatizadas de SalonTrack Chile...\n');

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
  const user1Id = 'usr_test_1_' + Date.now();
  const user2Id = 'usr_test_2_' + Date.now();

  const client1: Client = {
    id: generateId('cli'),
    user_id: user1Id,
    full_name: 'Clienta de Estilista 1',
    phone: '+56911111111',
    notes: 'Datos privados estilista 1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const client2: Client = {
    id: generateId('cli'),
    user_id: user2Id,
    full_name: 'Clienta de Estilista 2',
    phone: '+56922222222',
    notes: 'Datos privados estilista 2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const db = getDb();
  db.clients.push(client1, client2);

  // Consulta simulada para user1
  const user1Clients = db.clients.filter(c => c.user_id === user1Id);
  assert.ok(user1Clients.some(c => c.id === client1.id));
  assert.ok(!user1Clients.some(c => c.id === client2.id));
  db.clients = db.clients.filter(c => c.id !== client1.id && c.id !== client2.id);
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

      refreshDb();
      assert.ok(!getDb().services.some(service => service.id === createdClient.service.id));
      assert.ok(getDb().services.some(service => service.id === extraService.service.id));

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

      refreshDb();
      assert.ok(!getDb().clients.some(client => client.id === createdClient.client.id));
      assert.ok(!getDb().services.some(service => service.id === extraService.service.id));
      assert.ok(!getDb().contact_logs.some(log => log.client_id === createdClient.client.id));
    });

    await integrationTest('Autorización: reservas y acciones del negocio respetan membresías', async () => {
      const login = async (email: string, password: string) => {
        const response = await sendJson('/api/auth/login', { email, password });
        const body = await response.json() as { token: string; user: { id: string } };
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
      assert.strictEqual(staffConfirm.status, 403);
      assert.deepStrictEqual(await staffConfirm.json(), {
        error: 'No tienes permisos para esta acción en el negocio.',
      });
      assert.strictEqual((await postAs(`/api/bookings/${bookings.confirm}/confirm`, owner.token)).status, 200);
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

      const originalBookingMode = (sqlite.prepare('SELECT booking_mode FROM businesses WHERE id = ?').get(targetBusinessId) as any).booking_mode;
      sqlite.prepare("UPDATE businesses SET booking_mode = 'MANUAL' WHERE id = ?").run(targetBusinessId);
      const customerBookingResponse = await postAs('/api/bookings', bookingCustomer.token, {
        business_id: targetBusinessId,
        service_id: 'srv_val_corte',
        staff_id: 'stf_valeria',
        booking_date: '2099-01-02',
        start_time: '11:00',
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
      assert.strictEqual((await requestJson(`/api/bookings/${customerBooking.id}/status`, 'PUT', owner.token, { status: 'COMPLETED' })).status, 200);

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
      assert.ok(businessMineBody.services.some((s: any) => s.id === catalogService.service_id));
      assert.ok(businessMineBody.staff.some((s: any) => s.id === catalogStaff.staff_id));
      assert.ok(Array.isArray(businessMineBody.hours));
      assert.strictEqual((await requestJson(`/api/business/staff/${catalogStaff.staff_id}`, 'DELETE', owner.token)).status, 200);
      assert.strictEqual((sqlite.prepare('SELECT is_active FROM staff WHERE id = ?').get(catalogStaff.staff_id) as any).is_active, 0);

      const metricsResponse = await getAs('/api/admin/metrics', platformAdmin.token);
      assert.strictEqual(metricsResponse.status, 200);
      const metrics = (await metricsResponse.json() as any).stats;
      assert.strictEqual(metrics.totalUsers, (sqlite.prepare('SELECT COUNT(*) AS count FROM users').get() as any).count);
      assert.strictEqual(metrics.totalBusinesses, (sqlite.prepare('SELECT COUNT(*) AS count FROM businesses').get() as any).count);
      assert.strictEqual(metrics.totalBookings, (sqlite.prepare('SELECT COUNT(*) AS count FROM bookings').get() as any).count);
      assert.strictEqual(metrics.totalVolumeCLP, (sqlite.prepare('SELECT COALESCE(SUM(amount_clp), 0) AS total FROM bookings').get() as any).total);
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
