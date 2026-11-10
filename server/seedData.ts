import { getSqliteDb } from './sqlite.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function hashPassword(pass: string): string {
  return bcrypt.hashSync(pass, 10);
}

export function seedCategoriesIfEmpty() {
  const db = getSqliteDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (countRow.count > 0) return;

  const categories = [
    {
      id: 'cat_peluqueria',
      name: 'Peluquería',
      slug: 'peluqueria',
      icon: 'Scissors',
      description: 'Cortes, coloración, balayage, mechas y peinados profesionales.',
      order: 1,
      subs: ['Corte de Cabello', 'Coloración & Tintura', 'Balayage & Mechas', 'Alisado & Keratina', 'Peinados & Ondas', 'Baño de Color']
    },
    {
      id: 'cat_barberia',
      name: 'Barbería',
      slug: 'barberia',
      icon: 'UserCheck',
      description: 'Cortes masculinos, perfilado de barba, afeitado a navaja y diseño.',
      order: 2,
      subs: ['Corte Masculino', 'Perfilado de Barba', 'Afeitado Tradicional', 'Diseño y Fade', 'Corte & Barba Combo']
    },
    {
      id: 'cat_manicure',
      name: 'Manicure',
      slug: 'manicure',
      icon: 'Sparkles',
      description: 'Cuidado de manos, esmaltado permanente, rusa y diseños de nail art.',
      order: 3,
      subs: ['Manicure Rusa', 'Esmaltado Permanente', 'Manicure Tradicional', 'Nail Art & Cristales', 'Baño de Acrílico']
    },
    {
      id: 'cat_pedicure',
      name: 'Pedicure',
      slug: 'pedicure',
      icon: 'Footprints',
      description: 'Pedicure spa, retiro de durezas, exfoliación y esmaltado de pies.',
      order: 4,
      subs: ['Pedicure Spa', 'Pedicure Permanente', 'Pedicure Clínica / Durezas', 'Exfoliación e Hidratación']
    },
    {
      id: 'cat_unas',
      name: 'Uñas Esculpidas',
      slug: 'unas',
      icon: 'Hand',
      description: 'Extensiones de uñas, soft gel, acrílico, polygel y kapping.',
      order: 5,
      subs: ['Soft Gel / Press On', 'Uñas Acrílicas Esculpidas', 'Kapping Gel', 'Retiro de Extensiones']
    },
    {
      id: 'cat_maquillaje',
      name: 'Maquillaje',
      slug: 'maquillaje',
      icon: 'Palette',
      description: 'Maquillaje social, novias, graduaciones y fotografía.',
      order: 6,
      subs: ['Maquillaje Social', 'Maquillaje de Novia', 'Maquillaje de Noche', 'Clases de Automaquillaje']
    },
    {
      id: 'cat_estetica_facial',
      name: 'Estética Facial',
      slug: 'estetica-facial',
      icon: 'Smile',
      description: 'Limpiezas profundas, peeling, lifting de pestañas y cejas.',
      order: 7,
      subs: ['Limpieza Facial Profunda', 'Lifting de Pestañas', 'Laminado de Cejas', 'Peeling Químico / Punta de Diamante', 'Hidratación con Ácido Hialurónico']
    },
    {
      id: 'cat_estetica_corporal',
      name: 'Estética Corporal',
      slug: 'estetica-corporal',
      icon: 'Activity',
      description: 'Tratamientos reductivos, drenajes linfáticos y reafirmantes.',
      order: 8,
      subs: ['Drenaje Linfático Manual', 'Masaje Reductivo & Reafirmante', 'Maderoterapia Corporal', 'Cavitación & Radiofrecuencia']
    },
    {
      id: 'cat_depilacion',
      name: 'Depilación',
      slug: 'depilacion',
      icon: 'Zap',
      description: 'Depilación láser diodo, cera vegetal y depilación con hilo.',
      order: 9,
      subs: ['Láser Diodo Cuerpo Completo', 'Depilación con Cera', 'Depilación con Hilo', 'Zona Rebaje & Axilas']
    },
    {
      id: 'cat_masajes',
      name: 'Masajes',
      slug: 'masajes',
      icon: 'Heart',
      description: 'Masajes de relajación, descontracturantes y piedras calientes.',
      order: 10,
      subs: ['Masaje de Relajación', 'Masaje Descontracturante', 'Piedras Calientes', 'Masaje Craneofacial']
    },
    {
      id: 'cat_bienestar',
      name: 'Bienestar',
      slug: 'bienestar',
      icon: 'Sun',
      description: 'Reflexología, reiki, aromaterapia y armonización.',
      order: 11,
      subs: ['Reflexología Podal', 'Sesión de Reiki', 'Aromaterapia & Meditación']
    },
    {
      id: 'cat_spa',
      name: 'Spa',
      slug: 'spa',
      icon: 'Coffee',
      description: 'Jornadas de spa, hidroterapia, exfoliaciones y circuitos.',
      order: 12,
      subs: ['Día de Spa Relajante', 'Circuito Hidromasaje', 'Exfoliación Corporal Total']
    },
    {
      id: 'cat_capilares',
      name: 'Tratamientos Capilares',
      slug: 'tratamientos-capilares',
      icon: 'Flame',
      description: 'Botox capilar, cauterización, olaplex y nutrición profunda.',
      order: 13,
      subs: ['Botox Capilar', 'Tratamiento Olaplex Reparador', 'Nutrición Profunda Kérastase', 'Cauterización Capilar']
    },
    {
      id: 'cat_belleza',
      name: 'Servicios de Belleza',
      slug: 'servicios-de-belleza',
      icon: 'Eye',
      description: 'Extensiones de pestañas pelo a pelo, microblading y diseño de cejas.',
      order: 14,
      subs: ['Extensiones de Pestañas', 'Microblading de Cejas', 'Tinte de Pestañas y Cejas']
    },
    {
      id: 'cat_otros',
      name: 'Otros Servicios',
      slug: 'otros-servicios',
      icon: 'Grid',
      description: 'Asesorías de imagen integral y servicios especializados.',
      order: 15,
      subs: ['Asesoría de Colorimetría Personal', 'Consultoría de Estilo', 'Atención Especial a Domicilio']
    }
  ];

  const now = new Date().toISOString();
  const insertCat = db.prepare(`
    INSERT INTO categories (id, name, slug, icon, description, display_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const insertSub = db.prepare(`
    INSERT INTO subcategories (id, category_id, name, slug, display_order, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);

  for (const c of categories) {
    insertCat.run(c.id, c.name, c.slug, c.icon, c.description, c.order, now);
    let subOrder = 1;
    for (const subName of c.subs) {
      const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const subId = `sub_${c.slug}_${subOrder}`;
      insertSub.run(subId, c.id, subName, subSlug, subOrder, now);
      subOrder++;
    }
  }

  console.log('✅ Catálogo inicial de 15 categorías y subcategorías inicializado en SQLite.');
}

export function seedDemoDataIfEmpty() {
  const db = getSqliteDb();

  // First seed categories
  seedCategoriesIfEmpty();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) return;

  console.log('🌱 Inicializando cuentas y negocios demo para SalonTrack 2.0 (Chile)...');
  const now = new Date().toISOString();

  // 1. Platform Admin
  const adminId = 'usr_admin_salontrack';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(adminId, 'admin@salontrack.cl', hashPassword('Admin1234!'), now);

  db.prepare(`
    INSERT INTO user_profiles (id, user_id, full_name, phone, country, currency, timezone, default_interval_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?)
  `).run('prof_admin', adminId, 'Administrador SalonTrack', '+56900000000', now, now);

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_admin_1', adminId, 'PLATFORM_ADMIN', now
  );

  // 2. Valeria Henríquez (Salon Owner & Color Specialist in Providencia, Santiago)
  const valeriaId = 'usr_demo_valeria_estilista';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(valeriaId, 'contacto@valeriaestudio.cl', hashPassword('Salon1234'), now);

  db.prepare(`
    INSERT INTO user_profiles (
      id, user_id, full_name, phone, country, currency, timezone, default_interval_days,
      whatsapp_template, re_engagement_template, re_engagement_days_threshold, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?, 90, ?, ?)
  `).run(
    'prof_valeria',
    valeriaId,
    'Valeria Henríquez',
    '+56987654321',
    '¡Hola {nombre}! Te saluda {salon} ✨ Te escribo porque ya se aproxima la fecha recomendada para tu retoque de {servicio}. ¿Coordinamos tu hora? 💇‍♀️',
    '¡Hola {nombre}! En {salon} te extrañamos 💕 Vimos que han pasado semanas desde tu último {servicio}. Queremos invitarte con 15% de descuento en tu retoque si agendas esta semana ✨💇‍♀️',
    now,
    now
  );

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_valeria_owner', valeriaId, 'BUSINESS_OWNER', now
  );
  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_valeria_pro', valeriaId, 'PROFESSIONAL', now
  );

  // Business: Valeria Henríquez Color Studio
  const businessValeriaId = 'biz_valeria_studio';
  db.prepare(`
    INSERT INTO businesses (
      id, owner_id, slug, name, description, primary_category_id, phone, whatsapp, email,
      address, comuna, region, country, latitude, longitude, modality, status, booking_mode,
      min_advance_hours, max_advance_days, buffer_minutes, cancellation_policy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Chile', ?, ?, 'salon', 'PUBLISHED', 'AUTOMATIC', 2, 45, 10, ?, ?, ?)
  `).run(
    businessValeriaId,
    valeriaId,
    'valeria-color-studio',
    'Valeria Henríquez Color Studio',
    'Estudio especializado en balayage iluminado, colorimetría avanzada, corrección de color y tratamientos reconstructivos en Providencia.',
    'cat_peluqueria',
    '+56987654321',
    '+56987654321',
    'contacto@valeriaestudio.cl',
    'Av. Providencia 2133, Depto 402',
    'Providencia',
    'Región Metropolitana',
    -33.4243,
    -70.6125,
    'Cancelaciones permitidas hasta 24 horas antes sin costo.',
    now,
    now
  );

  db.prepare('INSERT INTO business_members (id, business_id, user_id, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(
    'bm_valeria', businessValeriaId, valeriaId, 'OWNER', now
  );

  // Staff in Valeria Studio: Valeria + Camila (Colleague)
  const staffValeriaId = 'stf_valeria';
  db.prepare(`
    INSERT INTO staff (id, business_id, user_id, name, specialty, bio, phone, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `).run(
    staffValeriaId,
    businessValeriaId,
    valeriaId,
    'Valeria Henríquez',
    'Master Colorista & Balayage',
    'Con más de 10 años creando rubios y matices luminosos respetando la fibra capilar.',
    '+56987654321',
    now
  );

  // Staff 2: Camila Staff
  const camilaId = 'usr_camila_staff';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(camilaId, 'camila@valeriaestudio.cl', hashPassword('Staff1234!'), now);

  db.prepare(`
    INSERT INTO user_profiles (id, user_id, full_name, phone, country, currency, timezone, default_interval_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?)
  `).run('prof_camila', camilaId, 'Camila Muñoz', '+56955678901', now, now);

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_camila_staff', camilaId, 'BUSINESS_STAFF', now
  );

  const staffCamilaId = 'stf_camila';
  db.prepare(`
    INSERT INTO staff (id, business_id, user_id, name, specialty, bio, phone, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 2, ?)
  `).run(
    staffCamilaId,
    businessValeriaId,
    camilaId,
    'Camila Muñoz',
    'Estilista & Tratamientos Capilares',
    'Experta en tratamientos botox, cortes de precisión y baños de luz.',
    '+56955678901',
    now
  );

  db.prepare('INSERT INTO business_members (id, business_id, user_id, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(
    'bm_camila', businessValeriaId, camilaId, 'STAFF', now
  );

  // Business Hours (Lunes a Sábado 09:30 a 19:30)
  for (let day = 1; day <= 6; day++) {
    db.prepare(`
      INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
      VALUES (?, ?, ?, '09:30', '19:30', 0, ?)
    `).run(`bh_valeria_${day}`, businessValeriaId, day, now);

    db.prepare(`
      INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
      VALUES (?, ?, ?, '09:30', '19:30', '14:00', '15:00', 1, ?)
    `).run(`sa_valeria_${day}`, staffValeriaId, day, now);

    db.prepare(`
      INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
      VALUES (?, ?, ?, '10:00', '19:00', '13:30', '14:30', 1, ?)
    `).run(`sa_camila_${day}`, staffCamilaId, day, now);
  }
  // Domingo cerrado
  db.prepare(`
    INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
    VALUES (?, ?, 0, '10:00', '14:00', 1, ?)
  `).run('bh_valeria_0', businessValeriaId, now);

  // Services in Valeria Studio
  const valeriaServices = [
    {
      id: 'srv_val_balayage',
      name: 'Balayage Caramelo & Tonalización',
      price: 85000,
      priceType: 'from',
      duration: 180,
      prep: 10,
      clean: 10,
      desc: 'Técnica de aclaración degradada personalizada, esfumado de raíz, matiz dialight y secado brushing final.',
      catId: 'cat_peluqueria',
      isFeatured: 1
    },
    {
      id: 'srv_val_babylights',
      name: 'Babylights & Matiz Ceniza Frío',
      price: 68000,
      priceType: 'fixed',
      duration: 150,
      prep: 10,
      clean: 10,
      desc: 'Mechas ultra finas desde raíz para luminosidad máxima. Incluye Olaplex y tonalizador.',
      catId: 'cat_peluqueria',
      isFeatured: 1
    },
    {
      id: 'srv_val_tintura_raiz',
      name: 'Tintura Raíz & Baño de Brillo',
      price: 45000,
      priceType: 'fixed',
      duration: 75,
      prep: 5,
      clean: 5,
      desc: 'Cubrimiento 100% de canas o cambio de tono en raíz con tintura LOréal Professionnel o Wella.',
      catId: 'cat_peluqueria',
      isFeatured: 0
    },
    {
      id: 'srv_val_corte',
      name: 'Corte de Cabello & Brushing Estilizado',
      price: 25000,
      priceType: 'fixed',
      duration: 50,
      prep: 5,
      clean: 5,
      desc: 'Diagnóstico capilar, lavado relajante con masaje capilar, corte y peinado con plancha u ondas.',
      catId: 'cat_peluqueria',
      isFeatured: 0
    },
    {
      id: 'srv_val_botox',
      name: 'Botox Capilar Reconstructivo Anti-Frizz',
      price: 45000,
      priceType: 'fixed',
      duration: 90,
      prep: 5,
      clean: 5,
      desc: 'Tratamiento intensivo con ácido hialurónico y colágeno para sellar puntas abiertas y eliminar el frizz.',
      catId: 'cat_capilares',
      isFeatured: 1
    }
  ];

  for (const s of valeriaServices) {
    db.prepare(`
      INSERT INTO services (
        id, business_id, category_id, name, description, price_clp, price_type,
        duration_minutes, prep_minutes, clean_minutes, modality, is_featured, status, display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'salon', ?, 'PUBLISHED', 1, ?, ?)
    `).run(s.id, businessValeriaId, s.catId, s.name, s.desc, s.price, s.priceType, s.duration, s.prep, s.clean, s.isFeatured, now, now);

    // Link staff to services
    db.prepare('INSERT INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      `ss_val_${s.id}`, staffValeriaId, s.id, now
    );
    db.prepare('INSERT INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      `ss_cam_${s.id}`, staffCamilaId, s.id, now
    );
  }

  // 3. Barbería Independiente en Renca: Route 68 Barber (Barbería en Renca)
  const ignacioId = 'usr_barbero_ignacio';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(ignacioId, 'ignacio@barberiaroute.cl', hashPassword('Barber1234!'), now);

  db.prepare(`
    INSERT INTO user_profiles (id, user_id, full_name, phone, country, currency, timezone, default_interval_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 20, ?, ?)
  `).run('prof_ignacio', ignacioId, 'Ignacio Valdés', '+56977889900', now, now);

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_ignacio_owner', ignacioId, 'BUSINESS_OWNER', now
  );
  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_ignacio_pro', ignacioId, 'PROFESSIONAL', now
  );

  const businessBarberId = 'biz_route68_barber';
  db.prepare(`
    INSERT INTO businesses (
      id, owner_id, slug, name, description, primary_category_id, phone, whatsapp, email,
      address, comuna, region, country, latitude, longitude, modality, status, booking_mode,
      min_advance_hours, max_advance_days, buffer_minutes, cancellation_policy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Chile', ?, ?, 'salon', 'PUBLISHED', 'AUTOMATIC', 1, 30, 5, ?, ?, ?)
  `).run(
    businessBarberId,
    ignacioId,
    'route-68-barberia-renca',
    'Route 68 Barbería Renca',
    'Barbería tradicional y urbana en Renca. Cortes degradados fade, perfilado de barba con toalla caliente y productos premium.',
    'cat_barberia',
    '+56977889900',
    '+56977889900',
    'ignacio@barberiaroute.cl',
    'Av. Domingo Santa María 4120',
    'Renca',
    'Región Metropolitana',
    -33.4072,
    -70.7188,
    'Avisar con 2 horas de anticipación para cancelar.',
    now,
    now
  );

  const staffIgnacioId = 'stf_ignacio';
  db.prepare(`
    INSERT INTO staff (id, business_id, user_id, name, specialty, bio, phone, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `).run(staffIgnacioId, businessBarberId, ignacioId, 'Ignacio Valdés', 'Barbero Clásico & Fade Master', 'Especialista en cortes fade degradados y barba.', '+56977889900', now);

  for (let day = 1; day <= 6; day++) {
    db.prepare(`
      INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
      VALUES (?, ?, ?, '10:00', '20:30', 0, ?)
    `).run(`bh_barber_${day}`, businessBarberId, day, now);

    db.prepare(`
      INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
      VALUES (?, ?, ?, '10:00', '20:30', '14:00', '15:00', 1, ?)
    `).run(`sa_ignacio_${day}`, staffIgnacioId, day, now);
  }

  const barberServices = [
    { id: 'srv_barb_corte', name: 'Corte de Cabello Fade & Perfilado', price: 12000, duration: 40, desc: 'Corte moderno con degradado a navaja o máquina, lavado y producto fijador.', isFeatured: 1 },
    { id: 'srv_barb_combo', name: 'Combo Corte + Perfilado de Barba', price: 18000, duration: 60, desc: 'Corte completo y ritual de barba con vapor, toalla caliente y aceites hidratantes.', isFeatured: 1 },
    { id: 'srv_barb_barba', name: 'Ritual de Barba con Toalla Caliente', price: 9000, duration: 30, desc: 'Perfilado a navaja con toallas aromatizadas y bálsamo nutritivo.', isFeatured: 0 }
  ];

  for (const bs of barberServices) {
    db.prepare(`
      INSERT INTO services (
        id, business_id, category_id, name, description, price_clp, price_type,
        duration_minutes, prep_minutes, clean_minutes, modality, is_featured, status, display_order, created_at, updated_at
      ) VALUES (?, ?, 'cat_barberia', ?, ?, ?, 'fixed', ?, 0, 5, 'salon', ?, 'PUBLISHED', 1, ?, ?)
    `).run(bs.id, businessBarberId, bs.name, bs.desc, bs.price, bs.duration, bs.isFeatured, now, now);

    db.prepare('INSERT INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      `ss_ign_${bs.id}`, staffIgnacioId, bs.id, now
    );
  }

  // 4. Manicure & Spa a Domicilio: Glam & Nails Santiago
  const nataliaId = 'usr_manicurista_natalia';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(nataliaId, 'natalia@glamnails.cl', hashPassword('Nails1234!'), now);

  db.prepare(`
    INSERT INTO user_profiles (id, user_id, full_name, phone, country, currency, timezone, default_interval_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 21, ?, ?)
  `).run('prof_natalia', nataliaId, 'Natalia Sepúlveda', '+56966778899', now, now);

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_natalia_owner', nataliaId, 'BUSINESS_OWNER', now
  );
  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_natalia_pro', nataliaId, 'PROFESSIONAL', now
  );

  const businessNailsId = 'biz_glam_nails';
  db.prepare(`
    INSERT INTO businesses (
      id, owner_id, slug, name, description, primary_category_id, phone, whatsapp, email,
      address, comuna, region, country, latitude, longitude, modality, status, booking_mode,
      min_advance_hours, max_advance_days, buffer_minutes, cancellation_policy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Chile', ?, ?, 'both', 'PUBLISHED', 'AUTOMATIC', 3, 20, 15, ?, ?, ?)
  `).run(
    businessNailsId,
    nataliaId,
    'glam-nails-manicure',
    'Glam & Nails Studio',
    'Manicure rusa, soft gel, esmaltado permanente y spa de pies. Atención en nuestro salón y a domicilio en Las Condes, Vitacura y Providencia.',
    'cat_manicure',
    '+56966778899',
    '+56966778899',
    'natalia@glamnails.cl',
    'Av. Las Condes 9400',
    'Las Condes',
    'Región Metropolitana',
    -33.3980,
    -70.5480,
    'Cancelaciones con 12 horas de aviso.',
    now,
    now
  );

  const staffNataliaId = 'stf_natalia';
  db.prepare(`
    INSERT INTO staff (id, business_id, user_id, name, specialty, bio, phone, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `).run(staffNataliaId, businessNailsId, nataliaId, 'Natalia Sepúlveda', 'Manicurista Master & Nail Artist', 'Especialista en manicura combinada rusa y soft gel.', '+56966778899', now);

  for (let day = 1; day <= 6; day++) {
    db.prepare(`
      INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
      VALUES (?, ?, ?, '09:00', '19:00', 0, ?)
    `).run(`bh_nails_${day}`, businessNailsId, day, now);

    db.prepare(`
      INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
      VALUES (?, ?, ?, '09:00', '19:00', '13:00', '14:00', 1, ?)
    `).run(`sa_natalia_${day}`, staffNataliaId, day, now);
  }

  const nailServices = [
    { id: 'srv_nail_rusa', name: 'Manicure Rusa & Esmaltado Permanente', price: 22000, duration: 75, desc: 'Limpieza de cutículas con torno y esmaltado de alta duración.', isFeatured: 1 },
    { id: 'srv_nail_softgel', name: 'Extensiones Soft Gel con Diseño', price: 34000, duration: 110, desc: 'Tips de gel completos con largo personalizado y diseño a mano alzada.', isFeatured: 1 },
    { id: 'srv_nail_pedi', name: 'Pedicure Spa Completa con Durezas', price: 26000, duration: 60, desc: 'Baño de sales, retiro de callosidades, exfoliación y esmaltado permanente.', isFeatured: 0 }
  ];

  for (const ns of nailServices) {
    db.prepare(`
      INSERT INTO services (
        id, business_id, category_id, name, description, price_clp, price_type,
        duration_minutes, prep_minutes, clean_minutes, modality, is_featured, status, display_order, created_at, updated_at
      ) VALUES (?, ?, 'cat_manicure', ?, ?, ?, 'fixed', ?, 5, 5, 'both', ?, 'PUBLISHED', 1, ?, ?)
    `).run(ns.id, businessNailsId, ns.name, ns.desc, ns.price, ns.duration, ns.isFeatured, now, now);

    db.prepare('INSERT INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      `ss_nat_${ns.id}`, staffNataliaId, ns.id, now
    );
  }

  // 5. Masajes Terapéuticos y Relajación: KineMasajes Santiago
  const kineId = 'usr_kine_matias';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(kineId, 'matias@kinemasajes.cl', hashPassword('Kine1234!'), now);

  db.prepare(`
    INSERT INTO user_profiles (id, user_id, full_name, phone, country, currency, timezone, default_interval_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?)
  `).run('prof_matias', kineId, 'Matías Riquelme', '+56944332211', now, now);

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_matias_owner', kineId, 'BUSINESS_OWNER', now
  );

  const businessMassageId = 'biz_kine_masajes';
  db.prepare(`
    INSERT INTO businesses (
      id, owner_id, slug, name, description, primary_category_id, phone, whatsapp, email,
      address, comuna, region, country, latitude, longitude, modality, status, booking_mode,
      min_advance_hours, max_advance_days, buffer_minutes, cancellation_policy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Chile', ?, ?, 'both', 'PUBLISHED', 'AUTOMATIC', 2, 30, 15, ?, ?, ?)
  `).run(
    businessMassageId,
    kineId,
    'kinemasajes-santiago',
    'KineMasajes Terapéuticos',
    'Kinesiólogo y masoterapeuta certificado. Masajes descontracturantes de cuello y espalda, piedras calientes y drenaje linfático en Santiago Centro y a domicilio.',
    'cat_masajes',
    '+56944332211',
    '+56944332211',
    'matias@kinemasajes.cl',
    'Moneda 1040, Of 702',
    'Santiago',
    'Región Metropolitana',
    -33.4429,
    -70.6538,
    'Avisar con 4 horas de anticipación.',
    now,
    now
  );

  const staffMatiasId = 'stf_matias';
  db.prepare(`
    INSERT INTO staff (id, business_id, user_id, name, specialty, bio, phone, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `).run(staffMatiasId, businessMassageId, kineId, 'Matías Riquelme', 'Kinesiólogo & Masoterapeuta', 'Especialista en contracturas de cuello y espalda alta.', '+56944332211', now);

  for (let day = 1; day <= 6; day++) {
    db.prepare(`
      INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
      VALUES (?, ?, ?, '09:00', '20:00', 0, ?)
    `).run(`bh_kine_${day}`, businessMassageId, day, now);

    db.prepare(`
      INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
      VALUES (?, ?, ?, '09:00', '20:00', '13:30', '14:30', 1, ?)
    `).run(`sa_matias_${day}`, staffMatiasId, day, now);
  }

  const massageServices = [
    { id: 'srv_msg_descont', name: 'Masaje Descontracturante Espalda & Cuello', price: 28000, duration: 60, desc: 'Terapia manual profunda para aliviar nudos y tensión muscular acumulada.', isFeatured: 1 },
    { id: 'srv_msg_relax', name: 'Masaje de Relajación con Aromaterapia', price: 25000, duration: 60, desc: 'Movimientos suaves y aceites esenciales para desconectar del estrés.', isFeatured: 1 },
    { id: 'srv_msg_domicilio', name: 'Masaje Terapéutico a Domicilio (Camilla Pro)', price: 35000, duration: 75, desc: 'Llevamos la camilla profesional y ambientación completa a la comodidad de tu hogar.', isFeatured: 1 }
  ];

  for (const ms of massageServices) {
    db.prepare(`
      INSERT INTO services (
        id, business_id, category_id, name, description, price_clp, price_type,
        duration_minutes, prep_minutes, clean_minutes, modality, is_featured, status, display_order, created_at, updated_at
      ) VALUES (?, ?, 'cat_masajes', ?, ?, ?, 'fixed', ?, 10, 10, 'both', ?, 'PUBLISHED', 1, ?, ?)
    `).run(ms.id, businessMassageId, ms.name, ms.desc, ms.price, ms.duration, ms.isFeatured, now, now);

    db.prepare('INSERT INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      `ss_mat_${ms.id}`, staffMatiasId, ms.id, now
    );
  }

  // 6. Registered Client Account: María Paz Contreras
  const customerId = 'usr_cliente_mariapaz';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `).run(customerId, 'cliente@gmail.com', hashPassword('Cliente1234!'), now);

  db.prepare(`
    INSERT INTO user_profiles (id, user_id, full_name, phone, country, currency, timezone, default_interval_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?)
  `).run('prof_mariapaz', customerId, 'María Paz Contreras', '+56991234567', now, now);

  db.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
    'role_cliente_cust', customerId, 'CUSTOMER', now
  );

  // Seed sample bookings for María Paz
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const pastWeek = new Date(today);
  pastWeek.setDate(pastWeek.getDate() - 7);
  const pastWeekStr = pastWeek.toISOString().split('T')[0];

  // Booking 1: Confirmed tomorrow in Valeria Studio
  const booking1Id = 'bk_demo_confirmed_1';
  db.prepare(`
    INSERT INTO bookings (
      id, code, business_id, staff_id, service_id, customer_user_id, booking_date, start_time, end_time,
      duration_minutes, amount_clp, modality, status, payment_method, payment_status, client_name, client_phone, client_email,
      created_at, updated_at
    ) VALUES (?, 'ST-2026-MP01', ?, ?, ?, ?, ?, '11:00', '12:15', 75, 45000, 'salon', 'CONFIRMED', 'presential', 'pending',
      'María Paz Contreras', '+56991234567', 'cliente@gmail.com', ?, ?)
  `).run(
    booking1Id,
    businessValeriaId,
    staffValeriaId,
    'srv_val_tintura_raiz',
    customerId,
    tomorrowStr,
    now,
    now
  );

  // Booking 2: Completed past week with Review and Payment!
  const booking2Id = 'bk_demo_completed_2';
  db.prepare(`
    INSERT INTO bookings (
      id, code, business_id, staff_id, service_id, customer_user_id, booking_date, start_time, end_time,
      duration_minutes, amount_clp, modality, status, payment_method, payment_status, client_name, client_phone, client_email,
      completed_at, created_at, updated_at
    ) VALUES (?, 'ST-2026-MP02', ?, ?, ?, ?, ?, '16:00', '19:00', 180, 85000, 'salon', 'COMPLETED', 'online', 'paid',
      'María Paz Contreras', '+56991234567', 'cliente@gmail.com', ?, ?, ?)
  `).run(
    booking2Id,
    businessValeriaId,
    staffValeriaId,
    'srv_val_balayage',
    customerId,
    pastWeekStr,
    pastWeekStr + 'T19:00:00Z',
    pastWeekStr + 'T10:00:00Z',
    pastWeekStr + 'T19:00:00Z'
  );

  // Payment for Booking 2
  db.prepare(`
    INSERT INTO payments (
      id, user_id, business_id, booking_id, type, amount_clp, currency, provider, provider_payment_id, status, payment_method, created_at
    ) VALUES (?, ?, ?, ?, 'booking_payment', 85000, 'CLP', 'local', 'SIM_PAY_85000_MP02', 'approved', 'simulated_online', ?)
  `).run('pay_demo_1', customerId, businessValeriaId, booking2Id, pastWeekStr + 'T16:05:00Z');

  // Review for Booking 2
  db.prepare(`
    INSERT INTO reviews (
      id, business_id, staff_id, booking_id, user_id, customer_name, rating, comment, response, response_date, is_reported, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, ?, 'María Paz Contreras', 5,
      '¡El balayage quedó increíble! Valeria cuidó mi cabello en todo momento y el tono caramelo quedó exactamente como quería. 100% recomendada.',
      '¡Muchísimas gracias María Paz por tu confianza! Un agrado atenderte siempre. ¡Nos vemos en tu próximo retoque!',
      ?, 0, 0, ?)
  `).run(
    'rev_demo_1',
    businessValeriaId,
    staffValeriaId,
    booking2Id,
    customerId,
    pastWeekStr + 'T21:00:00Z',
    pastWeekStr + 'T20:00:00Z'
  );

  // Completed booking for Carolina Silva
  const bkCaroId = 'bk_demo_caro_rev';
  db.prepare(`
    INSERT INTO bookings (
      id, code, business_id, staff_id, service_id, booking_date, start_time, end_time,
      duration_minutes, amount_clp, status, payment_method, payment_status, client_name, client_phone,
      completed_at, created_at, updated_at
    ) VALUES (?, 'ST-2026-CS01', ?, ?, 'srv_val_corte', ?, '15:00', '15:50', 50, 25000, 'COMPLETED', 'presential', 'paid',
      'Carolina Silva', '+56982345678', ?, ?, ?)
  `).run(bkCaroId, businessValeriaId, staffCamilaId, pastWeekStr, pastWeekStr + 'T16:00:00Z', pastWeekStr + 'T10:00:00Z', now);

  db.prepare(`
    INSERT INTO reviews (
      id, business_id, staff_id, booking_id, user_id, customer_name, rating, comment, is_reported, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Carolina Silva', 5, 'Excelente atención en Valeria Studio, el secado y matiz quedaron perfectos.', 0, 0, ?)
  `).run('rev_demo_2', businessValeriaId, staffCamilaId, bkCaroId, valeriaId, now);

  // Completed booking for Cristóbal Muñoz
  const bkCrisId = 'bk_demo_cris_rev';
  db.prepare(`
    INSERT INTO bookings (
      id, code, business_id, staff_id, service_id, booking_date, start_time, end_time,
      duration_minutes, amount_clp, status, payment_method, payment_status, client_name, client_phone,
      completed_at, created_at, updated_at
    ) VALUES (?, 'ST-2026-CM01', ?, ?, 'srv_barb_corte', ?, '17:00', '17:40', 40, 12000, 'COMPLETED', 'presential', 'paid',
      'Cristóbal Muñoz', '+56988887777', ?, ?, ?)
  `).run(bkCrisId, businessBarberId, staffIgnacioId, pastWeekStr, pastWeekStr + 'T18:00:00Z', pastWeekStr + 'T11:00:00Z', now);

  db.prepare(`
    INSERT INTO reviews (
      id, business_id, staff_id, booking_id, user_id, customer_name, rating, comment, is_reported, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Cristóbal Muñoz', 5, 'La mejor barbería en Renca. El corte degradado impecable y puntualidad total con la reserva.', 0, 0, ?)
  `).run('rev_demo_3', businessBarberId, staffIgnacioId, bkCrisId, ignacioId, now);

  // Completed booking for Javiera Gómez
  const bkJavId = 'bk_demo_jav_rev';
  db.prepare(`
    INSERT INTO bookings (
      id, code, business_id, staff_id, service_id, booking_date, start_time, end_time,
      duration_minutes, amount_clp, status, payment_method, payment_status, client_name, client_phone,
      completed_at, created_at, updated_at
    ) VALUES (?, 'ST-2026-JG01', ?, ?, 'srv_nail_rusa', ?, '12:00', '13:15', 75, 22000, 'COMPLETED', 'online', 'paid',
      'Javiera Gómez', '+56999998888', ?, ?, ?)
  `).run(bkJavId, businessNailsId, staffNataliaId, pastWeekStr, pastWeekStr + 'T13:30:00Z', pastWeekStr + 'T09:00:00Z', now);

  db.prepare(`
    INSERT INTO reviews (
      id, business_id, staff_id, booking_id, user_id, customer_name, rating, comment, is_reported, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Javiera Gómez', 5, 'La manicura rusa duró más de 3 semanas impecable. Muy higiénico y profesional.', 0, 0, ?)
  `).run('rev_demo_4', businessNailsId, staffNataliaId, bkJavId, nataliaId, now);

  // Favorites for María Paz
  db.prepare('INSERT INTO favorites (id, user_id, business_id, created_at) VALUES (?, ?, ?, ?)').run(
    'fav_1', customerId, businessValeriaId, now

  );
  db.prepare('INSERT INTO favorites (id, user_id, business_id, created_at) VALUES (?, ?, ?, ?)').run(
    'fav_2', customerId, businessBarberId, now
  );

  // Notifications for Customer & Valeria
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, is_read, entity_type, entity_id, urgency, created_at)
    VALUES (?, ?, 'booking_confirmed', '¡Reserva Confirmada!', 'Tu reserva en Valeria Henríquez Color Studio para mañana a las 11:00 ha sido confirmada.', 0, 'booking', ?, 'high', ?)
  `).run('notif_1', customerId, booking1Id, now);

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, is_read, entity_type, entity_id, urgency, created_at)
    VALUES (?, ?, 'new_booking', 'Nueva Reserva Recibida', 'María Paz Contreras ha reservado Tintura Raíz para mañana a las 11:00.', 0, 'booking', ?, 'high', ?)
  `).run('notif_2', valeriaId, booking1Id, now);

  // Active Subscription for Valeria
  const expSub = new Date();
  expSub.setDate(expSub.getDate() + 75);
  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at)
    VALUES (?, ?, 'pro_quarterly', 'active', ?, ?, 'mercadopago', ?)
  `).run('sub_valeria_active', valeriaId, now, expSub.toISOString(), now);

  // Import existing data from data/salontrack.json if present into SQLite CRM tables
  importLegacyJsonIfPresent(valeriaId, businessValeriaId);

  console.log('🎉 Cuentas y negocios demo inicializados con éxito en SQLite.');
}

