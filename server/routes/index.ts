import { Router } from 'express';
import { getSantiagoDateString } from '../lib/dates.js';
import authRoutes from './auth.js';
import profileRoutes from './profile.js';
import crmRoutes from './crm.js';
import dashboardRoutes from './dashboard.js';
import subscriptionRoutes from './subscriptions.js';
import reEngagementRoutes from './reEngagement.js';
import notificationRoutes from './notifications.js';
import backupRoutes from './backup.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SalonTrack Chile',
    version: '2.0.0-alpha',
    database: 'sqlite',
    currency: 'CLP',
    timezone: 'America/Santiago',
    current_time: new Date().toISOString(),
    santiago_date: getSantiagoDateString(),
  });
});

router.use(authRoutes);
router.use(profileRoutes);
router.use(crmRoutes);
router.use(dashboardRoutes);
router.use(subscriptionRoutes);
router.use(reEngagementRoutes);
router.use(notificationRoutes);
router.use(backupRoutes);

export default router;
