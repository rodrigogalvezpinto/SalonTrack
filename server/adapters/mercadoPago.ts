import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MercadoPagoPreferenceInput {
  title: string;
  unitPriceClp: number;
  externalReference: string;
  payerEmail: string;
  appUrl: string;
}

export interface MercadoPagoPayment {
  id: string;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string;
}

export function mercadoPagoConfigured(): boolean {
  return Boolean(
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()
    && process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
  );
}

export function apiBase(): string {
  return process.env.MERCADO_PAGO_API_BASE || 'https://api.mercadopago.com';
}

function apiUrl(path: string): string {
  return `${apiBase().replace(/\/+$/, '')}${path}`;
}

function accessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Mercado Pago no está configurado.');
  return token;
}

export async function createPreference(input: MercadoPagoPreferenceInput): Promise<{ id: string; init_point: string }> {
  const response = await fetch(apiUrl('/checkout/preferences'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': input.externalReference,
    },
    body: JSON.stringify({
      items: [{
        id: input.externalReference,
        title: input.title,
        quantity: 1,
        currency_id: 'CLP',
        unit_price: input.unitPriceClp,
      }],
      payer: { email: input.payerEmail },
      external_reference: input.externalReference,
      back_urls: {
        success: `${input.appUrl}/?payment=success`,
        failure: `${input.appUrl}/?payment=failure`,
        pending: `${input.appUrl}/?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${input.appUrl}/api/payments/webhook`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Mercado Pago rechazó la creación de preferencia (${response.status}).`);
  }

  const data = await response.json() as { id?: unknown; init_point?: unknown };
  if (data.id === undefined || typeof data.init_point !== 'string') {
    throw new Error('Mercado Pago devolvió una preferencia incompleta.');
  }
  return { id: String(data.id), init_point: data.init_point };
}

export async function getMercadoPagoPayment(id: string): Promise<MercadoPagoPayment | null> {
  const response = await fetch(apiUrl(`/v1/payments/${encodeURIComponent(id)}`), {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Mercado Pago rechazó la consulta del pago (${response.status}).`);
  }

  const data = await response.json() as Record<string, unknown>;
  if (data.id === undefined) throw new Error('Mercado Pago devolvió un pago incompleto.');
  return {
    id: String(data.id),
    status: String(data.status || ''),
    status_detail: String(data.status_detail || ''),
    transaction_amount: Number(data.transaction_amount),
    currency_id: String(data.currency_id || ''),
    external_reference: String(data.external_reference || ''),
  };
}

export function verifyWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
  toleranceSec = 300,
  now = new Date(),
}: {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  secret?: string;
  toleranceSec?: number;
  now?: Date;
}): boolean {
  if (
    !xSignature?.trim()
    || !xRequestId?.trim()
    || !dataId?.trim()
    || !secret?.trim()
    || !Number.isFinite(now.getTime())
    || !Number.isFinite(toleranceSec)
    || toleranceSec < 0
  ) {
    return false;
  }
  if (xRequestId !== xRequestId.trim() || dataId !== dataId.trim() || secret !== secret.trim()) return false;

  const signatureParts = new Map<string, string>();
  for (const part of xSignature.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) return false;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key || !value || signatureParts.has(key)) return false;
    signatureParts.set(key, value);
  }

  const timestamp = signatureParts.get('ts');
  const receivedHash = signatureParts.get('v1');
  if (!timestamp || !/^\d+$/.test(timestamp) || !receivedHash || !/^[\da-f]{64}$/i.test(receivedHash)) {
    return false;
  }

  const timestampValue = Number(timestamp);
  if (!Number.isSafeInteger(timestampValue)) return false;
  const timestampMs = timestampValue > 1e12 ? timestampValue : timestampValue * 1000;
  if (Math.abs(now.getTime() - timestampMs) > toleranceSec * 1000) return false;

  const normalizedDataId = /^[a-z\d]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedDataId};request-id:${xRequestId};ts:${timestamp};`;
  const expectedHash = createHmac('sha256', secret).update(manifest).digest();
  const actualHash = Buffer.from(receivedHash, 'hex');
  if (expectedHash.length !== actualHash.length) return false;
  return timingSafeEqual(expectedHash, actualHash);
}
