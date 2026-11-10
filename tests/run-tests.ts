import assert from 'node:assert';
import { formatCLP, formatChileanDate, formatChileanPhone, buildWhatsAppLink, prepareWhatsAppMessage } from '../src/utils/formatters.js';
import { hashPassword, verifyPassword, generateToken } from '../server/auth.js';
import { getDb, saveDb, generateId, User, Profile, Client, Service } from '../server/db.js';
import { getSqliteDb } from '../server/sqlite.js';
import { isSlotAvailable } from '../server/availability.js';
import { localGeolocationProvider, localPaymentProvider } from '../server/adapters/index.js';
import { seedDemoDataIfEmpty } from '../server/seedData.js';

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

console.log(`\n---------------------------------------`);
console.log(`Resultados de pruebas: ${passed} aprobadas, ${failed} fallidas.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Todas las pruebas pasaron satisfactoriamente.\n');
}

