import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { ReEngagementResponse, ReEngagementCandidate } from '../types';
import { formatCLP, formatChileanDate, formatChileanPhone, buildWhatsAppLink } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { 
  RotateCcw, 
  Send, 
  CheckCircle, 
  Sparkles, 
  AlertTriangle, 
  Filter, 
  Settings2, 
  Calendar, 
  Clock, 
  Phone,
  Tag
} from 'lucide-react';

export const ReEngagementView: React.FC = () => {
  const { profile } = useAuth();
  const [data, setData] = useState<ReEngagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholdDays, setThresholdDays] = useState<number>(90);
  const [customDays, setCustomDays] = useState<string>('90');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateText, setTemplateText] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const fetchReEngagement = async (days = thresholdDays) => {
    setLoading(true);
    try {
      const res = await apiRequest<ReEngagementResponse>(`/api/re-engagement?threshold_days=${days}`);
      setData(res);
      setTemplateText(res.template);
    } catch (e) {
      console.error('Error fetching re-engagement data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReEngagement(thresholdDays);
  }, [thresholdDays]);

  const handleThresholdChange = (days: number) => {
    setShowCustomInput(false);
    setThresholdDays(days);
  };

  const handleApplyCustomDays = (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(customDays, 10);
    if (!isNaN(days) && days > 0) {
      setThresholdDays(days);
    }
  };

  const handleUpdateStatus = async (
    candidate: ReEngagementCandidate, 
    newStatus: 'recontacted' | 'reactivated' | 'dismissed' | 'none'
  ) => {
    setUpdatingStatusId(candidate.client_id);
    try {
      await apiRequest('/api/re-engagement/status', {
        method: 'POST',
        body: JSON.stringify({
          client_id: candidate.client_id,
          status: newStatus,
          notes: `Estado actualizado a ${newStatus} desde módulo Re-engagement`,
        }),
      });
      // Refresh local state
      await fetchReEngagement(thresholdDays);
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSendWhatsAppOffer = async (candidate: ReEngagementCandidate) => {
    const waUrl = buildWhatsAppLink(candidate.phone, candidate.suggested_message);

    // Update status to 'recontacted' and log action
    try {
      await apiRequest('/api/re-engagement/status', {
        method: 'POST',
        body: JSON.stringify({
          client_id: candidate.client_id,
          status: 'recontacted',
          notes: `Oferta especial enviada vía WhatsApp (${candidate.months_inactive} meses inactiva)`,
        }),
      });
      await fetchReEngagement(thresholdDays);
    } catch (err) {
      console.error('Error recording WhatsApp contact:', err);
    }

    // Open WhatsApp
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSaveTemplate = async () => {
    try {
      await apiRequest('/api/re-engagement/template', {
        method: 'PUT',
        body: JSON.stringify({
          template: templateText,
          threshold_days: thresholdDays,
        }),
      });
      setIsEditingTemplate(false);
      await fetchReEngagement(thresholdDays);
    } catch (err) {
      console.error('Error saving template:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Hero */}
      <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-purple-200 text-xs font-semibold">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Módulo de Re-engagement y Retención</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Recupera Clientas Inactivas
          </h2>
          <p className="text-sm sm:text-base text-purple-200 leading-relaxed">
            Identifica automáticamente clientas que no han visitado el salón en los últimos meses.
            Envíales una oferta especial irresistible por WhatsApp para motivar su regreso.
          </p>

          {/* Configurable Threshold Selector */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-purple-300 font-semibold flex items-center gap-1.5 mr-1">
              <Filter className="w-3.5 h-3.5" />
              Período de inactividad:
            </span>

            <button
              onClick={() => handleThresholdChange(60)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                thresholdDays === 60 && !showCustomInput
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              2 Meses (60 días)
            </button>

            <button
              onClick={() => handleThresholdChange(90)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                thresholdDays === 90 && !showCustomInput
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              3 Meses (90 días) ⭐
            </button>

            <button
              onClick={() => handleThresholdChange(180)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                thresholdDays === 180 && !showCustomInput
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              6 Meses (180 días)
            </button>

            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                showCustomInput
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Personalizado
            </button>

            {showCustomInput && (
              <form onSubmit={handleApplyCustomDays} className="inline-flex items-center gap-1.5">
                <input
                  type="number"
                  min="15"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-20 px-2.5 py-1 text-xs rounded-lg bg-white text-slate-900 font-bold outline-none"
                  placeholder="Días"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Filtrar
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-rose-500/20 to-transparent pointer-events-none" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Clientas Inactivas</span>
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 truncate">
            {data?.total_inactive_clients || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Inactivas ≥ {thresholdDays} días
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Recontactadas</span>
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-blue-600 truncate">
            {data?.recontacted_count || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Oferta enviada
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Reactivadas</span>
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 truncate">
            {data?.reactivated_count || 0}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Agendaron cita 🎉
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Por Recuperar</span>
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 truncate">
            {formatCLP(data?.potential_recoverable_revenue_clp || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
            Potencial en servicios CLP
          </p>
        </div>
      </div>

      {/* Offer Template Editor Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-rose-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Mensaje Predefinido de Oferta para Re-engagement
            </h3>
          </div>
          <button
            onClick={() => setIsEditingTemplate(!isEditingTemplate)}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{isEditingTemplate ? 'Cancelar edición' : 'Personalizar oferta'}</span>
          </button>
        </div>

        {isEditingTemplate ? (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full text-xs font-normal rounded-xl border border-slate-300 p-3 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Variables: {'{nombre}'}, {'{salon}'}, {'{servicio}'}, {'{estilista}'}
              </span>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Guardar Plantilla
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 leading-relaxed italic">
            "{data?.template || templateText}"
          </div>
        )}
      </div>

      {/* Inactive Clients Candidate List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Listado de Clientas Inactivas ({data?.candidates?.length || 0})
            </h3>
            <p className="text-xs text-slate-500">
              Ordenadas por tiempo transcurrido desde su última visita.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Cargando clientas inactivas...
          </div>
        ) : !data?.candidates || data.candidates.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">¡Excelente retención!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No se encontraron clientas sin visitas por más de {thresholdDays} días. Todas están activas o con retoques al día.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.candidates.map((candidate) => {
              const isRecontacted = candidate.re_engagement_status === 'recontacted';
              const isReactivated = candidate.re_engagement_status === 'reactivated';
              const isDismissed = candidate.re_engagement_status === 'dismissed';

              return (
                <div
                  key={candidate.client_id}
                  className="p-5 sm:p-6 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Info */}
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-base">
                        {candidate.full_name}
                      </h4>
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {formatChileanPhone(candidate.phone)}
                      </span>

                      {/* Status Badges */}
                      {isReactivated ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✓ Reactivada
                        </span>
                      ) : isRecontacted ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Recontactada
                        </span>
                      ) : isDismissed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                          Descartada
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          Inactiva ({candidate.months_inactive} meses)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Última visita: <strong>{formatChileanDate(candidate.last_visit_date)}</strong> ({candidate.days_since_last_visit} días atrás)
                      </span>
                      <span>
                        Servicio: <strong>{candidate.latest_service?.service_type || 'Tratamiento'}</strong> ({formatCLP(candidate.recoverable_amount_clp)})
                      </span>
                    </div>

                    {candidate.latest_service?.color_formula && (
                      <p className="text-xs text-slate-500 font-mono bg-slate-100/80 px-2 py-1 rounded inline-block">
                        Fórmula anterior: {candidate.latest_service.color_formula}
                      </p>
                    )}

                    {candidate.notes && (
                      <p className="text-xs text-slate-500 italic">
                        Nota: {candidate.notes}
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {/* Status dropdown */}
                    <select
                      value={candidate.re_engagement_status}
                      disabled={updatingStatusId === candidate.client_id}
                      onChange={(e) => handleUpdateStatus(candidate, e.target.value as any)}
                      className="text-xs font-semibold rounded-xl border border-slate-300 py-2.5 sm:py-2 px-3 bg-white text-slate-700 outline-none focus:border-rose-500 w-full sm:w-auto"
                    >
                      <option value="none">Pendiente de contacto</option>
                      <option value="recontacted">Recontactada (Oferta enviada)</option>
                      <option value="reactivated">🎉 Reactivada (Agendó)</option>
                      <option value="dismissed">Descartar de re-engagement</option>
                    </select>

                    {/* WhatsApp Action button */}
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppOffer(candidate)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-emerald-600/20 active:scale-95 transition w-full sm:w-auto"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Oferta WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
