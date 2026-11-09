import { AppError } from '../lib/errors.js';
import type { CheckoutRequest, CheckoutSession, PaymentProvider } from './types.js';

/** Adaptador real de Mercado Pago. Solo se activa con PAYMENT_PROVIDER=mercadopago. */
export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  readonly allowsClientConfirmation = false;

  constructor(private accessToken: string, private appUrl: string) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: request.planId, title: request.title, description: request.description, quantity: 1, currency_id: 'CLP', unit_price: request.amountClp }],
        payer: { email: request.payerEmail, name: request.payerName, phone: { number: request.payerPhone } },
        external_reference: `${request.userId}___${request.planId}___${Date.now()}`,
        notification_url: `${this.appUrl}/api/payments/webhook`,
        back_urls: {
          success: `${this.appUrl}/?payment=success&plan=${request.planId}`,
          pending: `${this.appUrl}/?payment=pending&plan=${request.planId}`,
          failure: `${this.appUrl}/?payment=failure`,
        },
        auto_return: 'approved',
      }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data.init_point) {
      throw new AppError(502, 'No fue posible crear la preferencia de pago en Mercado Pago.', 'PAYMENT_PROVIDER_ERROR');
    }
    return { provider: this.name, preferenceId: data.id, initPoint: data.init_point, sandboxInitPoint: data.sandbox_init_point };
  }
}
