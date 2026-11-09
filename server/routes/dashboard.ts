import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { clientsRepository } from '../repositories/clients.js';
import { serviceHistoryRepository } from '../repositories/serviceHistory.js';
import { contactLogsRepository } from '../repositories/contactLogs.js';
import { getRetouchStatus, getSantiagoDateString } from '../lib/dates.js';
import { groupBy } from './helpers.js';

const router = Router();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

router.get('/dashboard/stats', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const todayStr = getSantiagoDateString();
  const userClients = clientsRepository.listByUser(userId);
  const userServices = serviceHistoryRepository.listByUser(userId);
  const servicesByClient = groupBy(userServices, s => s.client_id);
  const logsByClient = groupBy(contactLogsRepository.listByUser(userId), l => l.client_id);

  let retouchesThisWeek = 0;
  let retouchesOverdue = 0;
  let potentialRevenueWeekCLP = 0;
  let potentialRevenueMonthCLP = 0;
  let totalServiceAmounts = 0;
  let pendingContactCount = 0;
  const urgentRetouches: any[] = [];
  const clientRevenueBreakdown: any[] = [];

  userClients.forEach(client => {
    const latestService = (servicesByClient.get(client.id) ?? [])[0];
    if (!latestService) return;

    totalServiceAmounts += latestService.amount_clp;
    const status = getRetouchStatus(latestService.next_retouch_date, todayStr);
    const recentContact = (logsByClient.get(client.id) ?? []).some(l => Date.now() - new Date(l.contact_date).getTime() < WEEK_MS);

    if (!recentContact && ['today', 'this_week', 'overdue'].includes(status.status)) pendingContactCount++;
    if (status.status === 'this_week' || status.status === 'today') {
      retouchesThisWeek++;
      potentialRevenueWeekCLP += latestService.amount_clp;
    }
    if (status.status === 'overdue') retouchesOverdue++;

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
      urgentRetouches.push({ client, service: latestService, retouch: status });
    }
  });

  const averageTicketCLP = userServices.length > 0 ? Math.round(totalServiceAmounts / Math.max(1, userServices.length)) : 0;
  const recentClients = [...userClients].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

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
  const servicesByClient = groupBy(serviceHistoryRepository.listByUser(userId), s => s.client_id);
  const events: any[] = [];

  clientsRepository.listByUser(userId).forEach(client => {
    const clientServices = servicesByClient.get(client.id) ?? [];
    const latest = clientServices[0];
    if (latest) {
      events.push({
        id: `retouch_${latest.id}`,
        type: 'retouch',
        date: latest.next_retouch_date,
        client_id: client.id,
        client_name: client.full_name,
        client_phone: client.phone,
        service_type: latest.service_type,
        amount_clp: latest.amount_clp,
        status: getRetouchStatus(latest.next_retouch_date, todayStr).status,
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

export default router;
