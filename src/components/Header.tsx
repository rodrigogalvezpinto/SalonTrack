import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton } from './PWAInstallButton';
import { Scissors, LogOut, Crown, UserPlus, Sparkles } from 'lucide-react';

interface HeaderProps {
  onNewClientClick: () => void;
  onOpenCheckout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewClientClick,
  onOpenCheckout,
}) => {
  const { profile, subscription, logout, roles } = useAuth();
  const isProfessional = roles.includes('PROFESSIONAL');

  const getSubBadge = () => {
    if (!subscription) return null;
    if (subscription.status === 'active') {
      return (
        <button
          onClick={onOpenCheckout}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition shrink-0"
          title={`Licencia Activa (${subscription.days_remaining} días restantes)`}
        >
          <Crown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="hidden sm:inline">Activa</span>
          <span className="text-[11px] font-bold text-emerald-600">{subscription.days_remaining}d</span>
        </button>
      );
    }
    if (subscription.status === 'trial') {
      return (
        <button
          onClick={onOpenCheckout}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition shrink-0 animate-pulse"
          title={`Prueba gratuita (${subscription.days_remaining} días restantes)`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="hidden sm:inline">Prueba</span>
          <span className="text-[11px] font-bold text-amber-700">{subscription.days_remaining}d</span>
        </button>
      );
    }
    return (
      <button
        onClick={onOpenCheckout}
        className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold hover:bg-rose-200 transition shrink-0"
      >
        <span>Vencida</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 shrink-0">
            <Scissors className="w-4 h-4 sm:w-5 sm:h-5 rotate-45" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <h1 className="font-extrabold text-slate-900 text-sm sm:text-base md:text-lg tracking-tight leading-none truncate">
                SalonTrack
              </h1>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                CL 🇨🇱
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">
              {profile?.business_name || profile?.full_name || 'Mi Estudio de Color'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {isProfessional && getSubBadge()}
          <PWAInstallButton variant="header" />

          {isProfessional && <button
            onClick={onNewClientClick}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow-rose-600/20 active:scale-95 transition"
            title="Registrar nueva clienta"
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden md:inline">Nueva Clienta</span>
            <span className="hidden sm:inline md:hidden">Clienta</span>
          </button>}

          <button
            onClick={logout}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
