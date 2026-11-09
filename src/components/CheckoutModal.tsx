import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCLP } from '../utils/formatters';
import { X, Check, ShieldCheck, CreditCard, Sparkles, AlertCircle } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: string;
  onSuccess?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  defaultPlan = 'pro_quarterly',
  onSuccess,
}) => {
  const { reloadSession } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>(defaultPlan);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'basic_monthly',
      name: 'Plan Mensual Estilista',
      price: 9990,
      duration: '1 Mes',
      badge: 'Flexibilidad',
      features: [
        'Gestión de clientas ilimitadas',
        'Recordatorios directos de WhatsApp',
        'Fórmulas y fichas técnicas capilares',
        'Calculadora de ingresos potenciales',
      ],
    },
    {
      id: 'pro_quarterly',
      name: 'Plan Trimestral Pro',
      price: 14990,
      duration: '3 Meses',
      badge: 'Más Popular en Chile',
      highlighted: true,
      features: [
        'Todo lo del Plan Mensual',
        '3 meses completos de acceso',
        'Ahorro del 50% mensual equivalente',
        'Acceso prioritario a nuevas funciones PWA',
        'Soporte técnico preferente en Chile',
      ],
    },
    {
      id: 'annual',
      name: 'Plan Semestral Fundador',
      price: 19990,
      duration: '6 Meses',
      badge: 'Mejor Valor',
      features: [
        'Acceso por 6 meses ininterrumpidos',
        'Copia de seguridad y exportación de datos',
        'Personalización de mensajes de WhatsApp',
        'Garantía de precio congelado para siempre',
      ],
    },
  ];

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Create preference on backend
      const prefRes = await apiRequest('/api/payments/create-preference', {
        method: 'POST',
        body: JSON.stringify({ plan_id: selectedPlan }),
      });

      // 2. If live Mercado Pago redirect available, we could redirect, or if in test/sandbox we activate with backend validation
      if (prefRes.mode === 'mercadopago_live' && prefRes.init_point) {
        window.location.href = prefRes.init_point;
        return;
      }

      // Activate license through secure backend verification (idempotent)
      const activationRes = await apiRequest('/api/subscriptions/activate-license', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: selectedPlan,
          payment_ref: prefRes.preference_id || `MP_CHILE_${Date.now()}`,
        }),
      });

      setSuccessMessage(activationRes.message || '¡Licencia activada con éxito!');
      await reloadSession();

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-rose-100 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-slate-900 px-4 sm:px-6 py-4 sm:py-5 text-white flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] sm:text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Mercado Pago Chile — Pago Seguro en CLP
            </div>
            <h3 className="text-lg sm:text-xl font-bold">Activa tu Licencia SalonTrack</h3>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Deja de perder clientas y recupera hasta $190.000 CLP en retoques olvidados cada mes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plan Selection */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {successMessage ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="text-lg font-bold text-emerald-900">{successMessage}</h4>
              <p className="text-xs text-emerald-700">
                Tu cuenta ha sido actualizada automáticamente con acceso total.
              </p>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {plans.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative rounded-2xl p-4 border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-rose-600 bg-rose-50/40 shadow-md ring-2 ring-rose-200'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {plan.badge && (
                        <span className={`absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          plan.highlighted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-100'
                        }`}>
                          {plan.badge}
                        </span>
                      )}

                      <div className="text-xs font-bold text-slate-500 uppercase">{plan.duration}</div>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">{plan.name}</h4>

                      <div className="mt-3">
                        <span className="text-2xl font-black text-slate-900">{formatCLP(plan.price)}</span>
                        <span className="text-xs text-slate-500 font-semibold ml-1">CLP</span>
                      </div>

                      <ul className="mt-4 space-y-2 text-[11px] text-slate-600">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Guarantees and Payment methods */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800">Pagos seguros con Mercado Pago Chile:</span>
                    <p className="text-[11px] text-slate-500">Tarjetas de Débito (Redcompra), Webpay Plus y Crédito en cuotas.</p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 shrink-0">
                  Valores exentos de IVA o sujetos a boleta electrónica.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!successMessage && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-sm shadow-lg shadow-rose-600/20 active:scale-95 transition disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isProcessing ? 'Procesando...' : `Confirmar y Pagar ${formatCLP(plans.find(p => p.id === selectedPlan)?.price)} CLP`}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
