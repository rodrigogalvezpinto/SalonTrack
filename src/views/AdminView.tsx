import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { Business } from '../types';

interface AdminBusiness extends Business {
  owner_email: string | null;
}
interface AdminUser {
  id: string;
  email: string;
  roles: string[];
  created_at: string;
  is_demo: boolean;
}

const statusNames: Record<Business['status'], string> = {
  DRAFT: 'Borrador', PENDING_REVIEW: 'En revisión', PUBLISHED: 'Publicado', SUSPENDED: 'Suspendido', INACTIVE: 'Inactivo',
};
const statuses: Business['status'][] = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'INACTIVE'];
const buttonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-rose-300 disabled:opacity-40';

export const AdminView: React.FC = () => {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState('');
  const [manualReview, setManualReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (status = filter) => {
    setLoading(true);
    setError('');
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const [businessResult, userResult, settingsResult] = await Promise.all([
        apiRequest<{ businesses: AdminBusiness[] }>(`/api/admin/businesses${query}`),
        apiRequest<{ users: AdminUser[] }>('/api/admin/users'),
        apiRequest<{ settings: Array<{ key: string; value: unknown }> }>('/api/admin/settings'),
      ]);
      setBusinesses(businessResult.businesses);
      setUsers(userResult.users);
      setManualReview(Boolean(settingsResult.settings.find(item => item.key === 'business_publication_requires_review')?.value));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la administración.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const changeStatus = async (business: AdminBusiness, status: Business['status']) => {
    let reason: string | undefined;
    if (status === 'DRAFT' || status === 'SUSPENDED') {
      reason = window.prompt(status === 'SUSPENDED' ? 'Motivo de suspensión:' : 'Motivo del rechazo:') || undefined;
      if (!reason?.trim()) {
        setError('Debes indicar un motivo para esta acción.');
        return;
      }
    }
    if (status === 'PUBLISHED' && business.status === 'SUSPENDED') {
      const confirmPublish = window.confirm('¿Reactivar el negocio publicado?');
      if (!confirmPublish) return;
    }
    setBusy(business.id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/admin/businesses/${business.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      });
      setSuccess(`Se actualizó el estado de ${business.name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el negocio.');
    } finally {
      setBusy('');
    }
  };

  const updateReview = async (value: boolean) => {
    setBusy('settings');
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ business_publication_requires_review: value }),
      });
      setManualReview(value);
      setSuccess('La configuración de revisión se guardó.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
    } finally {
      setBusy('');
    }
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-rose-600">Plataforma</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Administración</h1></div><button onClick={() => load()} className={buttonClass}><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Actualizar</button></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div><h2 className="font-bold text-slate-900">Revisión de publicación</h2><p className="text-sm text-slate-500">Manual antes de mostrar negocios en el perfil público.</p></div>
      <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><span>Revisión manual antes de publicar</span><input type="checkbox" checked={manualReview} disabled={busy === 'settings'} onChange={event => updateReview(event.target.checked)} className="h-5 w-5 accent-rose-600" /></label>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h2 className="font-bold text-slate-900">Negocios</h2><p className="text-xs text-slate-500">{businesses.length} resultado(s)</p></div><select aria-label="Filtrar por estado" value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Todos los estados</option>{statuses.map(status => <option value={status} key={status}>{statusNames[status]}</option>)}</select></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Cargando negocios…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Negocio</th><th className="p-3">Propietario</th><th className="p-3">Comuna</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead><tbody>{businesses.map(business => <tr key={business.id} className="border-t border-slate-100"><td className="p-3"><p className="font-semibold text-slate-800">{business.name}</p><p className="text-xs text-slate-500">{business.slug}</p></td><td className="p-3 text-slate-600">{business.owner_email || '—'}</td><td className="p-3 text-slate-600">{business.commune || '—'}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{statusNames[business.status]}</span></td><td className="p-3"><div className="flex flex-wrap gap-1.5">
        {business.status === 'PENDING_REVIEW' && <><button disabled={busy === business.id} onClick={() => changeStatus(business, 'PUBLISHED')} className={buttonClass}><Check className="mr-1 inline h-3.5 w-3.5" />Aprobar</button><button disabled={busy === business.id} onClick={() => changeStatus(business, 'DRAFT')} className={buttonClass}><X className="mr-1 inline h-3.5 w-3.5" />Rechazar</button></>}
        {['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'INACTIVE'].includes(business.status) && <button disabled={busy === business.id} onClick={() => changeStatus(business, 'SUSPENDED')} className={buttonClass}><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Suspender</button>}
        {business.status === 'SUSPENDED' && <button disabled={busy === business.id} onClick={() => changeStatus(business, 'PUBLISHED')} className={buttonClass}><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Reactivar</button>}
      </div></td></tr>)}</tbody></table></div>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4"><h2 className="font-bold text-slate-900">Usuarios</h2><p className="text-xs text-slate-500">{users.length} cuenta(s); no se exponen credenciales.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Correo</th><th className="p-3">Roles</th><th className="p-3">Creado</th><th className="p-3">Tipo</th></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-800">{user.email}</td><td className="p-3 text-slate-600">{user.roles.join(', ') || '—'}</td><td className="p-3 text-slate-600">{new Date(user.created_at).toLocaleDateString('es-CL')}</td><td className="p-3 text-slate-600">{user.is_demo ? 'Demo' : 'Real'}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
};
