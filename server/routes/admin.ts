import { Router, type Response } from 'express';
import { AuthRequest, requireAuth } from '../auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireRole } from '../lib/permissions.js';
import { getDatabase } from '../db/connection.js';
import { businessesRepository } from '../repositories/businesses.js';
import { rolesRepository } from '../repositories/roles.js';
import { oneOf, optionalString } from '../lib/validation.js';
import { changeBusinessStatus, getPublicationIssues, type BusinessStatus } from '../services/businesses.js';

const router = Router();
const statuses = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'INACTIVE'] as const;

router.get('/admin/users', requireAuth, requireRole('PLATFORM_ADMIN'), (_req, res) => res.json({ users: rolesRepository.listUsersWithRoles() }));

router.get('/admin/businesses', requireAuth, requireRole('PLATFORM_ADMIN'), (req, res) => {
  const status = req.query.status === undefined ? undefined : oneOf(req.query.status, statuses, 'status');
  return res.json({ businesses: businessesRepository.listAll({ status }) });
});

router.post('/admin/businesses/:businessId/status', requireAuth, requireRole('PLATFORM_ADMIN'), (req: AuthRequest, res: Response) => {
  const business = businessesRepository.findById(req.params.businessId);
  if (!business) throw notFound('Negocio no encontrado.');
  const target = oneOf(req.body?.status, statuses, 'status') as BusinessStatus;
  const reason = optionalString(req.body?.reason, 'reason', 1000);
  const updated = changeBusinessStatus(business, target, 'platform_admin', req.userId!, reason);
  return res.json({ business: updated, publication_issues: getPublicationIssues(updated) });
});

router.get('/admin/settings', requireAuth, requireRole('PLATFORM_ADMIN'), (_req, res) => {
  const settings = getDatabase().prepare('SELECT key, value, updated_at, updated_by FROM platform_settings ORDER BY key').all()
    .map((row: any) => ({ ...row, value: JSON.parse(row.value) }));
  return res.json({ settings });
});

router.put('/admin/settings', requireAuth, requireRole('PLATFORM_ADMIN'), (req: AuthRequest, res: Response) => {
  if (typeof req.body?.business_publication_requires_review !== 'boolean') {
    throw badRequest('business_publication_requires_review debe ser verdadero o falso.');
  }
  const updatedAt = new Date().toISOString();
  getDatabase().prepare(`INSERT INTO platform_settings (key, value, updated_at, updated_by)
    VALUES ('business_publication_requires_review', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(JSON.stringify(req.body.business_publication_requires_review), updatedAt, req.userId!);
  return res.json({ business_publication_requires_review: req.body.business_publication_requires_review, updated_at: updatedAt });
});

export default router;
