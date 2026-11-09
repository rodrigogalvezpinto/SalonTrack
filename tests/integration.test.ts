import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { setupTestEnv, startServer, makeClient } from './helpers.js';

const tmpDir = setupTestEnv('integration');

const { createApp } = await import('../server/app.js');
const { initDatabase, getDatabase, closeDatabase } = await import('../server/db/connection.js');
const { runMigrations } = await import('../server/db/migrate.js');
const { importLegacyJson } = await import('../server/db/legacyImport.js');
const { seedDemoData, resetDemoData, DEMO_EMAIL, DEMO_PASSWORD } = await import('../server/db/seed.js');
const { backupDatabase, restoreDatabase } = await import('../server/db/backup.js');
const { resetRateLimits } = await import('../server/lib/rateLimit.js');
const { hashPassword } = await import('../server/auth.js');

const dbFile = process.env.DATABASE_FILE!;
initDatabase(dbFile);
const { server, baseUrl } = await startServer(createApp());
const api = makeClient(baseUrl);
const count = (sql: string, ...params: unknown[]) => (getDatabase().prepare(sql).get(...params) as any).n as number;

let seq = 0;
async function registerUser(overrides: Record<string, unknown> = {}) {
  const email = `pro${++seq}_${Date.now()}@test.cl`;
  const res = await api('POST', '/api/auth/register', {
    email, password: 'Secreta123', full_name: 'Profesional Test', business_name: 'Salón Test', phone: '+56 9 1234 5678', ...overrides,
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { email, token: res.data.token as string, userId: res.data.user.id as string };
}

beforeEach(() => resetRateLimits());
after(() => {
  server.close();
  closeDatabase();
});

describe('Migraciones', () => {
  test('aplica 001 una vez y es idempotente', () => {
    const rows = getDatabase().prepare('SELECT version FROM schema_migrations').all() as any[];
    assert.ok(rows.some(r => r.version === '001'));
    assert.deepEqual(runMigrations(getDatabase()), []);
  });

  test('claves foráneas activas', () => {
    assert.equal(getDatabase().pragma('foreign_keys', { simple: true }), 1);
  });
});

describe('Autenticación', () => {
  test('registro, correo duplicado, login, contraseña incorrecta y /me', async () => {
    const { email, token } = await registerUser();
    const dup = await api('POST', '/api/auth/register', { email: email.toUpperCase(), password: 'Secreta123', full_name: 'X' });
    assert.equal(dup.status, 409);

    const login = await api('POST', '/api/auth/login', { email, password: 'Secreta123' });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);
    assert.equal(login.data.user.profile.business_name, 'Salón Test');
    assert.equal(login.data.user.subscription.status, 'trial');
    assert.equal(login.data.user.subscription.days_remaining, 14);
    assert.equal(login.data.user.subscription.is_active, true);

    assert.equal((await api('POST', '/api/auth/login', { email, password: 'incorrecta' })).status, 401);

    const me = await api('GET', '/api/auth/me', undefined, token);
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, email);
    assert.equal(me.data.user.password_hash, undefined);
  });

  test('rechaza correo inválido, contraseña corta y tokens inválidos', async () => {
    assert.equal((await api('POST', '/api/auth/register', { email: 'no-es-correo', password: 'Secreta123', full_name: 'X' })).status, 400);
    assert.equal((await api('POST', '/api/auth/register', { email: 'a@b.cl', password: '123', full_name: 'X' })).status, 400);
    assert.equal((await api('GET', '/api/clients')).status, 401);
    assert.equal((await api('GET', '/api/clients', undefined, 'token-falso')).status, 401);
  });

  test('recuperación de contraseña con token de un solo uso (sin enumeración de correos)', async () => {
    const { email, userId } = await registerUser();
    const unknown = await api('POST', '/api/auth/forgot-password', { email: 'nadie@test.cl' });
    const known = await api('POST', '/api/auth/forgot-password', { email });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.data, known.data);

    // Ya no se puede cambiar la contraseña conociendo solo el correo.
    assert.equal((await api('POST', '/api/auth/reset-password', { email, new_password: 'Hackeada1' })).status, 400);

    const delivery = getDatabase()
      .prepare("SELECT body FROM notification_delivery_logs WHERE user_id = ? AND channel = 'email' ORDER BY created_at DESC")
      .get(userId) as any;
    const token = decodeURIComponent(/reset_token=([^\s]+)/.exec(delivery.body)![1]);
    assert.equal(count('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE token_hash = ?', token), 0, 'el token se guarda hasheado');

    assert.equal((await api('POST', '/api/auth/reset-password', { token, new_password: 'NuevaClave1' })).status, 200);
    assert.equal((await api('POST', '/api/auth/reset-password', { token, new_password: 'OtraClave1' })).status, 400);
    assert.equal((await api('POST', '/api/auth/login', { email, password: 'Secreta123' })).status, 401);
    assert.equal((await api('POST', '/api/auth/login', { email, password: 'NuevaClave1' })).status, 200);
  });

  test('rate limiting en login', async () => {
    const { email } = await registerUser();
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await api('POST', '/api/auth/login', { email, password: 'mala' })).status;
    assert.equal(last, 429);
  });
});

