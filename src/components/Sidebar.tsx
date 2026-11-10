import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calculator,
  Calendar as CalendarIcon,
  Settings,
  Compass,
  CalendarCheck,
  Building,
  User,
  Shield,
  Heart,
  Scissors,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  pendingRetouchesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  pendingRetouchesCount = 0,
}) => {
  const { isPlatformAdmin, isBusinessOwner, isStaff, isCustomer, business } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-65px)] p-4 shrink-0 space-y-6">
      {/* Customer Experience Menu */}
      {isCustomer && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
            Portal de Clienta
          </div>

          <button
            onClick={() => onSelectView('marketplace')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
              currentView === 'marketplace'
                ? 'bg-rose-50 text-rose-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <Compass className={`w-4 h-4 ${currentView === 'marketplace' ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Explorar Salones</span>
            </div>
          </button>

          <button
            onClick={() => onSelectView('customer_portal')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
              currentView === 'customer_portal'
                ? 'bg-rose-50 text-rose-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-3">
              <User className={`w-4 h-4 ${currentView === 'customer_portal' ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Mis Citas & Favoritos</span>
            </div>
          </button>
        </div>
      )}

      {/* Business Owner / Staff Experience Menu */}
      {(isBusinessOwner || isStaff || isPlatformAdmin) && (
        <>
          {/* Section 1: Business Operations */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Operación del Salón
            </div>

            <button
              onClick={() => onSelectView('business_bookings')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'business_bookings'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarCheck className={`w-4 h-4 ${currentView === 'business_bookings' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Reservas Online</span>
              </div>
            </button>

            <button
              onClick={() => onSelectView('business_catalog')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'business_catalog'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building className={`w-4 h-4 ${currentView === 'business_catalog' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Catálogo & Horarios</span>
              </div>
            </button>
          </div>

          {/* Section 2: CRM & Color Formulas (SalonTrack Core) */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Fichas CRM & Retoques
            </div>

            <button
              onClick={() => onSelectView('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'dashboard'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Dashboard General</span>
              </div>
            </button>

            <button
              onClick={() => onSelectView('clients')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'clients'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className={`w-4 h-4 ${currentView === 'clients' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Mis Clientas</span>
              </div>
            </button>

            <button
              onClick={() => onSelectView('retouches')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'retouches'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className={`w-4 h-4 ${currentView === 'retouches' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Control de Retoques</span>
              </div>
              {pendingRetouchesCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-600 text-white">
                  {pendingRetouchesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectView('re-engagement')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 're-engagement'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <RotateCcw className={`w-4 h-4 ${currentView === 're-engagement' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Recuperar Clientas</span>
              </div>
            </button>

            <button
              onClick={() => onSelectView('revenue')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'revenue'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calculator className={`w-4 h-4 ${currentView === 'revenue' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Ingresos Potenciales</span>
              </div>
            </button>

            <button
              onClick={() => onSelectView('calendar')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'calendar'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarIcon className={`w-4 h-4 ${currentView === 'calendar' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Calendario Retoques</span>
              </div>
            </button>

            <button
              onClick={() => onSelectView('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'settings'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className={`w-4 h-4 ${currentView === 'settings' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Ajustes & WhatsApp</span>
              </div>
            </button>
          </div>

          {/* Section 3: Marketplace & Public view */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Comunidad & Marketplace
            </div>

            <button
              onClick={() => onSelectView('marketplace')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                currentView === 'marketplace'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass className={`w-4 h-4 ${currentView === 'marketplace' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Explorar Salones</span>
              </div>
            </button>

            {business?.slug && (
              <button
                onClick={() => onSelectView(`business_profile:${business.slug}`)}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  currentView.startsWith('business_profile')
                    ? 'bg-rose-50 text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scissors className={`w-4 h-4 ${currentView.startsWith('business_profile') ? 'text-rose-600' : 'text-slate-400'}`} />
                  <span>Mi Perfil Público</span>
                </div>
              </button>
            )}
          </div>
        </>
      )}

      {/* Platform Admin Console */}
      {isPlatformAdmin && (
        <div className="space-y-1 pt-2 border-t border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 px-3 pb-1">
            Plataforma Master
          </div>
          <button
            onClick={() => onSelectView('admin_dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              currentView === 'admin_dashboard'
                ? 'bg-purple-50 text-purple-800 shadow-2xs'
                : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-purple-600" />
              <span>Consola Admin</span>
            </div>
          </button>
        </div>
      )}

      {/* Santiago Tips Card */}
      <div className="mt-auto p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 text-xs">
        <h4 className="font-bold text-rose-900 mb-0.5 text-[11px]">🇨🇱 Salones de Santiago</h4>
        <p className="text-rose-700/90 leading-relaxed text-[11px]">
          Configura tus comunas y horarios para aparecer en el mapa interactivo del Marketplace.
        </p>
      </div>
    </aside>
  );
};
