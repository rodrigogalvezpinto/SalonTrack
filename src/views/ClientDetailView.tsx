import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Client, Service, ContactLog } from '../types';
import { formatCLP, formatChileanDate, formatChileanPhone } from '../utils/formatters';
import { 
  ArrowLeft, 
  Send, 
  Scissors, 
  Sparkles, 
  Phone, 
  Calendar, 
  Clock, 
  Trash2, 
  Edit3, 
  MessageCircle, 
  AlertCircle,
  Plus
} from 'lucide-react';

interface ClientDetailViewProps {
  clientId: string;
  onBack: () => void;
  onOpenWhatsApp: (client: Client, service?: any) => void;
  onAddService: (client: Client) => void;
  onClientDeleted?: () => void;
  refreshKey?: number;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
  clientId,
  onBack,
  onOpenWhatsApp,
  onAddService,
  onClientDeleted,
  refreshKey,
}) => {
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [retouch, setRetouch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClientDetails = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        client: Client;
        services: Service[];
        contact_logs: ContactLog[];
        retouch: any;
      }>(`/api/clients/${clientId}`);

      setClient(res.client);
      setServices(res.services || []);
      setContactLogs(res.contact_logs || []);
      setRetouch(res.retouch);
      setEditName(res.client.full_name);
      setEditPhone(res.client.phone);
      setEditNotes(res.client.notes);
    } catch (e) {
      console.error('Error fetching client dossier:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientDetails();
  }, [clientId, refreshKey]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ client: Client }>(`/api/clients/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: editName,
          phone: editPhone,
          notes: editNotes,
        }),
      });
      setClient(res.client);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating client:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás segura de eliminar la ficha de ${client?.full_name}? Se borrará también su historial de fórmulas.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await apiRequest(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (onClientDeleted) onClientDeleted();
      onBack();
    } catch (err) {
      console.error('Error deleting client:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('¿Eliminar este registro de servicio del historial?')) return;
    try {
      await apiRequest(`/api/services/${serviceId}`, { method: 'DELETE' });
      await fetchClientDetails();
    } catch (err) {
      console.error('Error deleting service:', err);
    }
  };

  if (loading || !client) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium">
        Cargando ficha técnica de la clienta...
      </div>
    );
  }

  const latestService = services[0] || null;

  return (
    <div className="space-y-6">
      {/* Back button & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a mis clientas</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenWhatsApp(client, latestService)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Avisar WhatsApp</span>
          </button>

          <button
            onClick={() => onAddService(client)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Servicio</span>
          </button>
        </div>
      </div>

      {/* Client Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2 text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2 text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Observaciones</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2 text-slate-800"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
              >
                Guardar Cambios
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {client.full_name}
                </h2>
                {retouch && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    retouch.status === 'overdue' ? 'bg-rose-100 text-rose-800' :
                    retouch.status === 'today' ? 'bg-amber-100 text-amber-800' :
                    retouch.status === 'this_week' ? 'bg-purple-100 text-purple-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {retouch.label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {formatChileanPhone(client.phone)}
                </span>
                <span>Registrada el {formatChileanDate(client.created_at)}</span>
                <span>Total de servicios: <strong>{services.length}</strong></span>
              </div>

              {client.notes && (
                <p className="text-xs text-slate-600 pt-1">
                  <strong>Observaciones:</strong> {client.notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                title="Editar datos"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition"
                title="Eliminar clienta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Services History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-purple-700" />
            <h3 className="font-bold text-slate-900 text-lg">
              Historial de Servicios & Fórmulas ({services.length})
            </h3>
          </div>
          <button
            onClick={() => onAddService(client)}
            className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1"
          >
            <span>+ Agregar servicio</span>
          </button>
        </div>

        {services.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400 text-xs">
            Esta clienta no tiene servicios registrados en el historial todavía.
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {service.service_type}
                      </span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          Última Visita
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Fecha: <strong>{formatChileanDate(service.service_date)}</strong></span>
                      <span>•</span>
                      <span>Cobrado: <strong className="text-slate-900">{formatCLP(service.amount_clp)}</strong></span>
                      {service.tint_brand && (
                        <>
                          <span>•</span>
                          <span>Marca: {service.tint_brand}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition"
                    title="Eliminar este servicio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {service.color_formula && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Fórmula de Color:
                    </span>
                    <p className="font-mono text-slate-800 text-xs">{service.color_formula}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>
                    Próximo retoque recomendado: <strong>{formatChileanDate(service.next_retouch_date)}</strong> ({service.recommended_interval_days} días)
                  </span>
                  {service.notes && <span className="italic">Nota: {service.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Logs Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span>Historial de Contacto por WhatsApp</span>
        </h4>

        {contactLogs.length === 0 ? (
          <p className="text-xs text-slate-400">
            Aún no se han registrado contactos con esta clienta.
          </p>
        ) : (
          <div className="space-y-2">
            {contactLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800">WhatsApp enviado</span>
                  <p className="text-[11px] text-slate-500">{log.notes}</p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatChileanDate(log.contact_date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
