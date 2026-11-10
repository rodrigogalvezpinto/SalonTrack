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
import { DemoAccountsModal } from './components/DemoAccountsModal';
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

// SalonTrack 2.0 Views
import { MarketplaceView } from './views/MarketplaceView';
import { BusinessProfileView } from './views/BusinessProfileView';
import { CustomerPortalView } from './views/CustomerPortalView';
import { BusinessBookingsView } from './views/BusinessBookingsView';
import { BusinessCatalogView } from './views/BusinessCatalogView';
import { AdminDashboardView } from './views/AdminDashboardView';

import { Client, Service } from './types';
import { apiRequest } from './utils/api';
import { showPushNotification, playNotificationChime } from './utils/notifications';

function MainApp() {
  const { user, profile, isCustomer, isPlatformAdmin, isBusinessOwner, isStaff, business, isLoading } = useAuth();

  // Navigation state
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBusinessSlug, setSelectedBusinessSlug] = useState<string>('valeria-henriquez-studio');

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutDefaultPlan, setCheckoutDefaultPlan] = useState<string>('pro_quarterly');

  const [demoAccountsModalOpen, setDemoAccountsModalOpen] = useState(false);

  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [newServiceModalOpen, setNewServiceModalOpen] = useState(false);
  const [serviceTargetClient, setServiceTargetClient] = useState<Client | null>(null);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppTargetClient, setWhatsAppTargetClient] = useState<Client | null>(null);
  const [whatsAppTargetService, setWhatsAppTargetService] = useState<Service | null>(null);

  // Set default view depending on user role once authenticated
  useEffect(() => {
    if (!user) return;
    if (isCustomer) {
      setCurrentView('marketplace');
    } else if (isPlatformAdmin) {
      setCurrentView('admin_dashboard');
    } else {
      setCurrentView('dashboard');
    }
  }, [user?.id, isCustomer, isPlatformAdmin]);

  // Periodic notification check for Santiago timezone
  useEffect(() => {
    if (!user) return;

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

    checkUpcomingRetouches();
    const interval = setInterval(checkUpcomingRetouches, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-purple-600 flex items-center justify-center text-white shadow-lg animate-pulse">
          <span className="font-black text-xl">ST</span>
        </div>
        <p className="text-xs font-bold text-slate-500 mt-4 tracking-wide uppercase">
          Iniciando SalonTrack Chile 2.0...
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
          isOpen={authModalOpen}
          initialMode={authModalMode}
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

  const handleSelectBusinessProfile = (slug: string) => {
    setSelectedBusinessSlug(slug);
    setCurrentView(`business_profile:${slug}`);
  };

  const handleSelectView = (view: string) => {
    if (view.startsWith('business_profile:')) {
      const slug = view.split(':')[1];
      setSelectedBusinessSlug(slug || (business?.slug || 'valeria-henriquez-studio'));
      setCurrentView(view);
      return;
    }
    setSelectedClientId(null);
    setCurrentView(view);
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
        onOpenDemoAccounts={() => setDemoAccountsModalOpen(true)}
        onNavigate={handleSelectView}
      />

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-28 sm:pb-32 md:pb-8">
        {/* Desktop Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={handleSelectView}
        />

        {/* View Port Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {/* Marketplace View */}
          {currentView === 'marketplace' && (
            <MarketplaceView
              onSelectBusiness={handleSelectBusinessProfile}
            />
          )}

          {/* Business Public Profile View */}
          {currentView.startsWith('business_profile') && (
            <BusinessProfileView
              businessSlug={selectedBusinessSlug}
              onBack={() => setCurrentView('marketplace')}
            />
          )}

          {/* Customer Portal "Mi Cuenta" */}
          {currentView === 'customer_portal' && (
            <CustomerPortalView
              onNavigateToBusiness={handleSelectBusinessProfile}
              onExploreMarketplace={() => setCurrentView('marketplace')}
            />
          )}

          {/* Business Bookings Manager */}
          {currentView === 'business_bookings' && (
            <BusinessBookingsView />
          )}

          {/* Business Catalog, Staff & Hours */}
          {currentView === 'business_catalog' && (
            <BusinessCatalogView />
          )}

          {/* Platform Admin Panel */}
          {currentView === 'admin_dashboard' && (
            <AdminDashboardView />
          )}

          {/* Core SalonTrack CRM Views (Preserved) */}
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
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        onSelectView={handleSelectView}
      />

      {/* Modals */}
      <DemoAccountsModal
        isOpen={demoAccountsModalOpen}
        onClose={() => setDemoAccountsModalOpen(false)}
      />

      <WhatsAppModal
        isOpen={whatsAppModalOpen}
        client={whatsAppTargetClient}
        service={whatsAppTargetService}
        onClose={() => setWhatsAppModalOpen(false)}
      />

      <NewClientModal
        isOpen={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        onClientCreated={() => {
          setCurrentView('clients');
        }}
      />

      <NewServiceModal
        isOpen={newServiceModalOpen}
        client={serviceTargetClient}
        onClose={() => setNewServiceModalOpen(false)}
        onServiceCreated={() => {
          // auto reloaded in ClientDetailView
        }}
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
