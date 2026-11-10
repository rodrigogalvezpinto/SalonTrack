import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, X, Shield, Scissors, UserCheck, ShoppingBag, User, CheckCircle2 } from 'lucide-react';

interface DemoAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export const DemoAccountsModal: React.FC<DemoAccountsModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login } = useAuth();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const demoAccounts = [
    {
      email: 'contacto@valeriaestudio.cl',
      password: 'Salon1234',
      name: 'Valeria Henríquez (Dueña de Salón)',
      business: 'Valeria Henríquez Color Studio (Providencia)',
      role: 'BUSINESS_OWNER / PROFESSIONAL',
      badge: 'Salón & Estilista',
      color: 'from-rose-500 to-pink-600',
      icon: Scissors,
      desc: 'Gestión completa de salón, agenda, equipo, servicios de balayage, cálculo de retoques y CRM.',
    },
    {
      email: 'ignacio@barberiaroute.cl',
      password: 'Barber1234!',
      name: 'Ignacio Valdés (Barbero Independiente)',
      business: 'Route 68 Barbería (Renca)',
      role: 'BUSINESS_OWNER / PROFESSIONAL',
      badge: 'Barbería en Renca',
      color: 'from-blue-600 to-indigo-700',
      icon: UserCheck,
      desc: 'Barbería con cortes fade, perfilado de barba, horarios y reservas automáticas.',
    },
    {
      email: 'camila@valeriaestudio.cl',
      password: 'Staff1234!',
      name: 'Camila Muñoz (Estilista Trabajadora)',
      business: 'Valeria Henríquez Color Studio',
      role: 'BUSINESS_STAFF',
      badge: 'Equipo / Trabajadora',
      color: 'from-amber-500 to-orange-600',
      icon: User,
      desc: 'Acceso a citas asignadas y agenda de turnos individuales en el salón.',
    },
    {
      email: 'cliente@gmail.com',
      password: 'Cliente1234!',
      name: 'María Paz Contreras (Clienta)',
      business: 'Marketplace Santiago',
      role: 'CUSTOMER',
      badge: 'Clienta',
      color: 'from-emerald-500 to-teal-600',
      icon: ShoppingBag,
      desc: 'Descubre negocios, reserva citas, visualiza comprobantes y califica atenciones.',
    },
    {
      email: 'admin@salontrack.cl',
      password: 'Admin1234!',
      name: 'Administrador SalonTrack',
      business: 'Plataforma Global',
      role: 'PLATFORM_ADMIN',
      badge: 'Admin Global',
      color: 'from-purple-600 to-indigo-800',
      icon: Shield,
      desc: 'Panel de control administrativo: usuarios, negocios, 15 categorías, moderación y métricas.',
    },
  ];

  const handleQuickLogin = async (acc: typeof demoAccounts[0]) => {
    try {
      setLoadingEmail(acc.email);
      setError(null);
      await login(acc.email, acc.password);
      onClose();
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con cuenta demo.');
    } finally {
      setLoadingEmail(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Ambiente de Pruebas Local (Chile)
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Selector Rápido de Cuentas Demo
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa con 1 clic en cualquiera de los roles para probar la experiencia completa sin claves externas.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {demoAccounts.map((acc) => {
            const Icon = acc.icon;
            const isLoadingThis = loadingEmail === acc.email;

            return (
              <button
                key={acc.email}
                disabled={loadingEmail !== null}
                onClick={() => handleQuickLogin(acc)}
                className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-rose-400 hover:shadow-md bg-white hover:bg-slate-50/70 transition-all group flex items-start gap-4"
              >
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${acc.color} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-rose-600 transition-colors">
                      {acc.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {acc.badge}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                    {acc.business}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {acc.desc}
                  </p>
                </div>
                <div className="shrink-0 self-center">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold group-hover:bg-rose-600 transition-colors flex items-center gap-1">
                    {isLoadingThis ? 'Entrando...' : 'Entrar'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Persistencia SQLite activa en local
          </span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
