import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Client } from '../types';
import { formatCLP, formatChileanDate, formatChileanPhone } from '../utils/formatters';
import { 
  Clock, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Phone, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface RetouchesViewProps {
  onOpenWhatsApp: (client: Client, service?: any) => void;
  onSelectClient: (client: Client) => void;
}

export const RetouchesView: React.FC<RetouchesViewProps> = ({
  onOpenWhatsApp,
  onSelectClient,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'this_week' | 'overdue' | 'upcoming'>('all');

  const fetchRetouches = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ clients: Client[] }>('/api/clients');
      // Only keep clients with a calculated retouch
      const withRetouch = (res.clients || []).filter(c => c.retouch && c.latest_service);
      setClients(withRetouch);
    } catch (e) {
      console.error('Error fetching retouches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRetouches();
  }, []);

  const filtered = clients.filter(c => {
    if (!c.retouch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'today') return c.retouch.status === 'today';
    if (statusFilter === 'this_week') return c.retouch.status === 'this_week';
    if (statusFilter === 'overdue') return c.retouch.status === 'overdue';
    if (statusFilter === 'upcoming') return c.retouch.status === 'upcoming';
    return true;
  });

  // Sort by urgency: overdue first, then today, this_week, upcoming
  const sorted = [...filtered].sort((a, b) => {
    return (a.retouch?.diffDays || 0) - (b.retouch?.diffDays || 0);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-600" />
            <span>Seguimiento de Retoques</span>
          </h2>
          <p className="text-xs text-slate-500">
            Cálculo inteligente de fechas según el tipo de servicio e intervalo recomendado.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            statusFilter === 'all'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todos ({clients.length})
        </button>

        <button
          onClick={() => setStatusFilter('overdue')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            statusFilter === 'overdue'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          ⚠️ Retoques Atrasados
        </button>

        <button
          onClick={() => setStatusFilter('today')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            statusFilter === 'today'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          🎯 Para Hoy
        </button>

        <button
          onClick={() => setStatusFilter('this_week')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            statusFilter === 'this_week'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          📅 Esta Semana
        </button>

        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition ${
            statusFilter === 'upcoming'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Próximos Días
        </button>
      </div>

      {/* Retouches List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Calculando fechas de retoques...
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400 text-xs">
          No hay clientas en esta categoría de retoque actualmente.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((client) => {
            const retouch = client.retouch!;
            const latest = client.latest_service!;
            const isOverdue = retouch.status === 'overdue';
            const isToday = retouch.status === 'today';

            return (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 
                      onClick={() => onSelectClient(client)}
                      className="font-bold text-slate-900 text-base hover:text-rose-600 cursor-pointer"
                    >
                      {client.full_name}
                    </h3>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {formatChileanPhone(client.phone)}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isOverdue ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      isToday ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      retouch.status === 'this_week' ? 'bg-purple-100 text-purple-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {retouch.label} ({retouch.diffDays < 0 ? `${Math.abs(retouch.diffDays)} días atrasada` : retouch.diffDays === 0 ? 'Hoy' : `en ${retouch.diffDays} días`})
                    </span>

                    {client.contact_status === 'contacted' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                        ✓ Avisada recientemente
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Servicio: <strong>{latest.service_type}</strong> ({formatCLP(latest.amount_clp)})
                    </span>
                    <span>•</span>
                    <span>
                      Última visita: {formatChileanDate(latest.service_date)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-900">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      Fecha de retoque: {formatChileanDate(latest.next_retouch_date)} ({latest.recommended_interval_days} días de ciclo)
                    </span>
                  </div>

                  {latest.color_formula && (
                    <p className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded inline-block">
                      Fórmula: {latest.color_formula}
                    </p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelectClient(client)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
                    title="Ver ficha"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onOpenWhatsApp(client, latest)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-emerald-600/20 active:scale-95 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Avisar por WhatsApp</span>
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
