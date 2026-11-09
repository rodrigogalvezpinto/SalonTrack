import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { profilesRepository } from '../repositories/profiles.js';
import { notFound } from '../lib/errors.js';
import { isNonEmptyString, normalizeChileanPhone, optionalInt, optionalString } from '../lib/validation.js';

const router = Router();

router.get('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const profile = profilesRepository.findByUserId(req.userId!);
  if (!profile) throw notFound('Perfil no encontrado.');
  return res.json({ profile });
});

router.put('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const current = profilesRepository.findByUserId(req.userId!);
  if (!current) throw notFound('Perfil no encontrado.');

  const { full_name, business_name, phone, default_interval_days, whatsapp_template } = req.body ?? {};
  const profile = profilesRepository.update({
    ...current,
    full_name: optionalString(full_name, 'full_name', 120) || current.full_name,
    business_name: optionalString(business_name, 'business_name', 120) || current.business_name,
    phone: isNonEmptyString(phone) ? normalizeChileanPhone(phone) : current.phone,
    default_interval_days: optionalInt(default_interval_days, 'Los días de retoque', 1, 365) ?? current.default_interval_days,
    whatsapp_template: whatsapp_template !== undefined ? optionalString(whatsapp_template, 'whatsapp_template', 2000) ?? '' : current.whatsapp_template,
  });

  return res.json({ message: 'Perfil actualizado exitosamente.', profile });
});

export default router;
