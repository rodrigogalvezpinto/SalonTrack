import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { X, Scissors, Sparkles } from 'lucide-react';
import { Client } from '../types';

interface NewServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onServiceCreated: () => void;
}

export const NewServiceModal: React.FC<NewServiceModalProps> = ({
  isOpen,
  onClose,
  client,
  onServiceCreated,
}) => {
  const [serviceType, setServiceType] = useState('Tintura Raíz');
  const [tintBrand, setTintBrand] = useState("L'Oréal Professionnel");
  const [colorFormula, setColorFormula] = useState('');
  const [amountClp, setAmountClp] = useState('45000');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [intervalDays, setIntervalDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !client) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest('/api/services', {
        method: 'POST',
        body: JSON.stringify({
          client_id: client.id,
          service_type: serviceType,
          tint_brand: tintBrand,
          color_formula: colorFormula,
          amount_clp: parseInt(amountClp.replace(/\D/g, '') || '0', 10),
          service_date: serviceDate,
          recommended_interval_days: parseInt(intervalDays, 10) || 30,
          notes: notes.trim(),
        }),
      });

      onServiceCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el servicio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-rose-100 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Registrar Nuevo Servicio</h3>
              <p className="text-[11px] sm:text-xs text-purple-200">Para {client.full_name}</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Tipo de Servicio *
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-purple-600 bg-white"
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
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Marca de Tinte (Opcional)
              </label>
              <input
                type="text"
                value={tintBrand}
                onChange={(e) => setTintBrand(e.target.value)}
                placeholder="L'Oréal, Wella, Igora..."
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-purple-600 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Fórmula de Color / Mezcla Utilizada
            </label>
            <textarea
              rows={2}
              value={colorFormula}
              onChange={(e) => setColorFormula(e.target.value)}
              placeholder="Ej: Majirel 6.1 (30g) + 6.0 (15g) + Ox 20vol (70ml)..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-purple-600 font-mono outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Fecha Visita
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-purple-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Cobrado (CLP)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  step="1000"
                  value={amountClp}
                  onChange={(e) => setAmountClp(e.target.value)}
                  placeholder="45000"
                  className="w-full rounded-xl border border-slate-300 pl-6 p-2 text-xs text-slate-800 focus:border-purple-600 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Retoque En
              </label>
              <select
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-purple-600"
              >
                <option value="20">20 días (Rápido)</option>
                <option value="30">30 días (1 mes)</option>
                <option value="45">45 días (1.5 meses)</option>
                <option value="60">60 días (2 meses)</option>
                <option value="90">90 días (3 meses)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
              Observaciones del Resultado
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Quedó encantada con el matiz ceniza, hidratar puntas..."
              className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-purple-600"
            />
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
              disabled={loading || !serviceType}
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Añadir al Historial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
