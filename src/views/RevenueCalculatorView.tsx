import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { DashboardStats, Client } from '../types';
import { formatCLP, formatChileanDate } from '../utils/formatters';
import { 
  Calculator, 
  TrendingUp, 
  ShieldAlert, 
  DollarSign, 
  Send, 
  Sparkles,
  PieChart,
  Calendar
} from 'lucide-react';

interface RevenueCalculatorViewProps {
  onOpenWhatsApp: (client: Client, service?: any) => void;
  onSelectClient: (client: Client) => void;
}

export const RevenueCalculatorView: React.FC<RevenueCalculatorViewProps> = ({
  onOpenWhatsApp,
  onSelectClient,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<DashboardStats>('/api/dashboard/stats');
      setStats(data);
    } catch (e) {
      console.error('Error fetching revenue stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium">
        Calculando proyecciones de ingresos en CLP...
      </div>
    );
  }

  const breakdown = stats?.revenue_breakdown || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Calculator className="w-6 h-6 text-emerald-600" />
          <span>Calculadora de Ingresos Potenciales</span>
        </h2>
        <p className="text-xs text-slate-500">
          Visualiza las oportunidades comerciales asociadas a los retoques próximos de tus clientas.
        </p>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-amber-950">Aclaración Contable Obligatoria</h4>
          <p className="leading-relaxed">
            Estos valores son <strong>oportunidades comerciales estimadas</strong> basadas en el valor del servicio anterior, no representan ingresos efectivamente cobrados ni deudas exigibles a las clientas. Al concretar la visita, registra el valor real efectivamente percibido.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase truncate">Potencial Semana</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 mt-1 sm:mt-2 truncate">
            {formatCLP(stats?.potential_revenue_week_clp || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            {stats?.retouches_this_week || 0} clientas programadas
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase truncate">Potencial del Mes</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 mt-1 sm:mt-2 truncate">
            {formatCLP(stats?.potential_revenue_month_clp || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            {breakdown.length} clientas en ciclo
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase truncate">Ticket Promedio</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-purple-600 mt-1 sm:mt-2 truncate">
            {formatCLP(stats?.average_service_ticket_clp || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Por atención en tu salón
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase truncate">Por Contactar</div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-600 mt-1 sm:mt-2 truncate">
            {stats?.pending_contact_count || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Sin aviso de WhatsApp
          </p>
        </div>
      </div>

      {/* Detailed Opportunities Breakdown Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            Detalle de Oportunidades Comerciales ({breakdown.length})
          </h3>
          <span className="text-xs font-bold text-slate-500">
            Total Estimado: <strong className="text-slate-900 text-sm">{formatCLP(stats?.potential_revenue_month_clp || 0)}</strong>
          </span>
        </div>

        {breakdown.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No hay retoques pendientes calculados para este mes.
          </div>
        ) : (
          <>
            {/* Mobile View: Clean touch-friendly cards (hidden on sm+) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {breakdown.map((row) => (
                <div key={`mob-${row.client_id}`} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{row.client_name}</h4>
                      <p className="text-xs text-slate-500">{row.service_type}</p>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0">
                      {formatCLP(row.amount_clp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Fecha: {formatChileanDate(row.next_retouch_date)}
                    </span>

                    <button
                      onClick={() => {
                        const clientObj: any = {
                          id: row.client_id,
                          full_name: row.client_name,
                          phone: '+56900000000',
                        };
                        const srvObj: any = {
                          service_type: row.service_type,
                          amount_clp: row.amount_clp,
                          next_retouch_date: row.next_retouch_date,
                        };
                        onOpenWhatsApp(clientObj, srvObj);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition"
                    >
                      <Send className="w-3 h-3" />
                      <span>Avisar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Table (hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                    <th className="py-3 px-4">Clienta</th>
                    <th className="py-3 px-4">Servicio Estimado</th>
                    <th className="py-3 px-4">Fecha Estimada</th>
                    <th className="py-3 px-4 text-right">Valor Estimado (CLP)</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {breakdown.map((row) => (
                    <tr key={row.client_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {row.client_name}
                      </td>
                      <td className="py-3.5 px-4">
                        {row.service_type}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatChileanDate(row.next_retouch_date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        {formatCLP(row.amount_clp)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            const clientObj: any = {
                              id: row.client_id,
                              full_name: row.client_name,
                              phone: '+56900000000',
                            };
                            const srvObj: any = {
                              service_type: row.service_type,
                              amount_clp: row.amount_clp,
                              next_retouch_date: row.next_retouch_date,
                            };
                            onOpenWhatsApp(clientObj, srvObj);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs active:scale-95 transition"
                        >
                          <Send className="w-3 h-3" />
                          <span>Avisar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
