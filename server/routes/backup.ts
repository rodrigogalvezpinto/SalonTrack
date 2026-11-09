import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { usersRepository } from '../repositories/users.js';
import { profilesRepository } from '../repositories/profiles.js';
import { clientsRepository } from '../repositories/clients.js';
import { serviceHistoryRepository } from '../repositories/serviceHistory.js';
import { contactLogsRepository } from '../repositories/contactLogs.js';
import { subscriptionsRepository, subscriptionPaymentsRepository } from '../repositories/subscriptions.js';
import { getSantiagoDateString } from '../lib/dates.js';
import { requireRole } from '../lib/permissions.js';

const router = Router();

/** Exportación de los datos del usuario autenticado (portabilidad / privacidad). */
router.get('/backup/export', requireAuth, requireRole('PROFESSIONAL'), (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const user = usersRepository.findById(userId);
  const exportData = {
    user: user ? { id: user.id, email: user.email, created_at: user.created_at } : undefined,
    profile: profilesRepository.findByUserId(userId),
    clients: clientsRepository.listByUser(userId),
    services: serviceHistoryRepository.listByUser(userId),
    contact_logs: contactLogsRepository.listByUser(userId),
    subscription: subscriptionsRepository.findByUserId(userId),
    payments: subscriptionPaymentsRepository.listByUser(userId),
    exported_at: new Date().toISOString(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="salontrack_backup_${getSantiagoDateString()}.json"`);
  return res.json(exportData);
});

export default router;
