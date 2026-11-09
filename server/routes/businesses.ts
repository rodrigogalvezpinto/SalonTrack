import { Router, type Response } from 'express';
import { AuthRequest, requireAuth } from '../auth.js';
import { generateId, transaction } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { normalizeEmail, optionalString, oneOf, requireString } from '../lib/validation.js';
import { requireBusinessPermission } from '../lib/permissions.js';
import { businessesRepository } from '../repositories/businesses.js';
import { membersRepository } from '../repositories/members.js';
import { rolesRepository } from '../repositories/roles.js';
import { usersRepository } from '../repositories/users.js';
import { profilesRepository } from '../repositories/profiles.js';
import {
  addBusinessMember,
  changeBusinessStatus,
  getPublicationIssues,
  slugify,
  uniqueSlug,
  updateBusinessMember,
  type Business,
  type BusinessStatus,
} from '../services/businesses.js';

const router = Router();
const BUSINESS_ROLES = ['OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION'] as const;
const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'INACTIVE'] as const;
const STRING_LIMITS: Record<string, number> = {
  name: 120, description: 4000, logo_url: 1000, cover_url: 1000, primary_category: 120,
  phone: 40, whatsapp: 40, email: 254, website: 1000, instagram: 1000, facebook: 1000,
  address: 500, commune: 120, region: 120, country: 120,
};
const BOOLEAN_FIELDS = ['offers_in_store', 'offers_home_visit', 'offers_remote', 'hide_exact_address'] as const;

function validateUrl(value: string, field: string) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw badRequest(`El campo ${field} debe ser una URL http(s) válida.`);
  }
}

function businessChanges(body: Record<string, unknown>, current?: Business) {
  const changes: Record<string, unknown> = {};
  const editable = [...Object.keys(STRING_LIMITS), 'specialties', 'latitude', 'longitude', ...BOOLEAN_FIELDS, 'home_service_communes', 'home_service_radius_km'];
  for (const field of editable) {
    if (body[field] === undefined) continue;
    if (field === 'specialties' || field === 'home_service_communes') {
      const value = body[field];
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.length > 120)) {
        throw badRequest(`El campo ${field} debe ser una lista de textos.`);
      }
      changes[field] = value.map(item => item.trim()).filter(Boolean);
    } else if ((BOOLEAN_FIELDS as readonly string[]).includes(field)) {
      if (typeof body[field] !== 'boolean') throw badRequest(`El campo ${field} debe ser verdadero o falso.`);
      changes[field] = body[field];
    } else if (field === 'latitude' || field === 'longitude') {
      const value = body[field];
      if (value === null || value === '') changes[field] = null;
      else if (typeof value !== 'number' || !Number.isFinite(value) || (field === 'latitude' ? value < -90 || value > 90 : value < -180 || value > 180)) {
        throw badRequest(`${field} está fuera de rango.`);
      } else changes[field] = value;
    } else if (field === 'home_service_radius_km') {
      const value = body[field];
      if (value === null || value === '') changes[field] = null;
      else if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 200) {
        throw badRequest('El radio de atención debe estar entre 1 y 200 km.');
      } else changes[field] = value;
    } else {
      if (field === 'name') {
        changes[field] = requireString(body[field], 'El nombre del negocio es obligatorio.', STRING_LIMITS[field]);
      } else {
        const value = optionalString(body[field], field, STRING_LIMITS[field]);
        changes[field] = value || null;
      }
    }
  }

  if (body.email !== undefined && changes.email) changes.email = normalizeEmail(changes.email);
  for (const field of ['logo_url', 'cover_url', 'website', 'instagram', 'facebook']) {
    if (typeof changes[field] === 'string') validateUrl(changes[field] as string, field);
  }
  if (current && (current.status === 'PUBLISHED' || current.status === 'PENDING_REVIEW')) {
    const updated = { ...current, ...changes } as Business;
    const issues = getPublicationIssues(updated);
    if (issues.length) throw badRequest('La edición dejaría al negocio sin cumplir los requisitos de publicación.', issues);
  }
  return changes;
}

router.get('/businesses/mine', requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({ businesses: businessesRepository.listForUser(req.userId!) });
});

