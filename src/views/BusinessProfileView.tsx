import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { formatCLP, formatDuration } from '../utils/formatters';
import { Business, CatalogService, Staff, Review } from '../types';
import { BookingModal } from '../components/BookingModal';
import {
  ArrowLeft,
  MapPin,
  Star,
  Clock,
  Phone,
  Calendar,
  Heart,
  Share2,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  Scissors,
  Users,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface BusinessProfileViewProps {
  businessSlug: string;
  onBack: () => void;
  onOpenWhatsApp?: (phone: string, text?: string) => void;
}

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({
  businessSlug,
  onBack,
  onOpenWhatsApp
}) => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'services' | 'team' | 'hours' | 'reviews'>('services');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Booking modal
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [preselectedService, setPreselectedService] = useState<CatalogService | null>(null);

  useEffect(() => {
    loadBusinessData();
  }, [businessSlug]);

  const loadBusinessData = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{
        business: Business;
        services: CatalogService[];
        staff: Staff[];
        reviews: Review[];
        is_favorite?: boolean;
      }>(`/api/marketplace/business/${businessSlug}`);

      if (res && res.business) {
        setBusiness(res.business);
        setServices(res.services || []);
        setStaff(res.staff || []);
        setReviews(res.reviews || []);
        setIsFavorited(Boolean(res.is_favorite));
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!business) return;
    try {
      const res = await apiRequest<{ favorited: boolean }>(`/api/favorites/${business.id}`, {
        method: 'POST'
      });
      setIsFavorited(res.favorited);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenBooking = (service?: CatalogService) => {
    setPreselectedService(service || null);
    setBookingModalOpen(true);
  };

  const dayNames = [
    { day: 1, name: 'Lunes' },
    { day: 2, name: 'Martes' },
    { day: 3, name: 'Miércoles' },
    { day: 4, name: 'Jueves' },
    { day: 5, name: 'Viernes' },
    { day: 6, name: 'Sábado' },
    { day: 0, name: 'Domingo' }
  ];

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
        <div className="h-10 w-3/4 bg-slate-200 rounded" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <p className="text-lg font-medium text-slate-800">No encontramos este local o salón.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Explorador
        </button>
      </div>
    );
  }

  // Categories extracted from services
  const serviceCategories = ['all', ...Array.from(new Set(services.map(s => s.category_name || 'General')))];
  const filteredServices = selectedCategoryFilter === 'all'
    ? services
    : services.filter(s => (s.category_name || 'General') === selectedCategoryFilter);

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Explorar salones en Santiago</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition relative"
            title="Copiar enlace"
          >
            <Share2 className="w-4 h-4" />
            {copiedLink && (
              <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[11px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                ¡Enlace copiado!
              </span>
            )}
          </button>
          <button
            onClick={handleToggleFavorite}
            className={`p-2 border rounded-lg transition ${
              isFavorited
                ? 'border-rose-300 bg-rose-50 text-rose-600'
                : 'border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-white'
            }`}
            title="Guardar en favoritos"
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-600' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenBooking()}
            className="px-5 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition shadow-sm"
          >
            Reservar Cita
          </button>
        </div>
      </div>

      {/* Header Banner & Visual Presentation */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-6 sm:p-10 shadow-sm border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex items-center gap-3 text-xs tracking-wide text-rose-200 font-medium">
            <span>{business.category_name || 'Belleza y Estética'}</span>
            <span aria-hidden="true">·</span>
            <span>{business.comuna || 'Santiago'}, Chile</span>
            {business.verified && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verificado SalonTrack
                </span>
              </>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {business.name}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            {business.description || 'Especialistas certificados dedicados al cuidado personal, estilismo y técnicas profesionales de vanguardia.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="tabular-nums font-bold text-white text-base">
                {Number(business.rating_avg || 5.0).toFixed(1)}
              </span>
              <span className="text-slate-400 font-normal">
                ({business.reviews_count || business.rating_count || reviews.length} reseñas)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{business.address}, {business.comuna}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Atención previa reserva online</span>
            </div>

            {business.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="tabular-nums">{business.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp direct contact float inside banner */}
        {business.whatsapp && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-slate-300">
              ¿Dudas con tu tono o servicio? Escríbeles directamente:
            </span>
            <a
              href={`https://wa.me/${business.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${business.name}, vi su perfil en SalonTrack y me gustaría hacer una consulta.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600/90 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Oficial ({business.whatsapp})
            </a>
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab('services')}
            className={`pb-3 transition-colors border-b-2 ${
              activeTab === 'services'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Servicios y Precios ({services.length})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-3 transition-colors border-b-2 ${
              activeTab === 'team'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Profesionales ({staff.length})
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`pb-3 transition-colors border-b-2 ${
              activeTab === 'hours'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Horarios y Ubicación
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 transition-colors border-b-2 ${
              activeTab === 'reviews'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Opiniones de Clientes ({reviews.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Services Catalog */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          {/* Sub-category filter pills */}
          {serviceCategories.length > 2 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {serviceCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                    selectedCategoryFilter === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {cat === 'all' ? 'Todos los servicios' : cat}
                </button>
              ))}
            </div>
          )}

          {filteredServices.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
              No hay servicios registrados en esta categoría.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-rose-300 hover:shadow-sm transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-semibold text-slate-900 text-base">
                        {service.name}
                      </h3>
                      <span className="font-bold text-slate-900 text-lg tabular-nums tracking-tight shrink-0">
                        {formatCLP(service.price_clp)}
                      </span>
                    </div>

                    {service.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {service.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="tabular-nums">{formatDuration(service.duration_minutes || service.duration_min)}</span>
                      </span>
                      {service.category_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{service.category_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Confirmación online</span>
                    <button
                      onClick={() => handleOpenBooking(service)}
                      className="px-4 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white text-xs font-semibold rounded-lg transition"
                    >
                      Reservar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Team */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-600">
            Conoce al equipo de estilistas y especialistas certificados de {business.name}.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {staff.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{member.name}</h4>
                    <p className="text-xs text-slate-500">{member.role_title || 'Especialista'}</p>
                  </div>
                </div>

                {member.bio && (
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{member.bio}"
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenBooking()}
                    className="w-full py-1.5 text-center text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    Agendar con {member.name.split(' ')[0]}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Hours & Location */}
      {activeTab === 'hours' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Horarios de Atención</h3>
            <p className="text-xs text-slate-500">
              Horario oficial en Santiago de Chile. Las reservas deben realizarse con al menos 2 horas de anticipación.
            </p>

            <div className="divide-y divide-slate-100 text-sm">
              {dayNames.map(({ day, name }) => {
                const hour = (business.hours as any[])?.find((h: any) => h.day_of_week === day);
                const isClosed = !hour || Boolean(hour.is_closed);

                return (
                  <div key={day} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className="tabular-nums text-xs">
                      {isClosed ? (
                        <span className="text-slate-400">Cerrado</span>
                      ) : (
                        <span className="text-slate-900 font-semibold">
                          {hour.open_time} - {hour.close_time}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Ubicación y Llegada</h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{business.address}</p>
                  <p className="text-xs text-slate-500">{business.comuna}, Región Metropolitana</p>
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-600 leading-relaxed border-t border-slate-200">
                Coordenadas para navegación: <span className="font-mono tabular-nums">{business.latitude}, {business.longitude}</span>
              </div>

              <div className="pt-2 flex gap-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address} ${business.comuna}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Abrir en Google Maps
                </a>
              </div>
            </div>

            <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-xl text-xs text-rose-900 space-y-1">
              <p className="font-semibold">Política de Cancelación:</p>
              <p>Puedes cancelar o reagendar tu cita sin costo hasta con 4 horas de anticipación desde tu panel de "Mi Cuenta".</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-black text-slate-900 tabular-nums">
                {Number(business.rating_avg || 5.0).toFixed(1)}
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(business.rating_avg || 5)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basado en {business.reviews_count || business.rating_count || reviews.length} citas verificadas
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenBooking()}
              className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
            >
              Agendar para dejar tu opinión
            </button>
          </div>

          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
                Aún no hay reseñas registradas para este salón. Sé la primera en calificar el servicio agendando tu cita.
              </div>
            ) : (
              reviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {r.author_name || r.customer_name || 'Clienta Verificada'}
                      </span>
                      <span className="text-xs text-emerald-600 font-medium">· Cita verificada</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {r.comment}
                  </p>

                  <div className="text-[11px] text-slate-400 pt-1">
                    {new Date(r.created_at).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {bookingModalOpen && business && (
        <BookingModal
          business={business}
          initialService={preselectedService || undefined}
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          onBookingSuccess={() => {
            setBookingModalOpen(false);
            loadBusinessData();
          }}
        />
      )}
    </div>
  );
};
