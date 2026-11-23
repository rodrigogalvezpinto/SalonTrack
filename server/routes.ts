import { NextFunction, Request, Router, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { generateId, Subscription, Client, Service, ContactLog } from './db.js';
import { hashPassword, verifyPassword, generateToken, optionalAuth, requireAuth, requireRole, getUserRoles, AuthRequest } from './auth.js';
import { getSqliteDb, withTransaction } from './sqlite.js';
import {
  activateLicense,
  createBookingPayment,
  createBookingServiceRecord,
  createClientWithInitialService,
  createContactLog,
  createProfileRecord,
  createServiceRecord,
  createTrialSubscription,
  deleteClient,
  deleteServiceRecord,
  findOrCreateBookingClient,
  getClient,
  getApprovedPaymentRevenue,
  getLatestSubscriptionRecord,
  getOrCreateSubscription,
  getProfile,
  getSubscription,
  getUser,
  hasBookingServiceRecord,
  isSubscriptionActive,
  listClients,
  listContactLogs,
  listPayments,
  listServices,
  listSubscriptionPayments,
  setReEngagementStatus,
  updateClient,
  updateNotificationPreferences,
  updateProfileDetails,
  updateProfileTemplate,
} from './crmRepository.js';
import { getAvailableSlots, getPersonStaffIds, isSlotAvailable } from './availability.js';
import { emailProvider } from './adapters/email.js';
import { localGeolocationProvider, localWhatsAppProvider, localPaymentProvider } from './adapters/index.js';
import {
  createPreference,
  getMercadoPagoPayment,
  mercadoPagoConfigured,
  verifyWebhookSignature,
  type MercadoPagoPayment,
} from './adapters/mercadoPago.js';
import { createRateLimiter } from './rateLimit.js';
import { isBillingEnabled, TRIAL_DAYS } from './billing.js';
import { createNotification } from './notifications.js';

const router = Router();

const AUTH_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LOGIN_EMAIL_MAX_FAILURES = 10;
const AUTH_LOGIN_IP_MAX_FAILURES = 50;
const AUTH_REGISTER_WINDOW_MS = 60 * 60 * 1000;
const AUTH_REGISTER_MAX_REQUESTS_PER_IP = 10;
const AUTH_FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const AUTH_FORGOT_PASSWORD_MAX_REQUESTS_PER_IP = 10;
const AUTH_RESET_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RESET_PASSWORD_MAX_REQUESTS_PER_IP = 20;

const loginEmailRateLimiter = createRateLimiter({
  windowMs: AUTH_LOGIN_WINDOW_MS,
  max: AUTH_LOGIN_EMAIL_MAX_FAILURES,
});
const loginIpRateLimiter = createRateLimiter({
  windowMs: AUTH_LOGIN_WINDOW_MS,
  max: AUTH_LOGIN_IP_MAX_FAILURES,
});
const registerRateLimiter = createRateLimiter({
  windowMs: AUTH_REGISTER_WINDOW_MS,
  max: AUTH_REGISTER_MAX_REQUESTS_PER_IP,
});
const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: AUTH_FORGOT_PASSWORD_WINDOW_MS,
  max: AUTH_FORGOT_PASSWORD_MAX_REQUESTS_PER_IP,
});
const resetPasswordRateLimiter = createRateLimiter({
  windowMs: AUTH_RESET_PASSWORD_WINDOW_MS,
  max: AUTH_RESET_PASSWORD_MAX_REQUESTS_PER_IP,
});

function sendRateLimitedResponse(res: Response, retryAfterSec: number) {
  res.setHeader('Retry-After', String(retryAfterSec));
  return res.status(429).json({
    error: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
    code: 'RATE_LIMITED',
  });
}

function getClientIp(req: Request): string {
  return req.ip || 'unknown';
}

function subscriptionExpiredResponse(res: Response): void {
  res.status(402).json({
    error: 'Tu licencia de SalonTrack venció. Renuévala en Configuración para seguir editando.',
    code: 'SUBSCRIPTION_EXPIRED',
  });
}

function billingDisabledResponse(res: Response): void {
  res.status(409).json({
    error: 'Los planes de pago aún no están habilitados. Tu cuenta es gratis durante el lanzamiento.',
    code: 'BILLING_DISABLED',
  });
}

function requireActiveSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId || !isSubscriptionActive(req.userId)) {
    subscriptionExpiredResponse(res);
    return;
  }
  next();
}

function businessSubscriptionBlocked(res: Response, businessId: string): boolean {
  const business = getSqliteDb().prepare('SELECT owner_id FROM businesses WHERE id = ?')
    .get(businessId) as { owner_id: string } | undefined;
  if (!business || isSubscriptionActive(business.owner_id)) return false;
  subscriptionExpiredResponse(res);
  return true;
}

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

function simulatedPaymentsDisabled(res: Response): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SIMULATED_PAYMENTS !== 'true') {
    res.status(403).json({ error: 'Los pagos simulados no están disponibles en producción.' });
    return true;
  }
  return false;
}

function authorizeBusiness(
  req: AuthRequest,
  res: Response,
  businessId: string,
  allowedRoles: string[] = ['OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION', 'STAFF'],
  inactiveStatus: 403 | 404 = 404
): string | null {
  const member = getSqliteDb().prepare(`
    SELECT role, is_active
    FROM business_members
    WHERE business_id = ? AND user_id = ?
  `).get(businessId, req.userId || '') as { role: string; is_active: number } | undefined;

  if (!member) {
    res.status(404).json({ error: 'Negocio no encontrado.' });
    return null;
  }
  if (!member.is_active) {
    res.status(inactiveStatus).json({
      error: inactiveStatus === 403
        ? 'No tienes permisos para esta acción en el negocio.'
        : 'Negocio no encontrado.',
    });
    return null;
  }
  if (!allowedRoles.includes(member.role)) {
    res.status(403).json({ error: 'No tienes permisos para esta acción en el negocio.' });
    return null;
  }
  return member.role;
}

const BUSINESS_MEMBER_ROLES = ['OWNER', 'ADMIN', 'RECEPTION', 'PROFESSIONAL', 'STAFF'];

function authorizeBookingActor(
  req: AuthRequest,
  res: Response,
  booking: { id: string; business_id: string; staff_id: string | null; customer_user_id?: string | null },
  inactiveStatus: 403 | 404 = 404,
  allowedRoles: string[] = BUSINESS_MEMBER_ROLES,
  allowCustomer = false,
  allowPlatformAdmin = false,
): string | null {
  if (allowCustomer && booking.customer_user_id === req.userId) return 'CUSTOMER';
  if (allowPlatformAdmin && req.userId && getUserRoles(req.userId).includes('PLATFORM_ADMIN')) {
    return 'PLATFORM_ADMIN';
  }

  const role = authorizeBusiness(req, res, booking.business_id, allowedRoles, inactiveStatus);
  if (!role) return null;
  if (role === 'STAFF' || role === 'PROFESSIONAL') {
    const assignedStaff = getSqliteDb().prepare(`
      SELECT 1 FROM staff
      WHERE id = ? AND business_id = ? AND user_id = ?
      LIMIT 1
    `).get(booking.staff_id || '', booking.business_id, req.userId || '');
    if (!assignedStaff) {
      res.status(403).json({ error: 'Solo puedes gestionar tus propias citas.' });
      return null;
    }
  }
  return role;
}

function resolveActiveBusinessId(
  req: AuthRequest,
  res: Response,
  allowedRoles: string[],
): string | null {
  const requestedBusinessId = req.get('x-business-id');
  if (requestedBusinessId) {
    const role = authorizeBusiness(req, res, requestedBusinessId, BUSINESS_MEMBER_ROLES);
    if (!role) return null;
    if (!allowedRoles.includes(role)) {
      res.status(404).json({ error: 'Negocio no encontrado.' });
      return null;
    }
    return requestedBusinessId;
  }

  if (!req.userId || allowedRoles.length === 0) return null;
  const placeholders = allowedRoles.map(() => '?').join(', ');
  const member = getSqliteDb().prepare(`
    SELECT business_id
    FROM business_members
    WHERE user_id = ? AND is_active = 1 AND role IN (${placeholders})
    ORDER BY
      CASE role
        WHEN 'OWNER' THEN 0
        WHEN 'ADMIN' THEN 1
        WHEN 'RECEPTION' THEN 2
        ELSE 3
      END,
      created_at ASC,
      business_id ASC
    LIMIT 1
  `).get(req.userId, ...allowedRoles) as { business_id: string } | undefined;
  return member?.business_id || null;
}

interface BusinessMembershipSummary {
  business_id: string;
  name: string;
  slug: string;
  role: string;
}

function getBusinessMemberships(userId: string): BusinessMembershipSummary[] {
  return getSqliteDb().prepare(`
    SELECT b.id AS business_id, b.name, b.slug, bm.role
    FROM business_members bm
    INNER JOIN businesses b ON b.id = bm.business_id
    WHERE bm.user_id = ? AND bm.is_active = 1
    ORDER BY
      CASE bm.role
        WHEN 'OWNER' THEN 0
        WHEN 'ADMIN' THEN 1
        WHEN 'RECEPTION' THEN 2
        ELSE 3
      END,
      bm.created_at ASC,
      bm.business_id ASC
  `).all(userId) as unknown as BusinessMembershipSummary[];
}

function getUserBusiness(req: Request, userId: string): {
  business: any | null;
  memberships: BusinessMembershipSummary[];
} {
  const sqlite = getSqliteDb();
  const memberships = getBusinessMemberships(userId);
  const requestedBusinessId = req.get('x-business-id');
  const selectedMembership = memberships.find(membership => membership.business_id === requestedBusinessId)
    || memberships[0];
  if (!selectedMembership) return { business: null, memberships };

  const business = sqlite.prepare(`
    SELECT b.*, bm.role AS member_role
    FROM businesses b
    INNER JOIN business_members bm ON bm.business_id = b.id
    WHERE b.id = ? AND bm.user_id = ? AND bm.is_active = 1
  `).get(selectedMembership.business_id, userId) as any;
  if (business) business.auto_confirm_bookings = business.booking_mode === 'AUTOMATIC';
  return { business: business || null, memberships };
}

