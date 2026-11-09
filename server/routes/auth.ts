import { Router, Response } from 'express';
import { generateId, transaction, type Profile, type Subscription, type User } from '../db.js';
import { hashPassword, verifyPassword, generateToken, requireAuth, AuthRequest } from '../auth.js';
import { usersRepository } from '../repositories/users.js';
import { profilesRepository } from '../repositories/profiles.js';
import { subscriptionsRepository } from '../repositories/subscriptions.js';
import { passwordResetsRepository } from '../repositories/passwordResets.js';
import { getEmailProvider } from '../providers/index.js';
import { getConfig } from '../config.js';
import { badRequest, conflict, notFound, unauthorized, asyncHandler } from '../lib/errors.js';
import { normalizeChileanPhone, normalizeEmail, oneOf, optionalString, requireString, validatePassword, isNonEmptyString } from '../lib/validation.js';
import { rateLimit } from '../lib/rateLimit.js';
import { recordAudit } from '../lib/audit.js';
import { buildUserPayload, DEFAULT_WHATSAPP_TEMPLATE } from './helpers.js';
import { ensureProfessionalSetup } from '../services/businesses.js';
import { rolesRepository } from '../repositories/roles.js';

const router = Router();
const FIFTEEN_MIN = 15 * 60 * 1000;
const emailKey = (req: any) => `${req.ip}:${String(req.body?.email ?? '').trim().toLowerCase()}`;

router.post('/auth/register', rateLimit({ name: 'register', windowMs: 60 * 60 * 1000, max: 20 }), (req, res) => {
  const { email: rawEmail, password: rawPassword, full_name, business_name, phone } = req.body ?? {};
  const accountType = oneOf(req.body?.account_type ?? 'professional', ['professional', 'customer'] as const, 'account_type');
  if (!rawEmail || !rawPassword || !full_name) {
    throw badRequest('Nombre, correo y contraseña son obligatorios.');
  }
  const email = normalizeEmail(rawEmail);
  const password = validatePassword(rawPassword);
  const fullName = requireString(full_name, 'El nombre es obligatorio.', 120);
  const businessName = accountType === 'customer' ? fullName : optionalString(business_name, 'business_name', 120) || fullName;
  const cleanPhone = isNonEmptyString(phone) && phone.replace(/[^\d]/g, '').length > 3 ? normalizeChileanPhone(phone) : '+56900000000';

  if (usersRepository.findByEmail(email)) {
    throw conflict('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const now = new Date().toISOString();
  const userId = generateId('usr');
  const newUser: User = { id: userId, email, password_hash: hashPassword(password), created_at: now, updated_at: now };
  const newProfile: Profile = {
    id: generateId('prof'),
    user_id: userId,
    full_name: fullName,
    business_name: businessName,
    phone: cleanPhone,
    country: 'Chile',
    currency: 'CLP',
    timezone: 'America/Santiago',
    default_interval_days: 30,
    whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE,
    created_at: now,
    updated_at: now,
  };
  const trialExpire = new Date();
  trialExpire.setDate(trialExpire.getDate() + 14);
  const newSubscription: Subscription = {
    id: generateId('sub'),
    user_id: userId,
    plan: 'pro_quarterly',
    status: 'trial',
    start_date: now,
    expiration_date: trialExpire.toISOString(),
    payment_provider: 'local',
    created_at: now,
  };

  transaction(() => {
    usersRepository.insert(newUser);
    profilesRepository.insert(newProfile);
    if (accountType === 'professional') {
      subscriptionsRepository.insert(newSubscription);
      ensureProfessionalSetup(userId, { businessName, phone: cleanPhone, fullName, isDemo: false });
    } else {
      rolesRepository.addRole(userId, 'CUSTOMER');
    }
    recordAudit({ userId, action: 'user.registered', entityType: 'user', entityId: userId });
  });

  return res.status(201).json({
    message: 'Cuenta creada exitosamente en SalonTrack.',
    token: generateToken(newUser),
    user: buildUserPayload(newUser),
  });
});

router.post('/auth/login', rateLimit({ name: 'login', windowMs: FIFTEEN_MIN, max: 10, key: emailKey }), (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isNonEmptyString(email) || typeof password !== 'string' || !password) {
    throw badRequest('Por favor ingresa tu correo y contraseña.');
  }
  const user = usersRepository.findByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw unauthorized('Credenciales incorrectas. Verifica tu correo y contraseña.');
  }
  return res.json({ message: 'Inicio de sesión exitoso.', token: generateToken(user), user: buildUserPayload(user) });
});

router.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = usersRepository.findById(req.userId!);
  if (!user) throw notFound('Usuario no encontrado.');
  return res.json({ user: buildUserPayload(user) });
});

const GENERIC_FORGOT_MESSAGE = 'Si el correo está registrado, recibirás un enlace de recuperación con instrucciones de acceso.';

router.post(
  '/auth/forgot-password',
  rateLimit({ name: 'forgot', windowMs: FIFTEEN_MIN, max: 5, key: emailKey }),
  asyncHandler(async (req, res) => {
    const { email } = req.body ?? {};
    if (!isNonEmptyString(email)) throw badRequest('Ingresa tu correo registrado.');

    const user = usersRepository.findByEmail(email);
    if (user) {
      const { token, expiresAt } = passwordResetsRepository.create(user.id);
      const link = `${getConfig().appUrl}/?reset_token=${encodeURIComponent(token)}`;
      await getEmailProvider().send({
        to: user.email,
        userId: user.id,
        subject: 'Recupera tu contraseña de SalonTrack',
        text: `Recibimos una solicitud para restablecer tu contraseña.\nAbre este enlace (válido hasta ${expiresAt}):\n${link}\nSi no fuiste tú, ignora este mensaje.`,
      });
      recordAudit({ userId: user.id, action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id });
    }
    // Misma respuesta exista o no la cuenta, para evitar enumeración de correos.
    return res.json({ message: GENERIC_FORGOT_MESSAGE });
  })
);

router.post('/auth/reset-password', rateLimit({ name: 'reset', windowMs: FIFTEEN_MIN, max: 10 }), (req, res) => {
  const { token, new_password } = req.body ?? {};
  if (!isNonEmptyString(token)) throw badRequest('El enlace de recuperación es inválido o expiró.');
  const password = validatePassword(new_password, 'Contraseña debe contener al menos 6 caracteres.');

  const resetToken = passwordResetsRepository.findValid(token.trim());
  if (!resetToken) throw badRequest('El enlace de recuperación es inválido o expiró.');

  transaction(() => {
    if (!passwordResetsRepository.markUsed(resetToken.id)) throw badRequest('El enlace de recuperación es inválido o expiró.');
    usersRepository.updatePassword(resetToken.user_id, hashPassword(password));
    recordAudit({ userId: resetToken.user_id, action: 'auth.password_reset_completed', entityType: 'user', entityId: resetToken.user_id });
  });

  return res.json({ message: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
});

export default router;
