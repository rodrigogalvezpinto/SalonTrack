import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { formatCLP } from '../utils/formatters';
import { Category, Business } from '../types';
import {
  ShieldAlert,
  Building2,
  Users,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderTree,
  FileText,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldCheck
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalBookings: number;
  totalVolumeCLP: number;
}

interface AdminUser {
  id: string;
  email: string;
  is_active: boolean;
  name?: string;
  phone?: string;
  roles: string[];
  created_at: string;
}

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details?: string;
  created_at: string;
}

export const AdminDashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'businesses' | 'users' | 'categories' | 'audit'>('businesses');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    totalBookings: 0,
    totalVolumeCLP: 0
  });

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, bizRes, usersRes, catRes, logsRes] = await Promise.all([
        apiRequest<{ stats: AdminStats }>('/api/admin/metrics'),
        apiRequest<{ businesses: Business[] }>('/api/admin/businesses'),
        apiRequest<{ users: AdminUser[] }>('/api/admin/users'),
        apiRequest<{ categories: Category[] }>('/api/admin/categories'),
        apiRequest<{ logs: AuditLog[] }>('/api/admin/audit-logs')
      ]);

      if (statsRes.stats) setStats(statsRes.stats);
      if (bizRes.businesses) setBusinesses(bizRes.businesses);
      if (usersRes.users) setUsers(usersRes.users);
      if (catRes.categories) setCategories(catRes.categories);
      if (logsRes.logs) setAuditLogs(logsRes.logs);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBusinessStatus = async (id: string, newStatus: string) => {
    try {
      await apiRequest(`/api/admin/businesses/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      loadAdminData();
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  };

  const handleToggleBusinessVerification = async (id: string, currentVerified: boolean) => {
    try {
      await apiRequest(`/api/admin/businesses/${id}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ verified: !currentVerified })
      });
      loadAdminData();
    } catch (err: any) {
      alert(`Error al cambiar verificación: ${err.message}`);
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentActive })
      });
      loadAdminData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded tracking-wide uppercase">
              Consola de Plataforma
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Panel de Administración SalonTrack Chile
          </h1>
          <p className="text-xs text-slate-500">
            Control global de salones, usuarios, rubros chilenos y auditoría de seguridad.
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs"
        >
          Actualizar Datos
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500 block">Salones Registrados</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {stats.totalBusinesses}
          </span>
          <span className="text-[11px] text-slate-400">En Santiago de Chile</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500 block">Usuarios del Sistema</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {stats.totalUsers}
          </span>
          <span className="text-[11px] text-slate-400">Clientes y profesionales</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500 block">Citas Totales</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {stats.totalBookings}
          </span>
          <span className="text-[11px] text-slate-400">Gestionadas en el motor</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500 block">Volumen Transaccionado</span>
          <span className="text-2xl font-black text-slate-900 tabular-nums mt-1 block">
            {formatCLP(stats.totalVolumeCLP)}
          </span>
          <span className="text-[11px] text-slate-400">En servicios agendados</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab('businesses')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'businesses'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Salones y Negocios ({businesses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios y Roles ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Rubros y Categorías ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-rose-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Auditoría de Acciones ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Businesses */}
      {activeTab === 'businesses' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="divide-y divide-slate-100">
              {businesses.map((b) => (
                <div key={b.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-base">{b.name}</h4>
                      {b.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <ShieldCheck className="w-3 h-3" /> Verificado
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Sin verificar</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span>{b.category_name}</span> · <span>{b.address}, {b.comuna}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Slug: /{b.slug} · WhatsApp: {b.whatsapp || 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status badge & selector */}
                    <select
                      value={b.status}
                      onChange={(e) => handleUpdateBusinessStatus(b.id, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                        b.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : b.status === 'PENDING_REVIEW'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      <option value="PUBLISHED">Publicado</option>
                      <option value="PENDING_REVIEW">En Revisión</option>
                      <option value="SUSPENDED">Suspendido</option>
                    </select>

                    <button
                      onClick={() => handleToggleBusinessVerification(b.id, Boolean(b.verified))}
                      className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white"
                    >
                      {b.verified ? 'Quitar Verificación' : 'Verificar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{u.name || u.email}</span>
                    <span className="text-xs font-mono text-slate-400">({u.email})</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span>Roles: {u.roles.join(', ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{u.phone || 'Sin teléfono'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${u.is_active ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                    {u.is_active ? 'Activo' : 'Suspendido'}
                  </span>

                  <button
                    onClick={() => handleToggleUserActive(u.id, u.is_active)}
                    className="text-xs text-slate-600 hover:text-slate-900 underline"
                  >
                    {u.is_active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">{cat.name}</h4>
                <span className="text-[11px] text-slate-400 font-mono">/{cat.slug}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {cat.description}
              </p>
              {cat.subcategories && cat.subcategories.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 block mb-1">Subcategorías Chilenas:</span>
                  <div className="flex flex-wrap gap-1">
                    {cat.subcategories.map((sub) => (
                      <span key={sub.id} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {sub.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500 font-medium">
            Registro de auditoría inmutable de eventos de la plataforma (creación de negocios, confirmaciones, pagos y modificaciones).
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900">{log.action}</span>
                    <span className="text-slate-400">en entidad</span>
                    <span className="font-semibold text-slate-800">{log.entity}</span>
                  </div>
                  {log.details && (
                    <div className="text-slate-600 font-mono text-[11px] truncate max-w-xl">
                      {log.details}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-mono shrink-0">
                  {new Date(log.created_at).toLocaleString('es-CL')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