// -------------------------------------------------------------
// System Health
// -------------------------------------------------------------
router.get('/health', (_req, res) => {
  try {
    getSqliteDb().prepare('SELECT 1').get();
  } catch {
    return res.status(503).json({ status: 'unavailable', database: 'SQLite' });
  }

  return res.json({
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
  const rateLimit = registerRateLimiter.hit(getClientIp(req));
  if (rateLimit.limited) {
    return sendRateLimitedResponse(res, rateLimit.retryAfterSec);
  }

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
    const profileId = generateId('prof');
    const cleanPhone = phone ? phone.trim() : '+56900000000';
    const bizName = (business_name || full_name).trim();
    const assignedRole = role === 'CUSTOMER' ? 'CUSTOMER' : 'BUSINESS_OWNER';

    withTransaction(() => {
      sqlite.prepare(`
        INSERT INTO users (id, email, password_hash, is_active, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(userId, email.trim().toLowerCase(), passwordHash, now);

      createProfileRecord({
        id: profileId,
        user_id: userId,
        full_name: full_name.trim(),
        phone: cleanPhone,
        whatsapp_template: '¡Hola {nombre}! Te saluda {salon} ✨ Te escribo para coordinar tu cita recomendada.',
        created_at: now,
      });
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

      const trialExpire = new Date(now);
      trialExpire.setDate(trialExpire.getDate() + TRIAL_DAYS);
      createTrialSubscription(userId, now, trialExpire.toISOString());
    });

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
        subscription: withSubscriptionStatus(getLatestSubscriptionRecord(userId)),
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

    const normalizedEmail = email.trim().toLowerCase();
    const ip = getClientIp(req);
    const loginKey = `${ip}|${normalizedEmail.slice(0, 254)}`;
    const emailLimit = loginEmailRateLimiter.check(loginKey);
    const ipLimit = loginIpRateLimiter.check(ip);
    if (emailLimit.limited || ipLimit.limited) {
      return sendRateLimitedResponse(res, Math.max(emailLimit.retryAfterSec, ipLimit.retryAfterSec));
    }

    const sqlite = getSqliteDb();
    const user = sqlite.prepare('SELECT id, email, password_hash, is_active FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as any;

    if (!user || !verifyPassword(password, user.password_hash)) {
      loginEmailRateLimiter.hit(loginKey);
      loginIpRateLimiter.hit(ip);
      return res.status(401).json({ error: 'Credenciales incorrectas. Verifica tu correo y contraseña.' });
    }

    loginEmailRateLimiter.reset(loginKey);

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta a soporte.' });
    }

    const profile = getProfile(user.id);
    const subscription = withSubscriptionStatus(getLatestSubscriptionRecord(user.id));
    const roles = getUserRoles(user.id);

    const { business, memberships } = getUserBusiness(req, user.id);

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
        memberships,
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

  const profile = getProfile(req.userId || '');
  const subscription = withSubscriptionStatus(getLatestSubscriptionRecord(req.userId || ''));
  const roles = getUserRoles(user.id);

  const { business, memberships } = getUserBusiness(req, user.id);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      roles,
      profile,
      subscription,
      business,
      memberships,
    },
  });
});

const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = 5;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, character => entities[character]);
}

router.post('/auth/forgot-password', (req, res) => {
  const rateLimit = forgotPasswordRateLimiter.hit(getClientIp(req));
  if (rateLimit.limited) {
    return sendRateLimitedResponse(res, rateLimit.retryAfterSec);
  }

  const { email } = req.body;
  const sqlite = getSqliteDb();
  const user = typeof email === 'string'
    ? sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email.trim().toLowerCase()) as { id: string } | undefined
    : undefined;

  if (user) {
    const now = new Date();
    const resetActivity = sqlite.prepare(`
      SELECT
        MAX(created_at) AS latest_created_at,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) AS recent_count
      FROM password_reset_tokens
      WHERE user_id = ?
    `).get(
      new Date(now.getTime() - PASSWORD_RESET_WINDOW_MS).toISOString(),
      user.id,
    ) as { latest_created_at: string | null; recent_count: number };
    const lastRequestTooRecent = resetActivity.latest_created_at !== null &&
      now.getTime() - Date.parse(resetActivity.latest_created_at) < PASSWORD_RESET_COOLDOWN_MS;

    if (lastRequestTooRecent || resetActivity.recent_count >= PASSWORD_RESET_MAX_REQUESTS_PER_HOUR) {
      console.warn('[Password reset] Solicitud limitada por frecuencia.');
    } else {
      const token = randomBytes(32).toString('hex');
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
      const tokenHash = createHash('sha256').update(token).digest('hex');
      sqlite.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(generateId('prt'), user.id, tokenHash, expiresAt, createdAt);

      const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
      const resetLink = `${appUrl}/?reset_token=${token}`;
      const html = `<p>Recibimos una solicitud para restablecer tu contraseña de SalonTrack.</p><p><a href="${escapeHtml(resetLink)}">Restablecer contraseña</a></p><p>Este enlace vence en 30 minutos.</p>`;
      const text = `Para restablecer tu contraseña de SalonTrack, abre este enlace: ${resetLink}\n\nEl enlace vence en 30 minutos.`;
      void emailProvider.send(email.trim(), 'Recuperación de contraseña', html, text)
        .catch(err => console.error('[Password reset] No se pudo enviar el correo:', err instanceof Error ? err.message : err));
    }
  }

  return res.json({ message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' });
});

router.post('/auth/reset-password', (req, res) => {
  const rateLimit = resetPasswordRateLimiter.hit(getClientIp(req));
  if (rateLimit.limited) {
    return sendRateLimitedResponse(res, rateLimit.retryAfterSec);
  }

  const { token, new_password } = req.body;
  const genericError = { error: 'El enlace de recuperación no es válido o expiró.' };
  if (typeof token !== 'string' || !token) {
    return res.status(400).json(genericError);
  }
  if (typeof new_password !== 'string' || new_password.length < 6) {
    return res.status(400).json({ error: 'Contraseña debe contener al menos 6 caracteres.' });
  }

  const sqlite = getSqliteDb();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString();

  try {
    sqlite.exec('BEGIN IMMEDIATE');
    const resetToken = sqlite.prepare(`
      SELECT id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = ?
    `).get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

    const expirationTime = resetToken ? Date.parse(resetToken.expires_at) : NaN;
    if (!resetToken || resetToken.used_at || !Number.isFinite(expirationTime) || expirationTime <= Date.now()) {
      sqlite.exec('ROLLBACK');
      return res.status(400).json(genericError);
    }

    const updated = sqlite.prepare(`
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE id = ? AND used_at IS NULL AND expires_at > ?
    `).run(now, resetToken.id, now);
    if (updated.changes !== 1) {
      sqlite.exec('ROLLBACK');
      return res.status(400).json(genericError);
    }

    sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(hashPassword(new_password), resetToken.user_id);
    sqlite.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
      .run(now, resetToken.user_id);
    sqlite.exec('COMMIT');
  } catch (error) {
    try {
      sqlite.exec('ROLLBACK');
    } catch {}
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  }

  return res.json({ message: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
});

// -------------------------------------------------------------
// Profile & Settings Endpoints
// -------------------------------------------------------------
router.get('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const profile = getProfile(req.userId || '');
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
  return res.json({ profile });
});

router.put('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId || '';
  const { full_name, phone, default_interval_days, whatsapp_template, re_engagement_template, re_engagement_days_threshold } = req.body;
  const currentProfile = getProfile(userId);
  const reEngagementSettingsChanged = (
    re_engagement_template !== undefined
    && (re_engagement_template ?? '') !== (currentProfile?.re_engagement_template ?? '')
  ) || (
    re_engagement_days_threshold !== undefined
    && Number(re_engagement_days_threshold || 90) !== Number(currentProfile?.re_engagement_days_threshold || 90)
  );
  if (reEngagementSettingsChanged && !isSubscriptionActive(userId)) {
    subscriptionExpiredResponse(res);
    return;
  }

  const updated = updateProfileDetails(userId, {
    full_name,
    phone,
    default_interval_days,
    whatsapp_template,
    re_engagement_template,
    re_engagement_days_threshold,
  });
  return res.json({ message: 'Perfil actualizado exitosamente.', profile: updated });
});

// -------------------------------------------------------------
// MARKETPLACE & DISCOVERY (Public & Client Search)
// -------------------------------------------------------------
function getCategoriesWithSubcategories() {
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

  return enriched;
}

router.get('/marketplace/categories', (_req, res) => {
  return res.json({ categories: getCategoriesWithSubcategories() });
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

router.get('/marketplace/business/:slug', optionalAuth, (req: AuthRequest, res: Response) => {
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
  const isFavorite = req.userId
    ? Boolean(sqlite.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND business_id = ?').get(req.userId, business.id))
    : undefined;

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
    ...(req.userId ? { is_favorite: isFavorite } : {}),
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
router.post('/bookings', optionalAuth, async (req: AuthRequest, res: Response) => {
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
    if (
      typeof booking_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(booking_date) ||
      typeof start_time !== 'string' ||
      !/^\d{2}:\d{2}$/.test(start_time)
    ) {
      return res.status(400).json({ error: 'El formato de fecha u hora no es válido.' });
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

    const match = getAvailableSlots({
      businessId: business_id,
      serviceId: service_id,
      dateStr: booking_date,
      staffId: staff_id || undefined,
    }).find(slot => slot.time === start_time);
    if (!match) {
      return res.status(409).json({ error: 'El horario seleccionado ya no está disponible. Por favor elige otro horario.' });
    }
    const effectiveStaffId = match.staffId;

    const endTimeStr = match.endTime;
    const now = new Date().toISOString();
    const initialStatus = business.booking_mode === 'MANUAL' ? 'PENDING' : 'CONFIRMED';
    const payMethod = payment_method === 'online' ? 'online' : 'presential';
    const payStatus = 'pending';
    const customerUserId = req.userId || null;
    const createdBooking = withTransaction(db => {
      const available = isSlotAvailable({
        businessId: business_id,
        staffId: effectiveStaffId,
        serviceId: service_id,
        dateStr: booking_date,
        startTime: start_time,
        durationMinutes: match.durationMinutes,
      });
      if (!available) return null;

      let bookingCode: string | null = null;
      const currentYear = new Date().getFullYear();
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = `ST-${currentYear}-${randomBytes(4).toString('hex').toUpperCase()}`;
        if (!db.prepare('SELECT 1 FROM bookings WHERE code = ?').get(candidate)) {
          bookingCode = candidate;
          break;
        }
      }
      if (!bookingCode) throw new Error('No se pudo generar un código único para la reserva.');

      const bookingId = generateId('bk');
      db.prepare(`
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
        match.durationMinutes,
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

      db.prepare(`
        INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
        VALUES (?, ?, 'NONE', ?, ?, 'Reserva creada por el cliente', ?)
      `).run(generateId('bsh'), bookingId, initialStatus, customerUserId, now);

      return { bookingId, bookingCode };
    });
    if (!createdBooking) {
      return res.status(409).json({ error: 'El horario seleccionado ya no está disponible. Por favor elige otro horario.' });
    }
    const { bookingId, bookingCode } = createdBooking;

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

      createBookingPayment(sqlite, {
        userId: customerUserId,
        businessId: business_id,
        bookingId,
        amountClp: service.price_clp,
        provider: 'local',
        providerPaymentId: payResult.providerPaymentId,
        status: 'pending',
        paymentMethod: 'simulated_online',
        metadata: JSON.stringify(payResult),
        createdAt: now,
      });

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
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: 'Error al registrar la reserva.' });
  }
});

