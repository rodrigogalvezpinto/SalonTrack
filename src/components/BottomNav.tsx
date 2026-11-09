import React from 'react';
import { LayoutDashboard, Users, Clock, RotateCcw, Settings, Building2, ShieldCheck, UserCircle } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onSelectView: (view: string) => void;
  pendingCount?: number;
  roles?: string[];
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  pendingCount = 0,
  roles = [],
}) => {
  const isProfessional = roles.includes('PROFESSIONAL');
  const items = isProfessional
    ? [
        { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
        { id: 'clients', label: 'Clientas', icon: Users },
        { id: 'retouches', label: 'Retoques', icon: Clock, badge: pendingCount > 0 ? pendingCount : undefined },
        ...(roles.includes('PLATFORM_ADMIN')
          ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }]
          : [{ id: 're-engagement', label: 'Recuperar', icon: RotateCcw }]),
        { id: 'business', label: 'Negocio', icon: Building2 },
        ...(roles.includes('PLATFORM_ADMIN')
          ? [{ id: 'settings', label: 'Ajustes', icon: Settings }]
          : [{ id: 'settings', label: 'Ajustes', icon: Settings }]),
      ]
    : [
        { id: 'account', label: 'Mi cuenta', icon: UserCircle },
        ...(roles.includes('PLATFORM_ADMIN') ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : []),
      ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-xl flex items-center justify-around transition-all">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
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
    </nav>
  );
};