function importLegacyJsonIfPresent(defaultUserId: string, defaultBusinessId: string) {
  try {
    const jsonPath = path.resolve('data/salontrack.json');
    if (!fs.existsSync(jsonPath)) return;

    const db = getSqliteDb();
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Import clients
    if (Array.isArray(data.clients)) {
      const insertClient = db.prepare(`
        INSERT OR IGNORE INTO clients (id, user_id, business_id, full_name, phone, notes, preferred_contact, re_engagement_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?)
      `);

      for (const c of data.clients) {
        insertClient.run(
          c.id,
          c.user_id || defaultUserId,
          defaultBusinessId,
          c.full_name,
          c.phone,
          c.notes || '',
          c.re_engagement_status || 'none',
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString()
        );
      }
    }

    // Import services history
    if (Array.isArray(data.services)) {
      const insertService = db.prepare(`
        INSERT OR IGNORE INTO client_service_history (
          id, user_id, business_id, client_id, service_type, color_formula, tint_brand, service_date,
          amount_clp, recommended_interval_days, next_retouch_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of data.services) {
        insertService.run(
          s.id,
          s.user_id || defaultUserId,
          defaultBusinessId,
          s.client_id,
          s.service_type,
          s.color_formula || '',
          s.tint_brand || '',
          s.service_date,
          s.amount_clp || 0,
          s.recommended_interval_days || 30,
          s.next_retouch_date,
          s.notes || '',
          s.created_at || new Date().toISOString()
        );
      }
    }

    // Import contact logs
    if (Array.isArray(data.contact_logs)) {
      const insertLog = db.prepare(`
        INSERT OR IGNORE INTO contact_logs (id, user_id, client_id, contact_date, channel, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const l of data.contact_logs) {
        insertLog.run(
          l.id,
          l.user_id || defaultUserId,
          l.client_id,
          l.contact_date,
          l.channel || 'whatsapp',
          l.status || 'contacted',
          l.notes || '',
          l.created_at || new Date().toISOString()
        );
      }
    }

    console.log('✅ Historial y clientas de salontrack.json migrados limpiamente a SQLite.');
  } catch (err) {
    console.error('Error importing legacy json to sqlite:', err);
  }
}
