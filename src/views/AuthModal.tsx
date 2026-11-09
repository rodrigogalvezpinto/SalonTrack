import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { X, Scissors, Lock, Mail, User, Building, Phone, ArrowRight, Check } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'reset';
  resetToken?: string | null;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  resetToken,
  onClose,
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('+56 9 ');
  const [accountType, setAccountType] = useState<'professional' | 'customer'>('professional');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        await register({
          email,
          password,
          full_name: fullName,
          ...(accountType === 'professional' ? { business_name: businessName || fullName } : {}),
          phone,
          account_type: accountType,
        });
        onClose();
      } else if (mode === 'forgot') {
        const res = await apiRequest('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setSuccessMsg(res.message);
      } else if (mode === 'reset') {
        const res = await apiRequest('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, new_password: password }),
        });
        window.history.replaceState({}, '', window.location.pathname);
        setPassword('');
        setMode('login');
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-rose-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white font-black text-sm">
              <Scissors className="w-4 h-4 rotate-45" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {mode === 'login' && 'Iniciar Sesión'}
                {mode === 'register' && (accountType === 'professional' ? 'Crear Cuenta Profesional' : 'Crear Cuenta de Cliente')}
                {mode === 'forgot' && 'Recuperar Contraseña'}
                {mode === 'reset' && 'Nueva Contraseña'}
              </h3>
              <p className="text-[11px] text-slate-400">SalonTrack Chile 🇨🇱</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Demo Fill Button (Only in login mode) */}
          {mode === 'login' && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-between text-xs">
              <span className="text-rose-900 font-medium text-[11px]">¿Quieres probar la cuenta demo?</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('contacto@valeriaestudio.cl');
                  setPassword('Salon1234');
                }}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline"
              >
                Cargar Demo
              </button>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAccountType('professional')} className={`rounded-xl border p-2.5 text-xs font-bold ${accountType === 'professional' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>Soy profesional</button>
                <button type="button" onClick={() => setAccountType('customer')} className={`rounded-xl border p-2.5 text-xs font-bold ${accountType === 'customer' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>Soy cliente</button>
              </div>
              {accountType === 'professional' && <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Tu Nombre Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Valeria Henríquez"
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
                  />
                </div>
              </div>}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Nombre de tu Salón o Estudio
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ej: Valeria Color Studio"
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  WhatsApp de Contacto (+56) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 8765 4321"
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {mode !== 'reset' && (
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
              Correo Electrónico *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu-correo@salontrack.cl"
                className="w-full text-xs rounded-xl border border-slate-300 pl-9 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
              />
            </div>
          </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {mode === 'reset' ? 'Nueva Contraseña *' : 'Contraseña *'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs rounded-xl border border-slate-300 pl-9 p-2.5 text-slate-800 focus:border-rose-500 outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : mode === 'login' ? 'Iniciar Sesión' : mode === 'register' ? 'Registrarme y Comenzar' : mode === 'reset' ? 'Guardar Nueva Contraseña' : 'Enviar Instrucciones'}
          </button>

          {/* Toggle between Login, Register, Forgot */}
          <div className="text-center pt-2 text-xs text-slate-500">
            {mode === 'login' && (
              <p>
                ¿Aún no tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); }}
                  className="text-rose-600 font-bold hover:underline"
                >
                  Regístrate aquí
                </button>
              </p>
            )}

            {mode === 'register' && (
              <p>
                ¿Ya tienes una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-rose-600 font-bold hover:underline"
                >
                  Inicia sesión aquí
                </button>
              </p>
            )}

            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className="text-slate-600 font-bold hover:underline"
              >
                ← Volver a inicio de sesión
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
