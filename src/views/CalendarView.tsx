import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { CalendarEvent, Client } from '../types';
import { formatCLP, formatChileanDate, formatChileanPhone } from '../utils/formatters';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Scissors, 
  Send,
  Phone
} from 'lucide-react';

interface CalendarViewProps {
  onOpenWhatsApp: (client: Client, service?: any) => void;
  onSelectClient: (client: Client) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  onOpenWhatsApp,
  onSelectClient,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ events: CalendarEvent[]; santiago_date: string }>('/api/calendar');
      setEvents(res.events || []);
    } catch (e) {
      console.error('Error fetching calendar events:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  // Calendar math
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert to Monday = 0
  const startDayOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Events on selected date
  const selectedDateEvents = events.filter(e => e.date === selectedDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-600" />
            <span>Calendario de Retoques & Visitas</span>
          </h2>
          <p className="text-xs text-slate-500">
            Agenda visual para planificar tu semana en el salón.
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs sm:text-sm font-bold text-slate-800 min-w-[120px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month Grid (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3.5 sm:p-5 space-y-4">
          <div className="grid grid-cols-7 text-center font-bold text-slate-400 text-xs py-1">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mié</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sáb</span>
            <span>Dom</span>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty slots before month start */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 sm:h-20 rounded-xl bg-slate-50/50" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              const dayEvents = events.filter(e => e.date === dateStr);
              const retouchesCount = dayEvents.filter(e => e.type === 'retouch').length;
              const completedCount = dayEvents.filter(e => e.type === 'completed_service').length;

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-14 sm:h-20 rounded-xl p-1 sm:p-2 border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-200'
                      : isToday
                      ? 'border-rose-400 bg-rose-50/30'
                      : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] sm:text-xs font-bold ${isToday ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {retouchesCount > 0 && (
                      <div className="text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded truncate">
                        {retouchesCount} {retouchesCount === 1 ? 'ret.' : 'retoques'}
                      </div>
                    )}
                    {completedCount > 0 && (
                      <div className="text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-600 px-1 py-0.2 rounded truncate hidden sm:block">
                        {completedCount} visita{completedCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Drawer (1 col) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3.5 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Clientas para el día</span>
              <h3 className="font-black text-slate-900 text-lg">
                {formatChileanDate(selectedDate)}
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
              {selectedDateEvents.length} eventos
            </span>
          </div>

          {selectedDateEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No hay retoques ni visitas registradas en esta fecha.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 
                        onClick={() => onSelectClient({ id: evt.client_id, user_id: '', full_name: evt.client_name, phone: evt.client_phone || '', notes: '', created_at: '', updated_at: '' })}
                        className="font-bold text-slate-900 text-sm hover:text-indigo-600 cursor-pointer"
                      >
                        {evt.client_name}
                      </h4>
                      <p className="text-xs text-slate-500">{evt.service_type}</p>
                    </div>

                    <span className="font-bold text-xs text-slate-900">
                      {formatCLP(evt.amount_clp)}
                    </span>
                  </div>

                  {evt.color_formula && (
                    <p className="text-[11px] text-slate-500 font-mono bg-white p-1.5 rounded border border-slate-100">
                      Fórmula: {evt.color_formula}
                    </p>
                  )}

                  {evt.type === 'retouch' && (
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => {
                          const clientObj: any = {
                            id: evt.client_id,
                            full_name: evt.client_name,
                            phone: evt.client_phone || '+56900000000',
                          };
                          const srvObj: any = {
                            service_type: evt.service_type,
                            amount_clp: evt.amount_clp,
                            next_retouch_date: evt.date,
                          };
                          onOpenWhatsApp(clientObj, srvObj);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs active:scale-95 transition"
                      >
                        <Send className="w-3 h-3" />
                        <span>Avisar WhatsApp</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
