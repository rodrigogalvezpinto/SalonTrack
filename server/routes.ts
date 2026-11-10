import { Router, Response } from 'express';
import { getDb, saveDb, refreshDb, generateId, User, Profile, Subscription, Client, Service, ContactLog, Payment } from './db.js';
import { hashPassword, verifyPassword, generateToken, requireAuth, requireRole, getUserRoles, AuthRequest } from './auth.js';
import { getSqliteDb } from './sqlite.js';
import { getAvailableSlots, isSlotAvailable } from './availability.js';
import { localGeolocationProvider, localWhatsAppProvider, localEmailProvider, localPaymentProvider } from './adapters/index.js';

const router = Router();

// -------------------------------------------------------------
// Helper: Chile Santiago Date Calculations & Retouch Statuses
// -------------------------------------------------------------
function getSantiagoDateString(date = new Date()): string {
  const santiago = new Date(date.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const y = santiago.getFullYear();
  const m = String(santiago.getMonth() + 1).padStart(2, '0');
  const d = String(santiago.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateNextDate(startDateStr: string, intervalDays: number): string {
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + intervalDays);
  return date.toISOString().split('T')[0];
}

function getRetouchStatus(nextRetouchDateStr: string, todayStr: string) {
  const [ny, nm, nd] = nextRetouchDateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const nextDate = new Date(Date.UTC(ny, nm - 1, nd));
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));

  const diffDays = Math.round((nextDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'overdue', label: 'Retoque atrasado', diffDays, urgency: 'high' };
  } else if (diffDays === 0) {
    return { status: 'today', label: 'Retoque hoy', diffDays: 0, urgency: 'high' };
  } else if (diffDays <= 7) {
    return { status: 'this_week', label: 'Esta semana', diffDays, urgency: 'medium' };
  } else {
    return { status: 'upcoming', label: 'Próximo', diffDays, urgency: 'low' };
  }
}

function logAudit(userId: string | null, businessId: string | null, action: string, entityType: string, entityId: string | null, details: any = {}) {
  try {
    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, business_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(generateId('audit'), userId, businessId, action, entityType, entityId, JSON.stringify(details), new Date().toISOString());
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

function createNotification(userId: string, type: string, title: string, message: string, entityType?: string, entityId?: string, urgency: 'high' | 'medium' | 'low' = 'medium') {
  try {
    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, is_read, entity_type, entity_id, urgency, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(generateId('notif'), userId, type, title, message, entityType || null, entityId || null, urgency, new Date().toISOString());
  } catch (err) {
    console.error('Notification error:', err);
  }
}

// -------------------------------------------------------------
// System Health
// -------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SalonTrack Chile',
    version: '2.0.0',
    currency: 'CLP',
    timezone: 'America/Santiago',
    current_time: new Date().toISOString(),
    santiago_date: getSantiagoDateString(),
    database: 'SQLite (Persistent with WAL)',
    environment: process.env.NODE_ENV || 'development',
  });
});

