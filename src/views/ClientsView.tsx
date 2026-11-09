import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Client } from '../types';
import { formatCLP, formatChileanDate, formatChileanPhone } from '../utils/formatters';
import { 
  Users, 
  Search, 
  Filter, 
  Send, 
  UserPlus, 
  Sparkles, 
  Phone, 
  Calendar, 
  ChevronRight,
  Clock
} from 'lucide-react';

interface ClientsViewProps {
  onSelectClient: (client: Client) => void;
  onOpenWhatsApp: (client: Client, service?: any) => void;
  onNewClient: () => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  onSelectClient,
  onOpenWhatsApp,
  onNewClient,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue' | 'contacted' | 'pending_contact'>('all');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (filter !== 'all') queryParams.set('filter', filter);

      const res = await apiRequest<{ clients: Client[]; total: number }>(`/api/clients?${queryParams.toString()}`);
      setClients(res.clients || []);
    } catch (e) {
      console.error('Error fetching clients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, filter]);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Gestión de Clientas
          </h2>
          <p className="text-xs text-slate-500">
            Control centralizado de fichas técnicas, fórmulas y retoques.
          </p>
        </div>

        <button
          onClick={onNewClient}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-rose-600/20 active:scale-95 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nueva Clienta</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono (+56 9...)"
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none transition"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1 shrink-0 text-[11px]">
            <Filter className="w-3 h-3" /> Filtrar:
          </span>

          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              filter === 'all'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({clients.length})
          </button>

          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              filter === 'upcoming'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Próximos Retoques
          </button>

          <button
            onClick={() => setFilter('overdue')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              filter === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Retoques Atrasados
          </button>

          <button
            onClick={() => setFilter('contacted')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              filter === 'contacted'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Contactadas
          </button>

          <button
            onClick={() => setFilter('pending_contact')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              filter === 'pending_contact'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Pendientes de Contacto
          </button>
        </div>
      </div>

      {/* Clients Grid / List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Buscando clientas...
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">No se encontraron clientas</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'Intenta con otro término de búsqueda o limpia los filtros.' : 'Comienza registrando tu primera clienta para tener el control de sus retoques.'}
          </p>
          <button
            onClick={onNewClient}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            + Registrar Clienta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const retouch = client.retouch;
            const latest = client.latest_service;

            return (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-rose-300 hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                {/* Header */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 
                      onClick={() => onSelectClient(client)}
                      className="font-bold text-slate-900 text-base hover:text-rose-600 transition cursor-pointer"
                    >
                      {client.full_name}
                    </h3>
                    {retouch && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        retouch.status === 'overdue' ? 'bg-rose-100 text-rose-800' :
                        retouch.status === 'today' ? 'bg-amber-100 text-amber-800' :
                        retouch.status === 'this_week' ? 'bg-purple-100 text-purple-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {retouch.label}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{formatChileanPhone(client.phone)}</span>
                  </p>
                </div>

                {/* Service & Formula Specs */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-semibold">{latest?.service_type || 'Sin servicio registrado'}</span>
                    <span className="font-bold text-slate-900">{formatCLP(latest?.amount_clp || 0)}</span>
                  </div>

                  {latest?.color_formula && (
                    <div className="flex items-start gap-1 text-[11px] text-slate-500 font-mono">
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="truncate">{latest.color_formula}</span>
                    </div>
                  )}

                  {latest?.next_retouch_date && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-200/50">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Próximo retoque: <strong>{formatChileanDate(latest.next_retouch_date)}</strong></span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <button
                    onClick={() => onSelectClient(client)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <span>Ver ficha e historial</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onOpenWhatsApp(client, latest)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition"
                  >
                    <Send className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
