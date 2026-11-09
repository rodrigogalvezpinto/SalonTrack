import { hashPassword } from '../auth.js';
import { generateId, transaction, type Client, type Profile, type Service, type Subscription, type User } from '../db.js';
import { usersRepository } from '../repositories/users.js';
import { profilesRepository } from '../repositories/profiles.js';
import { clientsRepository } from '../repositories/clients.js';
import { serviceHistoryRepository } from '../repositories/serviceHistory.js';
import { subscriptionsRepository } from '../repositories/subscriptions.js';
import { rolesRepository } from '../repositories/roles.js';
import { businessesRepository } from '../repositories/businesses.js';
import { membersRepository } from '../repositories/members.js';
import { ensureProfessionalSetup } from '../services/businesses.js';

export const DEMO_EMAIL = 'contacto@valeriaestudio.cl';
export const DEMO_PASSWORD = 'Salon1234';
export const LEGACY_DEMO_USER_ID = 'usr_demo_valeria_estilista';
const DEMO_ACCOUNTS = [
  { email: 'admin@demo.salontrack.cl', password: 'Admin1234', name: 'Administración Demo' },
  { email: 'cliente@demo.salontrack.cl', password: 'Cliente1234', name: 'Cliente Demo' },
  { email: 'dueno@demo.salontrack.cl', password: 'Dueno1234', name: 'Dueño Demo' },
  { email: 'trabajador@demo.salontrack.cl', password: 'Staff1234', name: 'Trabajador Demo' },
];

