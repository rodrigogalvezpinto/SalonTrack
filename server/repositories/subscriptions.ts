import { getDatabase } from '../db/connection.js';
import type { Payment, Subscription } from '../db.js';

export const subscriptionsRepository = {
  findByUserId(userId: string): Subscription | undefined {
    return getDatabase().prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as Subscription | undefined;
  },
  insert(sub: Subscription) {
    getDatabase()
      .prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status, start_date, expiration_date, payment_provider, created_at, updated_at)
         VALUES (@id, @user_id, @plan, @status, @start_date, @expiration_date, @payment_provider, @created_at, @updated_at)`
      )
      .run({ ...sub, updated_at: sub.updated_at ?? sub.created_at });
  },
  update(sub: Subscription) {
    getDatabase()
      .prepare(
        `UPDATE subscriptions SET plan = @plan, status = @status, expiration_date = @expiration_date,
         payment_provider = @payment_provider, updated_at = @updated_at WHERE id = @id`
      )
      .run({ ...sub, updated_at: new Date().toISOString() });
  },
};

export const subscriptionPaymentsRepository = {
  findByProviderRef(provider: string, providerPaymentId: string): Payment | undefined {
    return getDatabase()
      .prepare('SELECT * FROM subscription_payments WHERE provider = ? AND provider_payment_id = ?')
      .get(provider, providerPaymentId) as Payment | undefined;
  },
  findByProviderPaymentId(providerPaymentId: string): Payment | undefined {
    return getDatabase()
      .prepare('SELECT * FROM subscription_payments WHERE provider_payment_id = ?')
      .get(providerPaymentId) as Payment | undefined;
  },
  listByUser(userId: string): Payment[] {
    return getDatabase()
      .prepare('SELECT * FROM subscription_payments WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Payment[];
  },
  insert(payment: Payment) {
    getDatabase()
      .prepare(
        `INSERT INTO subscription_payments (id, user_id, amount_clp, currency, provider, provider_payment_id, status, plan, created_at)
         VALUES (@id, @user_id, @amount_clp, @currency, @provider, @provider_payment_id, @status, @plan, @created_at)`
      )
      .run(payment);
  },
};