// -------------------------------------------------------------
// Demo Switcher / Accounts (Quick test switcher for local dev)
// -------------------------------------------------------------
router.get('/demo/accounts', (req, res) => {
  res.json({
    message: 'Cuentas demo disponibles para pruebas locales en Chile.',
    accounts: [
      {
        email: 'contacto@valeriaestudio.cl',
        password: 'Salon1234',
        name: 'Valeria Henríquez (Dueña de Salón & Estilista)',
        role: 'BUSINESS_OWNER / PROFESSIONAL',
        business: 'Valeria Henríquez Color Studio (Providencia)',
        description: 'Gestión completa de salón, agenda, equipo, servicios de balayage y CRM.',
      },
      {
        email: 'ignacio@barberiaroute.cl',
        password: 'Barber1234!',
        name: 'Ignacio Valdés (Barbero Independiente)',
        role: 'BUSINESS_OWNER / PROFESSIONAL',
        business: 'Route 68 Barbería (Renca)',
        description: 'Barbería con cortes fade, perfilado de barba y reservas automáticas.',
      },
      {
        email: 'camila@valeriaestudio.cl',
        password: 'Staff1234!',
        name: 'Camila Muñoz (Trabajadora Estilista)',
        role: 'BUSINESS_STAFF',
        business: 'Valeria Henríquez Color Studio',
        description: 'Gestión de agenda y citas asignadas a la trabajadora.',
      },
      {
        email: 'cliente@gmail.com',
        password: 'Cliente1234!',
        name: 'María Paz Contreras (Clienta)',
        role: 'CUSTOMER',
        business: 'N/A',
        description: 'Explora el Marketplace, reserva citas, revisa comprobantes y deja reseñas.',
      },
      {
        email: 'admin@salontrack.cl',
        password: 'Admin1234!',
        name: 'Administrador SalonTrack',
        role: 'PLATFORM_ADMIN',
        business: 'Plataforma Global',
        description: 'Panel de administración, gestión de categorías, métricas globales y moderación.',
      },
    ]
  });
});

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
router.post('/auth/register', (req, res) => {
  try {
    const { email, password, full_name, business_name, phone, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const sqlite = getSqliteDb();
    const existing = sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    const userId = generateId('usr');
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    sqlite.prepare(`
      INSERT INTO users (id, email, password_hash, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `).run(userId, email.trim().toLowerCase(), passwordHash, now);

    const profileId = generateId('prof');
    const cleanPhone = phone ? phone.trim() : '+56900000000';
    const bizName = (business_name || full_name).trim();

    sqlite.prepare(`
      INSERT INTO user_profiles (
        id, user_id, full_name, phone, country, currency, timezone, default_interval_days,
        whatsapp_template, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Chile', 'CLP', 'America/Santiago', 30, ?, ?, ?)
    `).run(
      profileId,
      userId,
      full_name.trim(),
      cleanPhone,
      '¡Hola {nombre}! Te saluda {salon} ✨ Te escribo para coordinar tu cita recomendada.',
      now,
      now
    );

    // Determine initial roles
    const assignedRole = role === 'CUSTOMER' ? 'CUSTOMER' : 'BUSINESS_OWNER';
    sqlite.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
      generateId('role'), userId, assignedRole, now
    );
    if (assignedRole === 'BUSINESS_OWNER') {
      sqlite.prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)').run(
        generateId('role'), userId, 'PROFESSIONAL', now
      );

      // Create initial business for owner
      const bizSlug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `salon-${Date.now()}`;
      const bizId = generateId('biz');
      sqlite.prepare(`
        INSERT INTO businesses (
          id, owner_id, slug, name, description, phone, email, country, modality, status, booking_mode, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Chile', 'salon', 'PUBLISHED', 'AUTOMATIC', ?, ?)
      `).run(bizId, userId, bizSlug, bizName, 'Servicios profesionales en Chile.', cleanPhone, email.trim().toLowerCase(), now, now);

      sqlite.prepare('INSERT INTO business_members (id, business_id, user_id, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(
        generateId('bm'), bizId, userId, 'OWNER', now
      );

      // Create owner as staff member
      const staffId = generateId('stf');
      sqlite.prepare(`
        INSERT INTO staff (id, business_id, user_id, name, specialty, phone, is_active, display_order, created_at)
        VALUES (?, ?, ?, ?, 'Estilista Principal', ?, 1, 1, ?)
      `).run(staffId, bizId, userId, full_name.trim(), cleanPhone, now);

      // Business hours (Mon-Sat 09:30-19:30)
      for (let d = 1; d <= 6; d++) {
        sqlite.prepare(`
          INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
          VALUES (?, ?, ?, '09:30', '19:30', 0, ?)
        `).run(generateId('bh'), bizId, d, now);

        sqlite.prepare(`
          INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
          VALUES (?, ?, ?, '09:30', '19:30', '14:00', '15:00', 1, ?)
        `).run(generateId('sa'), staffId, d, now);
      }
    }

    // 14 days free trial subscription
    const trialExpire = new Date();
    trialExpire.setDate(trialExpire.getDate() + 14);
    sqlite.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at)
      VALUES (?, ?, 'pro_quarterly', 'trial', ?, ?, 'mercadopago', ?)
    `).run(generateId('sub'), userId, now, trialExpire.toISOString(), now);

    refreshDb();
    logAudit(userId, null, 'USER_REGISTERED', 'user', userId, { email, role: assignedRole });

    const roles = getUserRoles(userId);
    const token = generateToken({ id: userId, email: email.trim().toLowerCase(), password_hash: '', created_at: now }, roles);

    return res.status(201).json({
      message: 'Cuenta creada exitosamente en SalonTrack.',
      token,
      user: {
        id: userId,
        email: email.trim().toLowerCase(),
        roles,
        profile: {
          id: profileId,
          user_id: userId,
          full_name: full_name.trim(),
          business_name: bizName,
          phone: cleanPhone,
        },
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Error al registrar usuario en el servidor.' });
  }
});

router.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor ingresa tu correo y contraseña.' });
    }

    const sqlite = getSqliteDb();
    const user = sqlite.prepare('SELECT id, email, password_hash, is_active FROM users WHERE LOWER(email) = ?').get(email.trim().toLowerCase()) as any;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas. Verifica tu correo y contraseña.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta a soporte.' });
    }

    const profile = sqlite.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(user.id) as any;
    const subscription = sqlite.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(user.id) as any;
    const roles = getUserRoles(user.id);

    // Also get business owned or staffed
    const business = sqlite.prepare(`
      SELECT b.id, b.name, b.slug, bm.role as member_role
      FROM businesses b
      INNER JOIN business_members bm ON bm.business_id = b.id
      WHERE bm.user_id = ? AND bm.is_active = 1
      LIMIT 1
    `).get(user.id) as any;

    const token = generateToken({ id: user.id, email: user.email, password_hash: user.password_hash, created_at: '' }, roles);
    logAudit(user.id, business?.id || null, 'USER_LOGIN', 'user', user.id);

    return res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        email: user.email,
        roles,
        profile,
        subscription,
        business,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

router.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const user = sqlite.prepare('SELECT id, email, is_active FROM users WHERE id = ?').get(req.userId || '') as any;
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const profile = sqlite.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId || '') as any;
  const subscription = sqlite.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.userId || '') as any;
  const roles = getUserRoles(user.id);

  const business = sqlite.prepare(`
    SELECT b.*, bm.role as member_role
    FROM businesses b
    INNER JOIN business_members bm ON bm.business_id = b.id
    WHERE bm.user_id = ? AND bm.is_active = 1
    LIMIT 1
  `).get(user.id) as any;

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      roles,
      profile,
      subscription,
      business,
    },
  });
});

router.post('/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Ingresa tu correo registrado.' });

  const sqlite = getSqliteDb();
  const user = sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email.trim().toLowerCase());

  return res.json({
    message: 'Si el correo está registrado, recibirás un enlace de recuperación con instrucciones de acceso.',
    sent: !!user,
  });
});

router.post('/auth/reset-password', (req, res) => {
  const { email, new_password } = req.body;
  if (!email || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Contraseña debe contener al menos 6 caracteres.' });
  }

  const sqlite = getSqliteDb();
  const user = sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email.trim().toLowerCase()) as any;
  if (!user) {
    return res.status(404).json({ error: 'No se encontró una cuenta con ese correo.' });
  }

  sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), user.id);
  refreshDb();

  return res.json({ message: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
});

// -------------------------------------------------------------
// Profile & Settings Endpoints
// -------------------------------------------------------------
router.get('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const profile = sqlite.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId || '');
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
  return res.json({ profile });
});

router.put('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { full_name, phone, default_interval_days, whatsapp_template, re_engagement_template, re_engagement_days_threshold } = req.body;

  sqlite.prepare(`
    UPDATE user_profiles
    SET full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        default_interval_days = COALESCE(?, default_interval_days),
        whatsapp_template = COALESCE(?, whatsapp_template),
        re_engagement_template = COALESCE(?, re_engagement_template),
        re_engagement_days_threshold = COALESCE(?, re_engagement_days_threshold),
        updated_at = ?
    WHERE user_id = ?
  `).run(
    full_name?.trim() || null,
    phone?.trim() || null,
    default_interval_days ? Number(default_interval_days) : null,
    whatsapp_template ?? null,
    re_engagement_template ?? null,
    re_engagement_days_threshold ? Number(re_engagement_days_threshold) : null,
    new Date().toISOString(),
    req.userId || ''
  );

  refreshDb();
  const updated = sqlite.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId || '');
  return res.json({ message: 'Perfil actualizado exitosamente.', profile: updated });
});

// -------------------------------------------------------------
// MARKETPLACE & DISCOVERY (Public & Client Search)
// -------------------------------------------------------------
router.get('/marketplace/categories', (req, res) => {
  const sqlite = getSqliteDb();
  const categories = sqlite.prepare(`
    SELECT id, name, slug, icon, description, display_order
    FROM categories
    WHERE is_active = 1
    ORDER BY display_order ASC
  `).all() as any[];

  const subcategories = sqlite.prepare(`
    SELECT id, category_id, name, slug, display_order
    FROM subcategories
    WHERE is_active = 1
    ORDER BY display_order ASC
  `).all() as any[];

  const enriched = categories.map(cat => ({
    ...cat,
    subcategories: subcategories.filter(s => s.category_id === cat.id),
  }));

  return res.json({ categories: enriched });
});

router.get('/marketplace/search', (req, res) => {
  const sqlite = getSqliteDb();
  const { q, category, comuna, modality, min_price, max_price, min_rating, user_lat, user_lng, sort } = req.query;

  let querySql = `
    SELECT b.*,
      c.name as category_name, c.slug as category_slug,
      COUNT(DISTINCT r.id) as reviews_count,
      COALESCE(AVG(r.rating), 5.0) as rating_avg,
      MIN(s.price_clp) as min_service_price
    FROM businesses b
    LEFT JOIN categories c ON c.id = b.primary_category_id
    LEFT JOIN reviews r ON r.business_id = b.id AND r.is_hidden = 0
    LEFT JOIN services s ON s.business_id = b.id AND s.status = 'PUBLISHED'
    WHERE b.status = 'PUBLISHED'
  `;

  const params: any[] = [];

  // Search text (Name, description, services, commune)
  if (q && typeof q === 'string') {
    const term = `%${q.trim().toLowerCase()}%`;
    querySql += `
      AND (
        LOWER(b.name) LIKE ? OR
        LOWER(b.description) LIKE ? OR
        LOWER(b.comuna) LIKE ? OR
        EXISTS (
          SELECT 1 FROM services s2
          WHERE s2.business_id = b.id AND LOWER(s2.name) LIKE ?
        )
      )
    `;
    params.push(term, term, term, term);
  }

  // Category filter
  if (category && typeof category === 'string' && category !== 'all') {
    querySql += ` AND (c.slug = ? OR b.primary_category_id = ?) `;
    params.push(category, category);
  }

  // Comuna filter
  if (comuna && typeof comuna === 'string' && comuna !== 'all') {
    querySql += ` AND LOWER(b.comuna) LIKE ? `;
    params.push(`%${comuna.trim().toLowerCase()}%`);
  }

  // Modality
  if (modality && typeof modality === 'string' && modality !== 'all') {
    querySql += ` AND (b.modality = ? OR b.modality = 'both') `;
    params.push(modality);
  }

  querySql += ` GROUP BY b.id `;

  // Having filters for price and rating
  const havingClauses: string[] = [];
  if (min_price) {
    havingClauses.push(`min_service_price >= ${Number(min_price)}`);
  }
  if (max_price) {
    havingClauses.push(`min_service_price <= ${Number(max_price)}`);
  }
  if (min_rating) {
    havingClauses.push(`rating_avg >= ${Number(min_rating)}`);
  }

  if (havingClauses.length > 0) {
    querySql += ` HAVING ${havingClauses.join(' AND ')} `;
  }

  const rawBusinesses = sqlite.prepare(querySql).all(...params) as any[];

  // Calculate Haversine distance if user coordinates provided or comuna coordinates inferred
  const userLatNum = user_lat ? Number(user_lat) : null;
  const userLngNum = user_lng ? Number(user_lng) : null;

  const results = rawBusinesses.map(biz => {
    let distanceKm: number | null = null;
    if (userLatNum !== null && userLngNum !== null && biz.latitude && biz.longitude) {
      distanceKm = localGeolocationProvider.calculateDistanceKm(userLatNum, userLngNum, biz.latitude, biz.longitude);
    }

    // Featured service
    const featuredService = sqlite.prepare(`
      SELECT id, name, price_clp, duration_minutes, price_type
      FROM services
      WHERE business_id = ? AND status = 'PUBLISHED'
      ORDER BY is_featured DESC, price_clp ASC
      LIMIT 1
    `).get(biz.id) as any;

    return {
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      description: biz.description,
      logo_url: biz.logo_url,
      cover_url: biz.cover_url,
      category_name: biz.category_name,
      category_slug: biz.category_slug,
      phone: biz.phone,
      whatsapp: biz.whatsapp,
      address: biz.address,
      comuna: biz.comuna,
      region: biz.region,
      latitude: biz.latitude,
      longitude: biz.longitude,
      modality: biz.modality,
      booking_mode: biz.booking_mode,
      rating_avg: Math.round(Number(biz.rating_avg) * 10) / 10,
      reviews_count: Number(biz.reviews_count),
      min_price: biz.min_service_price || 15000,
      distance_km: distanceKm,
      featured_service: featuredService,
    };
  });

  // Sorting
  if (sort === 'distance' && userLatNum !== null) {
    results.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
  } else if (sort === 'price_asc') {
    results.sort((a, b) => a.min_price - b.min_price);
  } else if (sort === 'price_desc') {
    results.sort((a, b) => b.min_price - a.min_price);
  } else if (sort === 'rating') {
    results.sort((a, b) => b.rating_avg - a.rating_avg);
  } else {
    // Default: Best rated & closest
    results.sort((a, b) => b.rating_avg - a.rating_avg);
  }

  return res.json({
    total: results.length,
    businesses: results,
    santiago_date: getSantiagoDateString(),
  });
});

router.get('/marketplace/business/:slug', (req, res) => {
  const sqlite = getSqliteDb();
  const slug = req.params.slug;

  const business = sqlite.prepare(`
    SELECT b.*, c.name as category_name
    FROM businesses b
    LEFT JOIN categories c ON c.id = b.primary_category_id
    WHERE b.slug = ? AND b.status = 'PUBLISHED'
  `).get(slug) as any;

  if (!business) {
    return res.status(404).json({ error: 'Negocio no encontrado o no publicado.' });
  }

  // Services grouped by category
  const services = sqlite.prepare(`
    SELECT s.*, c.name as category_name
    FROM services s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.business_id = ? AND s.status = 'PUBLISHED'
    ORDER BY s.is_featured DESC, s.display_order ASC
  `).all(business.id) as any[];

  // Staff
  const staff = sqlite.prepare(`
    SELECT s.id, s.name, s.specialty, s.bio, s.photo_url, s.phone
    FROM staff s
    WHERE s.business_id = ? AND s.is_active = 1
    ORDER BY s.display_order ASC
  `).all(business.id) as any[];

  // Hours
  const hours = sqlite.prepare(`
    SELECT day_of_week, open_time, close_time, is_closed
    FROM business_hours
    WHERE business_id = ?
    ORDER BY day_of_week ASC
  `).all(business.id) as any[];

  // Reviews
  const reviews = sqlite.prepare(`
    SELECT r.id, r.customer_name, r.rating, r.comment, r.response, r.response_date, r.created_at,
           st.name as staff_name, srv.name as service_name
    FROM reviews r
    LEFT JOIN staff st ON st.id = r.staff_id
    LEFT JOIN bookings b ON b.id = r.booking_id
    LEFT JOIN services srv ON srv.id = b.service_id
    WHERE r.business_id = ? AND r.is_hidden = 0
    ORDER BY r.created_at DESC
  `).all(business.id) as any[];

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10
    : 5.0;

  return res.json({
    business: {
      ...business,
      rating_avg: avgRating,
      reviews_count: reviews.length,
    },
    services,
    staff,
    hours,
    reviews,
  });
});

// -------------------------------------------------------------
// AVAILABILITY ENGINE ENDPOINTS
// -------------------------------------------------------------
router.get('/availability/slots', (req, res) => {
  const { business_id, service_id, date, staff_id } = req.query;

  if (!business_id || !service_id || !date) {
    return res.status(400).json({ error: 'business_id, service_id y date (YYYY-MM-DD) son requeridos.' });
  }

  const slots = getAvailableSlots({
    businessId: String(business_id),
    serviceId: String(service_id),
    dateStr: String(date),
    staffId: staff_id ? String(staff_id) : undefined,
  });

  return res.json({
    date,
    total_slots: slots.length,
    slots,
  });
});

// -------------------------------------------------------------
// BOOKINGS SYSTEM (Reservations)
// -------------------------------------------------------------
router.post('/bookings', async (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  try {
    const {
      business_id,
      staff_id,
      service_id,
      booking_date,
      start_time,
      modality,
      payment_method,
      client_name,
      client_phone,
      client_email,
      client_notes,
    } = req.body;

    if (!business_id || !service_id || !booking_date || !start_time || !client_name || !client_phone) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la reserva.' });
    }

    // Verify business
    const business = sqlite.prepare('SELECT id, name, owner_id, booking_mode, status FROM businesses WHERE id = ?').get(business_id) as any;
    if (!business || business.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'El negocio seleccionado no está disponible para reservas.' });
    }

    // Verify service and get price from SQLite (never trust client-sent price!)
    const service = sqlite.prepare('SELECT id, name, price_clp, duration_minutes FROM services WHERE id = ? AND business_id = ?').get(service_id, business_id) as any;
    if (!service) {
      return res.status(400).json({ error: 'El servicio solicitado no existe en el catálogo.' });
    }

    // Determine staff member if not provided: pick first available
    let effectiveStaffId = staff_id;
    if (!effectiveStaffId) {
      const candidates = sqlite.prepare(`
        SELECT s.id, s.name FROM staff s
        INNER JOIN staff_services ss ON ss.staff_id = s.id
        WHERE s.business_id = ? AND ss.service_id = ? AND s.is_active = 1
        ORDER BY s.display_order ASC
      `).all(business_id, service_id) as any[];

      for (const cand of candidates) {
        if (isSlotAvailable({ businessId: business_id, staffId: cand.id, serviceId: service_id, dateStr: booking_date, startTime: start_time, durationMinutes: service.duration_minutes })) {
          effectiveStaffId = cand.id;
          break;
        }
      }

      if (!effectiveStaffId && candidates.length > 0) {
        effectiveStaffId = candidates[0].id;
      }
    }

    if (!effectiveStaffId) {
      return res.status(400).json({ error: 'No hay profesional disponible para este servicio en el negocio.' });
    }

    // ATOMIC AVAILABILITY CHECK WITH TRANSACTION
    sqlite.exec('BEGIN TRANSACTION;');

    const available = isSlotAvailable({
      businessId: business_id,
      staffId: effectiveStaffId,
      serviceId: service_id,
      dateStr: booking_date,
      startTime: start_time,
      durationMinutes: service.duration_minutes,
    });

    if (!available) {
      sqlite.exec('ROLLBACK;');
      return res.status(409).json({ error: 'El horario seleccionado ya no está disponible. Por favor elige otro horario.' });
    }

    // Calculate end time
    const [h, m] = start_time.split(':').map(Number);
    const endMinutes = h * 60 + m + service.duration_minutes;
    const endTimeStr = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const bookingId = generateId('bk');
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bookingCode = `ST-2026-${randomCode}`;
    const now = new Date().toISOString();

    const initialStatus = business.booking_mode === 'MANUAL' ? 'PENDING' : 'CONFIRMED';
    const payMethod = payment_method === 'online' ? 'online' : 'presential';
    const payStatus = 'pending';

    // Link customer user if authenticated
    const customerUserId = req.userId || null;

    sqlite.prepare(`
      INSERT INTO bookings (
        id, code, business_id, staff_id, service_id, customer_user_id,
        booking_date, start_time, end_time, duration_minutes, amount_clp, modality,
        status, payment_method, payment_status, client_name, client_phone, client_email,
        client_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingId,
      bookingCode,
      business_id,
      effectiveStaffId,
      service_id,
      customerUserId,
      booking_date,
      start_time,
      endTimeStr,
      service.duration_minutes,
      service.price_clp,
      modality || 'salon',
      initialStatus,
      payMethod,
      payStatus,
      client_name.trim(),
      client_phone.trim(),
      client_email ? client_email.trim() : null,
      client_notes ? client_notes.trim() : null,
      now,
      now
    );

    // Record initial status in history
    sqlite.prepare(`
      INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
      VALUES (?, ?, 'NONE', ?, ?, 'Reserva creada por el cliente', ?)
    `).run(generateId('bsh'), bookingId, initialStatus, customerUserId, now);

    sqlite.exec('COMMIT;');

    // Notifications
    const staff = sqlite.prepare('SELECT name FROM staff WHERE id = ?').get(effectiveStaffId) as any;
    const statusMsg = initialStatus === 'CONFIRMED'
      ? `Tu reserva con ${staff?.name || 'el profesional'} ha sido confirmada para el ${booking_date} a las ${start_time} hrs.`
      : `Tu solicitud de reserva está pendiente de confirmación por el negocio. Te avisaremos pronto.`;

    if (customerUserId) {
      createNotification(customerUserId, 'booking_created', 'Reserva Registrada', statusMsg, 'booking', bookingId, 'medium');
    }
    createNotification(business.owner_id, 'new_booking_request', 'Nueva Reserva Recibida', `${client_name} ha reservado ${service.name} para el ${booking_date} a las ${start_time} hrs.`, 'booking', bookingId, 'high');

    // Create simulated payment entry if online
    let paymentData = null;
    if (payMethod === 'online') {
      const payResult = await localPaymentProvider.createPayment({
        amountClp: service.price_clp,
        description: `SalonTrack - Reserva ${service.name} (${bookingCode})`,
        payerName: client_name,
        payerEmail: client_email,
        metadata: { bookingId, bookingCode },
      });

      sqlite.prepare(`
        INSERT INTO payments (
          id, user_id, business_id, booking_id, type, amount_clp, currency, provider, provider_payment_id, status, payment_method, metadata, created_at
        ) VALUES (?, ?, ?, ?, 'booking_payment', ?, 'CLP', 'local', ?, 'pending', 'simulated_online', ?, ?)
      `).run(generateId('pay'), customerUserId, business_id, bookingId, service.price_clp, payResult.providerPaymentId, JSON.stringify(payResult), now);

      paymentData = payResult;
    }

    logAudit(customerUserId, business_id, 'BOOKING_CREATED', 'booking', bookingId, { code: bookingCode, amount: service.price_clp });

    return res.status(201).json({
      message: initialStatus === 'CONFIRMED' ? '¡Tu reserva ha sido confirmada con éxito!' : 'Solicitud de reserva enviada al salón.',
      booking: {
        id: bookingId,
        code: bookingCode,
        business_id,
        business_name: business.name,
        staff_name: staff?.name,
        service_name: service.name,
        booking_date,
        start_time,
        end_time: endTimeStr,
        amount_clp: service.price_clp,
        status: initialStatus,
        payment_method: payMethod,
        payment_status: payStatus,
      },
      payment: paymentData,
    });
  } catch (err: any) {
    try { sqlite.exec('ROLLBACK;'); } catch (e) {}
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: 'Error al registrar la reserva.' });
  }
});

