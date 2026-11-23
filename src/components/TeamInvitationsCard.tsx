import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface TeamInvitation {
  id: string;
  role: string;
  created_at: string;
  business_name: string;
  business_slug: string;
  business_logo: string | null;
}

const invitationRoleLabels: Record<string, string> = {
  STAFF: 'Profesional',
  RECEPTION: 'Recepción',
  ADMIN: 'Administración',
};

export const TeamInvitationsCard: React.FC = () => {
  const { reloadSession } = useAuth();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      const response = await apiRequest<{ invitations: TeamInvitation[] }>('/api/invitations/mine');
      setInvitations(response.invitations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las invitaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const respond = async (invitation: TeamInvitation, action: 'accept' | 'decline') => {
    setBusyId(invitation.id);
    setError(null);
    try {
      const response = await apiRequest<{ message: string }>(`/api/invitations/${invitation.id}/${action}`, {
        method: 'POST',
      });
      if (action === 'accept') {
        await reloadSession();
        setSuccess(`Ahora eres parte de ${invitation.business_name}.`);
      }
      setInvitations(current => current.filter(item => item.id !== invitation.id));
      if (response.message && action === 'accept') setSuccess(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo responder a la invitación.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || (invitations.length === 0 && !success && !error)) return null;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 space-y-4" aria-label="Invitaciones de equipo">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Invitaciones a equipos</h3>
        <p className="mt-1 text-xs text-slate-600">Puedes pertenecer a varios negocios con tu misma cuenta.</p>
      </div>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {success && <p role="status" className="text-sm font-semibold text-emerald-700">{success}</p>}
      {invitations.map(invitation => (
        <div key={invitation.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            {invitation.business_logo
              ? <img src={invitation.business_logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
              : <div className="w-10 h-10 rounded-lg bg-indigo-100" aria-hidden="true" />}
            <div>
              <p className="text-sm font-semibold text-slate-900">{invitation.business_name}</p>
              <p className="text-xs text-slate-500">
                Rol: {invitationRoleLabels[invitation.role] || invitation.role}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyId === invitation.id}
              onClick={() => void respond(invitation, 'accept')}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Aceptar
            </button>
            <button
              type="button"
              disabled={busyId === invitation.id}
              onClick={() => void respond(invitation, 'decline')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </section>
  );
};
