import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCLP, formatChileanPhone } from '../utils/formatters';
import { requestNotificationPermission, showPushNotification, playNotificationChime } from '../utils/notifications';
import { 
  Settings, 
  Crown, 
  Bell, 
  MessageCircle, 
  Download, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Building, 
  User, 
  Phone, 
  Clock, 
  RotateCcw
} from 'lucide-react';

interface SettingsViewProps {
  onOpenCheckout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenCheckout }) => {
  const { profile, subscription, user, updateProfile, reloadSession } = useAuth();

  // Salon profile fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [defaultInterval, setDefaultInterval] = useState(String(profile?.default_interval_days || 30));
  const [whatsappTemplate, setWhatsappTemplate] = useState(profile?.whatsapp_template || '');
  
  // Re-engagement settings
  const [reEngagementTemplate, setReEngagementTemplate] = useState(profile?.re_engagement_template || '');
  const [reEngagementThreshold, setReEngagementThreshold] = useState(String(profile?.re_engagement_days_threshold || 90));

  // Notification settings
  const [pushEnabled, setPushEnabled] = useState(profile?.notification_preferences?.push_enabled ?? true);
  const [alertTime, setAlertTime] = useState(profile?.notification_preferences?.alert_time || '09:00');
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(String(profile?.notification_preferences?.notify_days_before || 3));
  const [soundEnabled, setSoundEnabled] = useState(profile?.notification_preferences?.sound_enabled ?? true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setBusinessName(profile.business_name);
      setPhone(profile.phone);
      setDefaultInterval(String(profile.default_interval_days));
      setWhatsappTemplate(profile.whatsapp_template);
      setReEngagementTemplate(profile.re_engagement_template || '');
      setReEngagementThreshold(String(profile.re_engagement_days_threshold || 90));
      if (profile.notification_preferences) {
        setPushEnabled(profile.notification_preferences.push_enabled);
        setAlertTime(profile.notification_preferences.alert_time);
        setNotifyDaysBefore(String(profile.notification_preferences.notify_days_before));
        setSoundEnabled(profile.notification_preferences.sound_enabled ?? true);
      }
    }
  }, [profile]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateProfile({
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        phone: phone.trim(),
        default_interval_days: parseInt(defaultInterval, 10) || 30,
        whatsapp_template: whatsappTemplate,
        re_engagement_template: reEngagementTemplate,
        re_engagement_days_threshold: parseInt(reEngagementThreshold, 10) || 90,
      });

      await apiRequest('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          push_enabled: pushEnabled,
          alert_time: alertTime,
          notify_days_before: parseInt(notifyDaysBefore, 10) || 3,
          sound_enabled: soundEnabled,
        }),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPushNotification = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      playNotificationChime();
      showPushNotification('🔔 Notificación SalonTrack (Chile)', {
        body: `Recordatorio configurado a las ${alertTime} hrs (America/Santiago) con ${notifyDaysBefore} días de anticipación.`,
      });
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/backup/export';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>Configuración & Perfil del Salón</span>
        </h2>
        <p className="text-xs text-slate-500">
          Personaliza tus datos, mensajes de WhatsApp, notificaciones push y estado de licencia.
        </p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Salon & Stylist Profile */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Building className="w-4 h-4 text-rose-600" />
            <span>Datos del Salón y Estilista</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nombre de la Estilista / Profesional
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nombre del Salón o Estudio de Belleza
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Teléfono WhatsApp del Salón
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Intervalo de Retoque Predeterminado
              </label>
              <select
                value={defaultInterval}
                onChange={(e) => setDefaultInterval(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-rose-500 bg-white outline-none"
              >
                <option value="20">Cada 20 días</option>
                <option value="30">Cada 30 días (1 mes estándar)</option>
                <option value="45">Cada 45 días (1.5 meses)</option>
                <option value="60">Cada 60 días (2 meses)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-2xl bg-slate-50 text-xs text-slate-600">
            <div>
              <strong>País & Moneda:</strong> Chile (CLP - $)
            </div>
            <div>
              <strong>Zona Horaria:</strong> America/Santiago
            </div>
          </div>
        </div>

        {/* WhatsApp Templates Configuration */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Mensajes de WhatsApp Personalizados</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Plantilla para Recordatorio de Retoque Habitual
              </label>
              <textarea
                rows={3}
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 focus:border-emerald-500 outline-none leading-relaxed"
              />
              <span className="text-[11px] text-slate-400">
                Variables disponibles: {'{nombre}'}, {'{salon}'}, {'{servicio}'}, {'{fecha}'}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Plantilla de Oferta para Re-engagement (Clientas Inactivas)
              </label>
              <textarea
                rows={3}
                value={reEngagementTemplate}
                onChange={(e) => setReEngagementTemplate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 focus:border-purple-500 outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Variables: {'{nombre}'}, {'{salon}'}, {'{servicio}'}</span>
                <span className="font-semibold text-purple-700">Incluye oferta especial o descuento</span>
              </div>
            </div>
          </div>
        </div>

        {/* Push Notifications Configuration */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>Notificaciones Push & Alertas en Celular</span>
            </h3>
            <button
              type="button"
              onClick={handleTestPushNotification}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200"
            >
              Probar Notificación
            </button>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 text-xs block">Activar Notificaciones Push</span>
                <span className="text-[11px] text-slate-500">Recibe recordatorios de retoques en tu pantalla</span>
              </div>
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => setPushEnabled(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hora de alerta diaria (Santiago de Chile)
                </label>
                <input
                  type="time"
                  value={alertTime}
                  onChange={(e) => setAlertTime(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Anticipación del aviso
                </label>
                <select
                  value={notifyDaysBefore}
                  onChange={(e) => setNotifyDaysBefore(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-indigo-500 bg-white"
                >
                  <option value="1">1 día antes</option>
                  <option value="2">2 días antes</option>
                  <option value="3">3 días antes (Recomendado)</option>
                  <option value="5">5 días antes</option>
                  <option value="7">1 semana antes</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* License & Subscription Status */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>Estado de Licencia & Pagos (Mercado Pago Chile)</span>
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
              subscription?.status === 'trial' ? 'bg-amber-100 text-amber-800' :
              'bg-rose-100 text-rose-800'
            }`}>
              {subscription?.status === 'active' ? 'Licencia Activa' :
               subscription?.status === 'trial' ? `Prueba (${subscription.days_remaining} días restantes)` :
               'Vencida'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm">Planes SalonTrack Chile</h4>
              <p className="text-xs text-slate-300">
                Desde $9.990 CLP mensuales o $14.990 CLP por 3 meses completos.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCheckout}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg hover:from-rose-600 hover:to-pink-600 transition active:scale-95 shrink-0"
            >
              Renovar o Mejorar Plan
            </button>
          </div>
        </div>

        {/* Privacy & Backup */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 text-sm">Respaldo y Privacidad de Datos</h4>
            <p className="text-xs text-slate-500">
              Descarga una copia completa de tus clientas, fórmulas e historial en formato JSON seguro.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Respaldo</span>
          </button>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4 stroke-[3]" />
              ¡Configuración guardada con éxito!
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Todos los Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
};
