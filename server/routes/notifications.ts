import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { clientsRepository } from '../repositories/clients.js';
import { serviceHistoryRepository } from '../repositories/serviceHistory.js';
import { profilesRepository } from '../repositories/profiles.js';
import { notFound } from '../lib/errors.js';
import { optionalInt, optionalTime } from '../lib/validation.js';
import { getRetouchStatus, getSantiagoDateString } from '../lib/dates.js';
import { groupBy } from './helpers.js';

const router = Router();

router.get('/notifications/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const profile = profilesRepository.findByUserId(req.userId!);
  const defaultPrefs = { push_enabled: true, alert_time: '09:00', notify_days_before: 3, sound_enabled: true, timezone: 'America/Santiago' };
  return res.json({ preferences: profile?.notification_preferences || defaultPrefs, timezone: profile?.timezone || 'America/Santiago' });
});

router.put('/notifications/preferences', requireAuth, (req: AuthRequest, res: Response) => {
  const current = profilesRepository.findByUserId(req.userId!);
  if (!current) throw notFound('Perfil no encontrado.');
  const { push_enabled, alert_time, notify_days_before, sound_enabled, push_subscription } = req.body ?? {};

  const profile = profilesRepository.update({
    ...current,
    notification_preferences: {
      push_enabled: push_enabled !== undefined ? Boolean(push_enabled) : true,
      alert_time: optionalTime(alert_time, 'La hora de alerta') || '09:00',
      notify_days_before: optionalInt(notify_days_before, 'Los días de anticipación', 0, 30) || 3,
      sound_enabled: sound_enabled !== undefined ? Boolean(sound_enabled) : true,
      push_subscription: push_subscription || current.notification_preferences?.push_subscription,
    },
  });

  return res.json({ message: 'Preferencias de notificación guardadas correctamente.', preferences: profile.notification_preferences });
});

router.get('/notifications/upcoming', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const profile = profilesRepository.findByUserId(userId);
  const todayStr = getSantiagoDateString();
  const daysBefore = profile?.notification_preferences?.notify_days_before || 3;
  const servicesByClient = groupBy(serviceHistoryRepository.listByUser(userId), s => s.client_id);
  const notifications: any[] = [];

  clientsRepository.listByUser(userId).forEach(client => {
    const latest = (servicesByClient.get(client.id) ?? [])[0];
    if (!latest) return;
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
  });

  return res.json({
    notifications,
    count: notifications.length,
    santiago_date: todayStr,
    alert_time: profile?.notification_preferences?.alert_time || '09:00',
  });
});

router.post('/notifications/test', requireAuth, (req: AuthRequest, res: Response) => {
  const profile = profilesRepository.findByUserId(req.userId!);
  return res.json({
    success: true,
    title: '🔔 SalonTrack Chile: Notificación de Prueba',
    body: `¡Hola ${profile?.full_name}! Las notificaciones push para tu salón (${profile?.business_name || 'SalonTrack'}) están activadas y configuradas para la zona horaria America/Santiago.`,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    timestamp: Date.now(),
  });
});

export default router;
