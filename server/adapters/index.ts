// SalonTrack 2.0 - Decoupled Adapter Interfaces & Local Implementations

export interface PaymentResult {
  paymentId: string;
  provider: 'local' | 'mercadopago';
  providerPaymentId: string;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  amountClp: number;
  checkoutUrl?: string;
  instructions?: string;
  rawResponse?: any;
}

export interface PaymentProvider {
  createPayment(params: {
    amountClp: number;
    description: string;
    payerEmail?: string;
    payerName?: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult>;
  getPayment(providerPaymentId: string): Promise<PaymentResult | null>;
  simulateStatus(providerPaymentId: string, status: 'approved' | 'rejected' | 'pending' | 'refunded'): Promise<PaymentResult>;
}

// 1. Local Simulated Payment Provider (No real third-party keys required)
export class LocalPaymentProvider implements PaymentProvider {
  async createPayment(params: {
    amountClp: number;
    description: string;
    payerEmail?: string;
    payerName?: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult> {
    const simId = `SIM_PAY_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
    return {
      paymentId: simId,
      provider: 'local',
      providerPaymentId: simId,
      status: 'pending',
      amountClp: params.amountClp,
      checkoutUrl: `/checkout/local?payment_id=${simId}&amount=${params.amountClp}&desc=${encodeURIComponent(params.description)}`,
      instructions: 'Ambiente de pago simulado local de SalonTrack Chile. Puedes aprobar, rechazar o simular el resultado de la transacción.',
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentResult | null> {
    return {
      paymentId: providerPaymentId,
      provider: 'local',
      providerPaymentId,
      status: 'approved',
      amountClp: 0,
    };
  }

  async simulateStatus(providerPaymentId: string, status: 'approved' | 'rejected' | 'pending' | 'refunded'): Promise<PaymentResult> {
    return {
      paymentId: providerPaymentId,
      provider: 'local',
      providerPaymentId,
      status,
      amountClp: 0,
    };
  }
}

// 2. Local WhatsApp Provider
export interface WhatsAppMessageResult {
  success: boolean;
  phone: string;
  message: string;
  waLink: string;
  simulated: boolean;
  timestamp: string;
}

export class LocalWhatsAppProvider {
  formatChileanPhone(rawPhone: string): string {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.startsWith('56')) {
      return clean;
    }
    if (clean.startsWith('9') && clean.length === 9) {
      return `56${clean}`;
    }
    return clean;
  }

  buildWaLink(phone: string, text: string): string {
    const formattedPhone = this.formatChileanPhone(phone);
    const encoded = encodeURIComponent(text);
    return `https://wa.me/${formattedPhone}?text=${encoded}`;
  }

  interpolateTemplate(template: string, tags: Record<string, string>): string {
    let result = template;
    for (const [key, val] of Object.entries(tags)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), val);
    }
    return result;
  }

  sendSimulated(phone: string, text: string): WhatsAppMessageResult {
    const waLink = this.buildWaLink(phone, text);
    console.log(`[Local WhatsApp Provider] Mensaje simulado a ${phone}: "${text.substring(0, 80)}..."`);
    return {
      success: true,
      phone,
      message: text,
      waLink,
      simulated: true,
      timestamp: new Date().toISOString(),
    };
  }
}

// 3. Local Email Provider
export interface EmailResult {
  success: boolean;
  to: string;
  subject: string;
  simulated: boolean;
  sentAt: string;
}

export class LocalEmailProvider {
  async send(to: string, subject: string, html: string): Promise<EmailResult> {
    console.log(`[Local Email Provider] Correo simulado a <${to}>: Asunto: "${subject}"`);
    return {
      success: true,
      to,
      subject,
      simulated: true,
      sentAt: new Date().toISOString(),
    };
  }
}

// 4. Local Geolocation & Distance Provider (Haversine formula without external Google Maps API)
export class LocalGeolocationProvider {
  // Returns distance in Kilometers
  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d * 10) / 10; // Round to 1 decimal place
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Pre-configured Chilean commune center coordinates
  getComunaCoordinates(comuna: string): { latitude: number; longitude: number } | null {
    const normalized = comuna.trim().toLowerCase();
    const comunas: Record<string, { latitude: number; longitude: number }> = {
      'providencia': { latitude: -33.4243, longitude: -70.6125 },
      'santiago': { latitude: -33.4429, longitude: -70.6538 },
      'santiago centro': { latitude: -33.4429, longitude: -70.6538 },
      'las condes': { latitude: -33.3980, longitude: -70.5480 },
      'vitacura': { latitude: -33.3850, longitude: -70.5750 },
      'lo barnechea': { latitude: -33.3550, longitude: -70.5150 },
      'renca': { latitude: -33.4072, longitude: -70.7188 },
      'nunoa': { latitude: -33.4560, longitude: -70.5980 },
      'ñuñoa': { latitude: -33.4560, longitude: -70.5980 },
      'la florida': { latitude: -33.5220, longitude: -70.5980 },
      'maipu': { latitude: -33.5100, longitude: -70.7570 },
      'maipú': { latitude: -33.5100, longitude: -70.7570 },
      'quilicura': { latitude: -33.3630, longitude: -70.7300 },
      'recoleta': { latitude: -33.4070, longitude: -70.6400 },
      'independencia': { latitude: -33.4150, longitude: -70.6650 },
      'san miguel': { latitude: -33.4930, longitude: -70.6520 },
      'macul': { latitude: -33.4900, longitude: -70.6000 },
      'penalolen': { latitude: -33.4800, longitude: -70.5400 },
      'peñalolén': { latitude: -33.4800, longitude: -70.5400 },
      'la reina': { latitude: -33.4450, longitude: -70.5400 },
      'vina del mar': { latitude: -33.0245, longitude: -71.5520 },
      'viña del mar': { latitude: -33.0245, longitude: -71.5520 },
      'valparaiso': { latitude: -33.0472, longitude: -71.6127 },
      'valparaíso': { latitude: -33.0472, longitude: -71.6127 },
      'concepcion': { latitude: -36.8270, longitude: -73.0503 },
      'concepción': { latitude: -36.8270, longitude: -73.0503 },
    };

    return comunas[normalized] || null;
  }
}

// Singletons
export const localPaymentProvider = new LocalPaymentProvider();
export const localWhatsAppProvider = new LocalWhatsAppProvider();
export const localEmailProvider = new LocalEmailProvider();
export const localGeolocationProvider = new LocalGeolocationProvider();