describe('CRM y aislamiento entre profesionales', () => {
  test('crea clienta con servicio inicial en una transacción y calcula el retoque en backend', async () => {
    const { token } = await registerUser();
    const res = await api('POST', '/api/clients', {
      full_name: 'Daniela Rojas', phone: '9 7345 6789', notes: 'Pelo fino',
      initial_service: { service_type: 'Babylights', amount_clp: 68000.4, service_date: '2026-10-10', recommended_interval_days: 30, next_retouch_date: '2030-01-01' },
    }, token);
    assert.equal(res.status, 201);
    assert.equal(res.data.client.phone, '+56973456789');
    assert.equal(res.data.service.amount_clp, 68000);
    assert.equal(res.data.service.next_retouch_date, '2026-11-09');

    const list = await api('GET', '/api/clients', undefined, token);
    assert.equal(list.data.total, 1);
    assert.equal(list.data.clients[0].total_services, 1);
  });

  test('si el servicio inicial es inválido no se crea la clienta', async () => {
    const { token, userId } = await registerUser();
    const res = await api('POST', '/api/clients', {
      full_name: 'Clienta', phone: '+56911111111', initial_service: { service_type: 'Corte', service_date: '2026-02-30' },
    }, token);
    assert.equal(res.status, 400);
    assert.equal(count('SELECT COUNT(*) AS n FROM clients WHERE user_id = ?', userId), 0);
  });

  test('un profesional no puede leer, editar, borrar ni agregar servicios a clientas de otro', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const created = await api('POST', '/api/clients', { full_name: 'Privada de A', phone: '+56922222222' }, a.token);
    const id = created.data.client.id;

    assert.equal((await api('GET', `/api/clients/${id}`, undefined, b.token)).status, 404);
    assert.equal((await api('PUT', `/api/clients/${id}`, { full_name: 'X', phone: '+56933333333' }, b.token)).status, 404);
    assert.equal((await api('DELETE', `/api/clients/${id}`, undefined, b.token)).status, 404);
    assert.equal((await api('POST', '/api/services', { client_id: id, service_type: 'Corte' }, b.token)).status, 404);
    assert.equal((await api('POST', '/api/contact-logs', { client_id: id }, b.token)).status, 404);
    assert.equal((await api('GET', '/api/clients', undefined, b.token)).data.total, 0);
    assert.equal((await api('GET', `/api/clients/${id}`, undefined, a.token)).status, 200);
  });

  test('eliminar una clienta elimina su historial y contactos (cascada)', async () => {
    const { token } = await registerUser();
    const c = await api('POST', '/api/clients', { full_name: 'Temporal', phone: '+56944444444', initial_service: { service_type: 'Color' } }, token);
    const id = c.data.client.id;
    await api('POST', '/api/services', { client_id: id, service_type: 'Retoque', amount_clp: 30000 }, token);
    await api('POST', '/api/contact-logs', { client_id: id, status: 'contacted' }, token);
    assert.equal(count('SELECT COUNT(*) AS n FROM client_service_history WHERE client_id = ?', id), 2);

    assert.equal((await api('DELETE', `/api/clients/${id}`, undefined, token)).status, 200);
    assert.equal(count('SELECT COUNT(*) AS n FROM client_service_history WHERE client_id = ?', id), 0);
    assert.equal(count('SELECT COUNT(*) AS n FROM contact_logs WHERE client_id = ?', id), 0);
  });

  test('validaciones: estado de contacto, fecha y monto negativos', async () => {
    const { token } = await registerUser();
    const c = await api('POST', '/api/clients', { full_name: 'Val', phone: '+56955555555' }, token);
    const id = c.data.client.id;
    assert.equal((await api('POST', '/api/contact-logs', { client_id: id, status: 'hackeado' }, token)).status, 400);
    assert.equal((await api('POST', '/api/services', { client_id: id, service_type: 'Corte', amount_clp: -5 }, token)).status, 400);
    assert.equal((await api('POST', '/api/re-engagement/status', { client_id: id, status: 'otro' }, token)).status, 400);
  });

  test('escrituras concurrentes no pierden registros', async () => {
    const { token, userId } = await registerUser();
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => api('POST', '/api/clients', { full_name: `Concurrente ${i}`, phone: `+5691000${String(i).padStart(4, '0')}` }, token))
    );
    assert.ok(results.every(r => r.status === 201));
    assert.equal(count('SELECT COUNT(*) AS n FROM clients WHERE user_id = ?', userId), 25);
  });

  test('dashboard, calendario, re-engagement y exportación responden con datos del usuario', async () => {
    const { token } = await registerUser();
    await api('POST', '/api/clients', { full_name: 'Dash', phone: '+56966666666', initial_service: { service_type: 'Balayage', amount_clp: 85000 } }, token);
    const stats = await api('GET', '/api/dashboard/stats', undefined, token);
    assert.equal(stats.status, 200);
    assert.equal(stats.data.total_clients, 1);
    assert.equal((await api('GET', '/api/calendar', undefined, token)).data.events.length, 2);
    assert.equal((await api('GET', '/api/re-engagement?threshold_days=1', undefined, token)).status, 200);
    const exp = await api('GET', '/api/backup/export', undefined, token);
    assert.equal(exp.data.clients.length, 1);
    assert.equal(exp.data.user.password_hash, undefined);
  });
});

