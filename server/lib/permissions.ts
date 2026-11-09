import type { NextFunction, Response } from 'express';
import { requireAuth, type AuthRequest } from '../auth.js';
import { forbidden, notFound } from './errors.js';
import { businessesRepository } from '../repositories/businesses.js';
import { membersRepository } from '../repositories/members.js';
import { rolesRepository, type PlatformRole } from '../repositories/roles.js';

type BusinessPermission = 'business.view' | 'business.update' | 'business.status' | 'members.view' | 'members.manage';
type MemberRole = 'OWNER' | 'ADMIN' | 'PROFESSIONAL' | 'RECEPTION';

export const BUSINESS_PERMISSIONS: Record<BusinessPermission, MemberRole[]> = {
  'business.view': ['OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION'],
  'business.update': ['OWNER', 'ADMIN'],
  'business.status': ['OWNER', 'ADMIN'],
  'members.view': ['OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION'],
  'members.manage': ['OWNER', 'ADMIN'],
};

export function requireRole(role: PlatformRole) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.userId || !rolesRepository.hasRole(req.userId, role)) return next(forbidden());
    return next();
  };
}

export function requireBusinessPermission(permission: BusinessPermission) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const businessId = req.params.businessId;
    const business = businessId ? businessesRepository.findById(businessId) : undefined;
    const membership = business && req.userId ? membersRepository.findMembership(business.id, req.userId) : undefined;
    if (!business || !membership || membership.status !== 'ACTIVE') return next(notFound('Negocio no encontrado.'));
    if (!BUSINESS_PERMISSIONS[permission].includes(membership.role)) return next(forbidden());
    req.business = business;
    req.membership = membership;
    return next();
  };
}

export function requireProfessional(req: AuthRequest, res: Response, next: NextFunction) {
  return requireRole('PROFESSIONAL')(req, res, next);
}

export { requireAuth };
