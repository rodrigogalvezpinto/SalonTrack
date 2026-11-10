import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCLP, formatDuration } from '../utils/formatters';
import { Booking } from '../types';
import {
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageCircle,
  Filter,
  Search,
  Scissors,
  DollarSign,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export const BusinessBookingsView: React.FC = () => {
  const { business } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Complete modal state
  const [completingBooking, setCompletingBooking] = useState<Booking | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [retouchFormula, setRetouchFormula] = useState<string>('');
  const [retouchDays, setRetouchDays] = useState<number>(30);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState<boolean>(false);

  useEffect(() => {
    loadBookings();
  }, [business]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ bookings: Booking[] }>('/api/bookings/business');
      setBookings(res.bookings || []);
    } catch (err) {
      console.error('Error loading business bookings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await apiRequest(`/api/bookings/${id}/confirm`, { method: 'POST' });
      loadBookings();
    } catch (err: any) {
      alert(`Error al confirmar cita: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Indica el motivo del rechazo para avisar a la clienta:');
    if (reason === null) return;
    try {
      await apiRequest(`/api/bookings/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      loadBookings();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleStartService = async (id: string) => {
    try {
      await apiRequest(`/api/bookings/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'IN_PROGRESS' })
      });
      loadBookings();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCompleteService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingBooking) return;
    setIsSubmittingComplete(true);
    try {
      await apiRequest(`/api/bookings/${completingBooking.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          notes: completionNotes,
          formula_color: retouchFormula,
          recommended_retouch_days: Number(retouchDays) || 30
        })
      });
      setCompletingBooking(null);
      setCompletionNotes('');
      setRetouchFormula('');
      loadBookings();
    } catch (err: any) {
      alert(`Error al completar atención: ${err.message}`);
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleMarkNoShow = async (id: string) => {
    if (!confirm('¿Marcar que la clienta no se presentó a su cita?')) return;
    try {
      await apiRequest(`/api/bookings/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'NO_SHOW' })
      });
      loadBookings();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Chilean today date (YYYY-MM-DD)
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

  const todayBookings = bookings.filter(b => b.booking_date === todayStr);
  const pendingCount = bookings.filter(b => b.status === 'PENDING').length;
  const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length;
  const todayRevenue = todayBookings
    .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'IN_PROGRESS')
    .reduce((sum, b) => sum + (b.amount_clp || b.price_clp || 0), 0);

  // Filter list
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = b.client_name?.toLowerCase().includes(term);
      const matchService = b.service_name?.toLowerCase().includes(term);
      const matchCode = (b.code || b.confirmation_code || '').toLowerCase().includes(term);
      const matchPhone = b.client_phone?.includes(term);
      return matchName || matchService || matchCode || matchPhone;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Agenda y Reservas de Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Control de reservas online, confirmaciones y fichas de servicio para {business?.name || 'tu salón'}.
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
          Hoy en Santiago: <span className="font-semibold text-slate-900 tabular-nums">{todayStr}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500 block">Citas de Hoy</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {todayBookings.length}
          </span>
          <span className="text-[11px] text-slate-400">En agenda para hoy</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-amber-700 block font-medium">Por Confirmar</span>
          <span className="text-2xl font-black text-amber-600 tabular-nums mt-1 block">
            {pendingCount}
          </span>
          <span className="text-[11px] text-slate-400">Solicitudes pendientes</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-emerald-700 block font-medium">Confirmadas</span>
          <span className="text-2xl font-black text-emerald-600 tabular-nums mt-1 block">
            {confirmedCount}
          </span>
          <span className="text-[11px] text-slate-400">Listas para atención</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500 block">Ingreso Proyectado Hoy</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {formatCLP(todayRevenue)}
          </span>
          <span className="text-[11px] text-slate-400">En servicios del día</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por clienta, teléfono, código o servicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Todas ({bookings.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-slate-200 text-amber-700 hover:border-slate-300'
              }`}
            >
              Por Confirmar ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('CONFIRMED')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                statusFilter === 'CONFIRMED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-emerald-700 hover:border-slate-300'
              }`}
            >
              Confirmadas ({confirmedCount})
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                statusFilter === 'COMPLETED'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Completadas
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                statusFilter === 'CANCELLED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Canceladas
            </button>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">Cargando reservas...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">No hay reservas con este criterio</h3>
          <p className="text-xs text-slate-500">
            Las reservas agendadas por clientas desde el explorador público aparecerán aquí en tiempo real.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const isToday = b.booking_date === todayStr;

            return (
              <div
                key={b.id}
                className={`bg-white border rounded-xl p-5 hover:border-slate-300 transition space-y-4 ${
                  isToday ? 'border-rose-300 shadow-xs' : 'border-slate-200'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {b.code || b.confirmation_code}
                    </span>
                    <span className="font-semibold text-slate-900 text-base">
                      {b.client_name}
                    </span>
                    {isToday && (
                      <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        ¡Cita para Hoy!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {b.status === 'PENDING' && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                        Pendiente de Confirmación
                      </span>
                    )}
                    {b.status === 'CONFIRMED' && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                        Confirmada
                      </span>
                    )}
                    {b.status === 'IN_PROGRESS' && (
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md animate-pulse">
                        En Atención
                      </span>
                    )}
                    {b.status === 'COMPLETED' && (
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                        Completada
                      </span>
                    )}
                    {b.status === 'CANCELLED' && (
                      <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
                        Cancelada
                      </span>
                    )}
                    {b.status === 'NO_SHOW' && (
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
                        Inasistencia
                      </span>
                    )}

                    <span className="text-xs text-slate-500 font-mono">
                      {b.payment_status === 'paid' ? '• Pagado online' : '• Pago en local'}
                    </span>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Servicio Solicitado</span>
                    <span className="font-semibold text-slate-800 text-sm">{b.service_name}</span>
                    <span className="text-slate-500 block text-xs mt-0.5">
                      {formatDuration(b.duration_minutes || b.duration_min)} · Staff: {b.staff_name || 'Sin asignar'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Fecha y Horario</span>
                    <span className="font-semibold text-slate-900 text-sm tabular-nums">
                      {b.booking_date}
                    </span>
                    <span className="text-slate-500 block text-xs tabular-nums mt-0.5">
                      {b.start_time} - {b.end_time} hrs
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Contacto Clienta</span>
                    <span className="font-mono tabular-nums text-slate-800 block">{b.client_phone}</span>
                    <span className="text-slate-500 text-[11px] block truncate">{b.client_email}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Monto del Servicio</span>
                    <span className="font-bold text-slate-900 text-base tabular-nums">
                      {formatCLP(b.amount_clp || b.price_clp)}
                    </span>
                  </div>
                </div>

                {/* Actions row */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {b.client_phone && (
                      <a
                        href={`https://wa.me/${b.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${b.client_name}, te escribo desde ${business?.name || 'el salón'} respecto a tu cita de ${b.service_name} para el ${b.booking_date} a las ${b.start_time}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Enviar WhatsApp
                      </a>
                    )}
                  </div>

                  {/* Contextual actions */}
                  <div className="flex items-center gap-2">
                    {b.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleReject(b.id)}
                          className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:text-rose-600 text-xs font-medium rounded-lg transition"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleConfirm(b.id)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                        >
                          Aceptar y Confirmar Cita
                        </button>
                      </>
                    )}

                    {b.status === 'CONFIRMED' && (
                      <>
                        <button
                          onClick={() => handleStartService(b.id)}
                          className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold rounded-lg transition"
                        >
                          Iniciar Atención
                        </button>
                        <button
                          onClick={() => setCompletingBooking(b)}
                          className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
                        >
                          Completar y Guardar Ficha
                        </button>
                        <button
                          onClick={() => handleMarkNoShow(b.id)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-2"
                        >
                          No se presentó
                        </button>
                      </>
                    )}

                    {b.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => setCompletingBooking(b)}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
                      >
                        Finalizar Atención y Guardar Ficha
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completion & Retouch Registration Modal */}
      {completingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Finalizar Atención y Ficha Técnica</h3>
              <p className="text-xs text-slate-500 mt-1">
                Registra la fórmula de coloración o retoque y observaciones para el historial CRM de {completingBooking.client_name}.
              </p>
            </div>

            <form onSubmit={handleCompleteService} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fórmula Técnica / Tinte Utilizado (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 7.1 + 8.2 con oxidante 20 vol, matizador ceniza..."
                  value={retouchFormula}
                  onChange={(e) => setRetouchFormula(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-rose-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sugerir Retoque en (días)
                </label>
                <input
                  type="number"
                  min="7"
                  max="120"
                  value={retouchDays}
                  onChange={(e) => setRetouchDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-rose-600 tabular-nums"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  El sistema alertará automáticamente cuando la clienta deba volver para su mantenimiento.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notas de la Sesión
                </label>
                <textarea
                  rows={3}
                  placeholder="Comportamiento del cabello, corte realizado, productos recomendados para casa..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-rose-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingBooking(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComplete}
                  className="px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
                >
                  {isSubmittingComplete ? 'Guardando...' : 'Completar Atención'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
