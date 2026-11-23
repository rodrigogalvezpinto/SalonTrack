import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

interface Invitation {
  id: string;
  email: string;
  role: string;
  business_name: string;
  business_slug: string;
  business_logo: string | null;
}

interface InvitationAcceptanceModalProps {
  invitationId: string;
  token: string;
  onClose: () => void;
  onSwitchAccount: () => void;
}

const roleLabels: Record<string, string> = {
  STAFF: 'Profesional',
  RECEPTION: 'Recepción',
  ADMIN: 'Administración',
};

function clearInvitationLink() {
  sessionStorage.removeItem('invitation');
  sessionStorage.removeItem('invitation_token');
  const url = new URL(window.location.href);
  url.searchParams.delete('invitation');
  url.searchParams.delete('invitation_token');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export const InvitationAcceptanceModal: React.FC<InvitationAcceptanceModalProps> = ({
  invitationId,
  token,
  onClose,
  onSwitchAccount,
}) => {
  const { reloadSession } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notForUser, setNotForUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ invitations: Invitation[] }>('/api/invitations/mine')
      .then(result => {
        if (cancelled) return;
        const match = result.invitations.find(item => item.id === invitationId);
        setInvitation(match || null);
        setNotForUser(!match);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la invitación.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invitationId]);

  const respond = async (action: 'accept' | 'decline') => {
    if (!invitation) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ message: string }>(`/api/invitations/${invitation.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(action === 'accept' ? { token } : {}),
      });
      clearInvitationLink();
      if (action === 'accept') await reloadSession();
      setSuccess(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo responder a la invitación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitation-dialog-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="invitation-dialog-title" className="text-lg font-bold text-slate-900">Invitación de equipo</h2>
            <p className="mt-1 text-sm text-slate-600">Revisa los detalles antes de responder.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="mt-5 text-sm text-slate-600">Cargando invitación...</p>}
        {notForUser && (
          <div className="mt-5 space-y-4">
            <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Esta invitación es para otro correo. Inicia sesión con el correo invitado.
            </p>
            <button type="button" onClick={onSwitchAccount} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
              Cambiar de cuenta
            </button>
          </div>
        )}
        {invitation && !success && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
              {invitation.business_logo
                ? <img src={invitation.business_logo} alt="" className="h-12 w-12 rounded-lg object-cover" />
                : <div className="h-12 w-12 rounded-lg bg-indigo-100" aria-hidden="true" />}
              <div>
                <p className="font-semibold text-slate-900">{invitation.business_name}</p>
                <p className="text-sm text-slate-600">Rol: {roleLabels[invitation.role] || invitation.role}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">Invitación enviada a {invitation.email}.</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond('accept')}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Procesando...' : 'Aceptar'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond('decline')}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        )}
        {success && (
          <div className="mt-5 space-y-4">
            <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</p>
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
              Continuar
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      </section>
    </div>
  );
};
