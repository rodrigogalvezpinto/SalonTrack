import { transaction, generateId } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { getDatabase } from '../db/connection.js';
import { businessesRepository } from '../repositories/businesses.js';
import { membersRepository, type BusinessMember } from '../repositories/members.js';
import { rolesRepository } from '../repositories/roles.js';
import { usersRepository } from '../repositories/users.js';

export type BusinessStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'INACTIVE';

export interface Business {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  cover_url: string | null;
  primary_category: string | null;
  specialties: string[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  offers_in_store: boolean;
  offers_home_visit: boolean;
  offers_remote: boolean;
  home_service_communes: string[];
  home_service_radius_km: number | null;
  hide_exact_address: boolean;
  status: BusinessStatus;
  status_reason: string | null;
  published_at: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function uniqueSlug(base: string): string {
  const normalized = slugify(base) || 'negocio';
  let candidate = normalized;
  let suffix = 2;
  while (businessesRepository.slugExists(candidate)) {
    const ending = `-${suffix++}`;
    candidate = `${normalized.slice(0, 60 - ending.length).replace(/-+$/g, '')}${ending}`;
  }
  return candidate;
}

export function ensureProfessionalSetup(
  userId: string,
  input: { businessName: string; phone: string; fullName: string; isDemo?: boolean }
) {
  rolesRepository.addRole(userId, 'CUSTOMER');
  rolesRepository.addRole(userId, 'PROFESSIONAL');
  const existing = businessesRepository.listForUser(userId);
  const anyMembership = getDatabase().prepare('SELECT 1 FROM business_members WHERE user_id = ? LIMIT 1').get(userId);
  if (anyMembership) return existing;

  const now = new Date().toISOString();
  const business: Business = {
    id: generateId('biz'),
    slug: uniqueSlug(input.businessName),
    name: input.businessName,
    description: '',
    logo_url: null,
    cover_url: null,
    primary_category: null,
    specialties: [],
    phone: input.phone,
    whatsapp: input.phone,
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
    is_demo: input.isDemo ?? false,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
  businessesRepository.insert(business);
  membersRepository.insert({
    id: generateId('mem'),
    business_id: business.id,
    user_id: userId,
    role: 'OWNER',
    display_name: input.fullName,
    title: '',
    specialties: [],
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  });
  return [business];
}

export function getPublicationIssues(business: Business): string[] {
  const issues: string[] = [];
  if (!business.name.trim()) issues.push('El nombre del negocio es obligatorio.');
  if (!business.primary_category?.trim()) issues.push('Selecciona una categoría principal.');
  if (!business.phone?.trim() && !business.whatsapp?.trim()) issues.push('Agrega un teléfono o WhatsApp de contacto.');
  if (!business.commune?.trim() || !business.region?.trim()) issues.push('Indica la comuna y la región.');
  if (!business.offers_in_store && !business.offers_home_visit && !business.offers_remote) {
    issues.push('Selecciona al menos una modalidad de atención.');
  }
  if (business.offers_in_store && (!business.address?.trim() || business.latitude === null || business.longitude === null)) {
    issues.push('Para atención en el local indica dirección, latitud y longitud.');
  }
  if (business.offers_home_visit && !business.home_service_communes.length && !business.home_service_radius_km) {
    issues.push('Para atención a domicilio indica comunas o un radio de servicio.');
  }
  return issues;
}

function requiresReview(): boolean {
  const row = getDatabase().prepare("SELECT value FROM platform_settings WHERE key = 'business_publication_requires_review'").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) === true : false;
}

export function changeBusinessStatus(
  business: Business,
  target: BusinessStatus,
  actor: 'member' | 'platform_admin',
  actorUserId: string,
  reason?: string,
  memberRole?: BusinessMember['role']
): Business {
  const from = business.status;
  let nextStatus = target;
  const issues = getPublicationIssues(business);

  if (actor === 'member') {
    if (from === 'SUSPENDED' || target === 'SUSPENDED') throw forbidden('Solo la plataforma puede cambiar un negocio suspendido.');
    if (target === 'PUBLISHED') {
      if (from !== 'DRAFT') throw badRequest('Transición de estado no permitida.');
      if (issues.length) throw badRequest('El negocio aún no cumple los requisitos para publicar.', issues);
      nextStatus = requiresReview() ? 'PENDING_REVIEW' : 'PUBLISHED';
    } else if (target === 'DRAFT' && ['PUBLISHED', 'PENDING_REVIEW'].includes(from)) {
      nextStatus = 'DRAFT';
    } else if (target === 'INACTIVE' && ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED'].includes(from)) {
      if (memberRole !== 'OWNER') throw forbidden();
      nextStatus = 'INACTIVE';
    } else if (target === 'DRAFT' && from === 'INACTIVE') {
      if (memberRole !== 'OWNER') throw forbidden();
      nextStatus = 'DRAFT';
    } else {
      throw badRequest('Transición de estado no permitida.');
    }
  } else if (target === 'PUBLISHED' && ['PENDING_REVIEW', 'SUSPENDED'].includes(from)) {
    if (issues.length) throw badRequest('El negocio aún no cumple los requisitos para publicar.', issues);
  } else if (target === 'DRAFT' && ['PENDING_REVIEW', 'SUSPENDED'].includes(from)) {
    if (from === 'PENDING_REVIEW' && !reason?.trim()) throw badRequest('El motivo del rechazo es obligatorio.');
  } else if (target === 'SUSPENDED' && ['PENDING_REVIEW', 'PUBLISHED', 'DRAFT', 'INACTIVE'].includes(from)) {
    if (!reason?.trim()) throw badRequest('El motivo de suspensión es obligatorio.');
  } else {
    throw badRequest('Transición de estado no permitida.');
  }

  return transaction(() => {
    const updated = businessesRepository.update(business.id, {
      status: nextStatus,
      status_reason: reason?.trim() || null,
      ...(nextStatus === 'PUBLISHED' ? { published_at: business.published_at || new Date().toISOString() } : {}),
    });
    if (!updated) throw notFound('Negocio no encontrado.');
    recordAudit({
      userId: actorUserId,
      action: 'business.status_changed',
      entityType: 'business',
      entityId: business.id,
      metadata: { from, to: nextStatus, actor, reason: reason?.trim() || null },
    });
    return updated;
  });
}

export function addBusinessMember(
  businessId: string,
  actorUserId: string,
  actorRole: BusinessMember['role'],
  input: { email: string; role: BusinessMember['role']; display_name: string; title: string }
) {
  if (actorRole === 'ADMIN' && !['PROFESSIONAL', 'RECEPTION'].includes(input.role)) throw forbidden();
  const account = usersRepository.findByEmail(input.email);
  if (!account) throw notFound('No existe una cuenta con ese correo. La persona debe registrarse primero.');

  return transaction(() => {
    const current = membersRepository.findMembership(businessId, account.id);
    if (current?.status === 'ACTIVE') throw conflict('La persona ya pertenece a este negocio.');
    if (current) {
      if (actorRole === 'ADMIN' && !['PROFESSIONAL', 'RECEPTION'].includes(current.role)) throw forbidden();
      const updated = membersRepository.update(current.id, businessId, {
        role: input.role,
        display_name: input.display_name,
        title: input.title,
        status: 'ACTIVE',
      });
      rolesRepository.addRole(account.id, 'PROFESSIONAL');
      return updated!;
    }
    const now = new Date().toISOString();
    const member = membersRepository.insert({
      id: generateId('mem'),
      business_id: businessId,
      user_id: account.id,
      role: input.role,
      display_name: input.display_name,
      title: input.title,
      specialties: [],
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    });
    rolesRepository.addRole(account.id, 'PROFESSIONAL');
    return member;
  });
}

export function updateBusinessMember(
  businessId: string,
  actorUserId: string,
  actorRole: BusinessMember['role'],
  memberId: string,
  changes: Partial<Pick<BusinessMember, 'role' | 'status' | 'display_name' | 'title'>>
) {
  const current = membersRepository.findById(memberId, businessId);
  if (!current) throw notFound('Integrante no encontrado.');
  if (actorRole === 'ADMIN') {
    if (!['PROFESSIONAL', 'RECEPTION'].includes(current.role)) throw forbidden();
    if (changes.role && !['PROFESSIONAL', 'RECEPTION'].includes(changes.role)) throw forbidden();
  }
  if (
    current.role === 'OWNER' &&
    current.status === 'ACTIVE' &&
    ((changes.role !== undefined && changes.role !== 'OWNER') || changes.status === 'INACTIVE') &&
    membersRepository.countActiveOwners(businessId) <= 1
  ) {
    throw conflict('El negocio debe tener al menos un propietario activo.');
  }
  if (current.user_id === actorUserId && (changes.role !== undefined || changes.status !== undefined)) {
    throw forbidden('No puedes cambiar tu propio rol o estado.');
  }
  return transaction(() => membersRepository.update(memberId, businessId, changes));
}
