import { Router } from 'express';
import { notFound } from '../lib/errors.js';
import { optionalInt, optionalString } from '../lib/validation.js';
import { businessesRepository } from '../repositories/businesses.js';
import { membersRepository } from '../repositories/members.js';

const router = Router();

export function publicBusinessDto(business: any) {
  const dto: Record<string, unknown> = {
    id: business.id,
    slug: business.slug,
    name: business.name,
    description: business.description,
    logo_url: business.logo_url,
    cover_url: business.cover_url,
    primary_category: business.primary_category,
    specialties: business.specialties,
    phone: business.phone,
    whatsapp: business.whatsapp,
    email: business.email,
    website: business.website,
    instagram: business.instagram,
    facebook: business.facebook,
    commune: business.commune,
    region: business.region,
    country: business.country,
    offers_in_store: business.offers_in_store,
    offers_home_visit: business.offers_home_visit,
    offers_remote: business.offers_remote,
    home_service_communes: business.home_service_communes,
    home_service_radius_km: business.home_service_radius_km,
    team: membersRepository.listByBusiness(business.id)
      .filter(member => member.status === 'ACTIVE' && ['OWNER', 'PROFESSIONAL'].includes(member.role))
      .map(member => ({ display_name: member.display_name, title: member.title, specialties: member.specialties, role: member.role })),
  };
  if (business.hide_exact_address) {
    dto.latitude = business.latitude === null ? null : Math.round(business.latitude * 100) / 100;
    dto.longitude = business.longitude === null ? null : Math.round(business.longitude * 100) / 100;
  } else {
    dto.address = business.address;
    dto.latitude = business.latitude;
    dto.longitude = business.longitude;
  }
  return dto;
}

router.get('/public/businesses', (req, res) => {
  const commune = optionalString(req.query.commune, 'commune', 120);
  const q = optionalString(req.query.q, 'q', 120);
  const limit = optionalInt(req.query.limit, 'limit', 1, 100) ?? 20;
  const offset = optionalInt(req.query.offset, 'offset', 0, 1_000_000) ?? 0;
  const businesses = businessesRepository.listPublished({ commune, q, limit, offset }).map(publicBusinessDto);
  return res.json({ businesses });
});

router.get('/public/businesses/:slug', (req, res) => {
  const business = businessesRepository.findBySlug(req.params.slug);
  if (!business || business.status !== 'PUBLISHED') throw notFound('Negocio no encontrado.');
  return res.json({ business: publicBusinessDto(business) });
});

export default router;
