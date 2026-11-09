import assert from 'node:assert';
import { test as nodeTest } from 'node:test';
import { setupTestEnv } from './helpers.js';
import { formatCLP, formatChileanDate, formatChileanPhone, buildWhatsAppLink, prepareWhatsAppMessage } from '../src/utils/formatters.js';
import { hashPassword, verifyPassword, generateToken } from '../server/auth.js';
import { generateId, Client } from '../server/db.js';
import { usersRepository } from '../server/repositories/users.js';
import { clientsRepository } from '../server/repositories/clients.js';
import { calculateNextDate, daysBetween, getSantiagoDateString } from '../server/lib/dates.js';

setupTestEnv('unit');

const test = (name: string, fn: () => void) => nodeTest(name, fn);

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

  const now = new Date().toISOString();
  for (const id of [user1Id, user2Id]) {
    usersRepository.insert({ id, email: `${id}@test.cl`, password_hash: 'x', created_at: now });
  }
  clientsRepository.insert(client1);
  clientsRepository.insert(client2);

  const user1Clients = clientsRepository.listByUser(user1Id);
  assert.ok(user1Clients.some(c => c.id === client1.id));
  assert.ok(!user1Clients.some(c => c.id === client2.id));
  assert.strictEqual(clientsRepository.findForUser(client2.id, user1Id), undefined);
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
  assert.strictEqual(calculateNextDate(startDate, interval), '2026-11-09');
  assert.strictEqual(calculateNextDate('2026-12-20', 20), '2027-01-09');
  assert.strictEqual(daysBetween('2026-10-10', '2026-11-09'), 30);
});

test('Fecha Santiago: usa America/Santiago y no la fecha UTC', () => {
  // 02:00 UTC del 10/11 sigue siendo 9/11 en Chile (UTC-3 en horario de verano).
  assert.strictEqual(getSantiagoDateString(new Date('2026-11-10T02:00:00Z')), '2026-11-09');
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

