import crypto from 'node:crypto';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  is_demo?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  phone: string;
  country: string; // 'Chile'
  currency: string; // 'CLP'
  timezone: string; // 'America/Santiago'
  default_interval_days: number;
  whatsapp_template: string;
  re_engagement_template?: string;
  re_engagement_days_threshold?: number;
  notification_preferences?: {
    push_enabled: boolean;
    alert_time: string; // e.g. "09:00"
    notify_days_before: number; // e.g. 3
    sound_enabled?: boolean;
    push_subscription?: any;
  };
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  notes: string;
  preferred_contact?: string;
  re_engagement_status?: 'none' | 'inactive' | 'recontacted' | 'reactivated' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  client_id: string;
  service_type: string; // e.g. Tintura Raíz, Balayage, Babylights, Baño de Color, Botox Capilar, Alisado
  color_formula?: string; // e.g. "Majirel 7.1 (30g) + 7.0 (20g) + Oxidante 20vol (75ml)"
  tint_brand?: string; // e.g. "L'Oréal Professionnel", "Wella Koleston", "Schwarzkopf Igora"
  service_date: string; // YYYY-MM-DD
  amount_clp: number; // Integer CLP
  recommended_interval_days: number; // e.g. 30, 45, 60
  next_retouch_date: string; // YYYY-MM-DD
  notes?: string;
  created_at: string;
}

export interface ContactLog {
  id: string;
  user_id: string;
  client_id: string;
  contact_date: string;
  channel: 'whatsapp' | 'call' | 'sms';
  status: 'contacted' | 'pending' | 'scheduled' | 'no_reply';
  notes?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'basic_monthly' | 'pro_quarterly' | 'annual';
  status: 'trial' | 'active' | 'expired' | 'pending';
  start_date: string;
  expiration_date: string;
  payment_provider: 'mercadopago' | 'transfer' | 'manual' | 'local';
  updated_at?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount_clp: number;
  currency: string;
  provider: string;
  provider_payment_id: string;
  status: 'approved' | 'pending' | 'rejected';
  plan: string;
  created_at: string;
}

export function generateId(prefix = ''): string {
  return prefix ? `${prefix}_${crypto.randomUUID()}` : crypto.randomUUID();
}

export { getDatabase, initDatabase, closeDatabase, transaction } from './db/connection.js';