router.get('/bookings', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const userId = req.userId!;
  const roles = req.userRoles || getUserRoles(userId);
  const { role_view, status, business_id } = req.query;

  // If viewing as customer
  if (role_view === 'customer' || (!roles.includes('BUSINESS_OWNER') && !roles.includes('BUSINESS_STAFF') && !roles.includes('PLATFORM_ADMIN'))) {
    let sql = `
      SELECT b.*,
             biz.name as business_name, biz.slug as business_slug, biz.phone as business_phone, biz.address as business_address, biz.comuna as business_comuna,
             st.name as staff_name,
             srv.name as service_name,
             r.id as review_id, r.rating as review_rating
      FROM bookings b
      LEFT JOIN businesses biz ON biz.id = b.business_id
      LEFT JOIN staff st ON st.id = b.staff_id
      LEFT JOIN services srv ON srv.id = b.service_id
      LEFT JOIN reviews r ON r.booking_id = b.id
      WHERE b.customer_user_id = ?
    `;
    const params: any[] = [userId];

    if (status && typeof status === 'string' && status !== 'all') {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY b.booking_date DESC, b.start_time DESC';

    const bookings = sqlite.prepare(sql).all(...params);
    return res.json({ bookings, total: bookings.length });
  }

  // Viewing as Business Owner or Staff
  let sql = `
    SELECT b.*,
           biz.name as business_name,
           st.name as staff_name,
           srv.name as service_name
    FROM bookings b
    INNER JOIN businesses biz ON biz.id = b.business_id
    INNER JOIN business_members bm ON bm.business_id = biz.id
    LEFT JOIN staff st ON st.id = b.staff_id
    LEFT JOIN services srv ON srv.id = b.service_id
    WHERE bm.user_id = ? AND bm.is_active = 1
  `;
  const params: any[] = [userId];

  if (business_id) {
    sql += ' AND b.business_id = ?';
    params.push(business_id);
  }

  if (status && typeof status === 'string' && status !== 'all') {
    sql += ' AND b.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY b.booking_date DESC, b.start_time DESC';
  const bookings = sqlite.prepare(sql).all(...params);

  return res.json({ bookings, total: bookings.length });
});

router.get('/bookings/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const booking = sqlite.prepare(`
    SELECT b.*,
           biz.name as business_name, biz.phone as business_phone, biz.address as business_address, biz.comuna as business_comuna,
           st.name as staff_name, st.phone as staff_phone,
           srv.name as service_name, srv.description as service_desc,
           p.status as payment_record_status, p.provider_payment_id
    FROM bookings b
    LEFT JOIN businesses biz ON biz.id = b.business_id
    LEFT JOIN staff st ON st.id = b.staff_id
    LEFT JOIN services srv ON srv.id = b.service_id
    LEFT JOIN payments p ON p.booking_id = b.id
    WHERE b.id = ?
  `).get(req.params.id) as any;

  if (!booking) {
    return res.status(404).json({ error: 'Reserva no encontrada.' });
  }

  return res.json({ booking });
});

router.post('/bookings/:id/confirm', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  if (booking.status !== 'PENDING') {
    return res.status(400).json({ error: `No se puede confirmar una reserva en estado ${booking.status}.` });
  }

  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE bookings
    SET status = 'CONFIRMED', confirmed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, booking.id);

  sqlite.prepare(`
    INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
    VALUES (?, ?, 'PENDING', 'CONFIRMED', ?, 'Confirmada por el profesional', ?)
  `).run(generateId('bsh'), booking.id, req.userId || '', now);

  if (booking.customer_user_id) {
    createNotification(booking.customer_user_id, 'booking_confirmed', '¡Reserva Aceptada!', `Tu cita para el ${booking.booking_date} a las ${booking.start_time} hrs ha sido confirmada.`, 'booking', booking.id, 'high');
  }

  return res.json({ message: 'Reserva confirmada con éxito.', status: 'CONFIRMED' });
});

router.post('/bookings/:id/reject', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { reason } = req.body;
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE bookings
    SET status = 'REJECTED', cancellation_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(reason || 'Rechazada por el negocio', now, booking.id);

  sqlite.prepare(`
    INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
    VALUES (?, ?, ?, 'REJECTED', ?, ?, ?)
  `).run(generateId('bsh'), booking.id, booking.status, req.userId || '', reason || 'Rechazada por el profesional', now);

  if (booking.customer_user_id) {
    createNotification(booking.customer_user_id, 'booking_rejected', 'Reserva no aceptada', `El salón no pudo aceptar tu solicitud para el ${booking.booking_date}. Motivo: ${reason || 'Sin disponibilidad'}.`, 'booking', booking.id, 'medium');
  }

  return res.json({ message: 'Reserva rechazada.', status: 'REJECTED' });
});

router.post('/bookings/:id/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { reason } = req.body;
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
    return res.status(400).json({ error: `No se puede cancelar una reserva en estado ${booking.status}.` });
  }

  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE bookings
    SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(now, reason || 'Cancelada por el usuario', now, booking.id);

  sqlite.prepare(`
    INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
    VALUES (?, ?, ?, 'CANCELLED', ?, ?, ?)
  `).run(generateId('bsh'), booking.id, booking.status, req.userId || '', reason || 'Cancelada', now);

  // If customer cancelled, notify business owner
  const biz = sqlite.prepare('SELECT owner_id FROM businesses WHERE id = ?').get(booking.business_id) as any;
  if (biz && req.userId === booking.customer_user_id) {
    createNotification(biz.owner_id, 'booking_cancelled', 'Cita Cancelada', `La clienta ${booking.client_name} ha cancelado su cita del ${booking.booking_date}.`, 'booking', booking.id, 'high');
  } else if (booking.customer_user_id) {
    createNotification(booking.customer_user_id, 'booking_cancelled', 'Cita Cancelada', `Tu cita para el ${booking.booking_date} fue cancelada por el negocio.`, 'booking', booking.id, 'high');
  }

  return res.json({ message: 'Reserva cancelada correctamente.', status: 'CANCELLED' });
});

router.post('/bookings/:id/complete', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { color_formula, tint_brand, notes } = req.body;
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
    return res.status(400).json({ error: 'No se puede completar una reserva cancelada o rechazada.' });
  }

  const now = new Date().toISOString();

  // 1. Update Booking status to COMPLETED
  sqlite.prepare(`
    UPDATE bookings
    SET status = 'COMPLETED', payment_status = 'paid', completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, booking.id);

  sqlite.prepare(`
    INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
    VALUES (?, ?, ?, 'COMPLETED', ?, 'Atención completada', ?)
  `).run(generateId('bsh'), booking.id, booking.status, req.userId || '', now);

  // 2. CRITICAL SECTION 12.7: INTEGRATION WITH CRM
  // Link or find client in business CRM
  let crmClient = sqlite.prepare(`
    SELECT id FROM clients
    WHERE business_id = ? AND (phone = ? OR full_name = ?)
  `).get(booking.business_id, booking.client_phone, booking.client_name) as any;

  if (!crmClient) {
    const newClientId = generateId('cli');
    sqlite.prepare(`
      INSERT INTO clients (id, user_id, business_id, full_name, phone, notes, preferred_contact, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Clienta registrada automáticamente desde reserva marketplace', 'whatsapp', ?, ?)
    `).run(newClientId, req.userId || '', booking.business_id, booking.client_name, booking.client_phone, now, now);
    crmClient = { id: newClientId };
  }

  // Check service name
  const srv = sqlite.prepare('SELECT name, recommended_interval_days FROM services WHERE id = ?').get(booking.service_id) as any;
  const intervalDays = 30;
  const nextRetouchDate = calculateNextDate(booking.booking_date, intervalDays);

  // Prevent duplicate service history record
  const existingHistory = sqlite.prepare('SELECT id FROM client_service_history WHERE booking_id = ?').get(booking.id);
  if (!existingHistory) {
    sqlite.prepare(`
      INSERT INTO client_service_history (
        id, user_id, business_id, client_id, service_type, color_formula, tint_brand,
        service_date, amount_clp, recommended_interval_days, next_retouch_date, notes, booking_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId('srv'),
      req.userId || '',
      booking.business_id,
      crmClient.id,
      srv?.name || 'Servicio Profesional',
      color_formula || '',
      tint_brand || '',
      booking.booking_date,
      booking.amount_clp,
      intervalDays,
      nextRetouchDate,
      notes || 'Atención completada',
      booking.id,
      now
    );
  }

  // 3. Mark payment as approved if presential payment
  sqlite.prepare(`
    INSERT OR REPLACE INTO payments (
      id, user_id, business_id, booking_id, type, amount_clp, currency, provider, provider_payment_id, status, payment_method, created_at
    ) VALUES (?, ?, ?, ?, 'booking_payment', ?, 'CLP', 'local', ?, 'approved', 'presential', ?)
  `).run(generateId('pay'), booking.customer_user_id, booking.business_id, booking.id, booking.amount_clp, `PRES_PAY_${booking.id}`, now);

  // Notify customer to leave a review
  if (booking.customer_user_id) {
    createNotification(booking.customer_user_id, 'review_request', '¿Cómo estuvo tu atención?', `Tu servicio en ${booking.business_id} ha finalizado. ¡Comparte tu opinión dejando una reseña!`, 'booking', booking.id, 'low');
  }

  refreshDb();
  return res.json({ message: 'Atención completada y registrada en el historial del CRM.', status: 'COMPLETED' });
});

// -------------------------------------------------------------
// LOCAL CHECKOUT & PAYMENT SIMULATION (Section 13)
// -------------------------------------------------------------
router.post('/payments/checkout/simulate', requireAuth, async (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { booking_id, action } = req.body; // action: 'approve' | 'reject' | 'pending' | 'refund'

  if (!booking_id) {
    return res.status(400).json({ error: 'booking_id es requerido para simular el pago.' });
  }

  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  const now = new Date().toISOString();
  let paymentStatus: 'paid' | 'pending' | 'refunded' = 'pending';
  let txStatus: 'approved' | 'rejected' | 'pending' | 'refunded' = 'pending';

  if (action === 'approve') {
    paymentStatus = 'paid';
    txStatus = 'approved';
  } else if (action === 'reject') {
    paymentStatus = 'pending';
    txStatus = 'rejected';
  } else if (action === 'refund') {
    paymentStatus = 'refunded';
    txStatus = 'refunded';
  }

  // Update booking payment status
  sqlite.prepare(`
    UPDATE bookings
    SET payment_status = ?, updated_at = ?
    WHERE id = ?
  `).run(paymentStatus, now, booking.id);

  // Record / update payment
  const providerId = `SIM_PAY_${booking.id}_${Date.now()}`;
  sqlite.prepare(`
    INSERT INTO payments (
      id, user_id, business_id, booking_id, type, amount_clp, currency, provider, provider_payment_id, status, payment_method, metadata, created_at
    ) VALUES (?, ?, ?, ?, 'booking_payment', ?, 'CLP', 'local', ?, ?, 'simulated_online', ?, ?)
  `).run(
    generateId('pay'),
    req.userId || null,
    booking.business_id,
    booking.id,
    booking.amount_clp,
    providerId,
    txStatus,
    JSON.stringify({ simulated: true, action, date: now }),
    now
  );

  return res.json({
    message: txStatus === 'approved' ? '¡Pago simulado aprobado con éxito!' : `Pago marcado como ${txStatus}.`,
    payment_status: paymentStatus,
    transaction_status: txStatus,
    provider_payment_id: providerId,
  });
});

// -------------------------------------------------------------
// REVIEWS & REPUTATION (Section 16)
// -------------------------------------------------------------
router.post('/reviews', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const userId = req.userId!;
  const { booking_id, rating, comment } = req.body;

  if (!booking_id || !rating) {
    return res.status(400).json({ error: 'booking_id y calificación (1 a 5) son requeridos.' });
  }

  const ratingNum = Number(rating);
  if (ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5 estrellas.' });
  }

  // Verify booking belongs to user and is COMPLETED
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

  if (booking.customer_user_id !== userId) {
    return res.status(403).json({ error: 'Solo la persona que reservó puede dejar una reseña.' });
  }

  if (booking.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'Solo puedes calificar servicios que ya hayan sido completados.' });
  }

  // Check duplicate review
  const existingReview = sqlite.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(booking_id);
  if (existingReview) {
    return res.status(400).json({ error: 'Ya has emitido una reseña para esta reserva.' });
  }

  const profile = sqlite.prepare('SELECT full_name FROM user_profiles WHERE user_id = ?').get(userId) as any;
  const customerName = profile?.full_name || booking.client_name;
  const reviewId = generateId('rev');
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO reviews (
      id, business_id, staff_id, booking_id, user_id, customer_name, rating, comment, is_reported, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    reviewId,
    booking.business_id,
    booking.staff_id,
    booking.id,
    userId,
    customerName,
    ratingNum,
    comment ? comment.trim() : '',
    now
  );

  // Notify business owner
  const biz = sqlite.prepare('SELECT owner_id, name FROM businesses WHERE id = ?').get(booking.business_id) as any;
  if (biz) {
    createNotification(biz.owner_id, 'new_review', 'Nueva Reseña Recibida', `${customerName} calificó tu salón con ${ratingNum} estrellas.`, 'review', reviewId, 'medium');
  }

  return res.status(201).json({ message: '¡Gracias por calificar tu atención!', review_id: reviewId });
});

router.post('/reviews/:id/respond', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { response } = req.body;
  if (!response || !response.trim()) {
    return res.status(400).json({ error: 'El texto de respuesta es obligatorio.' });
  }

  const review = sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id) as any;
  if (!review) return res.status(404).json({ error: 'Reseña no encontrada.' });

  // Verify ownership of business
  const isOwner = sqlite.prepare(`
    SELECT 1 FROM businesses WHERE id = ? AND owner_id = ?
  `).get(review.business_id, req.userId || '');

  if (!isOwner) {
    return res.status(403).json({ error: 'Solo el propietario del salón puede responder esta reseña.' });
  }

  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE reviews
    SET response = ?, response_date = ?
    WHERE id = ?
  `).run(response.trim(), now, review.id);

  createNotification(review.user_id, 'review_response', 'El salón respondió a tu reseña', `El equipo de tu salón ha respondido a tu comentario.`, 'review', review.id, 'low');

  return res.json({ message: 'Respuesta publicada con éxito.' });
});

