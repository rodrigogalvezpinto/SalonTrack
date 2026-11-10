import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCLP, formatDuration } from '../utils/formatters';
import { Booking, Business, Review } from '../types';
import { LocalCheckoutModal } from '../components/LocalCheckoutModal';
import {
  Calendar,
  Clock,
  MapPin,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  MessageCircle,
  Heart,
  Bell,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Send,
  Trash2
} from 'lucide-react';

interface CustomerPortalViewProps {
  onNavigateToBusiness: (slug: string) => void;
  onExploreMarketplace: () => void;
}

interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  onNavigateToBusiness,
  onExploreMarketplace
}) => {
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'bookings' | 'favorites' | 'reviews' | 'notifications'>('bookings');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('upcoming');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<Business[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Actions
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  useEffect(() => {
    loadPortalData();
  }, [user]);

  const loadPortalData = async () => {
    setIsLoading(true);
    try {
      // 1. Load bookings
      const bookingsRes = await apiRequest<{ bookings: Booking[] }>('/api/bookings/my');
      setBookings(bookingsRes.bookings || []);

      // 2. Load favorites
      const favRes = await apiRequest<{ favorites: Business[] }>('/api/favorites');
      setFavorites(favRes.favorites || []);

      // 3. Load notifications
      const notifRes = await apiRequest<{ notifications: InAppNotification[] }>('/api/notifications');
      setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error('Error loading portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelModalBooking) return;
    try {
      await apiRequest(`/api/bookings/${cancelModalBooking.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason || 'Cancelado por el cliente desde Mi Cuenta' })
      });
      setCancelModalBooking(null);
      setCancelReason('');
      loadPortalData();
    } catch (err: any) {
      alert(`No se pudo cancelar la cita: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBooking) return;
    setIsSubmittingReview(true);
    try {
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          business_id: reviewBooking.business_id,
          booking_id: reviewBooking.id,
          staff_id: reviewBooking.staff_id,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      setReviewBooking(null);
      setReviewComment('');
      loadPortalData();
    } catch (err: any) {
      alert(`Error al registrar reseña: ${err.message || 'Error'}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleRemoveFavorite = async (bizId: string) => {
    try {
      await apiRequest(`/api/favorites/${bizId}`, { method: 'POST' });
      setFavorites(prev => prev.filter(b => b.id !== bizId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'upcoming') {
      return b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS';
    }
    if (bookingFilter === 'completed') {
      return b.status === 'COMPLETED';
    }
    if (bookingFilter === 'cancelled') {
      return b.status === 'CANCELLED' || b.status === 'NO_SHOW';
    }
    return true;
  });

  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      {/* Account Profile Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-sm">
            {(profile?.full_name || profile?.name || user?.email || 'C')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {profile?.full_name || profile?.name || 'Mi Cuenta'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span>{user?.email}</span>
              {profile?.phone && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-mono">{profile.phone}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="text-slate-600 font-medium">Cliente SalonTrack Chile</span>
            </div>
          </div>
        </div>

        <button
          onClick={onExploreMarketplace}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition shrink-0"
        >
          Explorar Salones y Barberías
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Mis Citas ({bookings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'favorites'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Salones Favoritos ({favorites.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notificaciones</span>
            {unreadNotifsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Status Sub-Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setBookingFilter('upcoming')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                bookingFilter === 'upcoming'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Próximas y Activas
            </button>
            <button
              onClick={() => setBookingFilter('completed')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                bookingFilter === 'completed'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Completadas
            </button>
            <button
              onClick={() => setBookingFilter('cancelled')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                bookingFilter === 'cancelled'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Canceladas
            </button>
            <button
              onClick={() => setBookingFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                bookingFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Todas ({bookings.length})
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Cargando tus citas...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h3 className="font-semibold text-slate-800 text-base">No hay citas en este estado</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Encuentra los mejores salones de belleza y barberías de Santiago para agendar tu próximo servicio.
                </p>
              </div>
              <button
                onClick={onExploreMarketplace}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
              >
                Buscar Salón Ahora
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((b) => {
                const isUpcoming = b.status === 'PENDING' || b.status === 'CONFIRMED';
                const isPaid = b.payment_status === 'paid' || (b.payment_status as string) === 'PAID';

                return (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition space-y-4"
                  >
                    {/* Top Row: Business & Code */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => b.business_slug && onNavigateToBusiness(b.business_slug)}
                            className="font-bold text-slate-900 text-base hover:text-rose-600 transition text-left"
                          >
                            {b.business_name}
                          </button>
                          <span className="text-xs text-slate-400">· {b.business_comuna}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          Código: <span className="font-bold text-slate-800">{b.code || b.confirmation_code}</span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        {b.status === 'PENDING' && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                            Pendiente confirmación
                          </span>
                        )}
                        {b.status === 'CONFIRMED' && (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                            Confirmada
                          </span>
                        )}
                        {b.status === 'COMPLETED' && (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                            Atención completada
                          </span>
                        )}
                        {b.status === 'CANCELLED' && (
                          <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
                            Cancelada
                          </span>
                        )}

                        {/* Payment state */}
                        {isPaid ? (
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Pagado
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            Pago en local
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Servicio agendado</span>
                        <span className="font-semibold text-slate-900">{b.service_name}</span>
                        <span className="text-slate-500 block text-xs">
                          {formatDuration(b.duration_minutes || b.duration_min)} · Atendido por {b.staff_name || 'Especialista asignado'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Fecha y Hora</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {b.booking_date} · {b.start_time} - {b.end_time}
                        </span>
                        <span className="text-slate-500 block text-xs">Hora oficial de Chile</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Valor total</span>
                        <span className="font-bold text-slate-900 text-base tabular-nums">
                          {formatCLP(b.amount_clp || b.price_clp)}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {(b.business_whatsapp || b.business_phone) && (
                          <a
                            href={`https://wa.me/${(b.business_whatsapp || b.business_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, tengo una reserva código ${b.code || b.confirmation_code} para el ${b.booking_date} a las ${b.start_time}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Salón
                          </a>
                        )}

                        {b.business_slug && (
                          <button
                            onClick={() => onNavigateToBusiness(b.business_slug!)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1"
                          >
                            Ver salón
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* If not paid and is upcoming, option to pay */}
                        {!isPaid && isUpcoming && (
                          <button
                            onClick={() => setCheckoutBooking(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pagar {formatCLP(b.amount_clp || b.price_clp)}
                          </button>
                        )}

                        {/* If completed, option to review */}
                        {b.status === 'COMPLETED' && (
                          <button
                            onClick={() => setReviewBooking(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition"
                          >
                            <Star className="w-3.5 h-3.5" /> Dejar Reseña
                          </button>
                        )}

                        {/* If upcoming, option to cancel */}
                        {isUpcoming && (
                          <button
                            onClick={() => setCancelModalBooking(b)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1"
                          >
                            Cancelar cita
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Favorites */}
      {activeTab === 'favorites' && (
        <div className="space-y-6">
          {favorites.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
              <Heart className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h3 className="font-semibold text-slate-800 text-base">Aún no tienes salones favoritos</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Guarda salones haciendo clic en el corazón para acceder rápidamente a su agenda y promociones.
                </p>
              </div>
              <button
                onClick={onExploreMarketplace}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
              >
                Explorar Salones
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((biz) => (
                <div
                  key={biz.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{biz.name}</h4>
                        <p className="text-xs text-slate-500">{biz.category_name} · {biz.comuna}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFavorite(biz.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Quitar de favoritos"
                      >
                        <Heart className="w-4 h-4 fill-rose-600 text-rose-600" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-slate-800 tabular-nums">
                        {Number(biz.rating_avg || 5).toFixed(1)}
                      </span>
                      <span className="text-slate-400">({biz.reviews_count || biz.rating_count || 0} reseñas)</span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {biz.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => onNavigateToBusiness(biz.slug)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Ver perfil completo
                    </button>
                    <button
                      onClick={() => onNavigateToBusiness(biz.slug)}
                      className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
                    >
                      Reservar Cita
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No tienes notificaciones pendientes</p>
              <p className="text-xs text-slate-400">Aquí te avisaremos cuando un salón confirme o modifique tu cita.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 flex items-start justify-between gap-4 transition ${
                    n.is_read ? 'bg-white opacity-80' : 'bg-rose-50/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                      )}
                      <h4 className="font-semibold text-slate-900 text-sm">{n.title}</h4>
                      <span className="text-[11px] text-slate-400">
                        {new Date(n.created_at).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                  </div>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkNotificationRead(n.id)}
                      className="text-xs text-slate-500 hover:text-slate-800 underline shrink-0"
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Simulated Local Checkout Modal */}
      {checkoutBooking && (
        <LocalCheckoutModal
          bookingId={checkoutBooking.id}
          bookingCode={checkoutBooking.code || checkoutBooking.confirmation_code}
          amountClp={checkoutBooking.amount_clp || checkoutBooking.price_clp || 0}
          serviceName={checkoutBooking.service_name || 'Servicio de Peluquería'}
          isOpen={Boolean(checkoutBooking)}
          onClose={() => setCheckoutBooking(null)}
          onPaymentProcessed={() => {
            setCheckoutBooking(null);
            loadPortalData();
          }}
        />
      )}

      {/* Leave Review Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Calificar Servicio</h3>
              <p className="text-xs text-slate-500 mt-1">
                Cuéntanos tu experiencia en {reviewBooking.business_name} con el servicio "{reviewBooking.service_name}".
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Puntuación</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm font-bold text-slate-800 ml-2">{reviewRating} / 5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tu Comentario</label>
                <textarea
                  rows={4}
                  required
                  placeholder="¿Cómo fue la puntualidad, el resultado del color o corte, y la atención?"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-rose-600 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewBooking(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-5 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
                >
                  {isSubmittingReview ? 'Publicando...' : 'Publicar Reseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Booking Confirmation Modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">¿Deseas cancelar esta cita?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cita para <span className="font-semibold">{cancelModalBooking.service_name}</span> el día <span className="font-semibold">{cancelModalBooking.booking_date}</span> a las <span className="font-semibold">{cancelModalBooking.start_time}</span>.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Imprevisto personal, cambio de horario..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalBooking(null)}
                className="px-3 py-1.5 border border-slate-200 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                onClick={handleCancelBooking}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
