import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { DashboardStats, Client } from '../types';
import { formatCLP, formatChileanDate, formatChileanPhone } from '../utils/formatters';
import { requestNotificationPermission, showPushNotification, playNotificationChime } from '../utils/notifications';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  Send, 
  UserPlus, 
  Sparkles, 
  Bell, 
  RotateCcw,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface DashboardViewProps {
  onOpenWhatsApp: (client: Client, service?: any) => void;
  onNewClient: () => void;
  onNavigate: (view: string) => void;
  onSelectClient: (client: Client) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenWhatsApp,
  onNewClient,
  onNavigate,
  onSelectClient,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [testingPush, setTestingPush] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await apiRequest<DashboardStats>('/api/dashboard/stats');
      setStats(data);
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPushStatus('granted');
      playNotificationChime();
      showPushNotification('🔔 ¡Notificaciones activadas en SalonTrack!', {
        body: 'Te avisaremos oportunamente sobre retoques y clientas en horario de Chile.',
      });
      // Save on server
      await apiRequest('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ push_enabled: true }),
      }).catch(() => {});
    } else {
      setPushStatus(Notification.permission);
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      playNotificationChime();
      showPushNotification('🔔 Retoque Próximo: Carolina Silva', {
        body: 'Le corresponde retoque de raíz en 2 días. Toca para abrir WhatsApp.',
      });
    } finally {
      setTimeout(() => setTestingPush(false), 1000);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium">
        Cargando indicadores de tu salón...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push Notification Bar */}
      {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Activa las notificaciones de retoques</h4>
              <p className="text-xs text-white/90">
                Recibe avisos en tu teléfono cada mañana a las 09:00 (hora de Santiago) sobre las clientas del día.
              </p>
            </div>
          </div>
          <button
            onClick={handleEnablePush}
            className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition shrink-0 active:scale-95"
          >
            Activar Notificaciones
          </button>
        </div>
      )}

      {/* KPI 4 Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Clientas */}
        <div 
          onClick={() => onNavigate('clients')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Total Clientas</span>
            <div className="p-1.5 sm:p-2 bg-rose-50 rounded-xl text-rose-600 group-hover:bg-rose-100 transition shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 truncate">{stats?.total_clients || 0}</div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">Registradas en agenda</p>
        </div>

        {/* Retoques esta semana */}
        <div 
          onClick={() => onNavigate('retouches')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Retoques Semana</span>
            <div className="p-1.5 sm:p-2 bg-amber-50 rounded-xl text-amber-600 group-hover:bg-amber-100 transition shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-600 truncate">
            {stats?.retouches_this_week || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            {stats?.retouches_overdue ? `${stats.retouches_overdue} atrasados` : 'Al día con clientas'}
          </p>
        </div>

        {/* Ingresos Potenciales CLP */}
        <div 
          onClick={() => onNavigate('revenue')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Potencial Mes</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-100 transition shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 truncate">
            {formatCLP(stats?.potential_revenue_month_clp || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Oportunidades este mes
          </p>
        </div>

        {/* Pendientes de contacto */}
        <div 
          onClick={() => onNavigate('retouches')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Por Contactar</span>
            <div className="p-1.5 sm:p-2 bg-purple-50 rounded-xl text-purple-600 group-hover:bg-purple-100 transition shrink-0">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-purple-600 truncate">
            {stats?.pending_contact_count || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">Avisar por WhatsApp</p>
        </div>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-800">Nota contable:</strong> Los ingresos potenciales calculados corresponden a 
          oportunidades comerciales estimadas basadas en el valor de servicios previos, no representan ingresos efectivamente cobrados ni deudas de las clientas.
        </p>
      </div>

      {/* Re-engagement Quick Banner */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h4 className="font-bold text-sm">¿Tienes clientas inactivas hace más de 3 meses?</h4>
            <p className="text-xs text-purple-200">
              Usa el nuevo módulo de Re-engagement para enviarles una oferta especial y recuperar ingresos perdidos.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('re-engagement')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition shrink-0 active:scale-95"
        >
          <span>Ir a Recuperar Clientas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content: Urgent Retouches and Recent Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Urgent Retouches (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-base">Retoques Urgentes & Esta Semana</h3>
            </div>
            <button
              onClick={() => onNavigate('retouches')}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {!stats?.urgent_retouches || stats.urgent_retouches.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No hay retoques urgentes en este momento. ¡Excelente trabajo de seguimiento!
              </div>
            ) : (
              stats.urgent_retouches.slice(0, 5).map((item, idx) => (
                <div key={idx} className="p-3.5 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span 
                        onClick={() => onSelectClient(item.client)}
                        className="font-bold text-slate-900 text-sm hover:underline cursor-pointer truncate"
                      >
                        {item.client.full_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        item.retouch.status === 'overdue' ? 'bg-rose-100 text-rose-800' :
                        item.retouch.status === 'today' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.retouch.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <span className="font-medium text-slate-700">{item.service.service_type}</span>
                      <span>•</span>
                      <span>{formatChileanDate(item.service.next_retouch_date)}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-900">{formatCLP(item.service.amount_clp)}</span>
                    </div>

                    {item.service.color_formula && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        Fórmula: {item.service.color_formula}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenWhatsApp(item.client, item.service)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 w-full sm:w-auto shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Avisar por WhatsApp</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Recent Registrations & Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Acciones Rápidas</h3>
            <div className="space-y-2">
              <button
                onClick={onNewClient}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition font-semibold text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-4 h-4" />
                  <span>Registrar Nueva Clienta</span>
                </div>
                <span>+</span>
              </button>

              <button
                onClick={() => onNavigate('revenue')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition font-semibold text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Calculadora de Ingresos CLP</span>
                </div>
                <span>→</span>
              </button>

              <button
                onClick={handleTestPush}
                disabled={testingPush}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition font-semibold text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4" />
                  <span>Probar Notificación Push</span>
                </div>
                <span>🔔</span>
              </button>
            </div>
          </div>

          {/* Recent Clients List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Últimas Clientas Registradas</h3>
            <div className="space-y-3">
              {!stats?.recent_clients || stats.recent_clients.length === 0 ? (
                <p className="text-xs text-slate-400">Sin registros recientes.</p>
              ) : (
                stats.recent_clients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => onSelectClient(c)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div>
                      <h5 className="font-bold text-xs text-slate-800">{c.full_name}</h5>
                      <span className="text-[11px] text-slate-400">{formatChileanPhone(c.phone)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatChileanDate(c.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
