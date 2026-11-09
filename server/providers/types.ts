export interface DeliveryResult {
  status: 'simulated' | 'sent' | 'failed';
  deliveryId: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  userId?: string | null;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<DeliveryResult>;
}

export interface WhatsAppMessage {
  to: string;
  text: string;
  userId?: string | null;
}

export interface WhatsAppProvider {
  readonly name: string;
  buildContactLink(phone: string, text: string): string;
  send(message: WhatsAppMessage): Promise<DeliveryResult>;
}

export interface CheckoutRequest {
  userId: string;
  planId: string;
  title: string;
  description: string;
  amountClp: number;
  payerEmail?: string;
  payerName?: string;
  payerPhone?: string;
}

export interface CheckoutSession {
  provider: string;
  preferenceId: string;
  initPoint?: string;
  sandboxInitPoint?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** true solo para el proveedor local: permite confirmar el pago simulado desde la app. */
  readonly allowsClientConfirmation: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}