router.post('/businesses', requireAuth, (req: AuthRequest, res: Response) => {
  const name = requireString(req.body?.name, 'El nombre del negocio es obligatorio.', 120);
  const user = usersRepository.findById(req.userId!);
  if (!user) throw notFound('Usuario no encontrado.');
  const userProfile = profilesRepository.findByUserId(req.userId!);
  const profileName = optionalString(req.body?.display_name, 'display_name', 120) || userProfile?.full_name || user.email;
  const profilePhone = optionalString(req.body?.phone, 'phone', 40) || userProfile?.phone || '';
  const now = new Date().toISOString();
  const business: Business = {
    id: generateId('biz'),
    slug: uniqueSlug(slugify(name)),
    name,
    description: '',
    logo_url: null,
    cover_url: null,
    primary_category: null,
    specialties: [],
    phone: profilePhone || null,
    whatsapp: null,
    email: null,
    website: null,
    instagram: null,
    facebook: null,
    address: null,
    commune: null,
    region: null,
    country: 'Chile',
    latitude: null,
    longitude: null,
    offers_in_store: true,
    offers_home_visit: false,
    offers_remote: false,
    home_service_communes: [],
    home_service_radius_km: null,
    hide_exact_address: false,
    status: 'DRAFT',
    status_reason: null,
    published_at: null,
    is_demo: user.is_demo ?? false,
    created_by: req.userId!,
    created_at: now,
    updated_at: now,
  };
  transaction(() => {
    businessesRepository.insert(business);
    membersRepository.insert({
      id: generateId('mem'),
      business_id: business.id,
      user_id: req.userId!,
      role: 'OWNER',
      display_name: profileName,
      title: '',
      specialties: [],
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    });
    rolesRepository.addRole(req.userId!, 'PROFESSIONAL');
  });
  return res.status(201).json({ business, my_role: 'OWNER' });
});

router.get('/businesses/:businessId', requireAuth, requireBusinessPermission('business.view'), (req: AuthRequest, res: Response) => {
  const business = req.business!;
  return res.json({
    business,
    my_role: req.membership!.role,
    publication_issues: getPublicationIssues(business),
  });
});

router.patch('/businesses/:businessId', requireAuth, requireBusinessPermission('business.update'), (req: AuthRequest, res: Response) => {
  const body = req.body ?? {};
  const changes = businessChanges(body, req.business!);
  if (body.slug !== undefined) {
    const slug = requireString(body.slug, 'El slug es obligatorio.', 60);
    if (!/^[a-z0-9-]{3,60}$/.test(slug)) throw badRequest('El slug debe usar de 3 a 60 letras minúsculas, números o guiones.');
    if (businessesRepository.slugExists(slug, req.business!.id)) throw conflict('Ese slug ya está en uso.');
    changes.slug = slug;
  }
  const business = businessesRepository.update(req.business!.id, changes as Partial<Business>);
  if (!business) throw notFound('Negocio no encontrado.');
  return res.json({ business, publication_issues: getPublicationIssues(business) });
});

router.post('/businesses/:businessId/status', requireAuth, requireBusinessPermission('business.status'), (req: AuthRequest, res: Response) => {
  const status = oneOf(req.body?.status, STATUSES, 'status') as BusinessStatus;
  const reason = optionalString(req.body?.reason, 'reason', 1000);
  const business = changeBusinessStatus(req.business!, status, 'member', req.userId!, reason, req.membership!.role);
  return res.json({ business, publication_issues: getPublicationIssues(business) });
});

router.get('/businesses/:businessId/members', requireAuth, requireBusinessPermission('members.view'), (req: AuthRequest, res: Response) => {
  return res.json({ members: membersRepository.listByBusiness(req.business!.id) });
});

router.post('/businesses/:businessId/members', requireAuth, requireBusinessPermission('members.manage'), (req: AuthRequest, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const role = oneOf(req.body?.role, BUSINESS_ROLES, 'role');
  const display_name = optionalString(req.body?.display_name, 'display_name', 120) || email;
  const title = optionalString(req.body?.title, 'title', 120) || '';
  const member = addBusinessMember(req.business!.id, req.userId!, req.membership!.role, { email, role, display_name, title });
  return res.status(201).json({ member });
});

router.patch('/businesses/:businessId/members/:memberId', requireAuth, requireBusinessPermission('members.manage'), (req: AuthRequest, res: Response) => {
  const changes: Record<string, unknown> = {};
  if (req.body?.role !== undefined) changes.role = oneOf(req.body.role, BUSINESS_ROLES, 'role');
  if (req.body?.status !== undefined) changes.status = oneOf(req.body.status, ['ACTIVE', 'INACTIVE'] as const, 'status');
  if (req.body?.display_name !== undefined) changes.display_name = requireString(req.body.display_name, 'El nombre para mostrar es obligatorio.', 120);
  if (req.body?.title !== undefined) changes.title = optionalString(req.body.title, 'title', 120) || '';
  const member = updateBusinessMember(
    req.business!.id,
    req.userId!,
    req.membership!.role,
    req.params.memberId,
    changes as Partial<Pick<import('../repositories/members.js').BusinessMember, 'role' | 'status' | 'display_name' | 'title'>>
  );
  return res.json({ member });
});

export default router;
