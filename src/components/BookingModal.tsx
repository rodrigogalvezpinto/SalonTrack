import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCLP } from '../utils/formatters';
import { Business, CatalogService, Staff, TimeSlotItem, Booking } from '../types';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  AlertCircle,
  MapPin,
  ChevronRight,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business;
  initialService?: CatalogService | null;
  onBookingSuccess?: (booking: Booking, paymentData?: any) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  business,
  initialService,
  onBookingSuccess,
}) => {
  const { user, profile } = useAuth();

  const [step, setStep] = useState<number>(1); // 1: Service/Staff, 2: Date & Slot, 3: Client Details & Payment, 4: Confirmed
  const [services, setServices] = useState<CatalogService[]>([]);
  const [selectedService, setSelectedService] = useState<CatalogService | null>(initialService || null);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(''); // '' = Cualquiera

  // Date & slots
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [availableSlots, setAvailableSlots] = useState<TimeSlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotItem | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Client Details
  const [modality, setModality] = useState<string>('salon');
  const [clientName, setClientName] = useState<string>(profile?.full_name || '');
  const [clientPhone, setClientPhone] = useState<string>(profile?.phone || '+569');
  const [clientEmail, setClientEmail] = useState<string>(user?.email || '');
  const [clientNotes, setClientNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'presential' | 'online'>('presential');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  // Load business catalog services & staff on open
  useEffect(() => {
    if (!isOpen || !business?.id) return;

    const loadData = async () => {
      try {
        const res = await apiRequest<{ services: CatalogService[]; staff: Staff[] }>(`/api/marketplace/business/${business.slug}`);
        if (res && res.services) {
          setServices(res.services);
          if (!selectedService && res.services.length > 0) {
            setSelectedService(initialService || res.services[0]);
          }
        }
        if (res && res.staff) {
          setStaffList(res.staff);
        }
      } catch (err) {
        console.error('Error loading business details for booking:', err);
      }
    };
    loadData();
  }, [isOpen, business]);

  // Sync profile details if available
  useEffect(() => {
    if (profile) {
      if (!clientName) setClientName(profile.full_name || '');
      if (clientPhone === '+569' && profile.phone) setClientPhone(profile.phone);
    }
    if (user && !clientEmail) {
      setClientEmail(user.email);
    }
  }, [profile, user]);

  // Load available slots whenever date, service, or staff changes
  useEffect(() => {
    if (!business?.id || !selectedService?.id || !selectedDate) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        let url = `/api/availability/slots?business_id=${business.id}&service_id=${selectedService.id}&date=${selectedDate}`;
        if (selectedStaffId) {
          url += `&staff_id=${selectedStaffId}`;
        }
        const res = await apiRequest<{ slots: TimeSlotItem[] }>(url);
        if (res && res.slots) {
          setAvailableSlots(res.slots);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error('Error fetching availability slots:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [business?.id, selectedService?.id, selectedDate, selectedStaffId]);

  if (!isOpen) return null;

  const handleCreateBooking = async () => {
    if (!selectedService || !selectedSlot) {
      setErrorMessage('Por favor selecciona un servicio y un horario disponible.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMessage('Por favor ingresa tu nombre y teléfono de contacto.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        business_id: business.id,
        service_id: selectedService.id,
        staff_id: selectedSlot.staffId,
        booking_date: selectedDate,
        start_time: selectedSlot.time,
        modality,
        payment_method: paymentMethod,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_email: clientEmail.trim() || undefined,
        client_notes: clientNotes.trim() || undefined,
      };

      const res = await apiRequest<{ booking: any; payment?: any; message: string }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setConfirmedBooking(res.booking);
      setStep(4); // Move to Confirmation screen

      if (onBookingSuccess) {
        onBookingSuccess(res.booking, res.payment);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al confirmar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5" />
              Reserva Online en {business.name}
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
              {step === 1 && 'Selecciona Servicio y Especialista'}
              {step === 2 && 'Elige Fecha y Horario Disponible'}
              {step === 3 && 'Tus Datos y Forma de Pago'}
              {step === 4 && '¡Reserva Registrada con Éxito!'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        {step < 4 && (
          <div className="flex items-center gap-2 my-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  step >= s ? 'bg-rose-500' : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: SELECT SERVICE & STAFF */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Servicio a Realizar
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedService(srv)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedService?.id === srv.id
                        ? 'border-rose-500 bg-rose-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{srv.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {srv.duration_minutes} min
                        </span>
                        {srv.description && (
                          <span className="truncate max-w-[200px] text-slate-400">
                            • {srv.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-rose-600 text-sm">
                        {formatCLP(srv.price_clp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Profesional / Especialista
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStaffId('')}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all ${
                    selectedStaffId === ''
                      ? 'border-rose-500 bg-rose-50/60 text-rose-700 font-black'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mb-1 text-rose-500" />
                  Cualquier profesional disponible
                </button>
                {staffList.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStaffId(st.id)}
                    className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                      selectedStaffId === st.id
                        ? 'border-rose-500 bg-rose-50/60 text-rose-700 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold truncate">{st.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{st.specialty || 'Estilista'}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={!selectedService}
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-200 transition-all flex items-center gap-2"
              >
                Continuar a Fecha y Hora
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT DATE & AVAILABILITY SLOTS */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Fecha de la cita
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-sm bg-slate-50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Horarios Disponibles Calculados ({availableSlots.length})
                </label>
                {loadingSlots && (
                  <span className="text-[11px] font-semibold text-rose-600 animate-pulse">
                    Calculando agenda...
                  </span>
                )}
              </div>

              {loadingSlots ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Comprobando disponibilidad del salón...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Sin horarios disponibles para este día</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Prueba cambiando de fecha o seleccionando otro profesional.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.time === slot.time && selectedSlot?.staffId === slot.staffId;
                    return (
                      <button
                        key={`${slot.time}_${slot.staffId}`}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-rose-500 bg-rose-600 text-white font-bold shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <div className="text-sm font-black tracking-tight">{slot.time}</div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-rose-100' : 'text-slate-500'}`}>
                          {slot.staffName.split(' ')[0]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Atrás
              </button>
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
                className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Continuar a Confirmación
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CLIENT DETAILS & PAYMENT */}
        {step === 3 && selectedService && selectedSlot && (
          <div className="space-y-4 py-2">
            {/* Booking Summary Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Resumen de Atención
                  </span>
                  <h4 className="font-bold text-slate-900 text-base">{selectedService.name}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Profesional: <span className="font-semibold text-slate-900">{selectedSlot.staffName}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Fecha: <span className="font-semibold text-slate-900">{selectedDate}</span> a las{' '}
                    <span className="font-semibold text-rose-600">{selectedSlot.time} hrs</span> ({selectedSlot.durationMinutes} min)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Total a Pagar</span>
                  <div className="text-xl font-black text-rose-600">
                    {formatCLP(selectedService.price_clp)}
                  </div>
                </div>
              </div>
            </div>

            {/* Modality */}
            {business.modality === 'both' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Modalidad de Atención
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModality('salon')}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                      modality === 'salon'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    🏢 En el salón
                  </button>
                  <button
                    type="button"
                    onClick={() => setModality('home')}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                      modality === 'home'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    🚗 A Domicilio
                  </button>
                </div>
              </div>
            )}

            {/* Client input fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tu Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Camila Silva"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Móvil (WhatsApp) *</label>
                <input
                  type="tel"
                  required
                  placeholder="+56 9 1234 5678"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones / Indicaciones (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Ej: Cabello con tintura previa, preferencia de tono frío, etc."
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs font-semibold resize-none"
              />
            </div>

            {/* Payment Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Forma de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('presential')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    paymentMethod === 'presential'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-600 mb-1" />
                  <div className="font-bold text-xs text-slate-900">Pago Presencial</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Pagas directamente en el local al atenderte</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    paymentMethod === 'online'
                      ? 'border-rose-500 bg-rose-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-blue-600 mb-1" />
                  <div className="font-bold text-xs text-slate-900">Pago en Línea</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Checkout local simulado de prueba</div>
                </button>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Atrás
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCreateBooking}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Registrando Reserva...' : 'Confirmar Reserva Ahora'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS RECEIPT */}
        {step === 4 && confirmedBooking && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                {confirmedBooking.status === 'CONFIRMED' ? '¡Cita Confirmada!' : 'Solicitud Pendiente'}
              </span>
              <h4 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Código: <span className="text-rose-600">{confirmedBooking.code}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Guarda este código para tu comprobante de atención.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">Salón:</span>
                <span className="font-bold text-slate-900">{confirmedBooking.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Servicio:</span>
                <span className="font-bold text-slate-900">{confirmedBooking.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Profesional:</span>
                <span className="font-bold text-slate-900">{confirmedBooking.staff_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha y Hora:</span>
                <span className="font-bold text-slate-900">
                  {confirmedBooking.booking_date} a las {confirmedBooking.start_time} hrs
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500">Total:</span>
                <span className="font-black text-rose-600 text-sm">
                  {formatCLP(confirmedBooking.amount_clp)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Forma de Pago:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {confirmedBooking.payment_method === 'presential' ? 'Presencial en el local' : 'En línea (Simulado)'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all"
              >
                Cerrar y Ver Mis Reservas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
