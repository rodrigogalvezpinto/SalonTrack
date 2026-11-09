import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  Calculator, 
  Calendar as CalendarIcon, 
  Settings, 
  CreditCard,
  Building2,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  pendingRetouchesCount?: number;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  pendingRetouchesCount = 0,
  roles = [],
}) => {
  const navItems = roles.includes('PROFESSIONAL') ? [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Mis Clientas', icon: Users },
    { 
      id: 'retouches', 
      label: 'Control de Retoques', 
      icon: Clock, 
      badge: pendingRetouchesCount > 0 ? pendingRetouchesCount : undefined 
    },
    { 
      id: 're-engagement', 
      label: 'Recuperar Clientas', 
      icon: Users,
    },
    { id: 'revenue', label: 'Ingresos Potenciales', icon: Calculator },
    { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
    { id: 'settings', label: 'Configuración & Salón', icon: Settings },
    { id: 'business', label: 'Mi negocio', icon: Building2 },
    ...(roles.includes('PLATFORM_ADMIN') ? [{ id: 'admin', label: 'Administración', icon: ShieldCheck }] : []),
  ] : [
    { id: 'account', label: 'Mi cuenta', icon: UserCircle },
    ...(roles.includes('PLATFORM_ADMIN') ? [{ id: 'admin', label: 'Administración', icon: ShieldCheck }] : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-65px)] p-4 shrink-0">
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                isActive
                  ? 'bg-rose-50 text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-600 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chilean Tips Banner */}
      <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 text-xs">
        <h4 className="font-bold text-rose-900 mb-1">💡 Tip para Coloristas</h4>
        <p className="text-rose-700/90 leading-relaxed text-[11px]">
          Avisar a tus clientas 3 días antes de su fecha estimada aumenta en un 68% la reserva puntual de su retoque.
        </p>
      </div>
    </aside>
  );
};
