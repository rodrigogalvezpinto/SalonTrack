import { profilesRepository } from '../repositories/profiles.js';
import { subscriptionsRepository } from '../repositories/subscriptions.js';
import type { Subscription, User } from '../db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Agrega los campos calculados que la UI usa para mostrar la vigencia de la licencia. */
export function withSubscriptionStatus(sub: Subscription | undefined) {
  if (!sub) return undefined;
  const now = Date.now();
  const expMs = new Date(sub.expiration_date).getTime();
  return {
    ...sub,
    days_remaining: Math.max(0, Math.ceil((expMs - now) / DAY_MS)),
    is_active: expMs >= now && (sub.status === 'active' || sub.status === 'trial'),
  };
}

export function buildUserPayload(user: User) {
  return {
    id: user.id,
    email: user.email,
    profile: profilesRepository.findByUserId(user.id),
    subscription: withSubscriptionStatus(subscriptionsRepository.findByUserId(user.id)),
  };
}

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export const DEFAULT_WHATSAPP_TEMPLATE =
  '¡Hola {nombre}! Te saluda {salon} ✨ Te escribo porque ya se aproxima la fecha recomendada para tu retoque de {servicio}. ¿Coordinamos tu hora para mantener tu cabello hermoso? 💇‍♀️';

export const DEFAULT_RE_ENGAGEMENT_TEMPLATE =
  '¡Hola {nombre}! En {salon} te extrañamos un montón 💕 Vimos que han pasado varias semanas desde tu último {servicio}. Queremos invitarte a renovar tu look con un beneficio especial: 15% de descuento en tu retoque o baño de luz si reservas esta semana. ¿Te gustaría agendar? ✨💇‍♀️';
