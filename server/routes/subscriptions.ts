import crypto from 'node:crypto';
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth.js';
import { generateId, transaction, type Payment, type Subscription } from '../db.js';
import { subscriptionsRepository, subscriptionPaymentsRepository } from '../repositories/subscriptions.js';
import { usersRepository } from '../repositories/users.js';
import { profilesRepository } from '../repositories/profiles.js';
import { getPaymentProvider } from '../providers/index.js';
import { asyncHandler, badRequest, conflict, forbidden } from '../lib/errors.js';
import { optionalString } from '../lib/validation.js';
import { recordAudit } from '../lib/audit.js';
import { withSubscriptionStatus } from './helpers.js';

const router = Router();

export const PLANS: Record<string, { name: string; price_clp: number; duration_days: number; description: string }> = {
  basic_monthly: {
    name: 'Plan Mensual Estilista',
    price_clp: 9990,
    duration_days: 30,
    description: 'Acceso completo a SalonTrack por 1 mes para estilistas independientes.',
  },
  pro_quarterly: {
    name: 'Plan Trimestral Pro (Recomendado)',
    price_clp: 14990,
    duration_days: 90,
    description: 'Acceso por 3 meses con 50% de ahorro equivalente por mes.',
  },
  annual: {
    name: 'Plan Semestral / Anual Fundador',
    price_clp: 19990,
    duration_days: 180,
    description: 'Acceso por 6 meses para salones en crecimiento y estilistas de alto volumen.',
  },
};

function getPlan(planId: unknown) {
  return typeof planId === 'string' && Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : undefined;
}

router.get('/subscriptions/plans', (req, res) => {
  res.json({ plans: PLANS, currency: 'CLP', tax_info: 'Precios expresados en Pesos Chilenos (CLP). Sujeto a comprobante digital.' });
});

router.get('/subscriptions/current', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  let sub = subscriptionsRepository.findByUserId(userId);
  if (!sub) {
    const now = new Date();
    const trialExpire = new Date(now);
    trialExpire.setDate(trialExpire.getDate() + 14);
    sub = {
      id: generateId('sub'),
      user_id: userId,
      plan: 'pro_quarterly',
      status: 'trial',
      start_date: now.toISOString(),
      expiration_date: trialExpire.toISOString(),
      payment_provider: 'local',
      created_at: now.toISOString(),
    };
    subscriptionsRepository.insert(sub);
  }

  return res.json({
    subscription: withSubscriptionStatus(sub),
    payments: subscriptionPaymentsRepository.listByUser(userId),
  });
});

router.post(
  '/payments/create-preference',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { plan_id } = req.body ?? {};
    const plan = getPlan(plan_id);
    if (!plan) throw badRequest('Plan seleccionado inválido.');

    const provider = getPaymentProvider();
    const user = usersRepository.findById(userId);
    const profile = profilesRepository.findByUserId(userId);
    const session = await provider.createCheckout({
      userId,
      planId: plan_id,
      title: `SalonTrack Chile - ${plan.name}`,
      description: plan.description,
      amountClp: plan.price_clp,
      payerEmail: user?.email,
      payerName: profile?.full_name,
      payerPhone: profile?.phone,
    });

    if (session.initPoint) {
      return res.json({
        preference_id: session.preferenceId,
        init_point: session.initPoint,
        sandbox_init_point: session.sandboxInitPoint,
        mode: 'mercadopago_live',
      });
    }

    return res.json({
      preference_id: session.preferenceId,
      plan_id,
      plan,
      mode: 'local_simulation',
      checkout_url: `/?checkout_modal=1&plan=${plan_id}&ref=${session.preferenceId}`,
      instructions: 'Checkout local simulado: no se realiza ningún cobro real. Confirma el pago para activar la licencia de prueba.',
    });
  })
);

router.post('/payments/webhook', (req, res) => {
  const { action, type, data } = req.body ?? {};
  const paymentId = data?.id || req.query['data.id'] || req.body?.id;
  console.log('[Mercado Pago Webhook Received]:', { action, type, paymentId });

  if (!paymentId) return res.status(200).send('Ignored: missing payment ID');
  if (subscriptionPaymentsRepository.findByProviderPaymentId(String(paymentId))) {
    return res.status(200).send('Already processed (Idempotent)');
  }
  // La verificación contra la API de Mercado Pago se implementará al activar el adaptador real (Fase 7/10).
  return res.status(200).send('Webhook received');
});

router.post('/subscriptions/activate-license', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { plan_id, payment_ref } = req.body ?? {};
  const provider = getPaymentProvider();
  if (!provider.allowsClientConfirmation) {
    throw forbidden('La activación directa solo está disponible con el proveedor de pagos local. Los pagos reales se confirman por webhook.');
  }
  const plan = getPlan(plan_id);
  if (!plan) throw badRequest('Plan seleccionado no existe.');
  const providerPaymentId = optionalString(payment_ref, 'payment_ref', 120) || `LOCAL_${crypto.randomUUID()}`;

  const result = transaction(() => {
    const existingPayment = subscriptionPaymentsRepository.findByProviderRef(provider.name, providerPaymentId);
    if (existingPayment) {
      if (existingPayment.user_id !== userId) throw conflict('La referencia de pago ya pertenece a otra operación.');
      return { duplicated: true as const, payment: existingPayment };
    }

    const now = new Date();
    const newPayment: Payment = {
      id: generateId('pay'),
      user_id: userId,
      amount_clp: plan.price_clp,
      currency: 'CLP',
      provider: provider.name,
      provider_payment_id: providerPaymentId,
      status: 'approved',
      plan: plan_id,
      created_at: now.toISOString(),
    };
    subscriptionPaymentsRepository.insert(newPayment);

    let sub = subscriptionsRepository.findByUserId(userId);
    const currentExp = sub ? new Date(sub.expiration_date) : now;
    const baseDate = new Date(currentExp.getTime() > now.getTime() ? currentExp : now);
    baseDate.setDate(baseDate.getDate() + plan.duration_days);

    if (sub) {
      sub = { ...sub, plan: plan_id, status: 'active', expiration_date: baseDate.toISOString(), payment_provider: provider.name as Subscription['payment_provider'] };
      subscriptionsRepository.update(sub);
    } else {
      sub = {
        id: generateId('sub'),
        user_id: userId,
        plan: plan_id,
        status: 'active',
        start_date: now.toISOString(),
        expiration_date: baseDate.toISOString(),
        payment_provider: provider.name as Subscription['payment_provider'],
        created_at: now.toISOString(),
      };
      subscriptionsRepository.insert(sub);
    }
    recordAudit({ userId, action: 'subscription.activated', entityType: 'subscription', entityId: sub.id, metadata: { plan: plan_id, payment_id: newPayment.id } });
    return { duplicated: false as const, payment: newPayment, subscription: sub, expiresAt: baseDate };
  });

  if (result.duplicated) return res.json({ message: 'Este pago ya fue procesado.', payment: result.payment });
  return res.json({
    message: `¡Licencia activada con éxito! Acceso habilitado hasta el ${result.expiresAt.toLocaleDateString('es-CL')}.`,
    subscription: withSubscriptionStatus(result.subscription),
    payment: result.payment,
  });
});

export default router;