describe('Licencias y pagos de suscripción', () => {
  test('activación idempotente: misma referencia no duplica pagos ni extiende dos veces', async () => {
    const { token, userId } = await registerUser();
    const [r1, r2] = await Promise.all([
      api('POST', '/api/subscriptions/activate-license', { plan_id: 'basic_monthly', payment_ref: 'REF-1' }, token),
      api('POST', '/api/subscriptions/activate-license', { plan_id: 'basic_monthly', payment_ref: 'REF-1' }, token),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(count('SELECT COUNT(*) AS n FROM subscription_payments WHERE user_id = ?', userId), 1);
    const current = await api('GET', '/api/subscriptions/current', undefined, token);
    assert.equal(current.data.subscription.status, 'active');
    assert.ok(current.data.subscription.days_remaining >= 43 && current.data.subscription.days_remaining <= 45);
    assert.equal(current.data.payments[0].amount_clp, 9990);
  });

  test('el precio sale del catálogo del backend y no se reutilizan referencias ajenas', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const res = await api('POST', '/api/subscriptions/activate-license', { plan_id: 'annual', payment_ref: 'REF-SHARED', amount_clp: 1 }, a.token);
    assert.equal(res.data.payment.amount_clp, 19990);
    assert.equal((await api('POST', '/api/subscriptions/activate-license', { plan_id: 'annual', payment_ref: 'REF-SHARED' }, b.token)).status, 409);
    assert.equal((await api('POST', '/api/subscriptions/activate-license', { plan_id: 'gratis' }, a.token)).status, 400);
  });

  test('checkout local se declara como simulación', async () => {
    const { token } = await registerUser();
    const res = await api('POST', '/api/payments/create-preference', { plan_id: 'pro_quarterly' }, token);
    assert.equal(res.status, 200);
    assert.equal(res.data.mode, 'local_simulation');
  });

  test('con PAYMENT_PROVIDER=mercadopago no se puede activar una licencia desde el cliente', async () => {
    const { token } = await registerUser();
    process.env.PAYMENT_PROVIDER = 'mercadopago';
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'token-de-prueba';
    try {
      assert.equal((await api('POST', '/api/subscriptions/activate-license', { plan_id: 'basic_monthly' }, token)).status, 403);
    } finally {
      process.env.PAYMENT_PROVIDER = 'local';
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    }
  });
});

describe('Migración desde JSON v1', () => {
  const legacyFile = path.join(tmpDir, 'legacy-v1.json');
  const legacy = {
    users: [{ id: 'usr_legacy_1', email: 'Legacy@Salon.cl', password_hash: hashPassword('Legacy123'), created_at: '2026-01-01T00:00:00Z' }],
    profiles: [{ id: 'prof_legacy_1', user_id: 'usr_legacy_1', full_name: 'Legacy Pro', business_name: 'Legacy Studio', phone: '+56911112222', country: 'Chile', currency: 'CLP', timezone: 'America/Santiago', default_interval_days: 30, whatsapp_template: 'Hola {nombre}', notification_preferences: { push_enabled: true, alert_time: '08:00', notify_days_before: 2 }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }],
    clients: [{ id: 'cli_legacy_1', user_id: 'usr_legacy_1', full_name: 'Clienta Legacy', phone: '+56933334444', notes: '', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }],
    services: [
      { id: 'srv_legacy_1', user_id: 'usr_legacy_1', client_id: 'cli_legacy_1', service_type: 'Tintura', service_date: '2026-01-02', amount_clp: 45000, recommended_interval_days: 30, next_retouch_date: '2026-02-01', created_at: '2026-01-02T00:00:00Z' },
      { id: 'srv_huerfano', user_id: 'usr_legacy_1', client_id: 'cli_no_existe', service_type: 'X', service_date: '2026-01-02', amount_clp: 1, recommended_interval_days: 30, next_retouch_date: '2026-02-01', created_at: '2026-01-02T00:00:00Z' },
    ],
    contact_logs: [{ id: 'log_legacy_1', user_id: 'usr_legacy_1', client_id: 'cli_legacy_1', contact_date: '2026-01-10T00:00:00Z', channel: 'whatsapp', status: 'contacted', created_at: '2026-01-10T00:00:00Z' }],
    subscriptions: [{ id: 'sub_legacy_1', user_id: 'usr_legacy_1', plan: 'pro_quarterly', status: 'active', start_date: '2026-01-01T00:00:00Z', expiration_date: '2099-01-01T00:00:00Z', payment_provider: 'mercadopago', created_at: '2026-01-01T00:00:00Z' }],
    payments: [{ id: 'pay_legacy_1', user_id: 'usr_legacy_1', amount_clp: 14990, currency: 'CLP', provider: 'mercadopago', provider_payment_id: 'MP_1', status: 'approved', plan: 'pro_quarterly', created_at: '2026-01-01T00:00:00Z' }],
  };

  before(() => fs.writeFileSync(legacyFile, JSON.stringify(legacy)));

  test('importa todos los registros válidos, respalda el JSON y omite huérfanos', async () => {
    const summary = importLegacyJson(legacyFile);
    assert.equal(summary.status, 'imported');
    assert.ok(summary.backup_file && fs.existsSync(summary.backup_file));
    assert.ok(fs.existsSync(legacyFile), 'el JSON original se conserva');
    for (const e of ['users', 'profiles', 'clients', 'contact_logs', 'subscriptions', 'payments'] as const) {
      assert.equal(summary.entities![e].inserted, 1, e);
      assert.equal(summary.entities![e].verified, 1, e);
    }
    assert.equal(summary.entities!.services.inserted, 1);
    assert.equal(summary.entities!.services.skipped, 1);

    const login = await api('POST', '/api/auth/login', { email: 'legacy@salon.cl', password: 'Legacy123' });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.profile.notification_preferences.alert_time, '08:00');
    const detail = await api('GET', '/api/clients/cli_legacy_1', undefined, login.data.token);
    assert.equal(detail.data.services.length, 1);
    assert.equal(detail.data.contact_logs.length, 1);
  });

  test('ejecutar la migración nuevamente no duplica registros', () => {
    assert.equal(importLegacyJson(legacyFile).status, 'already_imported');
    const forced = importLegacyJson(legacyFile, { force: true });
    assert.equal(forced.status, 'imported');
    assert.equal(forced.entities!.users.inserted, 0);
    assert.equal(forced.entities!.users.already_present, 1);
    assert.equal(count("SELECT COUNT(*) AS n FROM users WHERE id = 'usr_legacy_1'"), 1);
    assert.equal(count("SELECT COUNT(*) AS n FROM client_service_history WHERE user_id = 'usr_legacy_1'"), 1);
  });
});