function listBookings(req: AuthRequest, res: Response, forcedView?: 'customer' | 'business') {
  const sqlite = getSqliteDb();
  const userId = req.userId!;
  const roles = req.userRoles || getUserRoles(userId);
  const { role_view, status, business_id } = req.query;

  // If viewing as customer
  if (forcedView === 'customer' || (!forcedView && (role_view === 'customer' || (!roles.includes('BUSINESS_OWNER') && !roles.includes('BUSINESS_STAFF') && !roles.includes('PLATFORM_ADMIN'))))) {
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

  const businessId = typeof business_id === 'string'
    ? business_id
    : resolveActiveBusinessId(req, res, BUSINESS_MEMBER_ROLES);
  if (!businessId) {
    if (!res.headersSent) res.status(404).json({ error: 'Negocio no encontrado.' });
    return;
  }
  const memberRole = authorizeBusiness(req, res, businessId, BUSINESS_MEMBER_ROLES);
  if (memberRole === null) return;

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
    WHERE bm.user_id = ? AND bm.business_id = ? AND bm.is_active = 1
  `;
  const params: any[] = [userId, businessId];

  if (memberRole === 'STAFF' || memberRole === 'PROFESSIONAL') {
    sql += ' AND b.staff_id IN (SELECT id FROM staff WHERE business_id = ? AND user_id = ?)';
    params.push(businessId, userId);
  }

  if (status && typeof status === 'string' && status !== 'all') {
    sql += ' AND b.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY b.booking_date DESC, b.start_time DESC';
  const bookings = sqlite.prepare(sql).all(...params);

  return res.json({ bookings, total: bookings.length });
}

router.get('/bookings', requireAuth, (req: AuthRequest, res: Response) => listBookings(req, res));
router.get('/bookings/my', requireAuth, (req: AuthRequest, res: Response) => listBookings(req, res, 'customer'));
router.get('/bookings/business', requireAuth, (req: AuthRequest, res: Response) => listBookings(req, res, 'business'));

router.get('/bookings/:id/reschedule-slots', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(req, res, booking, 404, BUSINESS_MEMBER_ROLES, true) === null) return;

  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'El formato de fecha no es válido.' });
  }
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    return res.status(400).json({ error: `No se puede reprogramar una reserva en estado ${booking.status}.` });
  }

  return res.json({
    date,
    slots: getAvailableSlots({
      businessId: booking.business_id,
      serviceId: booking.service_id,
      dateStr: date,
      staffId: booking.staff_id,
      excludeBookingId: booking.id,
    }),
  });
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

  if (authorizeBookingActor(req, res, booking, 404, BUSINESS_MEMBER_ROLES, true, true) === null) return;

  return res.json({ booking });
});

const confirmBookingHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(req, res, booking) === null) return;

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
};
router.post('/bookings/:id/confirm', requireAuth, confirmBookingHandler);

const rejectBookingHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { reason } = req.body;
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(req, res, booking) === null) return;

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
};
router.post('/bookings/:id/reject', requireAuth, rejectBookingHandler);

const cancelBookingHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const { reason } = req.body;
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(
    req,
    res,
    booking,
    404,
    ['OWNER', 'ADMIN', 'STAFF', 'PROFESSIONAL', 'RECEPTION'],
    true,
  ) === null) return;

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
};
router.post('/bookings/:id/cancel', requireAuth, cancelBookingHandler);

router.post('/bookings/:id/reschedule', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(req, res, booking, 404, BUSINESS_MEMBER_ROLES, true) === null) return;

  const { booking_date, start_time, staff_id } = req.body;
  if (
    typeof booking_date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(booking_date) ||
    typeof start_time !== 'string' ||
    !/^\d{2}:\d{2}$/.test(start_time)
  ) {
    return res.status(400).json({ error: 'El formato de fecha u hora no es válido.' });
  }
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    return res.status(400).json({ error: `No se puede reprogramar una reserva en estado ${booking.status}.` });
  }

  const match = getAvailableSlots({
    businessId: booking.business_id,
    serviceId: booking.service_id,
    dateStr: booking_date,
    staffId: staff_id || booking.staff_id,
    excludeBookingId: booking.id,
  }).find(slot => slot.time === start_time);
  if (!match) {
    return res.status(409).json({ error: 'El horario seleccionado ya no está disponible. Por favor elige otro horario.' });
  }

  const now = new Date().toISOString();
  const reason = `Reprogramada de ${booking.booking_date} ${booking.start_time} a ${booking_date} ${start_time}`;
  const updated = withTransaction(db => {
    const available = isSlotAvailable({
      businessId: booking.business_id,
      staffId: match.staffId,
      serviceId: booking.service_id,
      dateStr: booking_date,
      startTime: start_time,
      durationMinutes: match.durationMinutes,
      excludeBookingId: booking.id,
    });
    if (!available) return false;

    db.prepare(`
      UPDATE bookings
      SET booking_date = ?, start_time = ?, end_time = ?, staff_id = ?, duration_minutes = ?, updated_at = ?
      WHERE id = ?
    `).run(booking_date, start_time, match.endTime, match.staffId, match.durationMinutes, now, booking.id);
    db.prepare(`
      INSERT INTO booking_status_history (
        id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(generateId('bsh'), booking.id, booking.status, booking.status, req.userId || null, reason, now);

    const business = db.prepare('SELECT owner_id FROM businesses WHERE id = ?')
      .get(booking.business_id) as { owner_id: string } | undefined;
    if (booking.customer_user_id === req.userId && business) {
      createNotification(
        business.owner_id,
        'booking_rescheduled',
        'Reserva reprogramada',
        `La clienta ${booking.client_name} reprogramó su cita del ${booking.booking_date} ${booking.start_time} al ${booking_date} ${start_time}.`,
        'booking',
        booking.id,
        'high'
      );
    } else if (booking.customer_user_id) {
      createNotification(
        booking.customer_user_id,
        'booking_rescheduled',
        'Reserva reprogramada',
        `Tu cita fue reprogramada por el negocio del ${booking.booking_date} ${booking.start_time} al ${booking_date} ${start_time}.`,
        'booking',
        booking.id,
        'high'
      );
    }
    return true;
  });
  if (!updated) {
    return res.status(409).json({ error: 'El horario seleccionado ya no está disponible. Por favor elige otro horario.' });
  }

  return res.status(200).json({
    message: 'Reserva reprogramada correctamente.',
    booking: {
      id: booking.id,
      booking_date,
      start_time,
      end_time: match.endTime,
      staff_id: match.staffId,
      duration_minutes: match.durationMinutes,
      status: booking.status,
    },
  });
});

const completeBookingHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const {
    color_formula,
    formula_color,
    recommended_retouch_days,
    recommended_interval_days,
    tint_brand,
    notes,
  } = req.body;
  const colorFormula = color_formula ?? formula_color ?? '';
  const parsedDays = Number(recommended_retouch_days ?? recommended_interval_days);
  const intervalDays = Number.isInteger(parsedDays) && parsedDays > 0 && parsedDays <= 365 ? parsedDays : 30;
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(req, res, booking) === null) return;

  if (booking.status !== 'CONFIRMED' && booking.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: `No se puede completar una reserva en estado ${booking.status}.` });
  }

  const now = new Date().toISOString();
  const completed = withTransaction(db => {
    const update = db.prepare(`
      UPDATE bookings
      SET status = 'COMPLETED', payment_status = 'paid', completed_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('CONFIRMED', 'IN_PROGRESS')
    `).run(now, now, booking.id);
    if (update.changes === 0) return false;

    const business = db.prepare('SELECT owner_id, name FROM businesses WHERE id = ?')
      .get(booking.business_id) as { owner_id: string; name: string };
    db.prepare(`
      INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
      VALUES (?, ?, ?, 'COMPLETED', ?, 'Atención completada', ?)
    `).run(generateId('bsh'), booking.id, booking.status, req.userId || '', now);

    if (!hasBookingServiceRecord(db, booking.id)) {
      const crmClient = findOrCreateBookingClient(
        db,
        business.owner_id,
        booking.business_id,
        booking.client_name,
        booking.client_phone,
        now,
      );
      const srv = db.prepare('SELECT name FROM services WHERE id = ?').get(booking.service_id) as any;
      createBookingServiceRecord(db, {
        id: generateId('srv'),
        user_id: business.owner_id,
        client_id: crmClient.id,
        service_type: srv?.name || 'Servicio Profesional',
        color_formula: colorFormula,
        tint_brand: tint_brand || '',
        service_date: booking.booking_date,
        amount_clp: booking.amount_clp,
        recommended_interval_days: intervalDays,
        next_retouch_date: calculateNextDate(booking.booking_date, intervalDays),
        notes: notes || 'Atención completada',
        created_at: now,
      }, booking.business_id, booking.id);
    }

    const hasApprovedPayment = db.prepare(`
      SELECT 1 FROM payments
      WHERE booking_id = ? AND type = 'booking_payment' AND status = 'approved'
      LIMIT 1
    `).get(booking.id);
    if (!hasApprovedPayment) {
      createBookingPayment(db, {
        userId: booking.customer_user_id,
        businessId: booking.business_id,
        bookingId: booking.id,
        amountClp: booking.amount_clp,
        provider: 'local',
        providerPaymentId: `PRES_PAY_${booking.id}`,
        status: 'approved',
        paymentMethod: 'presential',
        createdAt: now,
        replace: true,
      });
    }

    if (booking.customer_user_id) {
      createNotification(booking.customer_user_id, 'review_request', '¿Cómo estuvo tu atención?', `Tu servicio en ${business.name} ha finalizado. ¡Comparte tu opinión dejando una reseña!`, 'booking', booking.id, 'low');
    }
    return true;
  });
  if (!completed) {
    return res.status(409).json({ error: 'La reserva cambió de estado. Recarga e intenta nuevamente.' });
  }
  return res.json({ message: 'Atención completada y registrada en el historial del CRM.', status: 'COMPLETED' });
};
router.post('/bookings/:id/complete', requireAuth, completeBookingHandler);

