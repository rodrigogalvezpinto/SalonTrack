import React, { useEffect, useState } from 'react';
import { MapPin, Scissors } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface PublicBusiness {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url?: string | null;
  cover_url?: string | null;
  primary_category?: string | null;
  specialties: string[];
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  address?: string | null;
  commune?: string | null;
  region?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  offers_in_store: boolean;
  offers_home_visit: boolean;
  offers_remote: boolean;
  home_service_communes: string[];
  home_service_radius_km?: number | null;
  team: Array<{ display_name: string; title: string; specialties: string[]; role: string }>;
}

export const PublicBusinessView: React.FC<{ slug: string }> = ({ slug }) => {
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiRequest<{ business: PublicBusiness }>(`/api/public/businesses/${encodeURIComponent(slug)}`)
      .then(result => { if (mounted) setBusiness(result.business); })
      .catch(() => { if (mounted) setNotFound(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [slug]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-slate-500">Cargando perfil…</main>;
  if (notFound || !business) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><Scissors className="mx-auto h-9 w-9 text-rose-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Perfil no encontrado</h1><p className="mt-2 text-sm text-slate-500">Este negocio no está disponible o todavía no ha publicado su perfil.</p><a href="/" className="mt-5 inline-block rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">Ir a SalonTrack</a></section></main>;

  const contact = business.whatsapp || business.phone;
  const phoneLink = contact ? `tel:${contact}` : undefined;
  const modes = [
    business.offers_in_store && 'En el local',
    business.offers_home_visit && 'A domicilio',
    business.offers_remote && 'Atención remota',
  ].filter(Boolean);
  return <main className="min-h-screen bg-slate-50 pb-12">
    <header className="border-b border-slate-200 bg-white px-5 py-4"><a href="/" className="flex items-center gap-2 font-extrabold text-slate-900"><Scissors className="h-5 w-5 rotate-45 text-rose-600" />SalonTrack</a></header>
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {business.cover_url && <img src={business.cover_url} alt="" className="h-48 w-full object-cover sm:h-64" />}
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            {business.logo_url ? <img src={business.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Scissors className="h-7 w-7" /></span>}
            <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-rose-600">{business.primary_category}</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">{business.name}</h1><p className="mt-1 text-sm text-slate-500">{business.commune}, {business.region}</p></div>
          </div>
          {business.description && <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{business.description}</p>}
          {business.specialties.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{business.specialties.map(item => <span key={item} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">{item}</span>)}</div>}
          {!!modes.length && <div className="mt-6"><h2 className="text-sm font-bold text-slate-800">Modalidades</h2><p className="mt-1 text-sm text-slate-600">{modes.join(' · ')}</p>{business.offers_home_visit && business.home_service_communes.length > 0 && <p className="mt-1 text-sm text-slate-500">Atiende en: {business.home_service_communes.join(', ')}</p>}</div>}
          {(business.address || business.latitude !== null) && <div className="mt-5 flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /><span>{business.address || `${business.latitude}, ${business.longitude}`}{business.commune ? `, ${business.commune}` : ''}</span></div>}
          <div className="mt-6 flex flex-wrap gap-2">
            {phoneLink && <a href={phoneLink} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white">Contactar</a>}
            {business.website && <a href={business.website} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Sitio web</a>}
            {business.instagram && <a href={business.instagram} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Instagram</a>}
            {business.facebook && <a href={business.facebook} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Facebook</a>}
          </div>
        </div>
      </section>
      {business.team.length > 0 && <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Nuestro equipo</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{business.team.map((member, index) => <article key={`${member.display_name}-${index}`} className="rounded-2xl bg-slate-50 p-4"><h3 className="font-semibold text-slate-800">{member.display_name}</h3><p className="mt-1 text-sm text-slate-500">{member.title || member.role}</p>{member.specialties.length > 0 && <p className="mt-2 text-xs text-rose-700">{member.specialties.join(', ')}</p>}</article>)}</div></section>}
    </div>
  </main>;
};
