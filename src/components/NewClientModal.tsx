import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { X, Sparkles, UserPlus } from 'lucide-react';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: () => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+56 9 ');
  const [notes, setNotes] = useState('');
  
  // Initial service fields
  const [hasInitialService, setHasInitialService] = useState(true);
  const [serviceType, setServiceType] = useState('Tintura Raíz');
  const [tintBrand, setTintBrand] = useState("L'Oréal Professionnel");
  const [colorFormula, setColorFormula] = useState('');
  const [amountClp, setAmountClp] = useState('45000');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [intervalDays, setIntervalDays] = useState('30');
  const [serviceNotes, setServiceNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      };

      if (hasInitialService && serviceType) {
        payload.initial_service = {
          service_type: serviceType,
          tint_brand: tintBrand,
          color_formula: colorFormula,
          amount_clp: parseInt(amountClp.replace(/\D/g, '') || '0', 10),
          service_date: serviceDate,
          recommended_interval_days: parseInt(intervalDays, 10) || 30,
          notes: serviceNotes,
        };
      }

      await apiRequest('/api/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onClientCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la clienta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-rose-100 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Nueva Clienta</h3>
              <p className="text-[11px] sm:text-xs text-rose-100">Ficha técnica y control de retoques</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Carolina Silva"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Teléfono WhatsApp * (Chile)
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
              Observaciones de la clienta
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Prefiere citas los viernes, cuero cabelludo sensible..."
              className="w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-800 focus:border-rose-500 outline-none"
            />
          </div>

          {/* Toggle for initial service */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasInitialService}
                  onChange={(e) => setHasInitialService(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Registrar Servicio Inicial / Último Realizado
                </span>
              </label>
              <span className="text-[11px] text-slate-400">Recomendado para calcular retoque</span>
            </div>

            {hasInitialService && (
              <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Tipo de Tratamiento / Servicio
                    </label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white"
                    >
                      <option value="Tintura Raíz">Tintura Raíz</option>
                      <option value="Color Global">Color Global</option>
                      <option value="Balayage">Balayage</option>
                      <option value="Babylights">Babylights</option>
                      <option value="Baño de Luz / Matiz">Baño de Luz / Matiz</option>
                      <option value="Botox Capilar">Botox Capilar</option>
                      <option value="Alisado Permanente">Alisado Permanente</option>
                      <option value="Corte y Tratamiento">Corte y Tratamiento</option>
                      <option value="Otro Servicio">Otro Servicio</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Marca de Tinte (Opcional)
                    </label>
                    <input
                      type="text"
                      value={tintBrand}
                      onChange={(e) => setTintBrand(e.target.value)}
                      placeholder="L'Oréal, Wella, Igora..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Fórmula o Mezcla de Color
                  </label>
                  <input
                    type="text"
                    value={colorFormula}
                    onChange={(e) => setColorFormula(e.target.value)}
                    placeholder="Ej: 7.1 (30g) + 7.0 (15g) + Ox 20vol (70ml)"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Fecha del Servicio
                    </label>
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Valor Cobrado (CLP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-semibold">$</span>
                      <input
                        type="number"
                        step="1000"
                        value={amountClp}
                        onChange={(e) => setAmountClp(e.target.value)}
                        placeholder="45000"
                        className="w-full rounded-lg border border-slate-300 pl-6 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Retoque Recomendado
                    </label>
                    <select
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white"
                    >
                      <option value="20">Cada 20 días (Raíz rápida)</option>
                      <option value="30">Cada 30 días (1 mes estándar)</option>
                      <option value="45">Cada 45 días (1 mes y medio)</option>
                      <option value="60">Cada 60 días (2 meses / Balayage)</option>
                      <option value="90">Cada 90 días (3 meses)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={serviceNotes}
                    onChange={(e) => setServiceNotes(e.target.value)}
                    placeholder="Observaciones del servicio (ej: cubrimiento 100% canas)..."
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 focus:border-rose-500 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !fullName || !phone}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Clienta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
