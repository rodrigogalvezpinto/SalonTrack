import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { generateId, transaction, type ContactLog } from '../db.js';
import { clientsRepository } from '../repositories/clients.js';
import { serviceHistoryRepository } from '../repositories/serviceHistory.js';
import { contactLogsRepository } from '../repositories/contactLogs.js';
import { profilesRepository } from '../repositories/profiles.js';
import { badRequest, notFound } from '../lib/errors.js';
import { isNonEmptyString, oneOf, optionalInt, optionalString } from '../lib/validation.js';
import { daysBetween, getSantiagoDateString } from '../lib/dates.js';
import { DEFAULT_RE_ENGAGEMENT_TEMPLATE, groupBy } from './helpers.js';

const router = Router();
const RE_ENGAGEMENT_STATUSES = ['none', 'inactive', 'recontacted', 'reactivated', 'dismissed'] as const;

router.get('/re-engagement', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const profile = profilesRepository.findByUserId(userId);
  const todayStr = getSantiagoDateString();
  const queryThreshold = optionalInt(req.query.threshold_days, 'threshold_days', 1, 730);
  const thresholdDays = queryThreshold || profile?.re_engagement_days_threshold || 90;
  const template = profile?.re_engagement_template || DEFAULT_RE_ENGAGEMENT_TEMPLATE;
  const servicesByClient = groupBy(serviceHistoryRepository.listByUser(userId), s => s.client_id);

  const candidates: any[] = [];
  let totalRecoverableClp = 0;
  let recontactedCount = 0;
  let reactivatedCount = 0;

  clientsRepository.listByUser(userId).forEach(client => {
    const latestService = (servicesByClient.get(client.id) ?? [])[0];
    const lastVisitDate = latestService ? latestService.service_date : client.created_at.split('T')[0];
    const daysSinceLastVisit = Math.max(0, daysBetween(lastVisitDate, todayStr));
    if (daysSinceLastVisit < thresholdDays) return;

    const status = client.re_engagement_status || 'none';
    if (status === 'recontacted') recontactedCount++;
    if (status === 'reactivated') reactivatedCount++;
    const estimatedAmount = latestService ? latestService.amount_clp : 45000;
    totalRecoverableClp += estimatedAmount;

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
      suggested_message: template
        .replace(/{nombre}/g, client.full_name)
        .replace(/{salon}/g, profile?.business_name || 'nuestro salón')
        .replace(/{estilista}/g, profile?.full_name || 'tu estilista')
        .replace(/{servicio}/g, latestService?.service_type || 'servicio capilar'),
    });
  });

  candidates.sort((a, b) => b.days_since_last_visit - a.days_since_last_visit);

  return res.json({
    threshold_days: thresholdDays,
    total_inactive_clients: candidates.length,
    recontacted_count: recontactedCount,
    reactivated_count: reactivatedCount,
    potential_recoverable_revenue_clp: totalRecoverableClp,
    template,
    candidates,
    santiago_date: todayStr,
  });
});

router.post('/re-engagement/status', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { client_id, status, notes } = req.body ?? {};
  if (!isNonEmptyString(client_id) || !status) throw badRequest('client_id y status son requeridos.');
  const newStatus = oneOf(status, RE_ENGAGEMENT_STATUSES, 'Estado de re-engagement');

  const current = clientsRepository.findForUser(client_id, userId);
  if (!current) throw notFound('Clienta no encontrada.');

  const now = new Date().toISOString();
  const client = { ...current, re_engagement_status: newStatus, updated_at: now };
  const log: ContactLog = {
    id: generateId('log'),
    user_id: userId,
    client_id: client.id,
    contact_date: now,
    channel: 'whatsapp',
    status: newStatus === 'reactivated' ? 'scheduled' : 'contacted',
    notes: optionalString(notes, 'notes', 2000) || `Módulo Re-engagement: Marcada como ${newStatus}`,
    created_at: now,
  };

  transaction(() => {
    clientsRepository.update(client);
    contactLogsRepository.insert(log);
  });

  return res.json({ message: `Clienta ${client.full_name} actualizada a estado '${newStatus}'.`, client, log });
});

router.put('/re-engagement/template', requireAuth, (req: AuthRequest, res: Response) => {
  const current = profilesRepository.findByUserId(req.userId!);
  if (!current) throw notFound('Perfil no encontrado.');
  const { template, threshold_days } = req.body ?? {};

  const profile = profilesRepository.update({
    ...current,
    re_engagement_template: template !== undefined ? optionalString(template, 'template', 2000) : current.re_engagement_template,
    re_engagement_days_threshold: optionalInt(threshold_days, 'threshold_days', 1, 730) ?? current.re_engagement_days_threshold,
  });

  return res.json({ message: 'Plantilla de Re-engagement actualizada con éxito.', profile });
});

export default router;
