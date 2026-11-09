import React, { useState, useEffect } from 'react';
import { Client, Service } from '../types';
import { prepareWhatsAppMessage, buildWhatsAppLink, formatChileanPhone } from '../utils/formatters';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, Send, Check, Copy, X } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  service?: Service | null;
  onContactLogged?: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  client,
  service,
  onContactLogged,
}) => {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (client) {
      const activeService = service || client.latest_service;
      const initialMsg = prepareWhatsAppMessage(profile?.whatsapp_template || '', {
        clientName: client.full_name,
        salonName: profile?.business_name || 'nuestro salón',
        stylistName: profile?.full_name,
        serviceType: activeService?.service_type || 'retoque capilar',
        nextRetouchDate: activeService?.next_retouch_date,
      });
      setMessage(initialMsg);
      setCopied(false);
      setNotes('');
    }
  }, [client, service, profile]);

  if (!isOpen || !client) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendAndLog = async () => {
    const waUrl = buildWhatsAppLink(client.phone, message);
    
    // Log contact in backend
    setIsLogging(true);
    try {
      await apiRequest('/api/contact-logs', {
        method: 'POST',
        body: JSON.stringify({
          client_id: client.id,
          status: 'contacted',
          notes: notes.trim() || `Recordatorio enviado: ${service?.service_type || client.latest_service?.service_type || 'Retoque'}`,
        }),
      });

      if (onContactLogged) {
        onContactLogged();
      }
    } catch (e) {
      console.error('Failed to log contact:', e);
    } finally {
      setIsLogging(false);
    }

    // Open WhatsApp in new tab / mobile app
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-rose-100 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Avisar por WhatsApp</h3>
              <p className="text-[11px] sm:text-xs text-emerald-100">
                Para {client.full_name} ({formatChileanPhone(client.phone)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Service context badge */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700">
            <div>
              <span className="font-semibold text-slate-900">Servicio anterior: </span>
              {service?.service_type || client.latest_service?.service_type || 'Retoque de color'}
            </div>
            {client.retouch && (
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                client.retouch.status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                client.retouch.status === 'today' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {client.retouch.label}
              </span>
            )}
          </div>

          {/* Editable message textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Mensaje personalizado para la clienta:
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none leading-relaxed transition"
              placeholder="Escribe el mensaje personalizado..."
            />
            <p className="text-[11px] text-slate-400 mt-1">
              * Podrás revisar y enviar el mensaje directamente en WhatsApp al presionar el botón verde.
            </p>
          </div>

          {/* Note optional */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Nota interna para el historial (opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Recordatorio enviado por promo de tinte..."
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSendAndLog}
            disabled={isLogging || !message.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md hover:shadow-emerald-600/25 active:scale-95 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Abrir en WhatsApp y Registrar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
