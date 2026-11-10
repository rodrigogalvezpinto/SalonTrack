import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Scissors,
  LogOut,
  UserPlus,
  Compass,
  Building,
  User,
  Shield,
  Sparkles,
  CalendarCheck
} from 'lucide-react';

interface HeaderProps {
  onNewClientClick: () => void;
  onOpenCheckout: () => void;
  onOpenDemoAccounts: () => void;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewClientClick,
  onOpenCheckout,
  onOpenDemoAccounts,
  onNavigate
}) => {
  const { profile, roles, isPlatformAdmin, isBusinessOwner, isStaff, isCustomer, business, logout } = useAuth();

  const getRoleLabel = () => {
    if (isPlatformAdmin) return 'Admin Plataforma';
    if (isBusinessOwner) return 'Dueño de Salón';
    if (isStaff) return 'Profesional';
    return 'Cliente';
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => onNavigate(isCustomer ? 'marketplace' : 'dashboard')}
            className="flex items-center gap-2 sm:gap-3 text-left group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0 group-hover:scale-105 transition">
              <Scissors className="w-4 h-4 sm:w-5 sm:h-5 rotate-45" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base md:text-lg tracking-tight leading-none">
                  SalonTrack
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                  2.0 🇨🇱
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs mt-0.5">
                {business?.name || profile?.full_name || 'Ecosistema de Salones en Chile'}
              </p>
            </div>
          </button>
        </div>

        {/* Center Nav Quick Switches */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => onNavigate('marketplace')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white transition"
          >
            <Compass className="w-3.5 h-3.5 text-rose-600" />
            <span>Marketplace</span>
          </button>

          {(isBusinessOwner || isStaff) && (
            <>
              <button
                onClick={() => onNavigate('business_bookings')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white transition"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reservas del Salón</span>
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white transition"
              >
                <Building className="w-3.5 h-3.5 text-slate-600" />
                <span>Gestión CRM</span>
              </button>
            </>
          )}

          <button
            onClick={() => onNavigate('customer_portal')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white transition"
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mi Cuenta</span>
          </button>

          {isPlatformAdmin && (
            <button
              onClick={() => onNavigate('admin_dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-purple-700 hover:text-purple-900 hover:bg-white transition"
            >
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              <span>Consola Admin</span>
            </button>
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Demo Accounts Switcher Button */}
          <button
            onClick={onOpenDemoAccounts}
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 text-[11px] sm:text-xs font-bold hover:bg-amber-100 transition shadow-2xs"
            title="Cambiar entre los 5 roles demo"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span className="hidden sm:inline">Rol: {getRoleLabel()}</span>
            <span className="sm:hidden">{getRoleLabel()}</span>
          </button>

          <PWAInstallButton variant="header" />

          {/* New Client action if salon role */}
          {(isBusinessOwner || isStaff || isPlatformAdmin) && (
            <button
              onClick={onNewClientClick}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs hover:shadow-rose-600/20 active:scale-95 transition"
              title="Registrar nueva clienta"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva Clienta</span>
            </button>
          )}

          <button
            onClick={logout}
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
