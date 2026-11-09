export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  default_interval_days: number;
  whatsapp_template: string;
  re_engagement_template?: string;
  re_engagement_days_threshold?: number;
  notification_preferences?: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  alert_time: string;
  notify_days_before: number;
  sound_enabled?: boolean;
  push_subscription?: any;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'basic_monthly' | 'pro_quarterly' | 'annual';
  status: 'trial' | 'active' | 'expired' | 'pending';
  start_date: string;
  expiration_date: string;
  payment_provider: string;
  days_remaining?: number;
  is_active?: boolean;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  amount_clp: number;
  currency: string;
  provider: string;
  provider_payment_id: string;
  status: string;
  plan: string;
  created_at: string;
}

export interface RetouchInfo {
  status: 'overdue' | 'today' | 'this_week' | 'upcoming';
  label: string;
  diffDays: number;
  urgency: 'high' | 'medium' | 'low';
}

export interface Service {
  id: string;
  user_id: string;
  client_id: string;
  service_type: string;
  color_formula?: string;
  tint_brand?: string;
  service_date: string;
  amount_clp: number;
  recommended_interval_days: number;
  next_retouch_date: string;
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

export interface Client {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
  re_engagement_status?: 'none' | 'inactive' | 'recontacted' | 'reactivated' | 'dismissed';
  latest_service?: Service | null;
  total_services?: number;
  retouch?: RetouchInfo | null;
  latest_contact?: ContactLog | null;
  contact_status?: 'contacted' | 'pending_contact';
}

export interface DashboardStats {
  total_clients: number;
  retouches_this_week: number;
  retouches_overdue: number;
  potential_revenue_week_clp: number;
  potential_revenue_month_clp: number;
  average_service_ticket_clp: number;
  pending_contact_count: number;
  urgent_retouches: Array<{
    client: Client;
    service: Service;
    retouch: RetouchInfo;
  }>;
  recent_clients: Client[];
  revenue_breakdown: Array<{
    client_id: string;
    client_name: string;
    service_type: string;
    amount_clp: number;
    next_retouch_date: string;
    status: string;
    urgency: string;
    diffDays: number;
  }>;
  santiago_date: string;
}

export interface CalendarEvent {
  id: string;
  type: 'retouch' | 'completed_service';
  date: string;
  client_id: string;
  client_name: string;
  client_phone?: string;
  service_type: string;
  amount_clp: number;
  status: string;
  color_formula?: string;
}

export interface ReEngagementCandidate {
  client_id: string;
  full_name: string;
  phone: string;
  notes: string;
  last_visit_date: string;
  days_since_last_visit: number;
  months_inactive: string;
  latest_service: Service | null;
  re_engagement_status: 'none' | 'inactive' | 'recontacted' | 'reactivated' | 'dismissed';
  recoverable_amount_clp: number;
  suggested_message: string;
}

export interface ReEngagementResponse {
  threshold_days: number;
  total_inactive_clients: number;
  recontacted_count: number;
  reactivated_count: number;
  potential_recoverable_revenue_clp: number;
  template: string;
  candidates: ReEngagementCandidate[];
  santiago_date: string;
}

export interface NotificationItem {
  id: string;
  type: 'retouch_today' | 'retouch_overdue' | 'retouch_upcoming' | 'system';
  title: string;
  message: string;
  client_id?: string;
  phone?: string;
  urgency: 'high' | 'medium' | 'low';
  date: string;
}