router.put('/bookings/:id/status', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (authorizeBookingActor(
    req,
    res,
    booking,
    403,
    ['OWNER', 'ADMIN', 'STAFF', 'PROFESSIONAL', 'RECEPTION'],
  ) === null) return;

  const { status } = req.body;
  const transitions: Record<string, string[]> = {
    PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
    CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  };
  if (!transitions[booking.status]?.includes(status)) {
    return res.status(400).json({ error: `No se puede cambiar una reserva de ${booking.status} a ${status}.` });
  }

  const handlers: Record<string, (req: AuthRequest, res: Response) => unknown> = {
    CONFIRMED: confirmBookingHandler,
    REJECTED: rejectBookingHandler,
    CANCELLED: cancelBookingHandler,
    COMPLETED: completeBookingHandler,
  };
  if (handlers[status]) {
    handlers[status](req, res);
    return;
  }

  const now = new Date().toISOString();
  sqlite.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(status, now, booking.id);
  sqlite.prepare(`
    INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId('bsh'), booking.id, booking.status, status, req.userId || '', `Estado actualizado a ${status}`, now);
  return res.json({ message: `Estado actualizado a ${status}.`, status });
});

// -------------------------------------------------------------
// LOCAL CHECKOUT & PAYMENT SIMULATION (Section 13)
// -------------------------------------------------------------
router.post('/payments/checkout/simulate', requireAuth, (req: AuthRequest, res: Response) => {
  if (simulatedPaymentsDisabled(res)) return;
  const sqlite = getSqliteDb();
  const { booking_id, action } = req.body; // action: 'approve' | 'reject' | 'pending' | 'refund'

  if (!booking_id) {
    return res.status(400).json({ error: 'booking_id es requerido para simular el pago.' });
  }

  const booking = sqlite.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id) as any;
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
  if (booking.customer_user_id !== req.userId) {
    return res.status(404).json({ error: 'Reserva no encontrada.' });
  }

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
  createBookingPayment(sqlite, {
    userId: req.userId || null,
    businessId: booking.business_id,
    bookingId: booking.id,
    amountClp: booking.amount_clp,
    provider: 'local',
    providerPaymentId: providerId,
    status: txStatus,
    paymentMethod: 'simulated_online',
    metadata: JSON.stringify({ simulated: true, action, date: now }),
    createdAt: now,
  });

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

  const customerName = getProfile(userId)?.full_name || booking.client_name;
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

  if (authorizeBusiness(req, res, review.business_id, ['OWNER', 'ADMIN']) === null) return;

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

router.post('/favorites/:business_id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const userId = req.userId || '';
  const businessId = req.params.business_id;
  const existing = sqlite.prepare('SELECT id FROM favorites WHERE user_id = ? AND business_id = ?').get(userId, businessId);
  if (existing) {
    sqlite.prepare('DELETE FROM favorites WHERE user_id = ? AND business_id = ?').run(userId, businessId);
    return res.json({ favorited: false });
  }
  sqlite.prepare('INSERT INTO favorites (id, user_id, business_id, created_at) VALUES (?, ?, ?, ?)').run(
    generateId('fav'), userId, businessId, new Date().toISOString()
  );
  return res.json({ favorited: true });
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

const markNotificationRead = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId || '');
  return res.json({ message: 'Notificación leída.' });
};
router.patch('/notifications/:id/read', requireAuth, markNotificationRead);
router.put('/notifications/:id/read', requireAuth, markNotificationRead);

router.post('/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId || '');
  return res.json({ message: 'Todas las notificaciones marcadas como leídas.' });
});

// -------------------------------------------------------------
// MY BUSINESS MANAGEMENT (Portal Profesional - Section 6 & 15)
// -------------------------------------------------------------
router.get('/business/my', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = resolveActiveBusinessId(req, res, ['OWNER', 'ADMIN']);
  if (!businessId) {
    if (!res.headersSent) return res.json({ business: null, has_business: false });
    return;
  }
  const sqlite = getSqliteDb();
  const business = sqlite.prepare(`
    SELECT b.*, bm.role as member_role
    FROM businesses b
    INNER JOIN business_members bm ON bm.business_id = b.id
    WHERE b.id = ? AND bm.user_id = ? AND bm.is_active = 1
    LIMIT 1
  `).get(businessId, req.userId || '') as any;

  if (!business) {
    return res.json({ business: null, has_business: false });
  }
  business.auto_confirm_bookings = business.booking_mode === 'AUTOMATIC';

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

function getManagedBusinessId(req: AuthRequest, res: Response): string | null {
  const businessId = resolveActiveBusinessId(req, res, ['OWNER', 'ADMIN']);
  if (!businessId && !res.headersSent) {
    res.status(404).json({ error: 'Negocio no encontrado.' });
    return null;
  }
  return businessId;
}

router.get('/business/services', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  const services = getSqliteDb().prepare("SELECT * FROM services WHERE business_id = ? AND status != 'INACTIVE' ORDER BY display_order ASC").all(businessId);
  return res.json({ services });
});

router.get('/business/staff', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  const staff = getSqliteDb().prepare(`
    SELECT s.*,
           CASE
             WHEN s.user_id IS NOT NULL THEN 'linked'
             WHEN invitation.id IS NOT NULL THEN 'pending'
             ELSE 'none'
           END AS account_status,
           invitation.id AS invitation_id,
           CASE WHEN s.user_id IS NOT NULL THEN bm.role ELSE NULL END AS member_role
    FROM staff s
    LEFT JOIN business_members bm ON bm.business_id = s.business_id AND bm.user_id = s.user_id
    LEFT JOIN business_invitations invitation ON invitation.id = (
      SELECT bi.id FROM business_invitations bi
      WHERE bi.staff_id = s.id AND bi.status = 'pending'
      ORDER BY bi.created_at DESC
      LIMIT 1
    )
    WHERE s.business_id = ? AND s.is_active = 1
    ORDER BY s.display_order ASC
  `).all(businessId);
  return res.json({ staff });
});

function listStaffAvailability(db: ReturnType<typeof getSqliteDb>, staffId: string) {
  const rows = db.prepare(`
    SELECT day_of_week, is_active, start_time, end_time, break_start, break_end
    FROM staff_availability
    WHERE staff_id = ?
  `).all(staffId) as Array<{
    day_of_week: number;
    is_active: number;
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
  }>;
  const byDay = new Map(rows.map(row => [row.day_of_week, row]));
  return Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    return row
      ? { ...row, is_active: Boolean(row.is_active) }
      : {
        day_of_week: day,
        is_active: false,
        start_time: '09:00',
        end_time: '19:00',
        break_start: null,
        break_end: null,
      };
  });
}

function getBusinessStaffId(
  db: ReturnType<typeof getSqliteDb>,
  businessId: string,
  userId: string,
): string | null {
  const staff = db.prepare(`
    SELECT id FROM staff
    WHERE business_id = ? AND user_id = ? AND is_active = 1
    ORDER BY display_order, id
    LIMIT 1
  `).get(businessId, userId) as { id: string } | undefined;
  return staff?.id || null;
}

function isAvailabilityDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function isAvailabilityDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    && isAvailabilityDate(value.slice(0, 10));
}

function countConflictingBookings(
  db: ReturnType<typeof getSqliteDb>,
  businessId: string,
  staffIds: string[] | null,
  startDatetime: string,
  endDatetime: string,
): number {
  const staffFilter = staffIds
    ? `b.staff_id IN (${staffIds.map(() => '?').join(', ')})`
    : 'b.business_id = ?';
  const params = staffIds
    ? [...staffIds, endDatetime, startDatetime]
    : [businessId, endDatetime, startDatetime];
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM bookings b
    WHERE ${staffFilter}
      AND b.status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')
      AND (b.booking_date || 'T' || b.start_time || ':00') < ?
      AND (b.booking_date || 'T' || b.end_time || ':00') > ?
  `).get(...params) as { count: number };
  return row.count;
}

router.get('/business/staff/:id/availability', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getSqliteDb();
  const staff = db.prepare('SELECT id, business_id, user_id FROM staff WHERE id = ?')
    .get(req.params.id) as { id: string; business_id: string; user_id: string | null } | undefined;
  if (!staff) return res.status(404).json({ error: 'Profesional no encontrado.' });

  if (staff.user_id !== req.userId
    && authorizeBusiness(req, res, staff.business_id, ['OWNER', 'ADMIN', 'RECEPTION']) === null) return;

  return res.json({ availability: listStaffAvailability(db, staff.id) });
});

router.put('/business/staff/:id/availability', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getSqliteDb();
  const staff = db.prepare('SELECT id, business_id FROM staff WHERE id = ?')
    .get(req.params.id) as { id: string; business_id: string } | undefined;
  if (!staff) return res.status(404).json({ error: 'Profesional no encontrado.' });
  if (authorizeBusiness(req, res, staff.business_id, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, staff.business_id)) return;

  const input = req.body?.availability;
  if (!Array.isArray(input) || input.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un horario semanal válido.' });
  }
  const days = new Set<number>();
  const rows: Array<{
    day_of_week: number;
    is_active: number;
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
  }> = [];

  for (const item of input) {
    if (!Number.isInteger(item?.day_of_week) || item.day_of_week < 0 || item.day_of_week > 6
      || days.has(item.day_of_week)) {
      return res.status(400).json({ error: 'Cada día debe estar entre 0 y 6 y no repetirse.' });
    }
    days.add(item.day_of_week);
    if (![true, false, 0, 1].includes(item.is_active)
      || typeof item.start_time !== 'string'
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.start_time)
      || typeof item.end_time !== 'string'
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.end_time)
      || item.start_time >= item.end_time) {
      return res.status(400).json({ error: 'Los horarios deben usar HH:MM y la hora de inicio debe ser anterior al término.' });
    }

    const breakStartEmpty = item.break_start === undefined || item.break_start === null || item.break_start === '';
    const breakEndEmpty = item.break_end === undefined || item.break_end === null || item.break_end === '';
    if (breakStartEmpty !== breakEndEmpty) {
      return res.status(400).json({ error: 'Debes indicar el inicio y el término del descanso.' });
    }
    let breakStart: string | null = null;
    let breakEnd: string | null = null;
    if (!breakStartEmpty) {
      if (typeof item.break_start !== 'string'
        || typeof item.break_end !== 'string'
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.break_start)
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.break_end)
        || item.break_start >= item.break_end
        || item.break_start < item.start_time
        || item.break_end > item.end_time) {
        return res.status(400).json({ error: 'El descanso debe estar dentro del horario de trabajo.' });
      }
      breakStart = item.break_start;
      breakEnd = item.break_end;
    }
    rows.push({
      day_of_week: item.day_of_week,
      is_active: item.is_active ? 1 : 0,
      start_time: item.start_time,
      end_time: item.end_time,
      break_start: breakStart,
      break_end: breakEnd,
    });
  }

  const now = new Date().toISOString();
  withTransaction(transactionDb => {
    for (const row of rows) {
      transactionDb.prepare(`
        INSERT INTO staff_availability (
          id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(staff_id, day_of_week) DO UPDATE SET
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          break_start = excluded.break_start,
          break_end = excluded.break_end,
          is_active = excluded.is_active
      `).run(
        generateId('sa'),
        staff.id,
        row.day_of_week,
        row.start_time,
        row.end_time,
        row.break_start,
        row.break_end,
        row.is_active,
        now,
      );
    }
    logAudit(req.userId || null, staff.business_id, 'STAFF_AVAILABILITY_UPDATED', 'staff', staff.id, {
      days: rows.map(row => row.day_of_week),
    });
  });

  return res.json({ availability: listStaffAvailability(db, staff.id) });
});

router.get('/business/blocks', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getSqliteDb();
  const businessId = resolveActiveBusinessId(req, res, BUSINESS_MEMBER_ROLES);
  if (!businessId) {
    if (!res.headersSent) return res.status(404).json({ error: 'Negocio no encontrado.' });
    return;
  }
  const member = db.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1')
    .get(businessId, req.userId || '') as { role: string } | undefined;
  if (!member) return res.status(404).json({ error: 'Negocio no encontrado.' });

  const today = getSantiagoDateString();
  const defaultEnd = new Date(`${today}T00:00:00Z`);
  defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 90);
  const from = req.query.from === undefined ? today : req.query.from;
  const to = req.query.to === undefined ? defaultEnd.toISOString().slice(0, 10) : req.query.to;
  if (!isAvailabilityDate(from) || !isAvailabilityDate(to) || from > to) {
    return res.status(400).json({ error: 'El rango debe usar fechas válidas y la fecha inicial no puede superar la final.' });
  }

  const canManageAll = member.role === 'OWNER' || member.role === 'ADMIN';
  const ownStaffId = req.userId ? getBusinessStaffId(db, businessId, req.userId) : null;
  const canManageOwn = member.role === 'STAFF' || member.role === 'PROFESSIONAL';
  const staffFilter = canManageOwn ? 'AND (block.staff_id IS NULL OR block.staff_id = ?)' : '';
  const blocks = db.prepare(`
    SELECT block.id, block.staff_id, staff.name AS staff_name,
           block.start_datetime, block.end_datetime, block.reason
    FROM availability_blocks block
    LEFT JOIN staff ON staff.id = block.staff_id
    WHERE block.business_id = ?
      AND block.start_datetime < ?
      AND block.end_datetime > ?
      ${staffFilter}
    ORDER BY block.start_datetime
  `).all(
    businessId,
    `${to}T23:59:59`,
    `${from}T00:00:00`,
    ...(canManageOwn ? [ownStaffId || ''] : []),
  ) as Array<{
    id: string;
    staff_id: string | null;
    staff_name: string | null;
    start_datetime: string;
    end_datetime: string;
    reason: string | null;
  }>;
  const staff = canManageAll
    ? db.prepare(`
      SELECT id, name FROM staff
      WHERE business_id = ? AND is_active = 1
      ORDER BY display_order, name
    `).all(businessId) as Array<{ id: string; name: string }>
    : [];

  return res.json({
    blocks: blocks.map(block => ({
      ...block,
      can_delete: canManageAll || (canManageOwn && block.staff_id === ownStaffId),
    })),
    can_manage_all: canManageAll,
    own_staff_id: ownStaffId,
    staff,
  });
});

