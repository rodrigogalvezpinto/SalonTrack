import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Profile, Subscription, Business } from '../types';
import { apiRequest, getStoredToken, setStoredToken } from '../utils/api';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  business: Business | null;
  roles: string[];
  token: string | null;
  isLoading: boolean;
  isPlatformAdmin: boolean;
  isBusinessOwner: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; business_name: string; phone: string; role?: string }) => Promise<void>;
  logout: () => void;
  reloadSession: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  setBusiness: React.Dispatch<React.SetStateAction<Business | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      if (!getStoredToken()) {
        setUser(null);
        setProfile(null);
        setSubscription(null);
        setBusiness(null);
        setRoles([]);
        setIsLoading(false);
        return;
      }

      const res = await apiRequest<{
        user: {
          id: string;
          email: string;
          roles?: string[];
          profile: Profile;
          subscription: Subscription;
          business?: Business;
        };
      }>('/api/auth/me');

      if (res && res.user) {
        const userRoles = res.user.roles || ['CUSTOMER'];
        setUser({ id: res.user.id, email: res.user.email, roles: userRoles, created_at: '' });
        setProfile(res.user.profile);
        setSubscription(res.user.subscription);
        setBusiness(res.user.business || null);
        setRoles(userRoles);
      }
    } catch (err) {
      console.warn('Session expired or invalid, logging out.');
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setProfile(null);
      setSubscription(null);
      setBusiness(null);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{
      token: string;
      user: {
        id: string;
        email: string;
        roles?: string[];
        profile: Profile;
        subscription: Subscription;
        business?: Business;
      };
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const userRoles = res.user.roles || ['CUSTOMER'];
    setStoredToken(res.token);
    setToken(res.token);
    setUser({ id: res.user.id, email: res.user.email, roles: userRoles, created_at: '' });
    setProfile(res.user.profile);
    setSubscription(res.user.subscription);
    setBusiness(res.user.business || null);
    setRoles(userRoles);
  };

  const register = async (data: { email: string; password: string; full_name: string; business_name: string; phone: string; role?: string }) => {
    const res = await apiRequest<{
      token: string;
      user: {
        id: string;
        email: string;
        roles?: string[];
        profile: Profile;
        subscription?: Subscription;
      };
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const userRoles = res.user.roles || ['CUSTOMER'];
    setStoredToken(res.token);
    setToken(res.token);
    setUser({ id: res.user.id, email: res.user.email, roles: userRoles, created_at: '' });
    setProfile(res.user.profile);
    setSubscription(res.user.subscription || null);
    setRoles(userRoles);
    await reloadSession();
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
    setBusiness(null);
    setRoles([]);
  };

  const reloadSession = async () => {
    await fetchCurrentUser();
  };

  const updateProfile = async (data: Partial<Profile>) => {
    const res = await apiRequest<{ profile: Profile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setProfile(res.profile);
  };

  const isPlatformAdmin = roles.includes('PLATFORM_ADMIN');
  const isBusinessOwner = roles.includes('BUSINESS_OWNER');
  const isStaff = roles.includes('BUSINESS_STAFF');
  const isCustomer = roles.includes('CUSTOMER') || (!isPlatformAdmin && !isBusinessOwner && !isStaff);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        subscription,
        business,
        roles,
        token,
        isLoading,
        isPlatformAdmin,
        isBusinessOwner,
        isStaff,
        isCustomer,
        login,
        register,
        logout,
        reloadSession,
        refreshBusiness: reloadSession,
        updateProfile,
        setBusiness,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
