import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  Compass,
  CalendarCheck,
  Building,
  User,
  Shield,
  Settings
} from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onSelectView: (view: string) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  pendingCount = 0,
}) => {
  const { isPlatformAdmin, isBusinessOwner, isStaff, isCustomer } = useAuth();

  // Dynamic mobile tabs based on active role
  const getItems = () => {
    if (isCustomer) {
      return [
        { id: 'marketplace', label: 'Explorar', icon: Compass },
        { id: 'customer_portal', label: 'Mis Citas', icon: CalendarCheck },
        { id: 'customer_portal', label: 'Mi Cuenta', icon: User },
      ];
    }

    if (isPlatformAdmin) {
      return [
        { id: 'admin_dashboard', label: 'Admin', icon: Shield },
        { id: 'marketplace', label: 'Explorar', icon: Compass },
        { id: 'dashboard', label: 'CRM', icon: LayoutDashboard },
        { id: 'clients', label: 'Clientas', icon: Users },
      ];
    }

    // Default: Business Owner or Staff
    return [
      { id: 'business_bookings', label: 'Reservas', icon: CalendarCheck },
      { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
      { id: 'clients', label: 'Clientas', icon: Users },
      { id: 'retouches', label: 'Retoques', icon: Clock, badge: pendingCount > 0 ? pendingCount : undefined },
      { id: 'business_catalog', label: 'Mi Salón', icon: Building },
    ];
  };

  const items = getItems();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-xl flex items-center justify-around transition-all">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={`${item.id}-${idx}`}
            onClick={() => onSelectView(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition relative min-w-[46px] max-w-[64px] flex-1 active:scale-95 ${
              isActive ? 'text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-700 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[8px] sm:text-[9px] font-black rounded-full h-3.5 min-w-[14px] px-1 flex items-center justify-center shadow-2xs">
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
