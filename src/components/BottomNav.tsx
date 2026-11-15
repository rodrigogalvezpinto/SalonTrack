import React, { useState } from 'react';
import { LayoutDashboard, Users, Clock, RotateCcw, Settings, Building2, ShieldCheck, UserCircle, Calendar as CalendarIcon, Calculator, MoreHorizontal } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onSelectView: (view: string) => void;
  pendingCount?: number;
  roles?: string[];
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: number;
};

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  pendingCount = 0,
  roles = [],
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const isProfessional = roles.includes('PROFESSIONAL');
  const isPlatformAdmin = roles.includes('PLATFORM_ADMIN');
  const items: NavItem[] = isProfessional
    ? [
        { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
        { id: 'clients', label: 'Clientas', icon: Users },
        { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
      ]
    : [
        { id: 'account', label: 'Mi cuenta', icon: UserCircle },
        ...(isPlatformAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : []),
      ];
  const moreItems: NavItem[] = isProfessional
    ? [
        { id: 'retouches', label: 'Retoques', icon: Clock, badge: pendingCount > 0 ? pendingCount : undefined },
        { id: 're-engagement', label: 'Recuperar clientas', icon: RotateCcw },
        { id: 'revenue', label: 'Ingresos potenciales', icon: Calculator },
        { id: 'settings', label: 'Configuración', icon: Settings },
        { id: 'business', label: 'Mi negocio', icon: Building2 },
        ...(isPlatformAdmin ? [{ id: 'admin', label: 'Administración', icon: ShieldCheck }] : []),
      ]
    : [];
  const selectView = (view: string) => {
    onSelectView(view);
    setMoreOpen(false);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-xl flex items-center justify-around transition-all">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id || (item.id === 'clients' && currentView === 'client_detail');
        return (
          <button
            key={item.id}
            onClick={() => selectView(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition relative min-w-[46px] max-w-[64px] flex-1 active:scale-95 ${
              isActive ? 'text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-700 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[8px] sm:text-[9px] font-black rounded-full h-3.5 min-w-[14px] px-1 flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight truncate w-full text-center">
              {item.label}
            </span>
          </button>
        );
      })}
      {isProfessional && <div className="relative flex min-w-[46px] max-w-[64px] flex-1 justify-center">
        {moreOpen && <div className="absolute bottom-full right-0 mb-2 max-h-[70vh] w-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {moreItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return <button
              key={item.id}
              onClick={() => selectView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="relative"><Icon className="h-4 w-4" />{item.badge !== undefined && <span className="absolute -right-2 -top-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-black text-white">{item.badge}</span>}</span>
              {item.label}
            </button>;
          })}
        </div>}
        <button
          type="button"
          onClick={() => setMoreOpen(open => !open)}
          aria-expanded={moreOpen}
          aria-label={moreOpen ? 'Cerrar más opciones' : 'Más opciones'}
          className={`flex flex-col items-center justify-center rounded-xl px-1 py-1 transition ${
            moreOpen || moreItems.some(item => item.id === currentView) ? 'text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-700 font-medium'
          }`}
        >
          <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="mt-0.5 w-full truncate text-center text-[9px] tracking-tight sm:text-[10px]">Más</span>
        </button>
      </div>}
    </nav>
  );
};