// -------------------------------------------------------------
// FAVORITES (Section 18)
// -------------------------------------------------------------
router.get('/favorites', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const favorites = sqlite.prepare(`
    SELECT f.id as favorite_id, f.created_at as saved_at,
           b.*, c.name as category_name
    FROM favorites f
    INNER JOIN businesses b ON b.id = f.business_id
    LEFT JOIN categories c ON c.id = b.primary_category_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.userId || '');

  return res.json({ favorites, total: favorites.length });
});

router.post('/favorites', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { business_id } = req.body;
  if (!business_id) return res.status(400).json({ error: 'business_id requerido.' });

  try {
    sqlite.prepare(`
      INSERT OR IGNORE INTO favorites (id, user_id, business_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(generateId('fav'), req.userId || '', business_id, new Date().toISOString());
    return res.json({ message: 'Guardado en favoritos.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al guardar favorito.' });
  }
});

router.delete('/favorites/:business_id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  sqlite.prepare('DELETE FROM favorites WHERE user_id = ? AND business_id = ?').run(req.userId || '', req.params.business_id);
  return res.json({ message: 'Eliminado de favoritos.' });
});

// -------------------------------------------------------------
// NOTIFICATIONS IN-APP CENTER (Section 17)
// -------------------------------------------------------------
router.get('/notifications', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const notifications = sqlite.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.userId || '') as any[];

  const unreadCount = notifications.filter(n => !n.is_read).length;
  return res.json({ notifications, unread_count: unreadCount });
});

