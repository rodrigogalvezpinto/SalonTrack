export interface User {
  id: string;
  email: string;
  roles?: string[];
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  name?: string;
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
  type: 'retouch' | 'completed_service' | 'booking';
  date: string;
  client_id: string;
  client_name: string;
  client_phone?: string;
  service_type: string;
  amount_clp: number;
  status: string;
  color_formula?: string;
  time?: string;
  staff_name?: string;
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
  type: string;
  title: string;
  message: string;
  is_read?: number;
  client_id?: string;
  entity_type?: string;
  entity_id?: string;
  phone?: string;
  urgency: 'high' | 'medium' | 'low';
  date?: string;
  created_at?: string;
}

// -------------------------------------------------------------
// NEW SALONTRACK 2.0 ECOSYSTEM TYPES
// -------------------------------------------------------------
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  display_order: number;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  display_order: number;
}

export interface Business {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string;
  logo_url?: string;
  cover_url?: string;
  primary_category_id?: string;
  category_name?: string;
  category_slug?: string;
  phone: string;
  whatsapp: string;
  email: string;
  website?: string;
  instagram?: string;
  address: string;
  comuna: string;
  region: string;
  country: string;
  latitude?: number;
  longitude?: number;
  modality: 'salon' | 'home' | 'remote' | 'both';
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'INACTIVE';
  booking_mode: 'AUTOMATIC' | 'MANUAL';
  min_advance_hours: number;
  max_advance_days: number;
  buffer_minutes: number;
  cancellation_policy?: string;
  rating_avg?: number;
  rating_count?: number;
  reviews_count?: number;
  min_price?: number;
  distance_km?: number | null;
  featured_service?: CatalogService;
  verified?: boolean | number;
  auto_confirm_bookings?: boolean;
  hours?: BusinessHours[];
}

export interface Staff {
  id: string;
  business_id: string;
  user_id?: string;
  name: string;
  specialty?: string;
  role_title?: string;
  bio?: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  is_active: number | boolean;
  display_order: number;
}

export interface CatalogService {
  id: string;
  business_id: string;
  category_id?: string;
  category_name?: string;
  subcategory_id?: string;
  name: string;
  description?: string;
  image_url?: string;
  price_clp: number;
  price_type: 'fixed' | 'from' | 'variable' | 'evaluation';
  duration_minutes: number;
  duration_min?: number;
  buffer_min?: number;
  is_active?: boolean | number;
  prep_minutes?: number;
  clean_minutes?: number;
  modality?: 'salon' | 'home' | 'remote' | 'both';
  is_featured?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'INACTIVE';
  display_order?: number;
}

export interface BusinessHours {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: number | boolean;
}

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface Booking {
  id: string;
  code: string;
  confirmation_code?: string;
  business_id: string;
  business_name?: string;
  business_slug?: string;
  business_phone?: string;
  business_whatsapp?: string;
  business_address?: string;
  business_comuna?: string;
  staff_id: string;
  staff_name?: string;
  service_id: string;
  service_name?: string;
  service_desc?: string;
  customer_user_id?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  duration_min?: number;
  amount_clp: number;
  price_clp?: number;
  modality: string;
  status: BookingStatus;
  payment_method: 'presential' | 'online';
  payment_status: 'pending' | 'paid' | 'refunded' | 'PAID' | 'PENDING' | 'REFUNDED';
  client_name: string;
  client_phone: string;
  client_email?: string;
  client_notes?: string;
  review_id?: string;
  review_rating?: number;
  completed_at?: string;
  created_at: string;
}

export interface Review {
  id: string;
  business_id: string;
  staff_id?: string;
  staff_name?: string;
  booking_id: string;
  user_id: string;
  customer_name: string;
  author_name?: string;
  rating: number;
  comment?: string;
  response?: string;
  response_date?: string;
  service_name?: string;
  created_at: string;
}

export interface TimeSlotItem {
  time: string;
  endTime: string;
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  available: boolean;
}
