import { isValidIsoDate } from '../lib/validation.js';
export { calculateNextDate } from '../lib/dates.js';

export function isValidIsoDateSafe(value: unknown): value is string {
  return typeof value === 'string' && isValidIsoDate(value);
}
