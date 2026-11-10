import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { formatCLP } from '../utils/formatters';
import { CreditCard, CheckCircle2, XCircle, Clock, AlertCircle, X, ShieldCheck, ArrowRight } from 'lucide-react';

interface LocalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingCode?: string;
  amountClp: number;
  serviceName: string;
  onPaymentProcessed?: (status: 'approved' | 'rejected' | 'pending') => void;
}

export const LocalCheckoutModal: React.FC<LocalCheckoutModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  bookingCode,
  amountClp,
  serviceName,
  onPaymentProcessed,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultStatus, setResultStatus] = useState<'approved' | 'rejected' | 'pending' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulate = async (action: 'approve' | 'reject' | 'pending') => {
    setIsProcessing(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ message: string; transaction_status: 'approved' | 'rejected' | 'pending' }>('/api/payments/checkout/simulate', {
        method: 'POST',
        body: JSON.stringify({ booking_id: bookingId, action }),
      });

      setResultStatus(res.transaction_status);
      setMessage(res.message);

      if (onPaymentProcessed) {
        onPaymentProcessed(res.transaction_status);
      }
    } catch (err: any) {
      setMessage(err.message || 'Error al procesar la simulación de pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-1">
              <CreditCard className="w-3.5 h-3.5" />
              Checkout Local Simulado (Chile)
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Portal de Pago Seguro
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500 font-medium">Servicio a pagar:</div>
            <div className="font-bold text-slate-900 text-sm">{serviceName}</div>
            {bookingCode && (
              <div className="text-[11px] text-slate-400 mt-0.5">Reserva: {bookingCode}</div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">Monto total (CLP):</span>
              <span className="text-xl font-black text-slate-900">{formatCLP(amountClp)}</span>
            </div>
          </div>

          {resultStatus ? (
            <div className="text-center py-4 space-y-3">
              {resultStatus === 'approved' && (
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              )}
              {resultStatus === 'rejected' && (
                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                  <XCircle className="w-8 h-8" />
                </div>
              )}
              {resultStatus === 'pending' && (
                <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8" />
                </div>
              )}

              <div className="font-bold text-sm text-slate-900">{message}</div>
              <p className="text-xs text-slate-500">
                El estado de pago ha quedado registrado persistentemente en SQLite.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Cerrar Checkout
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium text-center mb-2">
                Selecciona el resultado a simular para verificar el flujo de la aplicación:
              </p>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSimulate('approve')}
                className="w-full p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Simular Pago Aprobado
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSimulate('reject')}
                className="w-full p-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors border border-red-200 flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Simular Pago Rechazado
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSimulate('pending')}
                className="w-full p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors border border-amber-200 flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Dejar Pago Pendiente
              </button>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Transacción Local Sin Conexión Externa
          </span>
          <span>SalonTrack 2.0</span>
        </div>
      </div>
    </div>
  );
};