describe('Datos demo', () => {
  test('seed es idempotente y reset solo afecta cuentas demo', async () => {
    const real = await registerUser();
    assert.equal(seedDemoData(), true);
    assert.equal(seedDemoData(), false);
    const demoLogin = await api('POST', '/api/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD });
    assert.equal(demoLogin.status, 200);
    assert.equal((await api('GET', '/api/clients', undefined, demoLogin.data.token)).data.total, 7);

    const { removedUsers } = resetDemoData();
    assert.equal(removedUsers, 5);
    assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE is_demo = 1'), 5);
    assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE id = ?', real.userId), 1);
  });
});

describe('Persistencia, respaldo y restauración', () => {
  test('los datos sobreviven a cerrar y reabrir la base', async () => {
    const { token } = await registerUser();
    const created = await api('POST', '/api/clients', { full_name: 'Persistente', phone: '+56977777777' }, token);
    closeDatabase();
    initDatabase(dbFile);
    assert.equal((await api('GET', `/api/clients/${created.data.client.id}`, undefined, token)).status, 200);
  });

  test('backup + restore recupera el estado respaldado y guarda copia previa', async () => {
    const { token } = await registerUser();
    const backupFile = await backupDatabase(path.join(tmpDir, 'manual-backup.sqlite'));
    const after = await api('POST', '/api/clients', { full_name: 'Posterior al respaldo', phone: '+56988888888' }, token);

    const result = await restoreDatabase(backupFile, dbFile);
    assert.ok(result.safetyBackup && fs.existsSync(result.safetyBackup));
    initDatabase(dbFile);
    assert.equal((await api('GET', `/api/clients/${after.data.client.id}`, undefined, token)).status, 404);
  });

  test('restore rechaza archivos que no son respaldos válidos', async () => {
    const bogus = path.join(tmpDir, 'bogus.sqlite');
    fs.writeFileSync(bogus, 'no soy sqlite');
    await assert.rejects(() => restoreDatabase(bogus, dbFile));
  });
});

describe('Errores centralizados', () => {
  test('JSON inválido y rutas inexistentes devuelven errores claros', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
    assert.equal(res.status, 400);
    assert.equal((await api('GET', '/api/no-existe')).status, 404);
  });
});
