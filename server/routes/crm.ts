import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { generateId, transaction, type Client, type ContactLog, type Service } from '../db.js';
import { clientsRepository } from '../repositories/clients.js';
import { serviceHistoryRepository } from '../repositories/serviceHistory.js';
import { contactLogsRepository } from '../repositories/contactLogs.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  isNonEmptyString, normalizeChileanPhone, oneOf, optionalAmountClp, optionalInt, optionalIsoDate, optionalString, requireString,
} from '../lib/validation.js';
import { calculateNextDate, getRetouchStatus, getSantiagoDateString } from '../lib/dates.js';
import { groupBy } from './helpers.js';

const router = Router();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CONTACT_STATUSES = ['contacted', 'pending', 'scheduled', 'no_reply'] as const;

/** Valida y construye un registro de historial; el monto y fechas se calculan en backend. */
function buildServiceRecord(userId: string, clientId: string, input: any, now: string): Service {
  const serviceType = requireString(input?.service_type, 'Clienta y tipo de servicio son requeridos.', 120);
  const serviceDate = optionalIsoDate(input.service_date, 'La fecha del servicio') || getSantiagoDateString();
  const intervalDays = optionalInt(input.recommended_interval_days, 'Los días de retoque', 1, 365) ?? 30;
  return {
    id: generateId('srv'),
    user_id: userId,
    client_id: clientId,
    service_type: serviceType,
    color_formula: optionalString(input.color_formula, 'color_formula', 500) || '',
    tint_brand: optionalString(input.tint_brand, 'tint_brand', 120) || '',
    service_date: serviceDate,
    amount_clp: optionalAmountClp(input.amount_clp) ?? 0,
    recommended_interval_days: intervalDays,
    next_retouch_date: calculateNextDate(serviceDate, intervalDays),
    notes: optionalString(input.notes, 'notes', 2000) || '',
    created_at: now,
  };
}

router.get('/clients', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { filter, search } = req.query;
  const todayStr = getSantiagoDateString();

  const userClients = clientsRepository.listByUser(userId, typeof search === 'string' && search.trim() ? search : undefined);
  const servicesByClient = groupBy(serviceHistoryRepository.listByUser(userId), s => s.client_id);
  const logsByClient = groupBy(contactLogsRepository.listByUser(userId), l => l.client_id);

  const enriched = userClients.map(client => {
    const clientServices = servicesByClient.get(client.id) ?? [];
    const latestService = clientServices[0] || null;
    const latestContact = (logsByClient.get(client.id) ?? [])[0] || null;
    const isContactedRecently = latestContact && Date.now() - new Date(latestContact.contact_date).getTime() < WEEK_MS;
    return {
      ...client,
      latest_service: latestService,
      total_services: clientServices.length,
      retouch: latestService ? getRetouchStatus(latestService.next_retouch_date, todayStr) : null,
      latest_contact: latestContact,
      contact_status: isContactedRecently ? 'contacted' : 'pending_contact',
    };
  });

  let filtered = enriched;
  if (filter === 'upcoming') {
    filtered = enriched.filter(c => c.retouch && ['upcoming', 'this_week', 'today'].includes(c.retouch.status));
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
  const userId = req.userId!;
  const { full_name, phone, notes, initial_service } = req.body ?? {};
  if (!isNonEmptyString(full_name) || !isNonEmptyString(phone)) {
    throw badRequest('Nombre completo y teléfono son obligatorios.');
  }

  const now = new Date().toISOString();
  const newClient: Client = {
    id: generateId('cli'),
    user_id: userId,
    full_name: requireString(full_name, 'Nombre completo y teléfono son obligatorios.', 120),
    phone: normalizeChileanPhone(phone),
    notes: optionalString(notes, 'notes', 2000) || '',
    re_engagement_status: 'none',
    created_at: now,
    updated_at: now,
  };
  const createdService =
    initial_service && isNonEmptyString(initial_service.service_type) ? buildServiceRecord(userId, newClient.id, initial_service, now) : null;

  transaction(() => {
    clientsRepository.insert(newClient);
    if (createdService) serviceHistoryRepository.insert(createdService);
  });

  return res.status(201).json({ message: 'Clienta registrada con éxito.', client: newClient, service: createdService });
});

router.get('/clients/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const client = clientsRepository.findForUser(req.params.id, userId);
  if (!client) throw notFound('Clienta no encontrada.');

  const services = serviceHistoryRepository.listByClient(client.id, userId);
  const todayStr = getSantiagoDateString();
  const latestService = services[0] || null;

  return res.json({
    client,
    services,
    contact_logs: contactLogsRepository.listByClient(client.id, userId),
    retouch: latestService ? getRetouchStatus(latestService.next_retouch_date, todayStr) : null,
    santiago_date: todayStr,
  });
});

router.put('/clients/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const current = clientsRepository.findForUser(req.params.id, userId);
  if (!current) throw notFound('Clienta no encontrada.');

  const { full_name, phone, notes } = req.body ?? {};
  if (!isNonEmptyString(full_name) || !isNonEmptyString(phone)) {
    throw badRequest('Nombre y teléfono son obligatorios.');
  }

  const client: Client = {
    ...current,
    full_name: requireString(full_name, 'Nombre y teléfono son obligatorios.', 120),
    phone: normalizeChileanPhone(phone),
    notes: notes !== undefined ? optionalString(notes, 'notes', 2000) ?? '' : current.notes,
    updated_at: new Date().toISOString(),
  };
  clientsRepository.update(client);
  return res.json({ message: 'Clienta actualizada con éxito.', client });
});

router.delete('/clients/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (!clientsRepository.deleteForUser(req.params.id, req.userId!)) throw notFound('Clienta no encontrada.');
  return res.json({ message: 'Clienta y su historial han sido eliminados correctamente.' });
});

router.post('/services', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { client_id, service_type } = req.body ?? {};
  if (!isNonEmptyString(client_id) || !isNonEmptyString(service_type)) {
    throw badRequest('Clienta y tipo de servicio son requeridos.');
  }
  const client = clientsRepository.findForUser(client_id, userId);
  if (!client) throw notFound('Clienta no encontrada.');

  const newService = buildServiceRecord(userId, client.id, req.body, new Date().toISOString());
  transaction(() => {
    serviceHistoryRepository.insert(newService);
    clientsRepository.touch(client.id, userId);
  });

  return res.status(201).json({ message: 'Servicio registrado correctamente en el historial.', service: newService });
});

router.delete('/services/:id', requireAuth, (req: AuthRequest, res: Response) => {
  if (!serviceHistoryRepository.deleteForUser(req.params.id, req.userId!)) throw notFound('Servicio no encontrado.');
  return res.json({ message: 'Servicio eliminado del historial.' });
});

router.post('/contact-logs', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { client_id, status, notes } = req.body ?? {};
  if (!isNonEmptyString(client_id)) throw badRequest('ID de clienta requerido.');
  const client = clientsRepository.findForUser(client_id, userId);
  if (!client) throw notFound('Clienta no encontrada.');

  const now = new Date().toISOString();
  const log: ContactLog = {
    id: generateId('log'),
    user_id: userId,
    client_id: client.id,
    contact_date: now,
    channel: 'whatsapp',
    status: status ? oneOf(status, CONTACT_STATUSES, 'Estado de contacto') : 'contacted',
    notes: optionalString(notes, 'notes', 2000) || 'Contacto de recordatorio de retoque vía WhatsApp',
    created_at: now,
  };
  contactLogsRepository.insert(log);
  return res.status(201).json({ message: 'Contacto registrado.', log });
});

export default router;