router.post('/business/blocks', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getSqliteDb();
  const businessId = resolveActiveBusinessId(req, res, BUSINESS_MEMBER_ROLES);
  if (!businessId) {
    if (!res.headersSent) return res.status(404).json({ error: 'Negocio no encontrado.' });
    return;
  }
  const member = db.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1')
    .get(businessId, req.userId || '') as { role: string } | undefined;
  if (!member) return res.status(404).json({ error: 'Negocio no encontrado.' });

  const start = req.body?.start_datetime;
  const end = req.body?.end_datetime;
  const rawStaffId = req.body?.staff_id;
  const reasonValue = req.body?.reason;
  if (!isAvailabilityDateTime(start) || !isAvailabilityDateTime(end) || start >= end) {
    return res.status(400).json({ error: 'Indica un inicio y término válidos en formato YYYY-MM-DDTHH:MM.' });
  }
  if (Date.parse(`${end}:00Z`) - Date.parse(`${start}:00Z`) > 366 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'El bloqueo no puede superar 366 días.' });
  }
  if (reasonValue !== undefined && reasonValue !== null && typeof reasonValue !== 'string') {
    return res.status(400).json({ error: 'El motivo debe ser texto.' });
  }
  const reason = typeof reasonValue === 'string' ? reasonValue.trim() : '';
  if (reason.length > 200) return res.status(400).json({ error: 'El motivo no puede superar 200 caracteres.' });
  if (rawStaffId !== undefined && rawStaffId !== null && rawStaffId !== '' && typeof rawStaffId !== 'string') {
    return res.status(400).json({ error: 'staff_id debe ser un profesional o null.' });
  }

  const canManageAll = member.role === 'OWNER' || member.role === 'ADMIN';
  const canManageOwn = member.role === 'STAFF' || member.role === 'PROFESSIONAL';
  let staffId = typeof rawStaffId === 'string' && rawStaffId ? rawStaffId : null;
  let affectedStaffIds: string[] | null = null;
  if (canManageAll) {
    if (staffId) {
      const staff = db.prepare(`
        SELECT id FROM staff
        WHERE id = ? AND business_id = ? AND is_active = 1
      `).get(staffId, businessId) as { id: string } | undefined;
      if (!staff) return res.status(404).json({ error: 'Profesional no encontrado en este negocio.' });
      affectedStaffIds = getPersonStaffIds(db, staff.id);
    }
  } else if (canManageOwn) {
    const ownStaffId = req.userId ? getBusinessStaffId(db, businessId, req.userId) : null;
    if (!ownStaffId || staffId !== ownStaffId) {
      return res.status(403).json({ error: 'Solo puedes registrar tus propias ausencias.' });
    }
    staffId = ownStaffId;
    affectedStaffIds = getPersonStaffIds(db, ownStaffId);
  } else {
    return res.status(403).json({ error: 'Solo puedes registrar tus propias ausencias.' });
  }
  if (businessSubscriptionBlocked(res, businessId)) return;

  const startDatetime = `${start}:00`;
  const endDatetime = `${end}:00`;
  const blockId = generateId('block');
  const now = new Date().toISOString();
  const conflictingBookings = withTransaction(transactionDb => {
    transactionDb.prepare(`
      INSERT INTO availability_blocks (id, business_id, staff_id, start_datetime, end_datetime, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(blockId, businessId, staffId, startDatetime, endDatetime, reason || null, now);
    const conflicts = countConflictingBookings(
      transactionDb,
      businessId,
      affectedStaffIds,
      startDatetime,
      endDatetime,
    );
    logAudit(req.userId || null, businessId, 'AVAILABILITY_BLOCK_CREATED', 'availability_block', blockId, {
      staff_id: staffId,
      conflicting_bookings: conflicts,
    });
    return conflicts;
  });
  return res.status(201).json({ block_id: blockId, conflicting_bookings: conflictingBookings });
});

router.delete('/business/blocks/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getSqliteDb();
  const businessId = resolveActiveBusinessId(req, res, BUSINESS_MEMBER_ROLES);
  if (!businessId) {
    if (!res.headersSent) return res.status(404).json({ error: 'Negocio no encontrado.' });
    return;
  }
  const member = db.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ? AND is_active = 1')
    .get(businessId, req.userId || '') as { role: string } | undefined;
  if (!member) return res.status(404).json({ error: 'Negocio no encontrado.' });
  const block = db.prepare(`
    SELECT id, business_id, staff_id FROM availability_blocks
    WHERE id = ? AND business_id = ?
  `).get(req.params.id, businessId) as { id: string; business_id: string; staff_id: string | null } | undefined;
  if (!block) return res.status(404).json({ error: 'Bloqueo no encontrado.' });

  const canManageAll = member.role === 'OWNER' || member.role === 'ADMIN';
  const canManageOwn = member.role === 'STAFF' || member.role === 'PROFESSIONAL';
  const ownStaffId = req.userId ? getBusinessStaffId(db, businessId, req.userId) : null;
  if (!canManageAll && !(canManageOwn && block.staff_id === ownStaffId)) {
    return res.status(403).json({ error: 'No tienes permisos para eliminar este bloqueo.' });
  }
  if (businessSubscriptionBlocked(res, businessId)) return;

  withTransaction(transactionDb => {
    transactionDb.prepare('DELETE FROM availability_blocks WHERE id = ? AND business_id = ?')
      .run(block.id, businessId);
    logAudit(req.userId || null, businessId, 'AVAILABILITY_BLOCK_DELETED', 'availability_block', block.id);
  });
  return res.json({ message: 'Ausencia eliminada.' });
});

router.get('/business/hours', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  const hours = getSqliteDb().prepare('SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week ASC').all(businessId);
  return res.json({ hours });
});

router.put('/business/my', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  req.params.id = businessId;
  return updateBusinessHandler(req, res);
});

const updateBusinessHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;

  if (authorizeBusiness(req, res, bizId, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, bizId)) return;

  const {
    name, description, phone, whatsapp, email, website, instagram,
    address, comuna, region, modality, booking_mode, auto_confirm_bookings,
    min_advance_hours, max_advance_days, buffer_minutes, cancellation_policy
  } = req.body;

  const normalizedBufferMinutes = buffer_minutes !== undefined && buffer_minutes !== ''
    ? Number(buffer_minutes)
    : null;
  if (normalizedBufferMinutes !== null && (!Number.isFinite(normalizedBufferMinutes) || normalizedBufferMinutes < 0)) {
    return res.status(400).json({ error: 'buffer_minutes debe ser un número finito mayor o igual a 0.' });
  }

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
    booking_mode || (auto_confirm_bookings === undefined ? null : (auto_confirm_bookings ? 'AUTOMATIC' : 'MANUAL')),
    min_advance_hours ? Number(min_advance_hours) : null,
    max_advance_days ? Number(max_advance_days) : null,
    normalizedBufferMinutes,
    cancellation_policy?.trim() || null,
    now,
    bizId
  );

  const updated = sqlite.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId);
  return res.json({ message: 'Datos del negocio actualizados con éxito.', business: updated });
};

// Business Catalog Services
const parseBufferMin = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return 5;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const createBusinessServiceHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;

  if (authorizeBusiness(req, res, bizId, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, bizId)) return;

  const { name, category_id, description, price_clp, price_type, duration_minutes, duration_min, buffer_min, is_featured, is_active, modality } = req.body;
  if (!name || !price_clp) {
    return res.status(400).json({ error: 'Nombre y precio son requeridos.' });
  }
  const normalizedBufferMin = parseBufferMin(buffer_min);
  if (normalizedBufferMin === null) {
    return res.status(400).json({ error: 'buffer_min debe ser un número finito mayor o igual a 0.' });
  }

  const srvId = generateId('srv');
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO services (
      id, business_id, category_id, name, description, price_clp, price_type,
      duration_minutes, prep_minutes, clean_minutes, modality, is_featured, status, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    srvId,
    bizId,
    category_id || 'cat_peluqueria',
    name.trim(),
    description?.trim() || '',
    Number(price_clp),
    price_type || 'fixed',
    Number(duration_minutes ?? duration_min) || 45,
    normalizedBufferMin,
    modality || 'salon',
    is_featured ? 1 : 0,
    is_active === false || is_active === 0 ? 'INACTIVE' : 'PUBLISHED',
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
};
router.post('/business/:id/services', requireAuth, createBusinessServiceHandler);
router.post('/business/services', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  req.params.id = businessId;
  return createBusinessServiceHandler(req, res);
});

router.put('/business/services/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const srvId = req.params.id;
  const srv = sqlite.prepare('SELECT business_id FROM services WHERE id = ?').get(srvId) as any;
  if (!srv) return res.status(404).json({ error: 'Servicio no encontrado.' });

  if (authorizeBusiness(req, res, srv.business_id, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, srv.business_id)) return;

  const { name, price_clp, price_type, duration_minutes, duration_min, buffer_min, description, is_featured, status, is_active } = req.body;
  const normalizedBufferMin = buffer_min === undefined ? null : parseBufferMin(buffer_min);
  if (buffer_min !== undefined && normalizedBufferMin === null) {
    return res.status(400).json({ error: 'buffer_min debe ser un número finito mayor o igual a 0.' });
  }
  const now = new Date().toISOString();

  sqlite.prepare(`
    UPDATE services
    SET name = COALESCE(?, name),
        price_clp = COALESCE(?, price_clp),
        price_type = COALESCE(?, price_type),
        duration_minutes = COALESCE(?, duration_minutes),
        clean_minutes = COALESCE(?, clean_minutes),
        description = COALESCE(?, description),
        is_featured = COALESCE(?, is_featured),
        status = COALESCE(?, status),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() || null,
    price_clp ? Number(price_clp) : null,
    price_type || null,
    duration_minutes !== undefined || duration_min !== undefined ? Number(duration_minutes ?? duration_min) : null,
    normalizedBufferMin,
    description !== undefined ? description.trim() : null,
    is_featured !== undefined ? (is_featured ? 1 : 0) : null,
    status || (is_active !== undefined ? (is_active ? 'PUBLISHED' : 'INACTIVE') : null),
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
  if (authorizeBusiness(req, res, srv.business_id, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, srv.business_id)) return;

  // Safe soft delete to preserve completed booking history!
  sqlite.prepare("UPDATE services SET status = 'INACTIVE', updated_at = ? WHERE id = ?").run(new Date().toISOString(), srvId);
  return res.json({ message: 'Servicio archivado del catálogo.' });
});

// Business Team Staff
const BUSINESS_INVITATION_ROLES = ['STAFF', 'RECEPTION', 'ADMIN'] as const;

function normalizeInvitationEmail(value: unknown, optional = false): string | null | undefined {
  if (value === undefined || value === null || value === '') return optional ? null : undefined;
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function normalizeInvitationRole(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return 'STAFF';
  return typeof value === 'string' && BUSINESS_INVITATION_ROLES.includes(value as typeof BUSINESS_INVITATION_ROLES[number])
    ? value
    : null;
}

function hasActiveBusinessMember(db: ReturnType<typeof getSqliteDb>, businessId: string, email: string): boolean {
  return Boolean(db.prepare(`
    SELECT 1
    FROM users u
    INNER JOIN business_members bm ON bm.user_id = u.id
    WHERE bm.business_id = ? AND bm.is_active = 1 AND LOWER(u.email) = ?
    LIMIT 1
  `).get(businessId, email));
}

function hasPendingBusinessInvitation(db: ReturnType<typeof getSqliteDb>, businessId: string, email: string): boolean {
  return Boolean(db.prepare(`
    SELECT 1 FROM business_invitations
    WHERE business_id = ? AND LOWER(email) = ? AND status = 'pending'
    LIMIT 1
  `).get(businessId, email));
}

function createBusinessInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: createHash('sha256').update(token).digest('hex'),
  };
}

function notifyAndEmailInvitation(
  email: string,
  businessName: string,
  invitationId: string,
  token: string,
): Promise<void> {
  const sqlite = getSqliteDb();
  const invitee = sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email) as { id: string } | undefined;
  if (invitee) {
    createNotification(
      invitee.id,
      'team_invitation',
      'Invitación a un equipo',
      `Te invitaron a formar parte de ${businessName}. Acepta o rechaza la invitación desde tu cuenta.`,
      'business_invitation',
      invitationId,
    );
  }

  const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
  const invitationLink = `${appUrl}/?invitation=${encodeURIComponent(invitationId)}&invitation_token=${encodeURIComponent(token)}`;
  const subject = `Invitación para unirte a ${businessName} en SalonTrack`;
  const html = `<p>Te invitaron a formar parte de ${escapeHtml(businessName)} en SalonTrack.</p><p><a href="${escapeHtml(invitationLink)}">Revisar invitación</a></p>`;
  const text = `Te invitaron a formar parte de ${businessName} en SalonTrack. Revisa la invitación desde tu cuenta: ${invitationLink}`;
  return emailProvider.send(email, subject, html, text)
    .then(result => {
      if (!result.success) console.error('[Team invitation] El adaptador no confirmó el envío del correo:', invitationId);
    })
    .catch(error => console.error(
      '[Team invitation] No se pudo enviar el correo:',
      error instanceof Error ? error.message : error,
    ));
}

