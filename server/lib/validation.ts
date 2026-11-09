import { badRequest } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function requireString(value: unknown, message: string, maxLength = 255): string {
  if (!isNonEmptyString(value)) throw badRequest(message);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw badRequest(`${message} (máximo ${maxLength} caracteres).`);
  return trimmed;
}

export function optionalString(value: unknown, field: string, maxLength = 2000): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw badRequest(`El campo ${field} debe ser texto.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw badRequest(`El campo ${field} excede ${maxLength} caracteres.`);
  return trimmed;
}

export function normalizeEmail(value: unknown): string {
  if (!isNonEmptyString(value)) throw badRequest('El correo electrónico es obligatorio.');
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw badRequest('El correo electrónico no es válido.');
  return email;
}

export function validatePassword(value: unknown, message = 'La contraseña debe tener al menos 6 caracteres.'): string {
  if (typeof value !== 'string' || value.length < 6) throw badRequest(message);
  if (value.length > 128) throw badRequest('La contraseña no puede superar 128 caracteres.');
  return value;
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function optionalIsoDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !isValidIsoDate(value)) throw badRequest(`${field} debe tener formato AAAA-MM-DD.`);
  return value;
}

export function optionalInt(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${field} debe ser numérico.`);
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) throw badRequest(`${field} debe estar entre ${min} y ${max}.`);
  return rounded;
}

export function optionalAmountClp(value: unknown, field = 'El monto'): number | undefined {
  // CLP no tiene decimales: se redondea al entero más cercano.
  return optionalInt(value, field, 0, 100_000_000);
}

export function optionalTime(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !TIME_RE.test(value)) throw badRequest(`${field} debe tener formato HH:MM.`);
  return value;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field} inválido. Valores permitidos: ${allowed.join(', ')}.`);
  }
  return value as T;
}

/** Normaliza teléfonos chilenos a +56XXXXXXXXX sin espacios. */
export function normalizeChileanPhone(value: unknown): string {
  if (!isNonEmptyString(value)) throw badRequest('El teléfono es obligatorio.');
  let phone = value.trim().replace(/[\s\-()]/g, '');
  if (!phone.startsWith('+')) {
    if (phone.startsWith('56')) phone = `+${phone}`;
    else if (phone.startsWith('9') && phone.length === 9) phone = `+56${phone}`;
  }
  if (!/^\+?\d{8,15}$/.test(phone)) throw badRequest('El teléfono no es válido. Usa el formato +56 9 XXXX XXXX.');
  return phone;
}