router.patch('/notifications/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId || '');
  return res.json({ message: 'Notificación leída.' });
});

router.post('/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId || '');
  return res.json({ message: 'Todas las notificaciones marcadas como leídas.' });
});

// -------------------------------------------------------------
// MY BUSINESS MANAGEMENT (Portal Profesional - Section 6 & 15)
// -------------------------------------------------------------
router.get('/business/my', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const business = sqlite.prepare(`
    SELECT b.*, bm.role as member_role
    FROM businesses b
    INNER JOIN business_members bm ON bm.business_id = b.id
    WHERE bm.user_id = ? AND bm.is_active = 1
    LIMIT 1
  `).get(req.userId || '') as any;

  if (!business) {
    return res.json({ business: null, has_business: false });
  }

  // Get staff
  const staff = sqlite.prepare('SELECT * FROM staff WHERE business_id = ? AND is_active = 1 ORDER BY display_order ASC').all(business.id);
  // Get services
  const services = sqlite.prepare("SELECT * FROM services WHERE business_id = ? AND status != 'INACTIVE' ORDER BY display_order ASC").all(business.id);
  // Get hours
  const hours = sqlite.prepare('SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC').all(business.id);

  return res.json({
    has_business: true,
    business,
    staff,
    services,
    hours,
  });
});

router.put('/business/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;

  // Verify permission
  const member = sqlite.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1').get(bizId, req.userId || '') as any;
  if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'No tienes permisos de administración en este negocio.' });
  }

  const {
    name, description, phone, whatsapp, email, website, instagram,
    address, comuna, region, modality, booking_mode, min_advance_hours, max_advance_days, buffer_minutes, cancellation_policy
  } = req.body;

  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE businesses
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        phone = COALESCE(?, phone),
        whatsapp = COALESCE(?, whatsapp),
        email = COALESCE(?, email),
        website = COALESCE(?, website),
        instagram = COALESCE(?, instagram),
        address = COALESCE(?, address),
        comuna = COALESCE(?, comuna),
        region = COALESCE(?, region),
        modality = COALESCE(?, modality),
        booking_mode = COALESCE(?, booking_mode),
        min_advance_hours = COALESCE(?, min_advance_hours),
        max_advance_days = COALESCE(?, max_advance_days),
        buffer_minutes = COALESCE(?, buffer_minutes),
        cancellation_policy = COALESCE(?, cancellation_policy),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() || null,
    description?.trim() || null,
    phone?.trim() || null,
    whatsapp?.trim() || null,
    email?.trim() || null,
    website?.trim() || null,
    instagram?.trim() || null,
    address?.trim() || null,
    comuna?.trim() || null,
    region?.trim() || null,
    modality || null,
    booking_mode || null,
    min_advance_hours ? Number(min_advance_hours) : null,
    max_advance_days ? Number(max_advance_days) : null,
    buffer_minutes ? Number(buffer_minutes) : null,
    cancellation_policy?.trim() || null,
    now,
    bizId
  );

  const updated = sqlite.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId);
  return res.json({ message: 'Datos del negocio actualizados con éxito.', business: updated });
});

// Business Catalog Services
router.post('/business/:id/services', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;

  const member = sqlite.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1').get(bizId, req.userId || '') as any;
  if (!member) return res.status(403).json({ error: 'Permisos insuficientes.' });

  const { name, category_id, description, price_clp, price_type, duration_minutes, is_featured, modality } = req.body;
  if (!name || !price_clp) {
    return res.status(400).json({ error: 'Nombre y precio son requeridos.' });
  }

  const srvId = generateId('srv');
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO services (
      id, business_id, category_id, name, description, price_clp, price_type,
      duration_minutes, prep_minutes, clean_minutes, modality, is_featured, status, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 5, ?, ?, 'PUBLISHED', 1, ?, ?)
  `).run(
    srvId,
    bizId,
    category_id || 'cat_peluqueria',
    name.trim(),
    description?.trim() || '',
    Number(price_clp),
    price_type || 'fixed',
    Number(duration_minutes) || 45,
    modality || 'salon',
    is_featured ? 1 : 0,
    now,
    now
  );

  // Link all current staff to this new service
  const staffMembers = sqlite.prepare('SELECT id FROM staff WHERE business_id = ? AND is_active = 1').all(bizId) as any[];
  for (const st of staffMembers) {
    sqlite.prepare('INSERT OR IGNORE INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      generateId('ss'), st.id, srvId, now
    );
  }

  return res.status(201).json({ message: 'Servicio agregado al catálogo con éxito.', service_id: srvId });
});

router.put('/business/services/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const srvId = req.params.id;
  const srv = sqlite.prepare('SELECT business_id FROM services WHERE id = ?').get(srvId) as any;
  if (!srv) return res.status(404).json({ error: 'Servicio no encontrado.' });

  const member = sqlite.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1').get(srv.business_id, req.userId || '') as any;
  if (!member) return res.status(403).json({ error: 'Permisos insuficientes.' });

  const { name, price_clp, price_type, duration_minutes, description, is_featured, status } = req.body;
  const now = new Date().toISOString();

  sqlite.prepare(`
    UPDATE services
    SET name = COALESCE(?, name),
        price_clp = COALESCE(?, price_clp),
        price_type = COALESCE(?, price_type),
        duration_minutes = COALESCE(?, duration_minutes),
        description = COALESCE(?, description),
        is_featured = COALESCE(?, is_featured),
        status = COALESCE(?, status),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() || null,
    price_clp ? Number(price_clp) : null,
    price_type || null,
    duration_minutes ? Number(duration_minutes) : null,
    description !== undefined ? description.trim() : null,
    is_featured !== undefined ? (is_featured ? 1 : 0) : null,
    status || null,
    now,
    srvId
  );

  return res.json({ message: 'Servicio actualizado correctamente.' });
});

router.delete('/business/services/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const srvId = req.params.id;
  const srv = sqlite.prepare('SELECT business_id FROM services WHERE id = ?').get(srvId) as any;
  if (!srv) return res.status(404).json({ error: 'Servicio no encontrado.' });

  // Safe soft delete to preserve completed booking history!
  sqlite.prepare("UPDATE services SET status = 'INACTIVE', updated_at = ? WHERE id = ?").run(new Date().toISOString(), srvId);
  return res.json({ message: 'Servicio archivado del catálogo.' });
});

// Business Team Staff
router.post('/business/:id/staff', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;

  const member = sqlite.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1').get(bizId, req.userId || '') as any;
  if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Solo el dueño o administrador puede agregar trabajadores.' });
  }

  const { name, specialty, phone, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del trabajador es obligatorio.' });

  const staffId = generateId('stf');
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO staff (id, business_id, name, specialty, bio, phone, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 2, ?)
  `).run(staffId, bizId, name.trim(), specialty?.trim() || 'Estilista', bio?.trim() || '', phone?.trim() || '', now);

  // Default hours (Mon-Sat 09:30-19:30)
  for (let d = 1; d <= 6; d++) {
    sqlite.prepare(`
      INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
      VALUES (?, ?, ?, '09:30', '19:30', '14:00', '15:00', 1, ?)
    `).run(generateId('sa'), staffId, d, now);
  }

  // Assign existing services to new staff
  const services = sqlite.prepare('SELECT id FROM services WHERE business_id = ? AND status = "PUBLISHED"').all(bizId) as any[];
  for (const s of services) {
    sqlite.prepare('INSERT OR IGNORE INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
      generateId('ss'), staffId, s.id, now
    );
  }

  return res.status(201).json({ message: 'Trabajador agregado exitosamente al equipo.', staff_id: staffId });
});

// Business Hours
router.put('/business/:id/hours', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;
  const { hours } = req.body; // Array of { day_of_week, open_time, close_time, is_closed }

  if (!Array.isArray(hours)) {
    return res.status(400).json({ error: 'hours debe ser un arreglo de días.' });
  }

  const now = new Date().toISOString();
  for (const h of hours) {
    sqlite.prepare(`
      INSERT OR REPLACE INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`bh_${bizId}_${h.day_of_week}`, bizId, h.day_of_week, h.open_time || '09:30', h.close_time || '19:30', h.is_closed ? 1 : 0, now);
  }

  return res.json({ message: 'Horarios de atención guardados correctamente.' });
});

