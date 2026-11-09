import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { WhatsAppModal } from './components/WhatsAppModal';
import { NewClientModal } from './components/NewClientModal';
import { NewServiceModal } from './components/NewServiceModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthModal } from './views/AuthModal';

import { LandingPage } from './views/LandingPage';
import { DashboardView } from './views/DashboardView';
import { ClientsView } from './views/ClientsView';
import { ClientDetailView } from './views/ClientDetailView';
import { RetouchesView } from './views/RetouchesView';
import { ReEngagementView } from './views/ReEngagementView';
import { RevenueCalculatorView } from './views/RevenueCalculatorView';
import { CalendarView } from './views/CalendarView';
import { SettingsView } from './views/SettingsView';
import { BusinessView } from './views/BusinessView';
import { AdminView } from './views/AdminView';
import { AccountView } from './views/AccountView';
import { PublicBusinessView } from './views/PublicBusinessView';

import { Client, Service } from './types';
import { apiRequest } from './utils/api';
import { showPushNotification, playNotificationChime } from './utils/notifications';

function MainApp() {
  const { user, profile, isLoading, roles, reloadSession } = useAuth();

  // Navigation
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'reset'>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset_token');
    if (token) {
      setResetToken(token);
      setAuthModalMode('reset');
      setAuthModalOpen(true);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;
    if (!roles.includes('PROFESSIONAL')) setCurrentView(roles.includes('PLATFORM_ADMIN') ? 'admin' : 'account');
    else if (currentView === 'account' || currentView === 'admin') setCurrentView('dashboard');
  }, [currentView, isLoading, roles, user]);
  
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutDefaultPlan, setCheckoutDefaultPlan] = useState<string>('pro_quarterly');

  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [newServiceModalOpen, setNewServiceModalOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion(v => v + 1);
  const [serviceTargetClient, setServiceTargetClient] = useState<Client | null>(null);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppTargetClient, setWhatsAppTargetClient] = useState<Client | null>(null);
  const [whatsAppTargetService, setWhatsAppTargetService] = useState<Service | null>(null);

  // Periodic notification check for Santiago timezone
  useEffect(() => {
    if (!user || !roles.includes('PROFESSIONAL')) return;

    const checkUpcomingRetouches = async () => {
      try {
        const res = await apiRequest<{ notifications: any[]; alert_time: string }>('/api/notifications/upcoming');
        if (res && res.notifications && res.notifications.length > 0) {
          const highUrgency = res.notifications.find((n: any) => n.urgency === 'high');
          if (highUrgency && Notification.permission === 'granted') {
            showPushNotification(`🔔 ${highUrgency.title}`, {
              body: highUrgency.message,
            });
            playNotificationChime();
          }
        }
      } catch (err) {
        // silent
      }
    };

    // Check on login
    checkUpcomingRetouches();
    // Check every 15 minutes
    const interval = setInterval(checkUpcomingRetouches, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [roles, user]);

  const isPublicProfile = window.location.pathname.startsWith('/negocio/');
  if (isPublicProfile) {
    return <PublicBusinessView slug={decodeURIComponent(window.location.pathname.slice('/negocio/'.length).split('/')[0])} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-purple-600 flex items-center justify-center text-white shadow-lg animate-pulse">
          <span className="font-black text-xl">ST</span>
        </div>
        <p className="text-xs font-bold text-slate-500 mt-4 tracking-wide uppercase">
          Iniciando SalonTrack Chile...
        </p>
      </div>
    );
  }

  // If not logged in, show conversion-focused Landing Page
  if (!user) {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setAuthModalOpen(true);
          }}
          onOpenCheckout={(planId) => {
            if (planId) setCheckoutDefaultPlan(planId);
            setAuthModalMode('register');
            setAuthModalOpen(true);
          }}
        />

        <AuthModal
          key={`${authModalMode}-${authModalOpen}`}
          isOpen={authModalOpen}
          initialMode={authModalMode}
          resetToken={resetToken}
          onClose={() => setAuthModalOpen(false)}
        />

        <OfflineBanner />
      </>
    );
  }

  // Handlers
  const handleOpenWhatsApp = (client: Client, service?: Service) => {
    setWhatsAppTargetClient(client);
    setWhatsAppTargetService(service || null);
    setWhatsAppModalOpen(true);
  };

  const handleOpenNewService = (client: Client) => {
    setServiceTargetClient(client);
    setNewServiceModalOpen(true);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setCurrentView('client_detail');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Top Header */}
      <Header
        onNewClientClick={() => setNewClientModalOpen(true)}
        onOpenCheckout={() => {
          setCheckoutDefaultPlan('pro_quarterly');
          setCheckoutModalOpen(true);
        }}
      />

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-28 sm:pb-32 md:pb-8">
        {/* Desktop Sidebar */}
        <Sidebar
          currentView={currentView}
          roles={roles}
          onSelectView={(view) => {
            setSelectedClientId(null);
            setCurrentView(view);
          }}
        />

        {/* View Port Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {currentView === 'dashboard' && (
            <DashboardView
              onOpenWhatsApp={handleOpenWhatsApp}
              onNewClient={() => setNewClientModalOpen(true)}
              onNavigate={(v) => setCurrentView(v)}
              onSelectClient={handleSelectClient}
            />
          )}

          {currentView === 'clients' && (
            <ClientsView
              onSelectClient={handleSelectClient}
              onOpenWhatsApp={handleOpenWhatsApp}
              onNewClient={() => setNewClientModalOpen(true)}
            />
          )}

          {currentView === 'client_detail' && selectedClientId && (
            <ClientDetailView
              clientId={selectedClientId}
              refreshKey={dataVersion}
              onBack={() => {
                setSelectedClientId(null);
                setCurrentView('clients');
              }}
              onOpenWhatsApp={handleOpenWhatsApp}
              onAddService={handleOpenNewService}
              onClientDeleted={() => {
                setSelectedClientId(null);
                setCurrentView('clients');
              }}
            />
          )}

          {currentView === 'retouches' && (
            <RetouchesView
              onOpenWhatsApp={handleOpenWhatsApp}
              onSelectClient={handleSelectClient}
            />
          )}

          {currentView === 're-engagement' && (
            <ReEngagementView />
          )}

          {currentView === 'revenue' && (
            <RevenueCalculatorView
              onOpenWhatsApp={handleOpenWhatsApp}
              onSelectClient={handleSelectClient}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView
              onOpenWhatsApp={handleOpenWhatsApp}
              onSelectClient={handleSelectClient}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              onOpenCheckout={() => setCheckoutModalOpen(true)}
            />
          )}

          {currentView === 'business' && roles.includes('PROFESSIONAL') && (
            <BusinessView memberships={user.memberships} />
          )}
          {currentView === 'admin' && roles.includes('PLATFORM_ADMIN') && <AdminView />}
          {currentView === 'account' && !roles.includes('PROFESSIONAL') && (
            <AccountView onBusinessCreated={async () => {
              await reloadSession();
              setCurrentView('business');
            }} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        roles={roles}
        onSelectView={(view) => {
          setSelectedClientId(null);
          setCurrentView(view);
        }}
      />

      {/* Modals */}
      <WhatsAppModal
        isOpen={whatsAppModalOpen}
        client={whatsAppTargetClient}
        service={whatsAppTargetService}
        onClose={() => setWhatsAppModalOpen(false)}
        onContactLogged={bumpDataVersion}
      />

      {roles.includes('PROFESSIONAL') && <NewClientModal
        isOpen={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        onClientCreated={() => {
          bumpDataVersion();
          setCurrentView('clients');
        }}
      />}

      <NewServiceModal
        isOpen={newServiceModalOpen}
        client={serviceTargetClient}
        onClose={() => setNewServiceModalOpen(false)}
        onServiceCreated={bumpDataVersion}
      />

      <CheckoutModal
        isOpen={checkoutModalOpen}
        defaultPlan={checkoutDefaultPlan}
        onClose={() => setCheckoutModalOpen(false)}
      />

      <OfflineBanner />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
