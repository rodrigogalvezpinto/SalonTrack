import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Profile, Subscription } from '../types';
import { apiRequest, getStoredToken, setStoredToken } from '../utils/api';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; business_name: string; phone: string }) => Promise<void>;
  logout: () => void;
  reloadSession: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      if (!getStoredToken()) {
        setUser(null);
        setProfile(null);
        setSubscription(null);
        setIsLoading(false);
        return;
      }

      const res = await apiRequest<{ user: { id: string; email: string; profile: Profile; subscription: Subscription } }>('/api/auth/me');
      if (res && res.user) {
        setUser({ id: res.user.id, email: res.user.email, created_at: '' });
        setProfile(res.user.profile);
        setSubscription(res.user.subscription);
      }
    } catch (err) {
      console.warn('Session expired or invalid, logging out.');
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setProfile(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: { id: string; email: string; profile: Profile; subscription: Subscription } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setStoredToken(res.token);
    setToken(res.token);
    setUser({ id: res.user.id, email: res.user.email, created_at: '' });
    setProfile(res.user.profile);
    setSubscription(res.user.subscription);
  };

  const register = async (data: { email: string; password: string; full_name: string; business_name: string; phone: string }) => {
    const res = await apiRequest<{ token: string; user: { id: string; email: string; profile: Profile; subscription: Subscription } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    setStoredToken(res.token);
    setToken(res.token);
    setUser({ id: res.user.id, email: res.user.email, created_at: '' });
    setProfile(res.user.profile);
    setSubscription(res.user.subscription);
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        subscription,
        token,
        isLoading,
        login,
        register,
        logout,
        reloadSession,
        updateProfile,
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