// -------------------------------------------------------------
// PLATFORM ADMINISTRATION (Section 19 - Role: PLATFORM_ADMIN)
// -------------------------------------------------------------
router.get('/admin/dashboard', requireAuth, requireRole('PLATFORM_ADMIN'), (req, res) => {
  const sqlite = getSqliteDb();

  const totalUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const totalBusinesses = sqlite.prepare('SELECT COUNT(*) as count FROM businesses').get() as any;
  const totalBookings = sqlite.prepare('SELECT COUNT(*) as count FROM bookings').get() as any;
  const totalReviews = sqlite.prepare('SELECT COUNT(*) as count FROM reviews').get() as any;

  const totalRevenue = sqlite.prepare('SELECT COALESCE(SUM(amount_clp), 0) as total FROM payments WHERE status = "approved"').get() as any;

  const popularCategories = sqlite.prepare(`
    SELECT c.name, COUNT(b.id) as business_count
    FROM categories c
    LEFT JOIN businesses b ON b.primary_category_id = c.id
    GROUP BY c.id
    ORDER BY business_count DESC
    LIMIT 5
  `).all();

  const recentBookings = sqlite.prepare(`
    SELECT b.id, b.code, b.booking_date, b.amount_clp, b.status,
           biz.name as business_name, b.client_name
    FROM bookings b
    LEFT JOIN businesses biz ON biz.id = b.business_id
    ORDER BY b.created_at DESC
    LIMIT 10
  `).all();

  return res.json({
    metrics: {
      total_users: totalUsers.count,
      total_businesses: totalBusinesses.count,
      total_bookings: totalBookings.count,
      total_reviews: totalReviews.count,
      total_revenue_clp: totalRevenue.total,
    },
    popular_categories: popularCategories,
    recent_bookings: recentBookings,
    santiago_date: getSantiagoDateString(),
  });
});

router.get('/admin/users', requireAuth, requireRole('PLATFORM_ADMIN'), (req, res) => {
  const sqlite = getSqliteDb();
  const users = sqlite.prepare(`
    SELECT u.id, u.email, u.is_active, u.created_at,
           p.full_name, p.phone
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  `).all() as any[];

  const enriched = users.map(u => ({
    ...u,
    roles: getUserRoles(u.id),
  }));

  return res.json({ users: enriched });
});

