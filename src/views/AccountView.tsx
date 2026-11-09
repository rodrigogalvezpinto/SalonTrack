import React, { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

export const AccountView: React.FC<{ onBusinessCreated: () => Promise<void> }> = ({ onBusinessCreated }) => {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.full_name ? `Servicios de ${profile.full_name}` : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const createBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/businesses', { method: 'POST', body: JSON.stringify({ name }) });
      setSuccess('Tu negocio está listo. Ahora puedes completar su perfil.');
      await onBusinessCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el negocio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><p className="text-xs font-bold uppercase tracking-widest text-rose-600">Tu espacio</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Mi cuenta</h1></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><span className="rounded-2xl bg-rose-50 p-3 text-rose-600"><UserRound className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">{profile?.full_name || 'Mi cuenta'}</h2><p className="text-sm text-slate-500">{user?.email}</p></div></div>
        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-slate-400">Nombre</dt><dd className="mt-1 text-sm text-slate-700">{profile?.full_name || '—'}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-400">Comuna preferida</dt><dd className="mt-1 text-sm text-slate-700">{profile?.preferred_commune || 'Sin indicar'}</dd></div></dl>
      </section>
      <section className="rounded-3xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 p-6 shadow-sm">
        <span className="inline-flex rounded-2xl bg-rose-100 p-3 text-rose-700"><BriefcaseBusiness className="h-5 w-5" /></span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">¿Quieres ofrecer tus servicios?</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Crea el perfil de tu negocio y administra tu información profesional en SalonTrack.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-100 p-3 text-sm text-rose-700">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{success}</p>}
        <form onSubmit={createBusiness} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Nombre de tu negocio" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />
          <button disabled={loading || !name.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Creando…' : 'Quiero ofrecer mis servicios'}<ArrowRight className="h-4 w-4" /></button>
        </form>
      </section>
    </div>
  );
};
