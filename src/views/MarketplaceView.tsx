import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { formatCLP } from '../utils/formatters';
import { Business, Category, CatalogService } from '../types';
import { BookingModal } from '../components/BookingModal';
import {
  Search,
  MapPin,
  Star,
  Clock,
  Scissors,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Map as MapIcon,
  List,
  Heart,
  Navigation,
  CheckCircle2,
  Calendar,
  Building2,
  Car
} from 'lucide-react';

interface MarketplaceViewProps {
  onSelectBusiness: (slug: string) => void;
  onOpenBookingModal?: (business: Business) => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({ onSelectBusiness }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedComuna, setSelectedComuna] = useState<string>('all');
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('rating'); // 'rating' | 'distance' | 'price_asc'
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split');
  const [selectedMapBiz, setSelectedMapBiz] = useState<Business | null>(null);

  // User simulated/detected coordinates (defaults to Providencia, Santiago)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: -33.4243,
    lng: -70.6125,
  });

  // Booking Modal
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [targetBookingBusiness, setTargetBookingBusiness] = useState<Business | null>(null);

  // Commune options in Chile
  const chileanComunas = [
    'Todas las comunas',
    'Providencia',
    'Santiago',
    'Las Condes',
    'Renca',
    'Vitacura',
    'Ñuñoa',
    'La Florida',
    'Maipú',
    'Quilicura',
    'Recoleta',
    'San Miguel',
  ];

  // Request browser geolocation if permitted
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Keep default Santiago center
        }
      );
    }
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await apiRequest<{ categories: Category[] }>('/api/marketplace/categories');
        if (res && res.categories) {
          setCategories(res.categories);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCats();
  }, []);

  // Search businesses
  const fetchBusinesses = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('q', searchTerm.trim());
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedComuna !== 'all' && selectedComuna !== 'Todas las comunas') params.append('comuna', selectedComuna);
      if (selectedModality !== 'all') params.append('modality', selectedModality);
      if (userCoords) {
        params.append('user_lat', String(userCoords.lat));
        params.append('user_lng', String(userCoords.lng));
      }
      params.append('sort', sortBy);

      const res = await apiRequest<{ businesses: Business[] }>(`/api/marketplace/search?${params.toString()}`);
      if (res && res.businesses) {
        setBusinesses(res.businesses);
        if (res.businesses.length > 0 && !selectedMapBiz) {
          setSelectedMapBiz(res.businesses[0]);
        }
      }
    } catch (err) {
      console.error('Error searching marketplace:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, [selectedCategory, selectedComuna, selectedModality, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBusinesses();
  };

  const handleOpenBooking = (biz: Business) => {
    setTargetBookingBusiness(biz);
    setBookingModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Search Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 sm:p-10 text-white shadow-xl overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Marketplace de Servicios Profesionales en Chile
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Descubre los mejores salones, barberías y especialistas cerca de ti.
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-2 font-medium">
            Compara precios reales en CLP, revisa disponibilidad inmediata y reserva en segundos.
          </p>

          {/* Search Bar Input */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Busca por servicio o salón (ej: Balayage, Barbería en Renca, Manicure)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white text-slate-900 placeholder-slate-400 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-md"
              />
            </div>

            <select
              value={selectedComuna}
              onChange={(e) => setSelectedComuna(e.target.value)}
              className="px-4 py-3.5 rounded-2xl bg-white text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-md cursor-pointer"
            >
              {chileanComunas.map((c) => (
                <option key={c} value={c}>
                  📍 {c}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-900/30 transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            selectedCategory === 'all'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Todas las Categorías
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.slug)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === cat.slug
                ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Filtros:
          </span>

          <select
            value={selectedModality}
            onChange={(e) => setSelectedModality(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          >
            <option value="all">Todas las modalidades</option>
            <option value="salon">🏢 En salón</option>
            <option value="home">🚗 A domicilio</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          >
            <option value="rating">⭐ Mejor evaluados</option>
            <option value="distance">📍 Más cercanos</option>
            <option value="price_asc">💵 Menor precio</option>
          </select>
        </div>

        {/* View toggles: Split, List, Map */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'split' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Dividida
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Solo Lista
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            Solo Mapa
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <div className="w-10 h-10 rounded-full border-3 border-rose-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">Cargando negocios disponibles...</p>
        </div>
      ) : businesses.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-lg">No encontramos resultados para tu búsqueda</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Intenta cambiar los filtros de categoría, buscar en otra comuna o ampliar los términos de búsqueda.
          </p>
        </div>
      ) : (
        <div className={`grid gap-6 ${viewMode === 'split' ? 'lg:grid-cols-12' : 'grid-cols-1'}`}>
          {/* Business List Column */}
          {(viewMode === 'split' || viewMode === 'list') && (
            <div className={viewMode === 'split' ? 'lg:col-span-7 space-y-4' : 'space-y-4 max-w-4xl mx-auto'}>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                {businesses.length} profesionales y negocios encontrados en Santiago
              </div>

              {businesses.map((biz) => {
                const isSelectedOnMap = selectedMapBiz?.id === biz.id;

                return (
                  <div
                    key={biz.id}
                    onMouseEnter={() => setSelectedMapBiz(biz)}
                    className={`p-5 rounded-3xl bg-white border transition-all ${
                      isSelectedOnMap
                        ? 'border-rose-500 shadow-lg shadow-rose-100 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      {/* Avatar / Logo */}
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-rose-900 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
                        {biz.name.substring(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 uppercase tracking-wider">
                            {biz.category_name || 'Belleza'}
                          </span>
                          {biz.modality === 'both' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Salón y Domicilio
                            </span>
                          )}
                          {biz.modality === 'home' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                              A Domicilio
                            </span>
                          )}
                        </div>

                        <h3
                          onClick={() => onSelectBusiness(biz.slug)}
                          className="font-black text-lg text-slate-900 hover:text-rose-600 cursor-pointer transition-colors mt-1"
                        >
                          {biz.name}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-slate-800">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            {biz.rating_avg}
                            <span className="text-slate-400 font-normal">
                              ({biz.reviews_count} {biz.reviews_count === 1 ? 'reseña' : 'reseñas'})
                            </span>
                          </span>

                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {biz.comuna || 'Santiago'}
                            {biz.distance_km !== null && biz.distance_km !== undefined && (
                              <span className="text-rose-600 font-bold ml-1">
                                • {biz.distance_km} km
                              </span>
                            )}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                          {biz.description}
                        </p>

                        {/* Featured service preview */}
                        {biz.featured_service && (
                          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div className="truncate pr-2">
                              <span className="font-semibold text-slate-800">Destacado: </span>
                              <span className="text-slate-600">{biz.featured_service.name}</span>
                            </div>
                            <span className="font-black text-rose-600 shrink-0">
                              {formatCLP(biz.featured_service.price_clp)}
                            </span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Desde</span>
                            <span className="text-base font-black text-slate-900">
                              {formatCLP(biz.min_price || 15000)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectBusiness(biz.slug)}
                              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
                            >
                              Ver Perfil
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenBooking(biz)}
                              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-1.5"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Reservar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Local Interactive Map Column */}
          {(viewMode === 'split' || viewMode === 'map') && (
            <div className={viewMode === 'split' ? 'lg:col-span-5' : 'max-w-4xl mx-auto w-full'}>
              <div className="sticky top-20 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                      Mapa Local Santiago
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Local / Sin API Key externa
                  </span>
                </div>

                {/* SVG Interactive Schematic Map */}
                <div className="relative rounded-2xl bg-gradient-to-br from-slate-100 via-slate-50 to-rose-50/30 border border-slate-200 h-80 sm:h-96 flex items-center justify-center overflow-hidden">
                  {/* Grid Lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-40">
                    <defs>
                      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    {/* Simulated River Mapacho line */}
                    <path
                      d="M 10 180 Q 150 140, 250 160 T 450 120"
                      fill="none"
                      stroke="#93c5fd"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Commune labels on map */}
                  <div className="absolute top-6 left-6 text-[10px] font-bold text-slate-400">Renca</div>
                  <div className="absolute top-1/2 left-1/3 text-[10px] font-bold text-slate-400">Santiago Centro</div>
                  <div className="absolute top-1/3 right-1/4 text-[10px] font-bold text-slate-400">Providencia</div>
                  <div className="absolute top-10 right-8 text-[10px] font-bold text-slate-400">Las Condes</div>

                  {/* Business Markers on Map */}
                  {businesses.map((biz, idx) => {
                    const isSelected = selectedMapBiz?.id === biz.id;

                    // Compute relative position based on Santiago coordinates
                    // Lat bounds ~ -33.47 to -33.37, Lng bounds ~ -70.75 to -70.52
                    const latPercent = biz.latitude ? Math.min(90, Math.max(10, ((-33.36 - biz.latitude) / 0.12) * 100)) : 50;
                    const lngPercent = biz.longitude ? Math.min(90, Math.max(10, ((biz.longitude - (-70.75)) / 0.25) * 100)) : 50;

                    return (
                      <div
                        key={biz.id}
                        onClick={() => setSelectedMapBiz(biz)}
                        style={{ top: `${latPercent}%`, left: `${lngPercent}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                      >
                        <div
                          className={`px-2.5 py-1.5 rounded-full font-black text-[11px] shadow-lg transition-transform flex items-center gap-1 ${
                            isSelected
                              ? 'bg-rose-600 text-white scale-110 ring-4 ring-rose-200'
                              : 'bg-slate-900 text-white hover:scale-105'
                          }`}
                        >
                          <Scissors className="w-3 h-3 text-rose-300" />
                          <span>{formatCLP(biz.min_price || 15000)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Business Preview Card beneath Map */}
                {selectedMapBiz && (
                  <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 animate-fadeIn">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                          Negocio Seleccionado en el Plano
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{selectedMapBiz.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {selectedMapBiz.rating_avg}
                          </span>
                          <span>• {selectedMapBiz.comuna}</span>
                          {selectedMapBiz.distance_km && (
                            <span className="text-rose-600 font-semibold">• {selectedMapBiz.distance_km} km</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenBooking(selectedMapBiz)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-1"
                      >
                        Reservar
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {targetBookingBusiness && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          business={targetBookingBusiness}
          onBookingSuccess={() => {
            fetchBusinesses();
          }}
        />
      )}
    </div>
  );
};
