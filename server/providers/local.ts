import crypto from 'node:crypto';
import { deliveryLogsRepository } from '../repositories/deliveryLogs.js';
import type {
  CheckoutRequest, CheckoutSession, DeliveryResult, EmailMessage, EmailProvider, PaymentProvider, WhatsAppMessage, WhatsAppProvider,
} from './types.js';

const shouldLog = () => process.env.NODE_ENV !== 'test';

/** Simula el envío de correos: queda registrado en notification_delivery_logs y en la consola. */
export class LocalEmailProvider implements EmailProvider {
  readonly name = 'local';
  async send(message: EmailMessage): Promise<DeliveryResult> {
    const deliveryId = deliveryLogsRepository.insert({
      userId: message.userId,
      channel: 'email',
      provider: this.name,
      recipient: message.to,
      subject: message.subject,
      body: message.text,
      status: 'simulated',
    });
    if (shouldLog()) {
      console.log(`\n📧 [Email simulado] Para: ${message.to}\n   Asunto: ${message.subject}\n   ${message.text.replace(/\n/g, '\n   ')}\n`);
    }
    return { status: 'simulated', deliveryId };
  }
}

export class LocalWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'local';
  buildContactLink(phone: string, text: string): string {
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  }
  async send(message: WhatsAppMessage): Promise<DeliveryResult> {
    const deliveryId = deliveryLogsRepository.insert({
      userId: message.userId,
      channel: 'whatsapp',
      provider: this.name,
      recipient: message.to,
      body: message.text,
      status: 'simulated',
    });
    return { status: 'simulated', deliveryId };
  }
}

export class LocalPaymentProvider implements PaymentProvider {
  readonly name = 'local';
  readonly allowsClientConfirmation = true;
  async createCheckout(_request: CheckoutRequest): Promise<CheckoutSession> {
    return { provider: this.name, preferenceId: `LOCAL_PREF_${crypto.randomUUID()}` };
  }
}
