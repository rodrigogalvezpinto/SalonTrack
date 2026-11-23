export const TRIAL_DAYS = 90;

function parseBillingGraceDays(): number {
  const configuredGraceDays = process.env.BILLING_GRACE_DAYS;
  if (configuredGraceDays === undefined || configuredGraceDays.trim() === '') return 7;

  const graceDays = Number(configuredGraceDays);
  if (!Number.isInteger(graceDays) || graceDays < 1) {
    throw new Error('BILLING_GRACE_DAYS debe ser un entero mayor o igual a 1.');
  }

  return graceDays;
}

export const BILLING_GRACE_DAYS = parseBillingGraceDays();

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true';
}
