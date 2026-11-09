import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Save, Users } from 'lucide-react';
import type { Business, BusinessMember, Membership } from '../types';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface BusinessViewProps {
  memberships: Membership[];
}

const emptyBusiness = {} as Business;

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-rose-400';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';

function TextField({ label, value, onChange, type = 'text', disabled = false, placeholder = '' }: {
  label: string; value: string | number | null | undefined; onChange: (value: string) => void; type?: string; disabled?: boolean; placeholder?: string;
}) {
  return <label className="block"><span className={labelClass}>{label}</span><input className={inputClass} type={type} disabled={disabled} placeholder={placeholder} value={value ?? ''} onChange={event => onChange(event.target.value)} /></label>;
}

export const BusinessView: React.FC<BusinessViewProps> = ({ memberships }) => {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(memberships[0]?.business_id || '');
  const [business, setBusiness] = useState<Business>(emptyBusiness);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<BusinessMember['role']>('PROFESSIONAL');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const selectedMembership = memberships.find(item => item.business_id === selectedId);
  const canEdit = selectedMembership?.role === 'OWNER' || selectedMembership?.role === 'ADMIN';
  const isOwner = selectedMembership?.role === 'OWNER';

  const load = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError('');
    try {
      const [result, team] = await Promise.all([
        apiRequest<{ business: Business; publication_issues: string[] }>(`/api/businesses/${selectedId}`),
        apiRequest<{ members: BusinessMember[] }>(`/api/businesses/${selectedId}/members`),
      ]);
      setBusiness(result.business);
      setIssues(result.publication_issues);
      setMembers(team.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el negocio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedId]);

  const updateField = (field: keyof Business, value: unknown) => setBusiness(current => ({ ...current, [field]: value }));
  const fields = useMemo(() => ({
    specialties: business.specialties?.join(', ') || '',
    home_service_communes: business.home_service_communes?.join(', ') || '',
  }), [business.specialties, business.home_service_communes]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { business: saved, publication_issues } = await apiRequest<{ business: Business; publication_issues: string[] }>(`/api/businesses/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...business,
          specialties: fields.specialties.split(',').map(item => item.trim()).filter(Boolean),
          home_service_communes: fields.home_service_communes.split(',').map(item => item.trim()).filter(Boolean),
          latitude: business.latitude === null ? null : Number(business.latitude),
          longitude: business.longitude === null ? null : Number(business.longitude),
          home_service_radius_km: business.home_service_radius_km === null ? null : Number(business.home_service_radius_km),
        }),
      });
      setBusiness(saved);
      setIssues(publication_issues);
      setSuccess('Los datos del negocio se guardaron correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: Business['status']) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiRequest<{ business: Business; publication_issues: string[] }>(`/api/businesses/${selectedId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setBusiness(result.business);
      setIssues(result.publication_issues);
      setSuccess('El estado del negocio se actualizó.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/businesses/${selectedId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role: newRole, display_name: newDisplayName || email, title: newTitle }),
      });
      setEmail('');
      setNewDisplayName('');
      setNewTitle('');
      await load();
      setSuccess('La persona se agregó al equipo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar al equipo.');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (member: BusinessMember, changes: Record<string, string>) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/businesses/${selectedId}/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      await load();
      setSuccess('El equipo se actualizó correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar al integrante.');
    } finally {
      setSaving(false);
    }
  };

  const useMyLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Este navegador no permite obtener la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => setBusiness(current => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude })),
      () => setError('No se pudo obtener la ubicación. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (!memberships.length) {
    return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center"><h2 className="text-xl font-bold">Mi negocio</h2><p className="mt-2 text-sm text-slate-500">Todavía no tienes negocios asociados.</p></section>;
  }

  const statusLabels: Record<Business['status'], string> = {
    DRAFT: 'Borrador', PENDING_REVIEW: 'En revisión', PUBLISHED: 'Publicado', SUSPENDED: 'Suspendido', INACTIVE: 'Inactivo',
  };
  const booleanInput = (label: string, key: 'offers_in_store' | 'offers_home_visit' | 'offers_remote' | 'hide_exact_address') => (
    <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" checked={Boolean(business[key])} disabled={!canEdit} onChange={event => updateField(key, event.target.checked)} className="accent-rose-600" />
      {label}
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-rose-600">Espacio profesional</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Mi negocio</h1></div>
        {memberships.length > 1 && <select className={inputClass + ' max-w-xs'} value={selectedId} onChange={event => setSelectedId(event.target.value)} aria-label="Seleccionar negocio">
          {memberships.map(item => <option key={item.business_id} value={item.business_id}>{item.business_name} · {item.role}</option>)}
        </select>}
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
      {loading && <p className="text-sm text-slate-500">Cargando negocio…</p>}
      {!!business.id && <>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold">{business.name}</h2><p className="mt-1 text-sm text-slate-500">Tu rol: {selectedMembership?.role}</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{statusLabels[business.status]}</span>
          </div>
          {business.status === 'SUSPENDED' && business.status_reason && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Motivo de suspensión: {business.status_reason}</p>}
          {!!issues.length && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-bold text-amber-900">Pendiente para publicar</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
          <form onSubmit={save} className="space-y-6">
            <fieldset disabled={!canEdit || saving} className="space-y-6">
              <div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Datos</h3><div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nombre" value={business.name} onChange={value => updateField('name', value)} />
                <TextField label="Slug público" value={business.slug} onChange={value => updateField('slug', value)} />
                <TextField label="Categoría principal" value={business.primary_category} onChange={value => updateField('primary_category', value)} />
                <TextField label="Especialidades (separadas por coma)" value={fields.specialties} onChange={value => updateField('specialties', value.split(',').map(item => item.trim()).filter(Boolean))} />
                <TextField label="Logo (URL)" value={business.logo_url} onChange={value => updateField('logo_url', value || null)} />
                <TextField label="Portada (URL)" value={business.cover_url} onChange={value => updateField('cover_url', value || null)} />
                <label className="block sm:col-span-2"><span className={labelClass}>Descripción</span><textarea className={inputClass} rows={3} value={business.description || ''} onChange={event => updateField('description', event.target.value)} /></label>
              </div></div>
              <div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Contacto</h3><div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Teléfono" value={business.phone} onChange={value => updateField('phone', value || null)} />
                <TextField label="WhatsApp" value={business.whatsapp} onChange={value => updateField('whatsapp', value || null)} />
                <TextField label="Correo" type="email" value={business.email} onChange={value => updateField('email', value || null)} />
                <TextField label="Sitio web (URL)" value={business.website} onChange={value => updateField('website', value || null)} />
                <TextField label="Instagram (URL)" value={business.instagram} onChange={value => updateField('instagram', value || null)} />
                <TextField label="Facebook (URL)" value={business.facebook} onChange={value => updateField('facebook', value || null)} />
              </div></div>
              <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ubicación</h3><button type="button" disabled={!canEdit || saving} onClick={useMyLocation} className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 disabled:opacity-40"><MapPin className="h-4 w-4" />Usar mi ubicación</button></div><div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Dirección" value={business.address} onChange={value => updateField('address', value || null)} />
                <TextField label="Comuna" value={business.commune} onChange={value => updateField('commune', value || null)} />
                <TextField label="Región" value={business.region} onChange={value => updateField('region', value || null)} />
                <TextField label="País" value={business.country} onChange={value => updateField('country', value)} />
                <TextField label="Latitud" type="number" value={business.latitude} onChange={value => updateField('latitude', value === '' ? null : Number(value))} />
                <TextField label="Longitud" type="number" value={business.longitude} onChange={value => updateField('longitude', value === '' ? null : Number(value))} />
              </div></div>
              <div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Modalidad de atención</h3><div className="grid gap-2 sm:grid-cols-2">
                {booleanInput('Atención en el local', 'offers_in_store')}
                {booleanInput('Atención a domicilio', 'offers_home_visit')}
                {booleanInput('Atención remota', 'offers_remote')}
                {booleanInput('Ocultar dirección exacta', 'hide_exact_address')}
              </div><div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField label="Comunas a domicilio (separadas por coma)" value={fields.home_service_communes} onChange={value => updateField('home_service_communes', value.split(',').map(item => item.trim()).filter(Boolean))} />
                <TextField label="Radio de atención (km)" type="number" value={business.home_service_radius_km} onChange={value => updateField('home_service_radius_km', value === '' ? null : Number(value))} />
              </div></div>
            </fieldset>
            {canEdit && <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar cambios'}</button>}
          </form>
          {selectedMembership?.role && <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            {business.status === 'DRAFT' && <button disabled={saving || issues.length > 0 || !canEdit} onClick={() => updateStatus('PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Publicar</button>}
            {business.status === 'PUBLISHED' && <button disabled={saving || !canEdit} onClick={() => updateStatus('DRAFT')} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Despublicar</button>}
            {business.status === 'PENDING_REVIEW' && <button disabled={saving || !canEdit} onClick={() => updateStatus('DRAFT')} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Retirar solicitud</button>}
            {isOwner && ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED'].includes(business.status) && <button disabled={saving} onClick={() => updateStatus('INACTIVE')} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">Desactivar</button>}
            {isOwner && business.status === 'INACTIVE' && <button disabled={saving} onClick={() => updateStatus('DRAFT')} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Reactivar</button>}
            {business.status === 'PUBLISHED' && <a target="_blank" rel="noreferrer" href={`/negocio/${business.slug}`} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700">Ver perfil público</a>}
          </div>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-rose-600" /><h2 className="text-lg font-bold">Equipo</h2></div>
          <div className="space-y-3">{members.map(member => {
            const canManageMember = canEdit && member.user_id !== user?.id;
            const canEditThis = canManageMember && (isOwner || ['PROFESSIONAL', 'RECEPTION'].includes(member.role));
            return <div key={member.id} className="grid gap-2 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[1fr_150px_130px] sm:items-center">
              <div><p className="text-sm font-semibold text-slate-800">{member.display_name}</p><p className="text-xs text-slate-500">{member.email} · {member.title || 'Sin cargo'}</p></div>
              {canEditThis ? <>
                <select className={inputClass} value={member.role} disabled={saving} onChange={event => updateMember(member, { role: event.target.value })}>
                  {(isOwner ? ['OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION'] : ['PROFESSIONAL', 'RECEPTION']).map(role => <option key={role} value={role}>{role}</option>)}
                </select>
                <button disabled={saving || (member.role === 'OWNER' && member.status === 'ACTIVE' && members.filter(item => item.role === 'OWNER' && item.status === 'ACTIVE').length <= 1)} onClick={() => updateMember(member, { status: member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">{member.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>
              </> : <p className="text-xs font-semibold text-slate-500">{member.role} · {member.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</p>}
            </div>;
          })}</div>
          {canEdit && <form onSubmit={addMember} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <h3 className="text-sm font-bold text-slate-800 sm:col-span-2">Agregar integrante (debe tener cuenta)</h3>
            <TextField label="Correo de la cuenta" type="email" value={email} onChange={setEmail} />
            <label className="block"><span className={labelClass}>Rol</span><select className={inputClass} value={newRole} onChange={event => setNewRole(event.target.value as BusinessMember['role'])}>{(isOwner ? ['OWNER', 'ADMIN', 'PROFESSIONAL', 'RECEPTION'] : ['PROFESSIONAL', 'RECEPTION']).map(role => <option key={role} value={role}>{role}</option>)}</select></label>
            <TextField label="Nombre para mostrar" value={newDisplayName} onChange={setNewDisplayName} />
            <TextField label="Cargo" value={newTitle} onChange={setNewTitle} />
            <button disabled={saving || !email} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2"><Plus className="h-4 w-4" />{saving ? 'Procesando…' : 'Agregar al equipo'}</button>
          </form>}
        </section>
      </>}
    </div>
  );
};