/** Inserta los datos CRM de Valeria si su cuenta aún no existe. */
function seedValeriaDemoData(): boolean {
  if (usersRepository.findByEmail(DEMO_EMAIL)) return false;

  const demoUserId = LEGACY_DEMO_USER_ID;
  const hashedPassword = hashPassword(DEMO_PASSWORD);

  const demoUser: User = {
    id: demoUserId,
    email: DEMO_EMAIL,
    is_demo: true,
    password_hash: hashedPassword,
    created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
  };

  const demoProfile: Profile = {
    id: generateId('prof'),
    user_id: demoUserId,
    full_name: 'Valeria Henríquez',
    business_name: 'Valeria Henríquez Color Studio',
    phone: '+56987654321',
    country: 'Chile',
    currency: 'CLP',
    timezone: 'America/Santiago',
    default_interval_days: 30,
    whatsapp_template: '¡Hola {nombre}! Te saluda {salon} ✨ Te escribo porque ya se aproxima la fecha recomendada para realizar tu retoque de {servicio}. ¿Coordinamos tu hora para tener tu cabello impecable? 💇‍♀️',
    re_engagement_template: '¡Hola {nombre}! En {salon} te extrañamos un montón 💕 Vimos que han pasado varias semanas desde tu último {servicio}. Queremos invitarte a renovar tu look con un beneficio especial: 15% de descuento en tu retoque o baño de luz si reservas esta semana. ¿Te gustaría agendar? ✨💇‍♀️',
    re_engagement_days_threshold: 90,
    notification_preferences: {
      push_enabled: true,
      alert_time: '09:00',
      notify_days_before: 3,
      sound_enabled: true,
    },
    created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
    updated_at: new Date('2026-09-01T10:00:00Z').toISOString(),
  };

  // Demo active subscription (3 months license)
  const now = new Date();
  const expires = new Date();
  expires.setDate(expires.getDate() + 45); // 45 days remaining

  const demoSubscription: Subscription = {
    id: generateId('sub'),
    user_id: demoUserId,
    plan: 'pro_quarterly',
    status: 'active',
    start_date: new Date('2026-09-01T00:00:00Z').toISOString(),
    expiration_date: expires.toISOString(),
    payment_provider: 'local',
    created_at: new Date('2026-09-01T00:00:00Z').toISOString(),
  };

  // Chilean sample clients
  const client1Id = generateId('cli');
  const client2Id = generateId('cli');
  const client3Id = generateId('cli');
  const client4Id = generateId('cli');
  const client5Id = generateId('cli');

  // Dates for retouches
  const today = new Date();
  
  // Overdue by 4 days
  const dOverdue = new Date(today);
  dOverdue.setDate(dOverdue.getDate() - 34);
  const dOverdueNext = new Date(dOverdue);
  dOverdueNext.setDate(dOverdueNext.getDate() + 30); // 4 days ago

  // Due today
  const dTodayService = new Date(today);
  dTodayService.setDate(dTodayService.getDate() - 30);
  const dTodayNext = new Date(today);

  // Due this week (+3 days)
  const dThisWeekService = new Date(today);
  dThisWeekService.setDate(dThisWeekService.getDate() - 27);
  const dThisWeekNext = new Date(today);
  dThisWeekNext.setDate(dThisWeekNext.getDate() + 3);

  // Due in 12 days
  const dUpcomingService = new Date(today);
  dUpcomingService.setDate(dUpcomingService.getDate() - 18);
  const dUpcomingNext = new Date(today);
  dUpcomingNext.setDate(dUpcomingNext.getDate() + 12);

  // Balayage due in 25 days (60 days interval)
  const dBalayageService = new Date(today);
  dBalayageService.setDate(dBalayageService.getDate() - 35);
  const dBalayageNext = new Date(today);
  dBalayageNext.setDate(dBalayageNext.getDate() + 25);

  const clients = [
    {
      id: client1Id,
      user_id: demoUserId,
      full_name: 'María Paz Contreras',
      phone: '+56991234567',
      notes: 'Prefiere atención viernes en la tarde. Cuero cabelludo sensible.',
      created_at: dOverdue.toISOString(),
      updated_at: dOverdue.toISOString(),
    },
    {
      id: client2Id,
      user_id: demoUserId,
      full_name: 'Carolina Silva Morales',
      phone: '+56982345678',
      notes: 'Fanática de tonos fríos cenizas. Siempre pide café cortado.',
      created_at: dTodayService.toISOString(),
      updated_at: dTodayService.toISOString(),
    },
    {
      id: client3Id,
      user_id: demoUserId,
      full_name: 'Daniela Andrea Rojas',
      phone: '+56973456789',
      notes: 'Pelo fino, usar plex siempre en la decoloración.',
      created_at: dThisWeekService.toISOString(),
      updated_at: dThisWeekService.toISOString(),
    },
    {
      id: client4Id,
      user_id: demoUserId,
      full_name: 'Paula Venegas Castro',
      phone: '+56964567890',
      notes: 'Vive en Providencia. Avisar 3 días antes de su retoque.',
      created_at: dUpcomingService.toISOString(),
      updated_at: dUpcomingService.toISOString(),
    },
    {
      id: client5Id,
      user_id: demoUserId,
      full_name: 'Camila Muñoz Lagos',
      phone: '+56955678901',
      notes: 'Balayage miel avellana. Mantener raíz natural esfumada.',
      created_at: dBalayageService.toISOString(),
      updated_at: dBalayageService.toISOString(),
    },
    {
      id: generateId('cli'),
      user_id: demoUserId,
      full_name: 'Francisca Valenzuela Ruiz',
      phone: '+56944567890',
      notes: 'Cliente habitual de color global. No ha venido hace más de 3 meses.',
      re_engagement_status: 'none' as const,
      created_at: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('cli'),
      user_id: demoUserId,
      full_name: 'Valentina Soto Miranda',
      phone: '+56933456789',
      notes: 'Retoque de raíz y corte. No viene hace 6 meses.',
      re_engagement_status: 'recontacted' as const,
      created_at: new Date(Date.now() - 195 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 195 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const services = [
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: client1Id,
      service_type: 'Tintura Raíz y Brillo',
      color_formula: 'Majirel 6.1 (35g) + 6.0 (15g) + Ox 20vol (75ml)',
      tint_brand: "L'Oréal Professionnel",
      service_date: dOverdue.toISOString().split('T')[0],
      amount_clp: 45000,
      recommended_interval_days: 30,
      next_retouch_date: dOverdueNext.toISOString().split('T')[0],
      notes: 'Cubrimiento 100% canas en sienes.',
      created_at: dOverdue.toISOString(),
    },
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: client2Id,
      service_type: 'Retoque Raíz & Baño de Luz',
      color_formula: 'Igora Royal 7-1 (40g) + 0-22 (2cm) + Ox 20vol',
      tint_brand: 'Schwarzkopf Igora',
      service_date: dTodayService.toISOString().split('T')[0],
      amount_clp: 55000,
      recommended_interval_days: 30,
      next_retouch_date: dTodayNext.toISOString().split('T')[0],
      notes: 'Matizar largos con 9.5-1.',
      created_at: dTodayService.toISOString(),
    },
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: client3Id,
      service_type: 'Babylights & Matiz Ceniza',
      color_formula: 'Deco Blondor + 20vol + Matiz Color Touch 9/16',
      tint_brand: 'Wella Professionals',
      service_date: dThisWeekService.toISOString().split('T')[0],
      amount_clp: 68000,
      recommended_interval_days: 30,
      next_retouch_date: dThisWeekNext.toISOString().split('T')[0],
      notes: 'Incluye tratamiento Olaplex paso 2.',
      created_at: dThisWeekService.toISOString(),
    },
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: client4Id,
      service_type: 'Color Global & Corte Puntas',
      color_formula: 'Inoa 5.35 (50g) + Ox 20vol Inoa (50g)',
      tint_brand: "L'Oréal Inoa (Sin Amoníaco)",
      service_date: dUpcomingService.toISOString().split('T')[0],
      amount_clp: 50000,
      recommended_interval_days: 30,
      next_retouch_date: dUpcomingNext.toISOString().split('T')[0],
      notes: 'Cabello muy hidratado, sellar con sérum de argán.',
      created_at: dUpcomingService.toISOString(),
    },
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: client5Id,
      service_type: 'Balayage Caramelo & Tonalización',
      color_formula: 'Deco Freelights + 30vol. Tono Dialight 8.31',
      tint_brand: "L'Oréal Professionnel",
      service_date: dBalayageService.toISOString().split('T')[0],
      amount_clp: 85000,
      recommended_interval_days: 60,
      next_retouch_date: dBalayageNext.toISOString().split('T')[0],
      notes: 'Raíz esfumada para crecimiento suave.',
      created_at: dBalayageService.toISOString(),
    },
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: clients[5].id,
      service_type: 'Color Global & Baño de Luz',
      color_formula: 'Majirel 5.15 (45g) + Ox 20vol (70ml)',
      tint_brand: "L'Oréal Professionnel",
      service_date: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount_clp: 52000,
      recommended_interval_days: 30,
      next_retouch_date: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Clienta inactiva por más de 3 meses.',
      created_at: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId('srv'),
      user_id: demoUserId,
      client_id: clients[6].id,
      service_type: 'Tintura Raíz & Tratamiento Kérastase',
      color_formula: 'Igora Royal 6-0 (50g) + Ox 20vol (50ml)',
      tint_brand: 'Schwarzkopf Igora',
      service_date: new Date(Date.now() - 195 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount_clp: 60000,
      recommended_interval_days: 30,
      next_retouch_date: new Date(Date.now() - 165 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Clienta inactiva por más de 6 meses.',
      created_at: new Date(Date.now() - 195 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  transaction(() => {
    usersRepository.insert(demoUser);
    profilesRepository.insert(demoProfile);
    subscriptionsRepository.insert(demoSubscription);
    clients.forEach(c => clientsRepository.insert(c as Client));
    services.forEach(s => serviceHistoryRepository.insert(s as Service));
  });
  ensureProfessionalSetup(demoUserId, {
    businessName: demoProfile.business_name,
    phone: demoProfile.phone,
    fullName: demoProfile.full_name,
    isDemo: true,
  });
  const valeriaBusiness = businessesRepository.listForUser(demoUserId)[0];
  if (!valeriaBusiness?.id) throw new Error('No se pudo crear el negocio demo de Valeria.');
  businessesRepository.update(valeriaBusiness.id, {
    name: 'Valeria Henríquez Color Studio',
    slug: 'valeria-henriquez-color-studio',
    description: 'Color, balayage y cuidado capilar personalizado en Providencia.',
    primary_category: 'Peluquería',
    specialties: ['Coloración', 'Balayage'],
    address: 'Av. Providencia 1234',
    commune: 'Providencia',
    region: 'Región Metropolitana',
    latitude: -33.4314,
    longitude: -70.6093,
    offers_in_store: true,
    offers_home_visit: true,
    home_service_communes: ['Providencia', 'Ñuñoa', 'Las Condes'],
    hide_exact_address: true,
    status: 'PUBLISHED',
    published_at: new Date().toISOString(),
  });
  if (process.env.NODE_ENV !== 'test') console.log('Datos demo cargados para el entorno de pruebas chileno.');
  return true;
}

function demoProfile(userId: string, fullName: string, businessName: string, phone = ''): Profile {
  const now = new Date().toISOString();
  return {
    id: generateId('prof'),
    user_id: userId,
    full_name: fullName,
    business_name: businessName,
    phone,
    country: 'Chile',
    currency: 'CLP',
    timezone: 'America/Santiago',
    default_interval_days: 30,
    whatsapp_template: '',
    created_at: now,
    updated_at: now,
  };
}

function insertDemoAccount(email: string, password: string, name: string, businessName = name) {
  const existing = usersRepository.findByEmail(email);
  if (existing) return undefined;
  const now = new Date().toISOString();
  const user: User = {
    id: generateId('usr'),
    email,
    password_hash: hashPassword(password),
    is_demo: true,
    created_at: now,
    updated_at: now,
  };
  transaction(() => {
    usersRepository.insert(user);
    profilesRepository.insert(demoProfile(user.id, name, businessName));
  });
  return user;
}

function demoBusiness(ownerId: string, fields: Partial<import('../services/businesses.js').Business> & Pick<import('../services/businesses.js').Business, 'name' | 'slug' | 'primary_category' | 'commune' | 'region'>) {
  const current = new Date().toISOString();
  const business = businessesRepository.insert({
    id: generateId('biz'),
    slug: fields.slug,
    name: fields.name,
    description: '',
    logo_url: null,
    cover_url: null,
    primary_category: fields.primary_category,
    specialties: [],
    phone: '+56955550000',
    whatsapp: '+56955550000',
    email: null,
    website: null,
    instagram: null,
    facebook: null,
    address: null,
    commune: fields.commune,
    region: fields.region,
    country: 'Chile',
    latitude: null,
    longitude: null,
    offers_in_store: true,
    offers_home_visit: false,
    offers_remote: false,
    home_service_communes: [],
    home_service_radius_km: null,
    hide_exact_address: false,
    status: 'DRAFT',
    status_reason: null,
    published_at: null,
    is_demo: true,
    created_by: ownerId,
    created_at: current,
    updated_at: current,
  });
  return businessesRepository.update(business.id, fields)!;
}

/** Siembra cada cuenta demo de manera independiente e idempotente por correo. */
export function seedDemoData(): boolean {
  let changed = seedValeriaDemoData();

  const admin = insertDemoAccount(DEMO_ACCOUNTS[0].email, DEMO_ACCOUNTS[0].password, DEMO_ACCOUNTS[0].name);
  if (admin) {
    rolesRepository.addRole(admin.id, 'CUSTOMER');
    rolesRepository.addRole(admin.id, 'PLATFORM_ADMIN');
    changed = true;
  }
  const customer = insertDemoAccount(DEMO_ACCOUNTS[1].email, DEMO_ACCOUNTS[1].password, DEMO_ACCOUNTS[1].name);
  if (customer) {
    rolesRepository.addRole(customer.id, 'CUSTOMER');
    changed = true;
  }
  const owner = insertDemoAccount(DEMO_ACCOUNTS[2].email, DEMO_ACCOUNTS[2].password, DEMO_ACCOUNTS[2].name, 'Barbería Central');
  if (owner) {
    ensureProfessionalSetup(owner.id, { businessName: 'Barbería Central', phone: '+56955550001', fullName: DEMO_ACCOUNTS[2].name, isDemo: true });
    const barberia = businessesRepository.listForUser(owner.id)[0];
    if (!barberia?.id) throw new Error('No se pudo crear Barbería Central.');
    businessesRepository.update(barberia.id, {
      slug: 'barberia-central',
      description: 'Barbería clásica en Santiago centro.',
      phone: '+56955550001',
      whatsapp: '+56955550001',
      address: "Av. Libertador Bernardo O'Higgins 1234",
      latitude: -33.4446,
      longitude: -70.6536,
      primary_category: 'Barbería',
      commune: 'Santiago',
      region: 'Región Metropolitana',
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
    });
    const spa = demoBusiness(owner.id, {
      slug: 'spa-nunoa-bienestar',
      name: 'Spa Ñuñoa Bienestar',
      primary_category: 'Masajes',
      commune: 'Ñuñoa',
      region: 'Región Metropolitana',
    });
    membersRepository.insert({
      id: generateId('mem'),
      business_id: spa.id,
      user_id: owner.id,
      role: 'OWNER',
      display_name: DEMO_ACCOUNTS[2].name,
      title: '',
      specialties: [],
      status: 'ACTIVE',
      created_at: spa.created_at,
      updated_at: spa.updated_at,
    });
    changed = true;
  }
  const staff = insertDemoAccount(DEMO_ACCOUNTS[3].email, DEMO_ACCOUNTS[3].password, DEMO_ACCOUNTS[3].name);
  if (staff) {
    rolesRepository.addRole(staff.id, 'PROFESSIONAL');
    const barberia = businessesRepository.findBySlug('barberia-central');
    if (barberia) {
      membersRepository.insert({
        id: generateId('mem'),
        business_id: barberia.id,
        user_id: staff.id,
        role: 'PROFESSIONAL',
        display_name: DEMO_ACCOUNTS[3].name,
        title: 'Barbero',
        specialties: [],
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    changed = true;
  }
  return changed;
}

/** Elimina únicamente las cuentas demo (y sus datos en cascada) y las vuelve a crear. */
export function resetDemoData(): { removedUsers: number } {
  return transaction(() => {
    businessesRepository.deleteDemo();
    const removedUsers = usersRepository.deleteDemoUsers();
    seedDemoData();
    return { removedUsers };
  });
}

/** Siembra los datos demo solo si la base no tiene usuarios (comportamiento v1). */
export function seedDemoDataIfEmpty(): boolean {
  if (usersRepository.count() > 0) return false;
  return seedDemoData();
}
