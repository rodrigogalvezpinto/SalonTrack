import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { after, test } from 'node:test';
import { setupTestEnv, startServer, makeClient } from './helpers.js';
import { runMigrations } from '../server/db/migrate.js';

const testDir = setupTestEnv('fase2');
const { initDatabase, closeDatabase, getDatabase } = await import('../server/db/connection.js');
const mainDatabase = path.join(testDir, 'businesses.sqlite');
initDatabase(mainDatabase);
const { createApp } = await import('../server/app.js');
const { rolesRepository } = await import('../server/repositories/roles.js');
const { seedDemoData, resetDemoData } = await import('../server/db/seed.js');
const { server, baseUrl } = await startServer(createApp());
const api = makeClient(baseUrl);
let counter = 0;
let registrationIp = 0;

async function register(accountType: 'professional' | 'customer' = 'professional') {
  const id = ++counter;
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${++registrationIp}` },
    body: JSON.stringify({
    email: `fase2-${id}@example.cl`,
    password: 'Salon1234',
    full_name: `Persona ${id}`,
    business_name: `Negocio ${id}`,
    phone: '+56987654321',
    account_type: accountType,
    }),
  });
  const result = { status: response.status, data: await response.json() as any };
  assert.equal(result.status, 201);
  return { token: result.data.token as string, user: result.data.user, email: `fase2-${id}@example.cl` };
}

async function createBusiness(token: string, name = `Nuevo negocio ${++counter}`) {
  const result = await api('POST', '/api/businesses', { name }, token);
  assert.equal(result.status, 201);
  return result.data.business;
}

async function completeBusiness(token: string, businessId: string, extra: Record<string, unknown> = {}) {
  return api('PATCH', `/api/businesses/${businessId}`, {
    primary_category: 'Peluquería',
    phone: '+56987654321',
    commune: 'Providencia',
    region: 'Región Metropolitana',
    address: 'Av. Providencia 123',
    latitude: -33.4314,
    longitude: -70.6093,
    ...extra,
  }, token);
}

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  closeDatabase();
});

test('registro de cliente: rol único, sin membresía ni acceso al CRM', async () => {
  const { token, user } = await register('customer');
  assert.deepEqual(user.roles, ['CUSTOMER']);
  assert.deepEqual(user.memberships, []);
  assert.equal(user.subscription, undefined);
  assert.equal((await api('GET', '/api/profile', undefined, token)).status, 200);
  assert.equal((await api('GET', '/api/subscriptions/plans')).status, 200);
  assert.equal((await api('GET', '/api/clients', undefined, token)).status, 403);
});

test('registro profesional crea negocio borrador y membresía OWNER', async () => {
  const { token, user } = await register();
  assert.ok(user.roles.includes('PROFESSIONAL'));
  assert.equal(user.memberships.length, 1);
  assert.equal(user.memberships[0].status, 'DRAFT');
  assert.equal(user.memberships[0].role, 'OWNER');
  const mine = await api('GET', '/api/businesses/mine', undefined, token);
  assert.equal(mine.data.businesses.length, 1);
  assert.equal(mine.data.businesses[0].my_role, 'OWNER');
  assert.equal((await api('GET', '/api/clients', undefined, token)).status, 200);
});

test('cliente crea un negocio y habilita su rol profesional sin cambiar el token', async () => {
  const { token } = await register('customer');
  const created = await api('POST', '/api/businesses', { name: 'Servicios de Cliente' }, token);
  assert.equal(created.status, 201);
  assert.equal(created.data.business.status, 'DRAFT');
  assert.equal(created.data.my_role, 'OWNER');
  assert.equal((await api('GET', '/api/clients', undefined, token)).status, 200);
  const session = await api('GET', '/api/auth/me', undefined, token);
  assert.ok(session.data.user.roles.includes('PROFESSIONAL'));
  assert.equal(session.data.user.memberships.length, 1);
});

test('un propietario no puede consultar ni modificar un negocio ajeno', async () => {
  const ownerA = await register();
  const ownerB = await register();
  const businessA = await createBusiness(ownerA.token, 'Negocio A');
  const businessB = await createBusiness(ownerB.token, 'Negocio B');
  assert.equal((await api('GET', `/api/businesses/${businessB.id}`, undefined, ownerA.token)).status, 404);
  assert.equal((await api('PATCH', `/api/businesses/${businessB.id}`, { name: 'Cambio' }, ownerA.token)).status, 404);
  assert.equal((await api('POST', `/api/businesses/${businessB.id}/status`, { status: 'PUBLISHED' }, ownerA.token)).status, 404);
  assert.equal((await api('GET', `/api/businesses/${businessB.id}/members`, undefined, ownerA.token)).status, 404);
  assert.ok(businessA.id);
});

test('RECEPTION y PROFESSIONAL ven el negocio pero no pueden editarlo ni administrar integrantes', async () => {
  const owner = await register();
  const reception = await register('customer');
  const professional = await register('customer');
  const business = await createBusiness(owner.token, 'Equipo SalonTrack');
  const addReception = await api('POST', `/api/businesses/${business.id}/members`, { email: reception.email, role: 'RECEPTION' }, owner.token);
  const addProfessional = await api('POST', `/api/businesses/${business.id}/members`, { email: professional.email, role: 'PROFESSIONAL' }, owner.token);
  for (const member of [reception, professional]) {
    assert.equal((await api('GET', `/api/businesses/${business.id}`, undefined, member.token)).status, 200);
    assert.equal((await api('GET', `/api/businesses/${business.id}/members`, undefined, member.token)).status, 200);
    assert.equal((await api('PATCH', `/api/businesses/${business.id}`, { name: 'No autorizado' }, member.token)).status, 403);
    assert.equal((await api('POST', `/api/businesses/${business.id}/members`, { email: `other-${counter}@example.cl`, role: 'PROFESSIONAL' }, member.token)).status, 403);
  }
  assert.ok(addReception.data.member.id);
  assert.ok(addProfessional.data.member.id);
});

test('ADMIN de negocio solo gestiona roles PROFESSIONAL y RECEPTION; no altera su propio rol', async () => {
  const owner = await register();
  const admin = await register('customer');
  const worker = await register('customer');
  const business = await createBusiness(owner.token, 'Negocio con administración');
  const adminMember = await api('POST', `/api/businesses/${business.id}/members`, { email: admin.email, role: 'ADMIN' }, owner.token);
  const workerMember = await api('POST', `/api/businesses/${business.id}/members`, { email: worker.email, role: 'PROFESSIONAL' }, owner.token);
  assert.equal((await api('POST', `/api/businesses/${business.id}/members`, { email: `nuevo-${counter}@example.cl`, role: 'OWNER' }, admin.token)).status, 403);
  assert.equal((await api('POST', `/api/businesses/${business.id}/members`, { email: `nuevo-${counter}@example.cl`, role: 'ADMIN' }, admin.token)).status, 403);
  assert.equal((await api('PATCH', `/api/businesses/${business.id}/members/${workerMember.data.member.id}`, { role: 'ADMIN' }, admin.token)).status, 403);
  assert.equal((await api('PATCH', `/api/businesses/${business.id}/members/${adminMember.data.member.id}`, { role: 'PROFESSIONAL' }, admin.token)).status, 403);
  assert.equal((await api('PATCH', `/api/businesses/${business.id}/members/${workerMember.data.member.id}`, { role: 'RECEPTION' }, worker.token)).status, 403);
});

test('último OWNER no se desactiva; puede promover a otro y un segundo OWNER puede cambiarlo', async () => {
  const owner = await register();
  const other = await register('customer');
  const business = await createBusiness(owner.token, 'Propietarios');
  const owners = await api('GET', `/api/businesses/${business.id}/members`, undefined, owner.token);
  const ownerMember = owners.data.members.find((member: any) => member.user_id === owner.user.id);
  assert.equal((await api('PATCH', `/api/businesses/${business.id}/members/${ownerMember.id}`, { status: 'INACTIVE' }, owner.token)).status, 409);
  const otherMember = await api('POST', `/api/businesses/${business.id}/members`, { email: other.email, role: 'PROFESSIONAL' }, owner.token);
  assert.ok((await api('GET', '/api/auth/me', undefined, other.token)).data.user.roles.includes('PROFESSIONAL'));
  assert.equal((await api('PATCH', `/api/businesses/${business.id}/members/${otherMember.data.member.id}`, { role: 'OWNER' }, owner.token)).status, 200);
  const demoted = await api('PATCH', `/api/businesses/${business.id}/members/${ownerMember.id}`, { role: 'PROFESSIONAL' }, other.token);
  assert.equal(demoted.status, 200);
  assert.equal(demoted.data.member.role, 'PROFESSIONAL');
});

test('miembros requieren una cuenta y las membresías inactivas se reactivan', async () => {
  const owner = await register();
  const member = await register('customer');
  const business = await createBusiness(owner.token);
  assert.equal((await api('POST', `/api/businesses/${business.id}/members`, { email: 'ausente@example.cl', role: 'PROFESSIONAL' }, owner.token)).status, 404);
  const added = await api('POST', `/api/businesses/${business.id}/members`, { email: member.email, role: 'PROFESSIONAL' }, owner.token);
  assert.equal((await api('POST', `/api/businesses/${business.id}/members`, { email: member.email, role: 'RECEPTION' }, owner.token)).status, 409);
  assert.equal((await api('PATCH', `/api/businesses/${business.id}/members/${added.data.member.id}`, { status: 'INACTIVE' }, owner.token)).status, 200);
  assert.equal((await api('GET', `/api/businesses/${business.id}`, undefined, member.token)).status, 404);
  const reactivated = await api('POST', `/api/businesses/${business.id}/members`, { email: member.email, role: 'RECEPTION' }, owner.token);
  assert.equal(reactivated.status, 201);
  assert.equal(reactivated.data.member.status, 'ACTIVE');
  assert.equal(reactivated.data.member.role, 'RECEPTION');
});

test('publicación valida requisitos, registra publicación y respeta la revisión manual', async () => {
  const owner = await register();
  const business = await createBusiness(owner.token);
  const incomplete = await api('POST', `/api/businesses/${business.id}/status`, { status: 'PUBLISHED' }, owner.token);
  assert.equal(incomplete.status, 400);
  assert.ok(incomplete.data.details.length > 0);
  await completeBusiness(owner.token, business.id);
  const published = await api('POST', `/api/businesses/${business.id}/status`, { status: 'PUBLISHED' }, owner.token);
  assert.equal(published.status, 200);
  assert.equal(published.data.business.status, 'PUBLISHED');
  assert.ok(published.data.business.published_at);

  const admin = await register('customer');
  rolesRepository.addRole(admin.user.id, 'PLATFORM_ADMIN');
  assert.equal((await api('PUT', '/api/admin/settings', { business_publication_requires_review: true }, admin.token)).status, 200);
  const waiting = await register();
  const reviewBusiness = await createBusiness(waiting.token);
  await completeBusiness(waiting.token, reviewBusiness.id);
  const review = await api('POST', `/api/businesses/${reviewBusiness.id}/status`, { status: 'PUBLISHED' }, waiting.token);
  assert.equal(review.data.business.status, 'PENDING_REVIEW');
  assert.equal((await api('POST', `/api/admin/businesses/${reviewBusiness.id}/status`, { status: 'DRAFT' }, admin.token)).status, 400);
  const approved = await api('POST', `/api/admin/businesses/${reviewBusiness.id}/status`, { status: 'PUBLISHED' }, admin.token);
  assert.equal(approved.data.business.status, 'PUBLISHED');
  await api('PUT', '/api/admin/settings', { business_publication_requires_review: false }, admin.token);
});

test('edición no puede romper requisitos de publicación y PATCH no cambia el estado', async () => {
  const owner = await register();
  const business = await createBusiness(owner.token);
  await completeBusiness(owner.token, business.id);
  await api('POST', `/api/businesses/${business.id}/status`, { status: 'PUBLISHED' }, owner.token);
  const invalidEdit = await api('PATCH', `/api/businesses/${business.id}`, { primary_category: '' }, owner.token);
  assert.equal(invalidEdit.status, 400);
  const statusEdit = await api('PATCH', `/api/businesses/${business.id}`, { status: 'DRAFT' }, owner.token);
  assert.equal(statusEdit.status, 200);
  assert.equal(statusEdit.data.business.status, 'PUBLISHED');
});

test('suspensión requiere motivo y los negocios suspendidos no son públicos', async () => {
  const owner = await register();
  const admin = await register('customer');
  rolesRepository.addRole(admin.user.id, 'PLATFORM_ADMIN');
  const business = await createBusiness(owner.token);
  await completeBusiness(owner.token, business.id);
  await api('POST', `/api/businesses/${business.id}/status`, { status: 'PUBLISHED' }, owner.token);
  assert.equal((await api('POST', `/api/admin/businesses/${business.id}/status`, { status: 'SUSPENDED' }, admin.token)).status, 400);
  const suspended = await api('POST', `/api/admin/businesses/${business.id}/status`, { status: 'SUSPENDED', reason: 'Revisión administrativa' }, admin.token);
  assert.equal(suspended.data.business.status, 'SUSPENDED');
  assert.equal((await api('POST', `/api/businesses/${business.id}/status`, { status: 'PUBLISHED' }, owner.token)).status, 403);
  assert.equal((await api('GET', `/api/public/businesses/${business.slug}`)).status, 404);
  const list = await api('GET', '/api/public/businesses');
  assert.ok(!list.data.businesses.some((item: any) => item.id === business.id));
  assert.equal((await api('POST', `/api/admin/businesses/${business.id}/status`, { status: 'DRAFT' }, admin.token)).status, 200);
});

test('DTO público oculta dirección exacta, redondea coordenadas y excluye datos privados', async () => {
  const owner = await register();
  const worker = await register('customer');
  const business = await createBusiness(owner.token, 'Perfil Público');
  await completeBusiness(owner.token, business.id, { hide_exact_address: true, status_reason: 'privado' });
  await api('POST', `/api/businesses/${business.id}/members`, { email: worker.email, role: 'PROFESSIONAL' }, owner.token);
  await api('POST', `/api/businesses/${business.id}/status`, { status: 'PUBLISHED' }, owner.token);
  const response = await api('GET', `/api/public/businesses/${business.slug}`);
  assert.equal(response.status, 200);
  const dto = response.data.business;
  assert.equal(dto.address, undefined);
  assert.equal(dto.latitude, -33.43);
  assert.equal(dto.longitude, -70.61);
  assert.equal(dto.status_reason, undefined);
  assert.equal(dto.created_by, undefined);
  assert.equal(dto.is_demo, undefined);
  assert.ok(dto.team.every((item: any) => !('email' in item) && !('user_id' in item)));
});

test('administración está protegida y nunca expone password_hash', async () => {
  const customer = await register('customer');
  assert.equal((await api('GET', '/api/admin/users', undefined, customer.token)).status, 403);
  assert.equal((await api('GET', '/api/admin/businesses', undefined, customer.token)).status, 403);
  const admin = await register('customer');
  rolesRepository.addRole(admin.user.id, 'PLATFORM_ADMIN');
  const users = await api('GET', '/api/admin/users', undefined, admin.token);
  assert.equal(users.status, 200);
  assert.ok(users.data.users.every((user: any) => !('password_hash' in user)));
  const businesses = await api('GET', '/api/admin/businesses', undefined, admin.token);
  assert.equal(businesses.status, 200);
});

test('slug con acentos, sufijo único y cambio duplicado rechazado', async () => {
  const owner = await register();
  const first = await createBusiness(owner.token, 'Peluquería Ñuñoa');
  const second = await createBusiness(owner.token, 'Peluquería Ñuñoa');
  assert.equal(first.slug, 'peluqueria-nunoa');
  assert.equal(second.slug, 'peluqueria-nunoa-2');
  assert.equal((await api('PATCH', `/api/businesses/${second.id}`, { slug: first.slug }, owner.token)).status, 409);
});

test('slugify y requisitos de publicación cubren normalización y modalidades', async () => {
  const { slugify, getPublicationIssues } = await import('../server/services/businesses.js');
  assert.equal(slugify('Peluquería Ñuñoa'), 'peluqueria-nunoa');
  const incomplete = {
    name: '', primary_category: null, phone: null, whatsapp: null, commune: null, region: null,
    offers_in_store: false, offers_home_visit: false, offers_remote: false,
    address: null, latitude: null, longitude: null, home_service_communes: [], home_service_radius_km: null,
  };
  assert.ok(getPublicationIssues(incomplete as any).length >= 4);
  const complete = {
    ...incomplete, name: 'Salón', primary_category: 'Peluquería', phone: '+56912345678',
    commune: 'Ñuñoa', region: 'Región Metropolitana', offers_in_store: true,
    address: 'Calle 1', latitude: -33.4, longitude: -70.6,
  };
  assert.deepEqual(getPublicationIssues(complete as any), []);
});

test('migración 002 retrocompleta roles y negocio OWNER para perfiles existentes', () => {
  const migrations = path.resolve('server/db/migrations');
  const only001 = fs.mkdtempSync(path.join(os.tmpdir(), 'salontrack-migration-'));
  fs.copyFileSync(path.join(migrations, '001_initial_schema.sql'), path.join(only001, '001_initial_schema.sql'));
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, only001);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, email, password_hash, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('usr_backfill', 'backfill@example.cl', 'hash', 0, now, now);
  db.prepare(`INSERT INTO user_profiles
    (id, user_id, full_name, business_name, phone, country, currency, timezone, default_interval_days, whatsapp_template, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('prof_backfill', 'usr_backfill', 'Perfil Anterior', 'Salón Anterior', '+56911111111', 'Chile', 'CLP', 'America/Santiago', 30, '', now, now);
  runMigrations(db, migrations);
  assert.deepEqual((db.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role').all('usr_backfill') as any[]).map(row => row.role), ['CUSTOMER', 'PROFESSIONAL']);
  const business = db.prepare(`SELECT b.name, b.status, bm.role, bm.display_name FROM businesses b
    JOIN business_members bm ON bm.business_id = b.id WHERE b.created_by = ?`).get('usr_backfill') as any;
  assert.deepEqual(business, { name: 'Salón Anterior', status: 'DRAFT', role: 'OWNER', display_name: 'Perfil Anterior' });
  db.close();
  fs.rmSync(only001, { recursive: true, force: true });
});

test('importación JSON agrega roles y negocio al profesional recién importado', async () => {
  const legacyFile = path.join(testDir, 'legacy-fase2.json');
  const now = new Date().toISOString();
  fs.writeFileSync(legacyFile, JSON.stringify({
    users: [{ id: 'usr_legacy_fase2', email: 'legacy-fase2@example.cl', password_hash: 'hash', created_at: now }],
    profiles: [{
      id: 'prof_legacy_fase2', user_id: 'usr_legacy_fase2', full_name: 'Profesional importada',
      business_name: 'Estudio importado', phone: '+56911112222', created_at: now, updated_at: now,
    }],
  }));
  const { importLegacyJson } = await import('../server/db/legacyImport.js');
  assert.equal(importLegacyJson(legacyFile).status, 'imported');
  assert.deepEqual(rolesRepository.listRoles('usr_legacy_fase2'), ['CUSTOMER', 'PROFESSIONAL']);
  const business = (await import('../server/repositories/businesses.js')).businessesRepository.listForUser('usr_legacy_fase2')[0];
  assert.equal(business.name, 'Estudio importado');
  assert.equal(business.status, 'DRAFT');
  assert.equal(business.my_role, 'OWNER');
});

test('cuentas demo: credenciales, negocios públicos y reset conserva cuentas reales', async () => {
  const demoDatabase = path.join(testDir, 'demo.sqlite');
  initDatabase(demoDatabase);
  const real = await register();
  assert.equal(seedDemoData(), true);
  assert.equal(seedDemoData(), false);

  const demoCredentials = [
    ['contacto@valeriaestudio.cl', 'Salon1234'],
    ['admin@demo.salontrack.cl', 'Admin1234'],
    ['cliente@demo.salontrack.cl', 'Cliente1234'],
    ['dueno@demo.salontrack.cl', 'Dueno1234'],
    ['trabajador@demo.salontrack.cl', 'Staff1234'],
  ];
  const sessions: Record<string, any> = {};
  for (const [email, password] of demoCredentials) {
    const result = await api('POST', '/api/auth/login', { email, password });
    assert.equal(result.status, 200, email);
    sessions[email] = result.data;
  }
  assert.deepEqual(sessions['contacto@valeriaestudio.cl'].user.roles, ['CUSTOMER', 'PROFESSIONAL']);
  assert.equal(sessions['contacto@valeriaestudio.cl'].user.memberships[0].status, 'PUBLISHED');
  assert.deepEqual(sessions['admin@demo.salontrack.cl'].user.roles, ['CUSTOMER', 'PLATFORM_ADMIN']);
  assert.deepEqual(sessions['admin@demo.salontrack.cl'].user.memberships, []);
  assert.deepEqual(sessions['cliente@demo.salontrack.cl'].user.roles, ['CUSTOMER']);
  assert.deepEqual(sessions['cliente@demo.salontrack.cl'].user.memberships, []);
  assert.deepEqual(sessions['dueno@demo.salontrack.cl'].user.roles, ['CUSTOMER', 'PROFESSIONAL']);
  assert.ok(sessions['admin@demo.salontrack.cl'].user.roles.includes('PLATFORM_ADMIN'));
  assert.equal(sessions['dueno@demo.salontrack.cl'].user.memberships.length, 2);
  assert.deepEqual(sessions['trabajador@demo.salontrack.cl'].user.roles, ['PROFESSIONAL']);
  assert.equal(sessions['trabajador@demo.salontrack.cl'].user.memberships[0].role, 'PROFESSIONAL');
  const staffTeam = await api('GET', `/api/businesses/${sessions['dueno@demo.salontrack.cl'].user.memberships[0].business_id}/members`, undefined, sessions['dueno@demo.salontrack.cl'].token);
  assert.ok(staffTeam.data.members.some((member: any) => member.title === 'Barbero'));
  assert.equal((await api('GET', '/api/clients', undefined, sessions['contacto@valeriaestudio.cl'].token)).data.total, 7);
  const publicList = await api('GET', '/api/public/businesses');
  assert.deepEqual(new Set(publicList.data.businesses.map((business: any) => business.name)), new Set(['Valeria Henríquez Color Studio', 'Barbería Central']));
  const valeria = await api('GET', '/api/public/businesses/valeria-henriquez-color-studio');
  assert.equal(valeria.data.business.address, undefined);
  assert.equal(valeria.data.business.latitude, -33.43);
  assert.equal(valeria.data.business.longitude, -70.61);

  const reset = resetDemoData();
  assert.equal(reset.removedUsers, 5);
  assert.equal((getDatabase().prepare('SELECT COUNT(*) AS n FROM users WHERE is_demo = 1').get() as any).n, 5);
  assert.equal((getDatabase().prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(real.user.id) as any).n, 1);
  closeDatabase();
  initDatabase(mainDatabase);
});