const createBusinessStaffHandler = async (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;

  if (authorizeBusiness(req, res, bizId, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, bizId)) return;

  const { name, specialty, role_title, phone, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del trabajador es obligatorio.' });
  const email = normalizeInvitationEmail(req.body.email, true);
  if (email === undefined) return res.status(400).json({ error: 'El correo electrónico no es válido.' });
  const memberRole = normalizeInvitationRole(req.body.member_role);
  if (!memberRole) return res.status(400).json({ error: 'member_role debe ser STAFF, RECEPTION o ADMIN.' });
  if (email && hasActiveBusinessMember(sqlite, bizId, email)) {
    return res.status(409).json({ error: 'Esta persona ya pertenece al equipo del negocio.' });
  }
  if (email && hasPendingBusinessInvitation(sqlite, bizId, email)) {
    return res.status(409).json({ error: 'Ya existe una invitación pendiente para este correo.' });
  }

  const staffId = generateId('stf');
  const invitationId = email ? generateId('inv') : null;
  const invitationToken = email ? createBusinessInvitationToken() : null;
  const now = new Date().toISOString();

  try {
    withTransaction(db => {
      if (email && hasActiveBusinessMember(db, bizId, email)) {
        throw new Error('BUSINESS_MEMBER_EXISTS');
      }
      if (email && hasPendingBusinessInvitation(db, bizId, email)) {
        throw new Error('PENDING_INVITATION_EXISTS');
      }

      db.prepare(`
        INSERT INTO staff (id, business_id, name, specialty, bio, phone, email, is_active, display_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 2, ?)
      `).run(staffId, bizId, name.trim(), (specialty || role_title)?.trim() || 'Estilista', bio?.trim() || '', phone?.trim() || '', email || '', now);

      for (let d = 1; d <= 6; d++) {
        db.prepare(`
          INSERT INTO staff_availability (id, staff_id, day_of_week, start_time, end_time, break_start, break_end, is_active, created_at)
          VALUES (?, ?, ?, '09:30', '19:30', '14:00', '15:00', 1, ?)
        `).run(generateId('sa'), staffId, d, now);
      }

      const services = db.prepare("SELECT id FROM services WHERE business_id = ? AND status = 'PUBLISHED'").all(bizId) as any[];
      for (const service of services) {
        db.prepare('INSERT OR IGNORE INTO staff_services (id, staff_id, service_id, created_at) VALUES (?, ?, ?, ?)').run(
          generateId('ss'), staffId, service.id, now
        );
      }

      if (invitationId && email) {
        db.prepare(`
          INSERT INTO business_invitations (
            id, business_id, staff_id, email, token_hash, role, status, invited_by_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(invitationId, bizId, staffId, email, invitationToken!.tokenHash, memberRole, req.userId || null, now);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'BUSINESS_MEMBER_EXISTS') {
      return res.status(409).json({ error: 'Esta persona ya pertenece al equipo del negocio.' });
    }
    if (error instanceof Error && error.message === 'PENDING_INVITATION_EXISTS') {
      return res.status(409).json({ error: 'Ya existe una invitación pendiente para este correo.' });
    }
    console.error('[Team invitation] No se pudo crear el miembro del equipo:', error);
    return res.status(500).json({ error: 'No se pudo agregar al miembro del equipo.' });
  }

  const business = sqlite.prepare('SELECT name FROM businesses WHERE id = ?').get(bizId) as { name: string };
  const invitation = invitationId
    ? sqlite.prepare(`
      SELECT id, business_id, staff_id, email, role, status, invited_by_user_id, created_at, responded_at
      FROM business_invitations WHERE id = ?
    `).get(invitationId)
    : null;
  if (email && invitationId && invitationToken) {
    await notifyAndEmailInvitation(email, business.name, invitationId, invitationToken.token);
  }
  return res.status(201).json({
    message: 'Trabajador agregado exitosamente al equipo.',
    staff_id: staffId,
    invitation,
  });
};
router.post('/business/:id/staff', requireAuth, createBusinessStaffHandler);
router.post('/business/staff', requireAuth, async (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  req.params.id = businessId;
  if (req.body.role_title && !req.body.specialty) req.body.specialty = req.body.role_title;
  return createBusinessStaffHandler(req, res);
});

router.post('/business/staff/:id/invite', requireAuth, async (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  const staff = sqlite.prepare(`
    SELECT id, business_id, user_id FROM staff
    WHERE id = ? AND business_id = ?
  `).get(req.params.id, businessId) as { id: string; business_id: string; user_id: string | null } | undefined;
  if (!staff) return res.status(404).json({ error: 'Trabajador no encontrado.' });
  if (staff.user_id) return res.status(409).json({ error: 'Este trabajador ya tiene una cuenta vinculada.' });
  if (businessSubscriptionBlocked(res, businessId)) return;

  const email = normalizeInvitationEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'El correo electrónico no es válido.' });
  const memberRole = normalizeInvitationRole(req.body.member_role);
  if (!memberRole) return res.status(400).json({ error: 'member_role debe ser STAFF, RECEPTION o ADMIN.' });
  if (hasActiveBusinessMember(sqlite, businessId, email)) {
    return res.status(409).json({ error: 'Esta persona ya pertenece al equipo del negocio.' });
  }
  if (hasPendingBusinessInvitation(sqlite, businessId, email)) {
    return res.status(409).json({ error: 'Ya existe una invitación pendiente para este correo.' });
  }
  const existingStaffInvite = sqlite.prepare(`
    SELECT id FROM business_invitations
    WHERE staff_id = ? AND status = 'pending'
    LIMIT 1
  `).get(staff.id);
  if (existingStaffInvite) {
    return res.status(409).json({ error: 'Este trabajador ya tiene una invitación pendiente.' });
  }

  const invitationId = generateId('inv');
  const invitationToken = createBusinessInvitationToken();
  const now = new Date().toISOString();
  try {
    withTransaction(db => {
      if (hasActiveBusinessMember(db, businessId, email) || hasPendingBusinessInvitation(db, businessId, email)) {
        throw new Error('INVITATION_CONFLICT');
      }
      db.prepare('UPDATE staff SET email = ? WHERE id = ? AND user_id IS NULL').run(email, staff.id);
      db.prepare(`
        INSERT INTO business_invitations (
          id, business_id, staff_id, email, token_hash, role, status, invited_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(invitationId, businessId, staff.id, email, invitationToken.tokenHash, memberRole, req.userId || null, now);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITATION_CONFLICT') {
      return res.status(409).json({ error: 'Ya existe un miembro o una invitación pendiente para este correo.' });
    }
    console.error('[Team invitation] No se pudo crear la invitación:', error);
    return res.status(500).json({ error: 'No se pudo enviar la invitación.' });
  }

  const business = sqlite.prepare('SELECT name FROM businesses WHERE id = ?').get(businessId) as { name: string };
  const invitation = sqlite.prepare(`
    SELECT id, business_id, staff_id, email, role, status, invited_by_user_id, created_at, responded_at
    FROM business_invitations WHERE id = ?
  `).get(invitationId);
  await notifyAndEmailInvitation(email, business.name, invitationId, invitationToken.token);
  return res.status(201).json({ invitation });
});

router.get('/business/invitations', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  const invitations = getSqliteDb().prepare(`
    SELECT bi.id, bi.business_id, bi.staff_id, bi.email, bi.role, bi.status,
           bi.invited_by_user_id, bi.created_at, bi.responded_at, s.name AS staff_name
    FROM business_invitations bi
    LEFT JOIN staff s ON s.id = bi.staff_id
    WHERE bi.business_id = ?
    ORDER BY bi.created_at DESC
  `).all(businessId);
  return res.json({ invitations });
});

router.delete('/business/invitations/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  if (businessSubscriptionBlocked(res, businessId)) return;
  const invitation = sqlite.prepare(`
    SELECT id, status FROM business_invitations
    WHERE id = ? AND business_id = ?
  `).get(req.params.id, businessId) as { id: string; status: string } | undefined;
  if (!invitation) return res.status(404).json({ error: 'Invitación no encontrada.' });
  if (invitation.status !== 'pending') {
    return res.status(409).json({ error: 'La invitación ya no está pendiente.' });
  }
  sqlite.prepare(`
    UPDATE business_invitations SET status = 'revoked', responded_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(new Date().toISOString(), invitation.id);
  return res.json({ message: 'Invitación revocada.' });
});

router.get('/invitations/mine', requireAuth, (req: AuthRequest, res: Response) => {
  const invitations = getSqliteDb().prepare(`
    SELECT bi.id, bi.business_id, bi.staff_id, bi.email, bi.role, bi.created_at,
           b.name AS business_name, b.slug AS business_slug, b.logo_url AS business_logo
    FROM business_invitations bi
    INNER JOIN businesses b ON b.id = bi.business_id
    WHERE LOWER(bi.email) = LOWER(?) AND bi.status = 'pending'
    ORDER BY bi.created_at DESC
  `).all(req.userEmail || '') as Array<{
    id: string;
    business_id: string;
    staff_id: string | null;
    email: string;
    role: string;
    created_at: string;
    business_name: string;
    business_slug: string;
    business_logo: string | null;
  }>;
  return res.json({ invitations });
});

router.post('/invitations/:id/accept', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const userId = req.userId!;
  const userEmail = (req.userEmail || '').trim().toLowerCase();
  const now = new Date().toISOString();
  const outcome = withTransaction(db => {
    const invitation = db.prepare(`
      SELECT id, business_id, staff_id, email, token_hash, role, status, invited_by_user_id
      FROM business_invitations WHERE id = ?
    `).get(req.params.id) as {
      id: string;
      business_id: string;
      staff_id: string | null;
      email: string;
      token_hash: string;
      role: string;
      status: string;
      invited_by_user_id: string | null;
    } | undefined;
    if (!invitation || invitation.email.toLowerCase() !== userEmail) return { kind: 'not_found' as const };
    if (invitation.status !== 'pending') return { kind: 'conflict' as const };
    const suppliedToken = typeof req.body?.token === 'string' ? req.body.token : '';
    const suppliedTokenHash = createHash('sha256').update(suppliedToken).digest();
    const expectedTokenHash = Buffer.from(invitation.token_hash, 'hex');
    if (
      suppliedTokenHash.length !== expectedTokenHash.length ||
      !timingSafeEqual(suppliedTokenHash, expectedTokenHash)
    ) {
      return { kind: 'invalid_token' as const };
    }

    const ownerMembership = db.prepare(`
      SELECT 1 FROM business_members
      WHERE business_id = ? AND user_id = ? AND role = 'OWNER'
    `).get(invitation.business_id, userId);
    if (ownerMembership) return { kind: 'owner' as const };

    if (invitation.staff_id) {
      const staff = db.prepare('SELECT business_id, user_id, is_active FROM staff WHERE id = ?')
        .get(invitation.staff_id) as { business_id: string; user_id: string | null; is_active: number } | undefined;
      if (staff && staff.business_id === invitation.business_id && staff.is_active === 0) {
        return { kind: 'staff_inactive' as const };
      }
      if (staff && staff.business_id === invitation.business_id && staff.user_id && staff.user_id !== userId) {
        return { kind: 'staff_linked' as const };
      }
    }

    db.prepare(`
      INSERT INTO business_members (id, business_id, user_id, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(business_id, user_id) DO UPDATE SET
        role = excluded.role,
        is_active = 1
    `).run(generateId('bm'), invitation.business_id, userId, invitation.role, now);

    if (invitation.staff_id) {
      db.prepare(`
        UPDATE staff SET user_id = ?, is_active = 1
        WHERE id = ? AND business_id = ? AND (user_id IS NULL OR user_id = ?)
      `).run(userId, invitation.staff_id, invitation.business_id, userId);
    }
    db.prepare(`
      INSERT OR IGNORE INTO user_roles (id, user_id, role, created_at)
      VALUES (?, ?, 'BUSINESS_STAFF', ?)
    `).run(generateId('role'), userId, now);
    const updated = db.prepare(`
      UPDATE business_invitations SET status = 'accepted', responded_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(now, invitation.id);
    if (updated.changes !== 1) throw new Error('INVITATION_ALREADY_RESPONDED');
    return {
      kind: 'accepted' as const,
      businessId: invitation.business_id,
      businessName: String((db.prepare('SELECT name FROM businesses WHERE id = ?').get(invitation.business_id) as { name: string }).name),
      inviterId: invitation.invited_by_user_id,
    };
  });

  if (outcome.kind === 'not_found') return res.status(404).json({ error: 'Invitación no encontrada.' });
  if (outcome.kind === 'conflict') return res.status(409).json({ error: 'La invitación ya no está pendiente.' });
  if (outcome.kind === 'invalid_token') {
    return res.status(403).json({ error: 'Abre el enlace de invitación que te enviamos por correo para aceptarla.' });
  }
  if (outcome.kind === 'owner') return res.status(409).json({ error: 'Ya eres propietario de este negocio.' });
  if (outcome.kind === 'staff_linked') return res.status(409).json({ error: 'Este perfil de trabajador ya está vinculado a otra cuenta.' });
  if (outcome.kind === 'staff_inactive') {
    return res.status(409).json({ error: 'Este perfil de trabajador está inactivo. Solicita una nueva invitación.' });
  }

  if (outcome.inviterId) {
    try {
      createNotification(
        outcome.inviterId,
        'team_invitation_accepted',
        'Invitación aceptada',
        `Tu invitación para ${outcome.businessName} fue aceptada.`,
        'business_invitation',
        req.params.id,
      );
    } catch (error) {
      console.error('[Team invitation] No se pudo notificar al administrador:', error);
    }
  }
  return res.json({
    message: `Ahora eres parte de ${outcome.businessName}.`,
    memberships: getBusinessMemberships(userId),
  });
});

router.post('/invitations/:id/decline', requireAuth, (req: AuthRequest, res: Response) => {
  const userEmail = (req.userEmail || '').trim().toLowerCase();
  const invitation = getSqliteDb().prepare(`
    SELECT id, status FROM business_invitations
    WHERE id = ? AND LOWER(email) = LOWER(?)
  `).get(req.params.id, userEmail) as { id: string; status: string } | undefined;
  if (!invitation) return res.status(404).json({ error: 'Invitación no encontrada.' });
  if (invitation.status !== 'pending') return res.status(409).json({ error: 'La invitación ya no está pendiente.' });
  getSqliteDb().prepare(`
    UPDATE business_invitations SET status = 'declined', responded_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(new Date().toISOString(), invitation.id);
  return res.json({ message: 'Invitación rechazada.' });
});

router.delete('/business/staff/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const staff = sqlite.prepare('SELECT business_id, user_id FROM staff WHERE id = ?').get(req.params.id) as any;
  if (!staff) return res.status(404).json({ error: 'Trabajador no encontrado.' });
  if (authorizeBusiness(req, res, staff.business_id, ['OWNER', 'ADMIN']) === null) return;
  const member = staff.user_id
    ? sqlite.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ?')
      .get(staff.business_id, staff.user_id) as { role: string } | undefined
    : undefined;
  if (member?.role === 'OWNER') {
    return res.status(400).json({ error: 'No se puede desactivar al propietario del negocio.' });
  }
  if (businessSubscriptionBlocked(res, staff.business_id)) return;

  const deactivated = withTransaction(db => {
    const currentMember = staff.user_id
      ? db.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ?')
        .get(staff.business_id, staff.user_id) as { role: string } | undefined
      : undefined;
    if (currentMember?.role === 'OWNER') return false;

    db.prepare('UPDATE staff SET is_active = 0 WHERE id = ?').run(req.params.id);
    db.prepare(`
      UPDATE business_invitations SET status = 'revoked', responded_at = ?
      WHERE staff_id = ? AND status = 'pending'
    `).run(new Date().toISOString(), req.params.id);
    if (staff.user_id) {
      db.prepare(`
        UPDATE business_members SET is_active = 0
        WHERE business_id = ? AND user_id = ? AND role != 'OWNER'
      `).run(staff.business_id, staff.user_id);
    }
    return true;
  });
  if (!deactivated) {
    return res.status(400).json({ error: 'No se puede desactivar al propietario del negocio.' });
  }
  return res.json({ message: 'Trabajador desactivado correctamente.' });
});

// Business Hours
const updateBusinessHoursHandler = (req: AuthRequest, res: Response) => {
  const sqlite = getSqliteDb();
  const bizId = req.params.id;
  if (authorizeBusiness(req, res, bizId, ['OWNER', 'ADMIN']) === null) return;
  if (businessSubscriptionBlocked(res, bizId)) return;

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
};
router.put('/business/:id/hours', requireAuth, updateBusinessHoursHandler);
router.put('/business/hours', requireAuth, (req: AuthRequest, res: Response) => {
  const businessId = getManagedBusinessId(req, res);
  if (!businessId) return;
  req.params.id = businessId;
  return updateBusinessHoursHandler(req, res);
});
router.put('/business/:id', requireAuth, updateBusinessHandler);

// -------------------------------------------------------------
// PLATFORM ADMINISTRATION (Section 19 - Role: PLATFORM_ADMIN)
// -------------------------------------------------------------
router.get('/admin/metrics', requireAuth, requireRole('PLATFORM_ADMIN'), (_req, res) => {
  const sqlite = getSqliteDb();
  const stats = {
    totalUsers: (sqlite.prepare('SELECT COUNT(*) AS count FROM users').get() as any).count,
    totalBusinesses: (sqlite.prepare('SELECT COUNT(*) AS count FROM businesses').get() as any).count,
    totalBookings: (sqlite.prepare('SELECT COUNT(*) AS count FROM bookings').get() as any).count,
    totalVolumeCLP: (sqlite.prepare('SELECT COALESCE(SUM(amount_clp), 0) AS total FROM bookings').get() as any).total,
  };
  return res.json({ stats });
});

router.get('/admin/categories', requireAuth, requireRole('PLATFORM_ADMIN'), (_req, res) => {
  return res.json({ categories: getCategoriesWithSubcategories() });
});

const updateAdminBusinessStatusHandler = (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'Estado de negocio inválido.' });
  }
  const sqlite = getSqliteDb();
  const result = sqlite.prepare('UPDATE businesses SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Negocio no encontrado.' });
  logAudit(req.userId || null, req.params.id, 'ADMIN_BUSINESS_STATUS_CHANGE', 'business', req.params.id, { status });
  return res.json({ message: `Estado del negocio cambiado a ${status}.` });
};
router.put('/admin/businesses/:id/status', requireAuth, requireRole('PLATFORM_ADMIN'), updateAdminBusinessStatusHandler);

router.put('/admin/businesses/:id/verify', requireAuth, requireRole('PLATFORM_ADMIN'), (req: AuthRequest, res: Response) => {
  const verified = req.body.verified ? 1 : 0;
  const result = getSqliteDb().prepare('UPDATE businesses SET verified = ?, updated_at = ? WHERE id = ?').run(verified, new Date().toISOString(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Negocio no encontrado.' });
  logAudit(req.userId || null, req.params.id, verified ? 'ADMIN_BUSINESS_VERIFIED' : 'ADMIN_BUSINESS_UNVERIFIED', 'business', req.params.id, { verified: Boolean(verified) });
  return res.json({ verified: Boolean(verified) });
});

function setAdminUserStatus(req: AuthRequest, res: Response, isActive: number, includeMessage = false) {
  const user = getSqliteDb().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  getSqliteDb().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive, req.params.id);
  logAudit(req.userId || null, null, isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_SUSPENDED', 'user', req.params.id);
  return res.json(includeMessage
    ? { message: isActive ? 'Usuario reactivado.' : 'Usuario suspendido.', is_active: isActive }
    : { is_active: isActive });
}

router.put('/admin/users/:id/status', requireAuth, requireRole('PLATFORM_ADMIN'), (req: AuthRequest, res: Response) => {
  if (![true, false, 1, 0].includes(req.body.is_active)) return res.status(400).json({ error: 'is_active debe ser booleano.' });
  const isActive = req.body.is_active ? 1 : 0;
  return setAdminUserStatus(req, res, isActive);
});

router.get('/admin/dashboard', requireAuth, requireRole('PLATFORM_ADMIN'), (req, res) => {
  const sqlite = getSqliteDb();

  const totalUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const totalBusinesses = sqlite.prepare('SELECT COUNT(*) as count FROM businesses').get() as any;
  const totalBookings = sqlite.prepare('SELECT COUNT(*) as count FROM bookings').get() as any;
  const totalReviews = sqlite.prepare('SELECT COUNT(*) as count FROM reviews').get() as any;

  const totalRevenue = getApprovedPaymentRevenue();

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
      total_revenue_clp: totalRevenue,
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
  return setAdminUserStatus(req, res, nextStatus, true);
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

router.post('/admin/businesses/:id/status', requireAuth, requireRole('PLATFORM_ADMIN'), updateAdminBusinessStatusHandler);

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
  const userId = req.userId!;
  const { filter, search } = req.query;
  const todayStr = getSantiagoDateString();

  let userClients = listClients(userId);
  const userServices = listServices(userId);
  const userContactLogs = listContactLogs(userId);

  if (search && typeof search === 'string') {
    const q = search.trim().toLowerCase();
    userClients = userClients.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  }

  const enriched = userClients.map(client => {
    const clientServices = userServices
      .filter(s => s.client_id === client.id)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    const latestService = clientServices[0] || null;

    const clientLogs = userContactLogs
      .filter(l => l.client_id === client.id)
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

router.post('/clients', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { full_name, phone, notes, initial_service } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Nombre completo y teléfono son obligatorios.' });
    }

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
    }

    createClientWithInitialService(newClient, createdService);

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
  const client = getClient(userId, req.params.id);

  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });

  const services = listServices(userId, client.id)
    .sort((a, b) => b.service_date.localeCompare(a.service_date));

  const contactLogs = listContactLogs(userId, client.id)
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

router.put('/clients/:id', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { full_name, phone, notes } = req.body;
  if (!full_name || !phone) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });

  const client = updateClient(userId, req.params.id, { full_name, phone, notes });
  if (!client) return res.status(404).json({ error: 'Clienta no encontrada.' });
  return res.json({ message: 'Clienta actualizada con éxito.', client });
});

router.delete('/clients/:id', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!deleteClient(userId, req.params.id)) return res.status(404).json({ error: 'Clienta no encontrada.' });
  return res.json({ message: 'Clienta y su historial han sido eliminados correctamente.' });
});

router.post('/services', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { client_id, service_type, color_formula, tint_brand, service_date, amount_clp, recommended_interval_days, notes } = req.body;

    if (!client_id || !service_type) {
      return res.status(400).json({ error: 'Clienta y tipo de servicio son requeridos.' });
    }

    const client = getClient(userId, client_id);
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

    if (!createServiceRecord(newService)) return res.status(404).json({ error: 'Clienta no encontrada.' });

    return res.status(201).json({ message: 'Servicio registrado correctamente en el historial.', service: newService });
  } catch (e: any) {
    return res.status(500).json({ error: 'Error al registrar servicio.' });
  }
});

router.delete('/services/:id', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!deleteServiceRecord(userId, req.params.id)) return res.status(404).json({ error: 'Servicio no encontrado.' });
  return res.json({ message: 'Servicio eliminado del historial.' });
});

router.post('/contact-logs', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { client_id, status, notes } = req.body;

  if (!client_id) return res.status(400).json({ error: 'ID de clienta requerido.' });

  const client = getClient(userId, client_id);
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

  createContactLog(log);

  return res.status(201).json({ message: 'Contacto registrado.', log });
});

router.get('/dashboard/stats', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const todayStr = getSantiagoDateString();

  const userClients = listClients(userId);
  const userServices = listServices(userId);
  const userContactLogs = listContactLogs(userId);

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

      const recentContact = userContactLogs.some(
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
  const todayStr = getSantiagoDateString();

  const userClients = listClients(userId);
  const userServices = listServices(userId);
  const events: any[] = [];

  userClients.forEach(client => {
    const clientServices = userServices
      .filter(s => s.client_id === client.id)
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

function parseSubscriptionExternalReference(externalReference: string): { userId: string; planId: string } | null {
  const match = /^sub:([^:]+):([^:]+):([a-f0-9]{12})$/.exec(externalReference);
  if (!match || !PLANS[match[2]]) return null;
  return { userId: match[1], planId: match[2] };
}

function withSubscriptionStatus(subscription: Subscription | null) {
  if (!subscription) return null;

  const billingEnabled = isBillingEnabled();
  const expirationDate = new Date(subscription.expiration_date);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isExpired = expirationDate.getTime() < now.getTime();

  return {
    ...subscription,
    days_remaining: daysRemaining,
    is_active: !billingEnabled || (!isExpired && (subscription.status === 'active' || subscription.status === 'trial')),
    billing_enabled: billingEnabled,
  };
}

type MercadoPagoApplicationResult =
  | { kind: 'activated'; subscription: NonNullable<ReturnType<typeof getSubscription>>; message: string }
  | { kind: 'duplicate'; subscription: NonNullable<ReturnType<typeof getSubscription>>; message: string }
  | { kind: 'ignored'; reason: string }
  | { kind: 'forbidden' };

function applyMercadoPagoPayment(
  payment: MercadoPagoPayment,
  expectedUserId?: string,
): MercadoPagoApplicationResult {
  const reference = parseSubscriptionExternalReference(payment.external_reference);
  if (!reference) return { kind: 'ignored', reason: 'invalid_reference' };
  if (expectedUserId && reference.userId !== expectedUserId) return { kind: 'forbidden' };
  if (payment.status !== 'approved') return { kind: 'ignored', reason: 'not_approved' };
  if (payment.currency_id !== 'CLP') return { kind: 'ignored', reason: 'currency_mismatch' };

  const plan = PLANS[reference.planId];
  if (Math.round(payment.transaction_amount) !== plan.price_clp) {
    return { kind: 'ignored', reason: 'amount_mismatch' };
  }

  const result = activateLicense(
    reference.userId,
    reference.planId as Subscription['plan'],
    plan.price_clp,
    plan.duration_days,
    `mp_${payment.id}`,
    'mercadopago_checkout',
  );
  if (result.kind === 'conflict') return { kind: 'forbidden' };

  const subscription = result.kind === 'created'
    ? result.subscription
    : getSubscription(reference.userId) || getOrCreateSubscription(reference.userId);
  return result.kind === 'duplicate'
    ? { kind: 'duplicate', subscription, message: 'Este pago ya fue procesado.' }
    : { kind: 'activated', subscription, message: '¡Licencia activada con éxito!' };
}

router.get('/subscriptions/plans', (req, res) => {
  res.json({
    plans: PLANS,
    billing_enabled: isBillingEnabled(),
    currency: 'CLP',
    tax_info: 'Precios expresados en Pesos Chilenos (CLP). Sujeto a comprobante digital.',
  });
});

router.get('/subscriptions/current', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const sub = getOrCreateSubscription(userId);
  const userPayments = listSubscriptionPayments(userId);

  return res.json({
    subscription: withSubscriptionStatus(sub),
    payments: userPayments,
  });
});

router.post('/payments/create-preference', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!isBillingEnabled()) {
    billingDisabledResponse(res);
    return;
  }

  const { plan_id } = req.body;
  const plan = PLANS[plan_id];
  if (!plan) return res.status(400).json({ error: 'Plan seleccionado inválido.' });

  if (mercadoPagoConfigured()) {
    const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
    const user = getUser(req.userId!);
    const externalReference = `sub:${req.userId}:${plan_id}:${randomBytes(6).toString('hex')}`;
    try {
      const preference = await createPreference({
        title: plan.name,
        unitPriceClp: plan.price_clp,
        externalReference,
        payerEmail: user?.email || '',
        appUrl,
      });
      return res.json({
        mode: 'mercadopago_live',
        preference_id: preference.id,
        init_point: preference.init_point,
        plan_id,
        plan,
      });
    } catch {
      return res.status(502).json({ error: 'No se pudo iniciar el pago con Mercado Pago. Intenta nuevamente.' });
    }
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SIMULATED_PAYMENTS !== 'true') {
    return res.status(503).json({
      error: 'Los pagos en línea aún no están configurados. Contáctanos para renovar tu licencia.',
      code: 'PAYMENTS_NOT_CONFIGURED',
    });
  }

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

router.post('/payments/webhook', async (req, res) => {
  if (!mercadoPagoConfigured()) {
    if (process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()) {
      return res.status(503).json({ error: 'El webhook de Mercado Pago no está configurado.' });
    }
    return res.status(200).json({ received: true, ignored: true });
  }

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;

  const rawDataId = req.query['data.id'] ?? req.body?.data?.id;
  const dataId = typeof rawDataId === 'string' || typeof rawDataId === 'number' ? String(rawDataId) : undefined;
  const rawType = req.query.type ?? req.body?.type;
  const type = typeof rawType === 'string' ? rawType : '';

  if (!verifyWebhookSignature({
    xSignature: req.get('x-signature'),
    xRequestId: req.get('x-request-id'),
    dataId,
    secret,
  })) {
    return res.status(401).json({ error: 'La firma del webhook de Mercado Pago no es válida.' });
  }

  if (type !== 'payment' || !dataId) return res.status(200).json({ received: true, ignored: true });

  let payment: Awaited<ReturnType<typeof getMercadoPagoPayment>>;
  try {
    payment = await getMercadoPagoPayment(dataId);
  } catch {
    return res.status(500).json({ error: 'No se pudo consultar el pago en Mercado Pago.' });
  }
  if (!payment) return res.status(200).json({ received: true, ignored: true });

  try {
    applyMercadoPagoPayment(payment);
  } catch (error) {
    console.error('Error al aplicar el pago de Mercado Pago:', error);
    return res.status(500).json({ error: 'No se pudo aplicar el pago de Mercado Pago.' });
  }
  return res.status(200).json({ received: true });
});

router.post('/payments/confirm', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!mercadoPagoConfigured()) {
    return res.status(503).json({
      error: 'Los pagos en línea aún no están configurados. Contáctanos para renovar tu licencia.',
      code: 'PAYMENTS_NOT_CONFIGURED',
    });
  }

  const paymentId = typeof req.body?.payment_id === 'string' ? req.body.payment_id.trim() : '';
  if (!paymentId) return res.status(400).json({ error: 'Falta el identificador del pago.' });

  let payment: Awaited<ReturnType<typeof getMercadoPagoPayment>>;
  try {
    payment = await getMercadoPagoPayment(paymentId);
  } catch {
    return res.status(502).json({ error: 'No se pudo consultar el pago en Mercado Pago.' });
  }
  const paymentNotFound = () => res.status(404).json({ error: 'No se encontró el pago.' });
  if (!payment) return paymentNotFound();

  const result = applyMercadoPagoPayment(payment, req.userId);
  if (result.kind === 'forbidden') return paymentNotFound();
  if (result.kind === 'ignored') {
    if (result.reason === 'invalid_reference') return paymentNotFound();
    if (result.reason === 'not_approved') return res.status(409).json({ status: payment.status });
    return paymentNotFound();
  }
  return res.json({ message: result.message, subscription: withSubscriptionStatus(result.subscription) });
});

router.post('/subscriptions/activate-license', requireAuth, (req: AuthRequest, res: Response) => {
  if (!isBillingEnabled()) {
    billingDisabledResponse(res);
    return;
  }

  if (simulatedPaymentsDisabled(res)) return;
  try {
    const userId = req.userId!;
    const { plan_id, payment_ref } = req.body;
    const plan = PLANS[plan_id];
    if (!plan) return res.status(400).json({ error: 'Plan seleccionado no existe.' });

    const providerPaymentId = `sim_${payment_ref || Date.now()}`;
    const result = activateLicense(
      userId,
      plan_id as Subscription['plan'],
      plan.price_clp,
      plan.duration_days,
      providerPaymentId,
    );
    if (result.kind === 'conflict') {
      return res.status(409).json({ error: 'Este pago ya fue procesado.' });
    }
    if (result.kind === 'duplicate') {
      return res.json({ message: 'Este pago ya fue procesado.', payment: result.payment });
    }

    const { payment, subscription } = result;
    const baseDate = new Date(subscription.expiration_date);
    return res.json({
      message: `¡Licencia activada con éxito! Acceso habilitado hasta el ${baseDate.toLocaleDateString('es-CL')}.`,
      subscription: withSubscriptionStatus(subscription),
      payment,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al activar la licencia.' });
  }
});

router.get('/backup/export', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const user = getUser(userId);
  const exportData = {
    user: user ? { id: user.id, email: user.email, created_at: user.created_at } : null,
    profile: getProfile(userId),
    clients: listClients(userId),
    services: listServices(userId),
    contact_logs: listContactLogs(userId),
    subscription: withSubscriptionStatus(getSubscription(userId)),
    payments: listPayments(userId),
    exported_at: new Date().toISOString(),
  };

  res.setHeader('Content-Disposition', `attachment; filename="salontrack_backup_${getSantiagoDateString()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  return res.json(exportData);
});

// Re-engagement Module
router.get('/re-engagement', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const profile = getProfile(userId);
  const todayStr = getSantiagoDateString();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayMs = new Date(Date.UTC(ty, tm - 1, td)).getTime();

  const queryThreshold = req.query.threshold_days ? Number(req.query.threshold_days) : null;
  const thresholdDays = queryThreshold || profile?.re_engagement_days_threshold || 90;

  const userClients = listClients(userId);
  const userServices = listServices(userId);

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

router.post('/re-engagement/status', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { client_id, status, notes } = req.body;

  if (!client_id || !status) return res.status(400).json({ error: 'client_id y status son requeridos.' });

  const result = setReEngagementStatus(userId, client_id, status, notes);
  if (!result) return res.status(404).json({ error: 'Clienta no encontrada.' });
  const { client, log } = result;
  return res.json({ message: `Clienta ${client.full_name} actualizada a estado '${status}'.`, client, log });
});

router.put('/re-engagement/template', requireAuth, requireActiveSubscription, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { template, threshold_days } = req.body;
  const profile = updateProfileTemplate(userId, template, threshold_days);
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
  return res.json({ message: 'Plantilla de Re-engagement actualizada con éxito.', profile });
});

router.get('/notifications/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const profile = getProfile(userId);
  return res.json({
    preferences: profile?.notification_preferences || { push_enabled: true, alert_time: '09:00', notify_days_before: 3, sound_enabled: true },
    timezone: profile?.timezone || 'America/Santiago',
  });
});

router.put('/notifications/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { push_enabled, alert_time, notify_days_before, sound_enabled, push_subscription } = req.body;
  const profile = updateNotificationPreferences(userId, {
    push_enabled,
    alert_time,
    notify_days_before,
    sound_enabled,
    push_subscription,
  });
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
  return res.json({ message: 'Preferencias guardadas.', preferences: profile.notification_preferences });
});

router.get('/notifications/upcoming', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const profile = getProfile(userId);
  const todayStr = getSantiagoDateString();
  const daysBefore = profile?.notification_preferences?.notify_days_before || 3;

  const userClients = listClients(userId);
  const userServices = listServices(userId);
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

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API error:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

export default router;
