import { getConfig } from '../config.js';
import { AppError } from '../lib/errors.js';
import { LocalEmailProvider, LocalPaymentProvider, LocalWhatsAppProvider } from './local.js';
import { MercadoPagoPaymentProvider } from './mercadopago.js';
import type { EmailProvider, PaymentProvider, WhatsAppProvider } from './types.js';

export function getPaymentProvider(): PaymentProvider {
  const config = getConfig();
  if (config.paymentProvider === 'mercadopago') {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      throw new AppError(503, 'PAYMENT_PROVIDER=mercadopago requiere MERCADO_PAGO_ACCESS_TOKEN.', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
    }
    return new MercadoPagoPaymentProvider(token, config.appUrl);
  }
  return new LocalPaymentProvider();
}

export function getEmailProvider(): EmailProvider {
  return new LocalEmailProvider();
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return new LocalWhatsAppProvider();
}

export type { EmailProvider, PaymentProvider, WhatsAppProvider } from './types.js';