router.post('/admin/users/:id/toggle-status', requireAuth, requireRole('PLATFORM_ADMIN'), (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const user = sqlite.prepare('SELECT id, is_active FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const nextStatus = user.is_active ? 0 : 1;
  sqlite.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(nextStatus, user.id);
  logAudit(req.userId || null, null, nextStatus ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_SUSPENDED', 'user', user.id);

  return res.json({ message: nextStatus ? 'Usuario reactivado.' : 'Usuario suspendido.', is_active: nextStatus });
});

router.get('/admin/businesses', requireAuth, requireRole('PLATFORM_ADMIN'), (req, res) => {
  const sqlite = getSqliteDb();
  const businesses = sqlite.prepare(`
    SELECT b.*, c.name as category_name, u.email as owner_email,
           COUNT(DISTINCT bk.id) as total_bookings
    FROM businesses b
    LEFT JOIN categories c ON c.id = b.primary_category_id
    LEFT JOIN users u ON u.id = b.owner_id
    LEFT JOIN bookings bk ON bk.business_id = b.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `).all();

  return res.json({ businesses });
});

router.post('/admin/businesses/:id/status', requireAuth, requireRole('PLATFORM_ADMIN'), (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { status } = req.body; // 'PUBLISHED' | 'SUSPENDED' | 'DRAFT'
  if (!status) return res.status(400).json({ error: 'status requerido.' });

  sqlite.prepare('UPDATE businesses SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), req.params.id);
  logAudit(req.userId || null, req.params.id, 'ADMIN_BUSINESS_STATUS_CHANGE', 'business', req.params.id, { status });

  return res.json({ message: `Estado del negocio cambiado a ${status}.` });
});

router.get('/admin/audit-logs', requireAuth, requireRole('PLATFORM_ADMIN'), (req, res) => {
  const sqlite = getSqliteDb();
  const logs = sqlite.prepare(`
    SELECT a.*, u.email as user_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all();

  return res.json({ logs });
});

// -------------------------------------------------------------
// EXISTING CRM & RETOUCHES ROUTES (Preserved with 100% compatibility)
// -------------------------------------------------------------
router.get('/clients', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.userId!;
  const { filter, search } = req.query;
  const todayStr = getSantiagoDateString();

  let userClients = db.clients.filter(c => c.user_id === userId);

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    userClients = userClients.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  }

  const enriched = userClients.map(client => {
    const clientServices = db.services
      .filter(s => s.user_id === userId && s.client_id === client.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    const latestService = clientServices[0] || null;

    const clientLogs = db.contact_logs
      .filter(l => l.user_id === userId && l.client_id === client.id)
      .sort((a, b) => b.contact_date.localeCompare(a.contact_date));

    const latestContact = clientLogs[0] || null;

    let retouchInfo = null;
    if (latestService) {
      retouchInfo = getRetouchStatus(latestService.next_retouch_date, todayStr);
    }

    const isContactedRecently = latestContact &&
      (new Date().getTime() - new Date(latestContact.contact_date).getTime() < 7 * 24 * 60 * 60 * 1000);

    return {
      ...client,
      latest_service: latestService,
      total_services: clientServices.length,
      retouch: retouchInfo,
      latest_contact: latestContact,
      contact_status: isContactedRecently ? 'contacted' : 'pending_contact',
    };
  });

  let filtered = enriched;
  if (filter === 'upcoming') {
    filtered = enriched.filter(c => c.retouch && (c.retouch.status === 'upcoming' || c.retouch.status === 'this_week' || c.retouch.status === 'today'));
  } else if (filter === 'overdue') {
    filtered = enriched.filter(c => c.retouch && c.retouch.status === 'overdue');
  } else if (filter === 'contacted') {
    filtered = enriched.filter(c => c.contact_status === 'contacted');
  } else if (filter === 'pending_contact') {
    filtered = enriched.filter(c => c.contact_status === 'pending_contact');
  }

  return res.json({ clients: filtered, total: filtered.length, santiago_date: todayStr });
});

router.post('/clients', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { full_name, phone, notes, initial_service } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Nombre completo y teléfono son obligatorios.' });
    }

    const db = getDb();
    const clientId = generateId('cli');
    const now = new Date().toISOString();

    let cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('9')) cleanPhone = `+56${cleanPhone}`;
      else if (cleanPhone.startsWith('56')) cleanPhone = `+${cleanPhone}`;
    }

    const newClient: Client = {
      id: clientId,
      user_id: userId,
      full_name: full_name.trim(),
      phone: cleanPhone,
      notes: notes?.trim() || '',
      created_at: now,
      updated_at: now,
    };

    db.clients.push(newClient);

    let createdService = null;
    if (initial_service && initial_service.service_type) {
      const serviceDate = initial_service.service_date || getSantiagoDateString();
      const intervalDays = Number(initial_service.recommended_interval_days) || 30;
      const nextDate = calculateNextDate(serviceDate, intervalDays);

      createdService = {
        id: generateId('srv'),
        user_id: userId,
        client_id: clientId,
        service_type: initial_service.service_type.trim(),
        color_formula: initial_service.color_formula?.trim() || '',
        tint_brand: initial_service.tint_brand?.trim() || '',
        service_date: serviceDate,
        amount_clp: Math.round(Number(initial_service.amount_clp) || 0),
        recommended_interval_days: intervalDays,
        next_retouch_date: nextDate,
        notes: initial_service.notes?.trim() || '',
        created_at: now,
      };
      db.services.push(createdService);
    }

    saveDb(db);

    return res.status(201).json({
      message: 'Clienta registrada con éxito.',
      client: newClient,
      service: createdService,
    });
  } catch (e: any) {
    console.error('Error creating client:', e);
    return res.status(500).json({ error: 'Error al registrar la clienta.' });
  }
});

router.get('/clients/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const client = db.clients.find(c => c.id === req.params.id && c.user_id === userId);

  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  const services = db.services
    .filter(s => s.client_id === client.id && s.user_id === userId)
    .sort((a, b) => b.service_date.localeCompare(a.service_date));

  const contactLogs = db.contact_logs
    .filter(l => l.client_id === client.id && l.user_id === userId)
    .sort((a, b) => b.contact_date.localeCompare(a.contact_date));

  const todayStr = getSantiagoDateString();
  const latestService = services[0] || null;
  const retouch = latestService ? getRetouchStatus(latestService.next_retouch_date, todayStr) : null;

  return res.json({
    client,
    services,
    contact_logs: contactLogs,
    retouch,
    santiago_date: todayStr,
  });
});

router.put('/clients/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const index = db.clients.findIndex(c => c.id === req.params.id && c.user_id === userId);

  if (index === -1) return res.status(404).json({ error: 'Clienta no encontrada.' });

  const { full_name, phone, notes } = req.body;
  if (!full_name || !phone) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });

  db.clients[index] = {
    ...db.clients[index],
    full_name: full_name.trim(),
    phone: phone.trim(),
    notes: notes !== undefined ? notes.trim() : db.clients[index].notes,
    updated_at: new Date().toISOString(),
  };

  saveDb(db);
  return res.json({ message: 'Clienta actualizada con éxito.', client: db.clients[index] });
});

router.delete('/clients/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const clientId = req.params.id;

  const clientIndex = db.clients.findIndex(c => c.id === clientId && c.user_id === userId);
  if (clientIndex === -1) return res.status(404).json({ error: 'Clienta no encontrada.' });

  db.clients.splice(clientIndex, 1);
  db.services = db.services.filter(s => !(s.client_id === clientId && s.user_id === userId));
  db.contact_logs = db.contact_logs.filter(l => !(l.client_id === clientId && l.user_id === userId));

  saveDb(db);
  return res.json({ message: 'Clienta y su historial han sido eliminados correctamente.' });
});

router.post('/services', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    const { client_id, service_type, color_formula, tint_brand, service_date, amount_clp, recommended_interval_days, notes } = req.body;

    if (!client_id || !service_type) {
      return res.status(400).json({ error: 'Clienta y tipo de servicio son requeridos.' });
    }

    const client = db.clients.find(c => c.id === client_id && c.user_id === userId);
    if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

    const sDate = service_date || getSantiagoDateString();
    const intervalDays = Number(recommended_interval_days) || 30;
    const nextDate = calculateNextDate(sDate, intervalDays);

    const newService: Service = {
      id: generateId('srv'),
      user_id: userId,
      client_id,
      service_type: service_type.trim(),
      color_formula: color_formula?.trim() || '',
      tint_brand: tint_brand?.trim() || '',
      service_date: sDate,
      amount_clp: Math.round(Number(amount_clp) || 0),
      recommended_interval_days: intervalDays,
      next_retouch_date: nextDate,
      notes: notes?.trim() || '',
      created_at: new Date().toISOString(),
    };

    db.services.push(newService);
    client.updated_at = new Date().toISOString();
    saveDb(db);

    return res.status(201).json({ message: 'Servicio registrado correctamente en el historial.', service: newService });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error al registrar servicio.' });
  }
});

router.delete('/services/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const srvIndex = db.services.findIndex(s => s.id === req.params.id && s.user_id === userId);
  if (srvIndex === -1) return res.status(404).json({ error: 'Servicio no encontrado.' });

  db.services.splice(srvIndex, 1);
  saveDb(db);
  return res.json({ message: 'Servicio eliminado del historial.' });
});

router.post('/contact-logs', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const { client_id, status, notes } = req.body;

  if (!client_id) return res.status(400).json({ error: 'ID de clienta requerido.' });

  const client = db.clients.find(c => c.id === client_id && c.user_id === userId);
  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  const log: ContactLog = {
    id: generateId('log'),
    user_id: userId,
    client_id,
    contact_date: new Date().toISOString(),
    channel: 'whatsapp',
    status: status || 'contacted',
    notes: notes || 'Contacto de recordatorio de retoque vía WhatsApp',
    created_at: new Date().toISOString(),
  };

  db.contact_logs.push(log);
  saveDb(db);

  return res.status(201).json({ message: 'Contacto registrado.', log });
});

router.get('/dashboard/stats', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const todayStr = getSantiagoDateString();

  const userClients = db.clients.filter(c => c.user_id === userId);
  const userServices = db.services.filter(s => s.user_id === userId);

  let retouchesThisWeek = 0;
  let retouchesOverdue = 0;
  let potentialRevenueWeekCLP = 0;
  let potentialRevenueMonthCLP = 0;
  let totalServiceAmounts = 0;
  let pendingContactCount = 0;

  const urgentRetouches: any[] = [];
  const clientRevenueBreakdown: any[] = [];

  userClients.forEach(client => {
    const clientServices = userServices
      .filter(s => s.client_id === client.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    const latestService = clientServices[0];
    if (latestService) {
      totalServiceAmounts += latestService.amount_clp;
      const status = getRetouchStatus(latestService.next_retouch_date, todayStr);

      const recentContact = db.contact_logs.some(
        l => l.client_id === client.id &&
             l.user_id === userId &&
             (new Date().getTime() - new Date(l.contact_date).getTime() < 7 * 24 * 60 * 60 * 1000)
      );

      if (!recentContact && (status.status === 'today' || status.status === 'this_week' || status.status === 'overdue')) {
        pendingContactCount++;
      }

      if (status.status === 'this_week' || status.status === 'today') {
        retouchesThisWeek++;
        potentialRevenueWeekCLP += latestService.amount_clp;
      }

      if (status.status === 'overdue') {
        retouchesOverdue++;
      }

      if (status.diffDays <= 30) {
        potentialRevenueMonthCLP += latestService.amount_clp;
        clientRevenueBreakdown.push({
          client_id: client.id,
          client_name: client.full_name,
          service_type: latestService.service_type,
          amount_clp: latestService.amount_clp,
          next_retouch_date: latestService.next_retouch_date,
          status: status.status,
          urgency: status.urgency,
          diffDays: status.diffDays,
        });
      }

      if (status.status === 'today' || status.status === 'overdue' || status.diffDays <= 3) {
        urgentRetouches.push({
          client,
          service: latestService,
          retouch: status,
        });
      }
    }
  });

  const averageTicketCLP = userServices.length > 0
    ? Math.round(totalServiceAmounts / Math.max(1, userServices.length))
    : 0;

  const recentClients = [...userClients]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return res.json({
    total_clients: userClients.length,
    retouches_this_week: retouchesThisWeek,
    retouches_overdue: retouchesOverdue,
    potential_revenue_week_clp: potentialRevenueWeekCLP,
    potential_revenue_month_clp: potentialRevenueMonthCLP,
    average_service_ticket_clp: averageTicketCLP,
    pending_contact_count: pendingContactCount,
    urgent_retouches: urgentRetouches,
    recent_clients: recentClients,
    revenue_breakdown: clientRevenueBreakdown.sort((a, b) => a.diffDays - b.diffDays),
    santiago_date: todayStr,
  });
});

router.get('/calendar', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const todayStr = getSantiagoDateString();

  const userClients = db.clients.filter(c => c.user_id === userId);
  const events: any[] = [];

  userClients.forEach(client => {
    const clientServices = db.services
      .filter(s => s.client_id === client.id && s.user_id === userId)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    const latest = clientServices[0];
    if (latest) {
      const status = getRetouchStatus(latest.next_retouch_date, todayStr);
      events.push({
        id: `retouch_${latest.id}`,
        type: 'retouch',
        date: latest.next_retouch_date,
        client_id: client.id,
        client_name: client.full_name,
        client_phone: client.phone,
        service_type: latest.service_type,
        amount_clp: latest.amount_clp,
        status: status.status,
        color_formula: latest.color_formula,
      });
    }

    clientServices.slice(0, 3).forEach(srv => {
      events.push({
        id: `srv_${srv.id}`,
        type: 'completed_service',
        date: srv.service_date,
        client_id: client.id,
        client_name: client.full_name,
        service_type: srv.service_type,
        amount_clp: srv.amount_clp,
        status: 'completed',
      });
    });
  });

  return res.json({ events, santiago_date: todayStr });
});

// Plans & Subscriptions
const PLANS: Record<string, { name: string; price_clp: number; duration_days: number; description: string }> = {
  basic_monthly: {
    name: 'Plan Mensual Estilista',
    price_clp: 9990,
    duration_days: 30,
    description: 'Acceso completo a SalonTrack por 1 mes para estilistas independientes.',
  },
  pro_quarterly: {
    name: 'Plan Trimestral Pro (Recomendado)',
    price_clp: 14990,
    duration_days: 90,
    description: 'Acceso por 3 meses con 50% de ahorro equivalente por mes.',
  },
  annual: {
    name: 'Plan Semestral / Anual Fundador',
    price_clp: 19990,
    duration_days: 180,
    description: 'Acceso por 6 meses para salones en crecimiento y estilistas de alto volumen.',
  },
};

router.get('/subscriptions/plans', (req, res) => {
  res.json({
    plans: PLANS,
    currency: 'CLP',
    tax_info: 'Precios expresados en Pesos Chilenos (CLP). Sujeto a comprobante digital.',
  });
});

router.get('/subscriptions/current', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  let sub = db.subscriptions.find(s => s.user_id === userId);

  if (!sub) {
    const trialExpire = new Date();
    trialExpire.setDate(trialExpire.getDate() + 14);
    sub = {
      id: generateId('sub'),
      user_id: userId,
      plan: 'pro_quarterly',
      status: 'trial',
      start_date: new Date().toISOString(),
      expiration_date: trialExpire.toISOString(),
      payment_provider: 'mercadopago',
      created_at: new Date().toISOString(),
    };
    db.subscriptions.push(sub);
    saveDb(db);
  }

  const expDate = new Date(sub.expiration_date);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isExpired = expDate.getTime() < now.getTime();

  const userPayments = db.payments
    .filter(p => p.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return res.json({
    subscription: {
      ...sub,
      days_remaining: daysRemaining,
      is_active: !isExpired && (sub.status === 'active' || sub.status === 'trial'),
    },
    payments: userPayments,
  });
});

router.post('/payments/create-preference', requireAuth, async (req: AuthRequest, res: Response) => {
  const { plan_id } = req.body;
  const plan = PLANS[plan_id];
  if (!plan) return res.status(400).json({ error: 'Plan seleccionado inválido.' });

  const simulatedPrefId = `PREF_MP_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return res.json({
    preference_id: simulatedPrefId,
    plan_id,
    plan,
    mode: 'mercadopago_sandbox',
    checkout_url: `/?checkout_modal=1&plan=${plan_id}&ref=${simulatedPrefId}`,
    instructions: 'Ambiente de prueba Mercado Pago Chile listo. Puedes confirmar el pago simulado con confirmación backend segura.',
  });
});

router.post('/payments/webhook', (req, res) => {
  return res.status(200).send('Webhook received (simulated local)');
});

router.post('/subscriptions/activate-license', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { plan_id, payment_ref } = req.body;
    const plan = PLANS[plan_id];
    if (!plan) return res.status(400).json({ error: 'Plan seleccionado no existe.' });

    const db = getDb();
    const providerPaymentId = payment_ref || `MP_${Date.now()}`;

    const existingPayment = db.payments.find(p => p.provider_payment_id === providerPaymentId);
    if (existingPayment) {
      return res.json({ message: 'Este pago ya fue procesado.', payment: existingPayment });
    }

    const newPayment: Payment = {
      id: generateId('pay'),
      user_id: userId,
      amount_clp: plan.price_clp,
      currency: 'CLP',
      provider: 'mercadopago',
      provider_payment_id: providerPaymentId,
      status: 'approved',
      plan: plan_id,
      created_at: new Date().toISOString(),
    };
    db.payments.push(newPayment);

    let sub = db.subscriptions.find(s => s.user_id === userId);
    const startDate = new Date();
    let currentExp = sub ? new Date(sub.expiration_date) : new Date();
    const baseDate = (currentExp.getTime() > startDate.getTime()) ? currentExp : startDate;
    baseDate.setDate(baseDate.getDate() + plan.duration_days);

    if (sub) {
      sub.plan = plan_id as any;
      sub.status = 'active';
      sub.expiration_date = baseDate.toISOString();
    } else {
      sub = {
        id: generateId('sub'),
        user_id: userId,
        plan: plan_id as any,
        status: 'active',
        start_date: startDate.toISOString(),
        expiration_date: baseDate.toISOString(),
        payment_provider: 'mercadopago',
        created_at: startDate.toISOString(),
      };
      db.subscriptions.push(sub);
    }

    saveDb(db);

    return res.json({
      message: `¡Licencia activada con éxito! Acceso habilitado hasta el ${baseDate.toLocaleDateString('es-CL')}.`,
      subscription: sub,
      payment: newPayment,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al activar la licencia.' });
  }
});

router.get('/backup/export', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const exportData = {
    user: db.users.find(u => u.id === userId),
    profile: db.profiles.find(p => p.user_id === userId),
    clients: db.clients.filter(c => c.user_id === userId),
    services: db.services.filter(s => s.user_id === userId),
    contact_logs: db.contact_logs.filter(l => l.user_id === userId),
    subscription: db.subscriptions.find(s => s.user_id === userId),
    payments: db.payments.filter(p => p.user_id === userId),
    exported_at: new Date().toISOString(),
  };

  res.setHeader('Content-Disposition', `attachment; filename="salontrack_backup_${getSantiagoDateString()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  return res.json(exportData);
});

// Re-engagement Module
router.get('/re-engagement', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const profile = db.profiles.find(p => p.user_id === userId);
  const todayStr = getSantiagoDateString();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayMs = new Date(Date.UTC(ty, tm - 1, td)).getTime();

  const queryThreshold = req.query.threshold_days ? Number(req.query.threshold_days) : null;
  const thresholdDays = queryThreshold || profile?.re_engagement_days_threshold || 90;

  const userClients = db.clients.filter(c => c.user_id === userId);
  const userServices = db.services.filter(s => s.user_id === userId);

  const defaultReEngagementTemplate = profile?.re_engagement_template ||
    '¡Hola {nombre}! En {salon} te extrañamos un montón 💕 Vimos que han pasado varias semanas desde tu último {servicio}. Queremos invitarte a renovar tu look con un beneficio especial: 15% de descuento en tu retoque o baño de luz si reservas esta semana. ¿Te gustaría agendar? ✨💇‍♀️';

  const candidates: any[] = [];
  let totalRecoverableClp = 0;
  let recontactedCount = 0;
  let reactivatedCount = 0;

  userClients.forEach(client => {
    const clientServices = userServices
      .filter(s => s.client_id === client.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    const latestService = clientServices[0];
    let lastVisitDate = latestService ? latestService.service_date : client.created_at.split('T')[0];
    const [ly, lm, ld] = lastVisitDate.split('-').map(Number);
    const lastVisitMs = new Date(Date.UTC(ly, lm - 1, ld)).getTime();

    const daysSinceLastVisit = Math.max(0, Math.round((todayMs - lastVisitMs) / (1000 * 60 * 60 * 24)));

    if (daysSinceLastVisit >= thresholdDays) {
      const status = client.re_engagement_status || 'none';
      if (status === 'recontacted') recontactedCount++;
      if (status === 'reactivated') reactivatedCount++;

      const estimatedAmount = latestService ? latestService.amount_clp : 45000;
      totalRecoverableClp += estimatedAmount;

      let suggestedMsg = defaultReEngagementTemplate
        .replace(/{nombre}/g, client.full_name)
        .replace(/{salon}/g, profile?.business_name || 'nuestro salón')
        .replace(/{estilista}/g, profile?.full_name || 'tu estilista')
        .replace(/{servicio}/g, latestService?.service_type || 'servicio capilar');

      candidates.push({
        client_id: client.id,
        full_name: client.full_name,
        phone: client.phone,
        notes: client.notes,
        last_visit_date: lastVisitDate,
        days_since_last_visit: daysSinceLastVisit,
        months_inactive: (daysSinceLastVisit / 30).toFixed(1),
        latest_service: latestService || null,
        re_engagement_status: status,
        recoverable_amount_clp: estimatedAmount,
        suggested_message: suggestedMsg,
      });
    }
  });

  candidates.sort((a, b) => b.days_since_last_visit - a.days_since_last_visit);

  return res.json({
    threshold_days: thresholdDays,
    total_inactive_clients: candidates.length,
    recontacted_count: recontactedCount,
    reactivated_count: reactivatedCount,
    potential_recoverable_revenue_clp: totalRecoverableClp,
    template: defaultReEngagementTemplate,
    candidates,
    santiago_date: todayStr,
  });
});

router.post('/re-engagement/status', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const { client_id, status, notes } = req.body;

  if (!client_id || !status) return res.status(400).json({ error: 'client_id y status son requeridos.' });

  const client = db.clients.find(c => c.id === client_id && c.user_id === userId);
  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  client.re_engagement_status = status;
  client.updated_at = new Date().toISOString();

  const log: ContactLog = {
    id: generateId('log'),
    user_id: userId,
    client_id,
    contact_date: new Date().toISOString(),
    channel: 'whatsapp',
    status: status === 'reactivated' ? 'scheduled' : 'contacted',
    notes: notes || `Módulo Re-engagement: Marcada como ${status}`,
    created_at: new Date().toISOString(),
  };
  db.contact_logs.push(log);
  saveDb(db);

  return res.json({ message: `Clienta ${client.full_name} actualizada a estado '${status}'.`, client, log });
});

router.put('/re-engagement/template', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const profileIndex = db.profiles.findIndex(p => p.user_id === userId);
  if (profileIndex === -1) return res.status(404).json({ error: 'Perfil no encontrado.' });

  const { template, threshold_days } = req.body;
  if (template !== undefined) db.profiles[profileIndex].re_engagement_template = template;
  if (threshold_days !== undefined) db.profiles[profileIndex].re_engagement_days_threshold = Number(threshold_days);
  db.profiles[profileIndex].updated_at = new Date().toISOString();

  saveDb(db);
  return res.json({ message: 'Plantilla de Re-engagement actualizada con éxito.', profile: db.profiles[profileIndex] });
});

router.get('/notifications/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const profile = db.profiles.find(p => p.user_id === userId);
  return res.json({
    preferences: profile?.notification_preferences || { push_enabled: true, alert_time: '09:00', notify_days_before: 3, sound_enabled: true },
    timezone: profile?.timezone || 'America/Santiago',
  });
});

router.put('/notifications/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const profileIndex = db.profiles.findIndex(p => p.user_id === userId);
  if (profileIndex === -1) return res.status(404).json({ error: 'Perfil no encontrado.' });

  const { push_enabled, alert_time, notify_days_before, sound_enabled, push_subscription } = req.body;
  db.profiles[profileIndex].notification_preferences = {
    push_enabled: push_enabled !== undefined ? Boolean(push_enabled) : true,
    alert_time: alert_time || '09:00',
    notify_days_before: Number(notify_days_before) || 3,
    sound_enabled: sound_enabled !== undefined ? Boolean(sound_enabled) : true,
    push_subscription: push_subscription || db.profiles[profileIndex].notification_preferences?.push_subscription,
  };
  db.profiles[profileIndex].updated_at = new Date().toISOString();
  saveDb(db);

  return res.json({ message: 'Preferencias guardadas.', preferences: db.profiles[profileIndex].notification_preferences });
});

router.get('/notifications/upcoming', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const db = getDb();
  const profile = db.profiles.find(p => p.user_id === userId);
  const todayStr = getSantiagoDateString();
  const daysBefore = profile?.notification_preferences?.notify_days_before || 3;

  const userClients = db.clients.filter(c => c.user_id === userId);
  const userServices = db.services.filter(s => s.user_id === userId);
  const notifications: any[] = [];

  userClients.forEach(client => {
    const clientServices = userServices
      .filter(s => s.client_id === client.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    const latest = clientServices[0];
    if (latest) {
      const status = getRetouchStatus(latest.next_retouch_date, todayStr);
      if (status.status === 'today') {
        notifications.push({
          id: `notif_today_${client.id}`,
          type: 'retouch_today',
          title: `¡Retoque hoy! ${client.full_name}`,
          message: `Tiene programado su retoque de ${latest.service_type} para el día de hoy.`,
          client_id: client.id,
          phone: client.phone,
          urgency: 'high',
          date: todayStr,
        });
      } else if (status.status === 'overdue') {
        notifications.push({
          id: `notif_overdue_${client.id}`,
          type: 'retouch_overdue',
          title: `Retoque atrasado: ${client.full_name}`,
          message: `Han pasado ${Math.abs(status.diffDays)} días desde su fecha recomendada.`,
          client_id: client.id,
          phone: client.phone,
          urgency: 'high',
          date: latest.next_retouch_date,
        });
      } else if (status.diffDays > 0 && status.diffDays <= daysBefore) {
        notifications.push({
          id: `notif_upcoming_${client.id}`,
          type: 'retouch_upcoming',
          title: `Retoque en ${status.diffDays} días: ${client.full_name}`,
          message: `Se aproxima su retoque de ${latest.service_type}. ¡Momento ideal para enviarle WhatsApp!`,
          client_id: client.id,
          phone: client.phone,
          urgency: 'medium',
          date: latest.next_retouch_date,
        });
      }
    }
  });

  return res.json({
    notifications,
    count: notifications.length,
    santiago_date: todayStr,
    alert_time: profile?.notification_preferences?.alert_time || '09:00',
  });
});

export default router;
