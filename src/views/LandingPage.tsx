import React, { useState } from 'react';
import { formatCLP } from '../utils/formatters';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { 
  Scissors, 
  Clock, 
  Send, 
  TrendingUp, 
  Check, 
  ChevronDown, 
  Sparkles, 
  ShieldCheck, 
  Phone, 
  Users,
  RotateCcw,
  Bell,
  ArrowRight,
  Calculator
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenCheckout: (planId?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onOpenCheckout,
}) => {
  // Interactive Calculator State
  const [estimatedClients, setEstimatedClients] = useState<number>(25);
  const [avgTicket, setAvgTicket] = useState<number>(45000);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Potential calculated recovered amount: ~20% of clients who would otherwise forget their retouch
  const monthlyRecoverable = Math.round(estimatedClients * 0.25 * avgTicket);

  const plans = [
    {
      id: 'basic_monthly',
      name: 'Plan Mensual Estilista',
      price: 9990,
      period: '/ mes',
      badge: 'Flexibilidad',
      desc: 'Ideal para estilistas independientes y coloristas que inician la digitalización de su salón.',
      features: [
        'Registro ilimitado de clientas y fórmulas',
        'Cálculo automático de fechas de retoque',
        'Recordatorios de WhatsApp en 1 clic',
        'Calculadora de ingresos potenciales',
        'Acceso como Aplicación Web Progresiva (PWA)',
      ],
    },
    {
      id: 'pro_quarterly',
      name: 'Plan Trimestral Pro',
      price: 14990,
      period: '/ 3 meses',
      highlighted: true,
      badge: 'Más Elegido en Chile 🇨🇱',
      desc: '3 meses completos. Equivale a sólo $4.997 CLP al mes (ahorro de 50%).',
      features: [
        'Todo lo del Plan Mensual',
        'Módulo de Re-engagement para clientas inactivas',
        'Notificaciones Push matutinas configurables',
        'Historial técnico de decoloración y matices',
        'Soporte técnico preferente en Chile',
        'Acceso prioritario a nuevas herramientas',
      ],
    },
    {
      id: 'annual',
      name: 'Plan Semestral Fundador',
      price: 19990,
      period: '/ 6 meses',
      badge: 'Mayor Ahorro',
      desc: 'Acceso por 6 meses ininterrumpidos para estudios y salones de alto volumen.',
      features: [
        'Acceso garantizado por 6 meses',
        'Módulo completo de Re-engagement',
        'Notificaciones Push y alertas sonoras',
        'Copia de seguridad y exportación JSON',
        'Precio congelado de renovación de por vida',
      ],
    },
  ];

  const faqs = [
    {
      q: '¿Cómo funciona el envío de mensajes por WhatsApp?',
      a: 'SalonTrack prepara un mensaje personalizado con el nombre de tu clienta, el salón y el servicio correspondiente. Al presionar "Avisar por WhatsApp", la aplicación abre WhatsApp directamente con el texto listo para enviar. Tú siempre mantienes el control total y puedes editar el texto antes de mandarlo.',
    },
    {
      q: '¿Puedo instalar SalonTrack en mi celular como una app nativa?',
      a: '¡Sí! SalonTrack es una Progressive Web App (PWA). Puedes instalarla directamente en tu teléfono Android, iPhone o tablet sin pasar por tiendas lentas, funcionando con acceso directo en tu pantalla de inicio.',
    },
    {
      q: '¿Qué medios de pago aceptan en Chile?',
      a: 'Procesamos pagos en Pesos Chilenos (CLP) a través de Mercado Pago Chile: tarjetas de Débito (Redcompra / CuentaRUT), Webpay Plus y Crédito en cuotas.',
    },
    {
      q: '¿Mis datos y fórmulas de tinte están seguros?',
      a: 'Absolutamente. Cada profesional cuenta con una cuenta aislada y protegida. Tus fórmulas, teléfonos y datos de clientas son privados y nunca son compartidos con otros estilistas.',
    },
    {
      q: '¿Cómo funciona el nuevo módulo de Re-engagement?',
      a: 'Identifica de forma automática qué clientas llevan 60, 90 o 180 días sin visitarte, calculando el dinero que podrías recuperar si regresan y facilitándote un mensaje con oferta o descuento especial para motivarlas a agendar.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Scissors className="w-5 h-5 rotate-45" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">SalonTrack</span>
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                CHILE 🇨🇱
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <PWAInstallButton variant="header" />
            <button
              onClick={() => onOpenAuth('login')}
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl transition"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-95"
            >
              Crear Cuenta Gratis
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100/80 text-rose-800 text-xs font-bold shadow-xs">
          <Sparkles className="w-4 h-4 text-rose-600" />
          <span>Diseñado para Peluqueras y Estilistas Independientes en Chile</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight sm:leading-none">
          Deja de perder clientas por <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600">
            olvidar sus retoques de color
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Organiza tus clientas, controla sus próximas visitas y recupera oportunidades de ingresos desde una sola aplicación sencilla y sin complicaciones.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onOpenAuth('register')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-base shadow-xl shadow-rose-600/25 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <span>Comenzar Prueba Gratuita</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('pricing');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm transition"
          >
            Ver Planes desde $9.990 CLP
          </button>
        </div>

        {/* Chile Trust Badge */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" /> Sin contratos ni ataduras
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" /> Moneda Chilena (CLP)
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" /> Pagos seguros con Mercado Pago
          </span>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-slate-900 text-white py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              ¿Por qué tantas peluqueras pierden dinero cada mes?
            </h2>
            <p className="text-slate-400 text-sm">
              El 73% de las clientas no vuelve a tiempo simplemente porque nadie les recordó que su raíz o color ya necesitaba mantenimiento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">1</div>
              <h3 className="font-bold text-lg text-white">Notas sueltas en WhatsApp</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Los chats se pierden entre cientos de mensajes familiares y proveedores. Olvidas cuándo fue su última sesión y qué tinte le aplicaste.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">2</div>
              <h3 className="font-bold text-lg text-white">Cuadernos y agendas de papel</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                No te avisan cuándo una clienta está atrasada. No calculan ingresos ni te permiten enviar mensajes con un clic.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">3</div>
              <h3 className="font-bold text-lg text-white">Clientas que se van con otra</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cuando una clienta nota su raíz muy crecida de imprevisto, termina agendando en cualquier salón disponible de su barrio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Recovered Revenue Calculator */}
      <section className="py-16 px-4 sm:px-8 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-lg space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculadora de Dinero Recuperable</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ¿Cuánto dinero estás dejando sobre la mesa?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Mueve los controles según tu salón y calcula cuántos ingresos puedes recuperar con recordatorios oportunos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Clientas habituales de color:</span>
                <span className="text-rose-600 text-sm font-black">{estimatedClients} clientas</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={estimatedClients}
                onChange={(e) => setEstimatedClients(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Valor promedio por servicio:</span>
                <span className="text-rose-600 text-sm font-black">{formatCLP(avgTicket)} CLP</span>
              </div>
              <input
                type="range"
                min="25000"
                max="100000"
                step="5000"
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                Ingresos mensuales que puedes recuperar:
              </span>
              <div className="text-3xl sm:text-4xl font-black mt-1">
                {formatCLP(monthlyRecoverable)} <span className="text-lg font-normal text-emerald-200">CLP / mes</span>
              </div>
              <p className="text-[11px] text-emerald-100 mt-1">
                Recuperando apenas 5 a 6 retoques que antes se te olvidaban contactar.
              </p>
            </div>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold text-xs sm:text-sm hover:bg-emerald-50 active:scale-95 transition shrink-0"
            >
              Comenzar a Recuperar
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-4 sm:px-8 bg-slate-100/70 border-t border-slate-200">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Precios Transparentes para Chile
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Invierte menos de lo que cobras por un corte de puntas
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Elige el plan que mejor se adapte a tu ritmo. Con un solo retoque recuperado pagas meses de suscripción.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 sm:p-8 bg-white border-2 flex flex-col justify-between transition-all ${
                  plan.highlighted
                    ? 'border-rose-600 shadow-xl shadow-rose-600/10 ring-2 ring-rose-200 scale-100 sm:scale-105'
                    : 'border-slate-200/80 shadow-xs'
                }`}
              >
                {plan.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${
                    plan.highlighted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
                  }`}>
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{plan.desc}</p>
                  </div>

                  <div className="pt-2">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900">
                      {formatCLP(plan.price)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 ml-1">
                      CLP {plan.period}
                    </span>
                  </div>

                  <ul className="space-y-2.5 pt-4 border-t border-slate-100 text-xs text-slate-600">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => onOpenCheckout(plan.id)}
                  className={`mt-8 w-full py-3 rounded-2xl font-bold text-xs sm:text-sm transition active:scale-95 ${
                    plan.highlighted
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  Elegir {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="py-16 px-4 sm:px-8 max-w-3xl mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Preguntas Frecuentes
          </h2>
          <p className="text-xs text-slate-500">
            Todo lo que necesitas saber sobre SalonTrack antes de comenzar.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full p-4 sm:p-5 text-left font-bold text-sm text-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 px-4 sm:px-8 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800">SalonTrack Chile</span>
            <span>• Gestión inteligente de retoques para peluquerías</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <span>Santiago, Chile 🇨🇱</span>
            <span>CLP ($)</span>
            <span>Mercado Pago Oficial</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
