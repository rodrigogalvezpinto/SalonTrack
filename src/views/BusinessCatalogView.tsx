import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCLP, formatDuration } from '../utils/formatters';
import { CatalogService, Staff, BusinessHours } from '../types';
import {
  Scissors,
  Users,
  Clock,
  Building,
  Plus,
  Trash2,
  Edit2,
  Check,
  Save,
  AlertCircle,
  ShieldCheck,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const BusinessCatalogView: React.FC = () => {
  const { business, refreshBusiness } = useAuth();

  const [activeTab, setActiveTab] = useState<'services' | 'staff' | 'hours' | 'profile'>('services');

  // Services State
  const [services, setServices] = useState<CatalogService[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    duration_min: 45,
    price_clp: 20000,
    buffer_min: 10,
    is_active: true
  });

  // Staff State
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '+56 9 ',
    role_title: 'Estilista Profesional',
    bio: ''
  });

  // Hours State
  const [hours, setHours] = useState<BusinessHours[]>([]);
  const [isSavingHours, setIsSavingHours] = useState<boolean>(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: business?.name || '',
    description: business?.description || '',
    address: business?.address || '',
    comuna: business?.comuna || 'Providencia',
    phone: business?.phone || '',
    whatsapp: business?.whatsapp || '',
    auto_confirm_bookings: business?.auto_confirm_bookings ?? false
  });
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (business) {
      loadData();
      setProfileForm({
        name: business.name || '',
        description: business.description || '',
        address: business.address || '',
        comuna: business.comuna || 'Providencia',
        phone: business.phone || '',
        whatsapp: business.whatsapp || '',
        auto_confirm_bookings: business.auto_confirm_bookings ?? false
      });
    }
  }, [business]);

  const loadData = async () => {
    try {
      const [svcRes, staffRes, hoursRes] = await Promise.all([
        apiRequest<{ services: CatalogService[] }>('/api/business/services'),
        apiRequest<{ staff: Staff[] }>('/api/business/staff'),
        apiRequest<{ hours: BusinessHours[] }>('/api/business/hours')
      ]);

      setServices(svcRes.services || []);
      setStaffList(staffRes.staff || []);

      // Default week hours if empty
      const defaultHours: BusinessHours[] = [
        { day_of_week: 1, open_time: '10:00', close_time: '20:00', is_closed: 0 },
        { day_of_week: 2, open_time: '10:00', close_time: '20:00', is_closed: 0 },
        { day_of_week: 3, open_time: '10:00', close_time: '20:00', is_closed: 0 },
        { day_of_week: 4, open_time: '10:00', close_time: '20:00', is_closed: 0 },
        { day_of_week: 5, open_time: '10:00', close_time: '20:00', is_closed: 0 },
        { day_of_week: 6, open_time: '10:00', close_time: '19:00', is_closed: 0 },
        { day_of_week: 0, open_time: '10:00', close_time: '18:00', is_closed: 1 }
      ];

      if (hoursRes.hours && hoursRes.hours.length > 0) {
        setHours(hoursRes.hours);
      } else {
        setHours(defaultHours);
      }
    } catch (err) {
      console.error('Error loading business catalog:', err);
    }
  };

  // Service CRUD
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingServiceId) {
        await apiRequest(`/api/business/services/${editingServiceId}`, {
          method: 'PUT',
          body: JSON.stringify(serviceForm)
        });
      } else {
        await apiRequest('/api/business/services', {
          method: 'POST',
          body: JSON.stringify(serviceForm)
        });
      }
      setIsServiceModalOpen(false);
      setEditingServiceId(null);
      setServiceForm({
        name: '',
        description: '',
        duration_min: 45,
        price_clp: 20000,
        buffer_min: 10,
        is_active: true
      });
      loadData();
    } catch (err: any) {
      alert(`Error al guardar servicio: ${err.message}`);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('¿Eliminar este servicio del catálogo?')) return;
    try {
      await apiRequest(`/api/business/services/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Staff CRUD
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/business/staff', {
        method: 'POST',
        body: JSON.stringify(staffForm)
      });
      setIsStaffModalOpen(false);
      setStaffForm({
        name: '',
        email: '',
        phone: '+56 9 ',
        role_title: 'Estilista Profesional',
        bio: ''
      });
      loadData();
    } catch (err: any) {
      alert(`Error al guardar miembro del equipo: ${err.message}`);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('¿Eliminar este miembro del equipo?')) return;
    try {
      await apiRequest(`/api/business/staff/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Hours Save
  const handleSaveHours = async () => {
    setIsSavingHours(true);
    try {
      await apiRequest('/api/business/hours', {
        method: 'PUT',
        body: JSON.stringify({ hours })
      });
      setStatusMessage('Horarios guardados exitosamente');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Error al guardar horarios: ${err.message}`);
    } finally {
      setIsSavingHours(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await apiRequest('/api/business/my', {
        method: 'PUT',
        body: JSON.stringify(profileForm)
      });
      setStatusMessage('Perfil actualizado correctamente');
      setTimeout(() => setStatusMessage(null), 3000);
      refreshBusiness();
    } catch (err: any) {
      alert(`Error al actualizar perfil: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Administración del Salón y Catálogo
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personaliza tus servicios, equipo de estilistas, horarios y ficha pública para el Marketplace de Santiago.
          </p>
        </div>

        {statusMessage && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg">
            <Check className="w-3.5 h-3.5" /> {statusMessage}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab('services')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'services'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>Servicios ({services.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Equipo ({staffList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'hours'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Horarios de Atención</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Ficha del Negocio</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Services */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Servicios que tus clientes pueden ver y reservar online desde el Marketplace.
            </p>
            <button
              onClick={() => {
                setEditingServiceId(null);
                setServiceForm({
                  name: '',
                  description: '',
                  duration_min: 45,
                  price_clp: 20000,
                  buffer_min: 10,
                  is_active: true
                });
                setIsServiceModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Servicio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-base">{svc.name}</h4>
                      <p className="text-xs text-slate-500">{svc.category_name || 'Servicio General'}</p>
                    </div>
                    <span className="font-bold text-slate-900 text-base tabular-nums">
                      {formatCLP(svc.price_clp)}
                    </span>
                  </div>

                  {svc.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {svc.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                    <span>Duración: {formatDuration(svc.duration_minutes || svc.duration_min)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Buffer: {svc.clean_minutes || svc.buffer_min || 0} min</span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${svc.status !== 'INACTIVE' ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {svc.status !== 'INACTIVE' ? 'Activo en marketplace' : 'Oculto'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingServiceId(svc.id);
                        setServiceForm({
                          name: svc.name,
                          description: svc.description || '',
                          duration_min: svc.duration_minutes || svc.duration_min || 45,
                          price_clp: svc.price_clp,
                          buffer_min: svc.clean_minutes || svc.buffer_min || 10,
                          is_active: svc.status !== 'INACTIVE'
                        });
                        setIsServiceModalOpen(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-md"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteService(svc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Staff */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Profesionales que atienden reservas y cuentan con agenda independiente.
            </p>
            <button
              onClick={() => setIsStaffModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Profesional
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {staffList.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                    {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{member.name}</h4>
                    <p className="text-xs text-slate-500">{member.role_title || member.specialty || 'Estilista'}</p>
                  </div>
                </div>

                {member.bio && (
                  <p className="text-xs text-slate-600 italic">"{member.bio}"</p>
                )}

                <div className="text-xs text-slate-500 font-mono space-y-0.5 pt-1">
                  <div>{member.email}</div>
                  <div>{member.phone}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleDeleteStaff(member.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Hours */}
      {activeTab === 'hours' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Horarios de Apertura y Cierre</h3>
            <p className="text-xs text-slate-500 mt-1">
              El motor de colisiones utiliza estos horarios para generar los bloques de disponibilidad disponibles para las clientas.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {dayNames.map(({ day, name }) => {
              const currentHour = hours.find(h => h.day_of_week === day) || {
                day_of_week: day,
                open_time: '10:00',
                close_time: '20:00',
                is_closed: false
              };

              return (
                <div key={day} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="w-32 font-semibold text-sm text-slate-800">
                    {name}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={!Boolean(currentHour.is_closed)}
                        onChange={(e) => {
                          const isClosed = !e.target.checked;
                          setHours(prev => {
                            const exists = prev.some(h => h.day_of_week === day);
                            if (exists) {
                              return prev.map(h => h.day_of_week === day ? { ...h, is_closed: isClosed ? 1 : 0 } : h);
                            }
                            return [...prev, { day_of_week: day, open_time: '10:00', close_time: '20:00', is_closed: isClosed ? 1 : 0 }];
                          });
                        }}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className={Boolean(currentHour.is_closed) ? 'text-slate-400' : 'text-slate-700 font-medium'}>
                        {Boolean(currentHour.is_closed) ? 'Cerrado todo el día' : 'Abierto'}
                      </span>
                    </label>

                    {!currentHour.is_closed && (
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="time"
                          value={currentHour.open_time}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, open_time: val } : h));
                          }}
                          className="px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                        <span className="text-slate-400">a</span>
                        <input
                          type="time"
                          value={currentHour.close_time}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, close_time: val } : h));
                          }}
                          className="px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveHours}
              disabled={isSavingHours}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              {isSavingHours ? 'Guardando...' : 'Guardar Horarios'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Ficha Pública del Salón</h3>
            <p className="text-xs text-slate-500 mt-1">
              Esta información aparece visible en el Marketplace público y en el perfil de tu salón.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Comercial del Salón</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-semibold text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Descripción y Especialidades</label>
              <textarea
                rows={3}
                value={profileForm.description}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Dirección (Calle y Número)</label>
              <input
                type="text"
                required
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Comuna (Santiago de Chile)</label>
              <input
                type="text"
                required
                value={profileForm.comuna}
                onChange={(e) => setProfileForm({ ...profileForm, comuna: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono Fijo / Contacto</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp para Notificaciones (+56 9...)</label>
              <input
                type="text"
                required
                value={profileForm.whatsapp}
                onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-mono"
              />
            </div>

            <div className="sm:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileForm.auto_confirm_bookings}
                  onChange={(e) => setProfileForm({ ...profileForm, auto_confirm_bookings: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Confirmación Automática de Citas</span>
                  <span className="text-[11px] text-slate-500 block">
                    Si está activado, las citas que no choquen con horarios ocupados se confirmarán de inmediato sin requerir aprobación manual.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
            >
              {isSavingProfile ? 'Guardando...' : 'Actualizar Datos del Negocio'}
            </button>
          </div>
        </form>
      )}

      {/* Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {editingServiceId ? 'Editar Servicio' : 'Nuevo Servicio'}
            </h3>

            <form onSubmit={handleSaveService} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Balayage Rubio Ceniza, Corte Fade, Esmaltado Permanente..."
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  placeholder="Detalles de lo que incluye el procedimiento..."
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Precio en CLP ($)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={serviceForm.price_clp}
                    onChange={(e) => setServiceForm({ ...serviceForm, price_clp: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Duración (minutos)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    required
                    value={serviceForm.duration_min}
                    onChange={(e) => setServiceForm({ ...serviceForm, duration_min: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
                >
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Agregar Miembro al Equipo</h3>

            <form onSubmit={handleSaveStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcelo Rojas"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cargo o Especialidad</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Colorista Senior, Barbero Máster, Manicurista..."
                  value={staffForm.role_title}
                  onChange={(e) => setStaffForm({ ...staffForm, role_title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="pro@salon.cl"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    required
                    placeholder="+56 9 8888 7777"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Breve Bio (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Años de experiencia, certificaciones..."
                  value={staffForm.bio}
                  onChange={(e) => setStaffForm({ ...staffForm, bio: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-rose-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
                >
                  Guardar Profesional
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
