import { generateId } from './db.js';
import { emailProvider } from './adapters/email.js';
import { createNotification } from './notifications.js';
import { getSqliteDb, withTransaction } from './sqlite.js';
import { isBillingEnabled } from './billing.js';

type TrialNotice = {
  kind: 'trial_ending_7d' | 'trial_ended';
  title: string;
  message: string;
  urgency: 'high' | 'medium';
};

type TrialSubscription = {
  id: string;
  user_id: string;
  email: string;
  expiration_date: string;
};

function getTrialNotice(expirationDate: string, now: Date): TrialNotice | null {
  const expirationTime = Date.parse(expirationDate);
  if (expirationTime <= now.getTime()) {
    return {
      kind: 'trial_ended',
      title: 'Tu oferta de lanzamiento terminó',
      message: 'Tu oferta de lanzamiento terminó. Ahora es momento de elegir un plan en Configuración para seguir editando.',
      urgency: 'high',
    };
  }

  const daysRemaining = Math.ceil((expirationTime - now.getTime()) / 86_400_000);
  if (daysRemaining <= 7) {
    const endingCopy = daysRemaining === 1 ? 'termina mañana' : `termina en ${daysRemaining} días`;
    return {
      kind: 'trial_ending_7d',
      title: `Tu oferta de lanzamiento ${endingCopy}`,
      message: `Tu oferta de lanzamiento ${endingCopy}. Elige un plan en Configuración para seguir usando SalonTrack sin interrupciones.`,
      urgency: 'medium',
    };
  }

  return null;
}

export async function processTrialNotices(now = new Date()): Promise<number> {
  if (!isBillingEnabled()) return 0;

  let subscriptions: TrialSubscription[];
  try {
    subscriptions = getSqliteDb().prepare(`
      SELECT s.id, s.user_id, u.email, s.expiration_date
      FROM subscriptions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.status = 'trial'
        AND s.id = (
          SELECT latest.id
          FROM subscriptions latest
          WHERE latest.user_id = s.user_id
          ORDER BY latest.created_at DESC, latest.rowid DESC
          LIMIT 1
        )
    `).all() as TrialSubscription[];
  } catch (error) {
    console.error('[Trial notices] No se pudieron consultar las suscripciones:', error);
    return 0;
  }

  let sentCount = 0;
  for (const subscription of subscriptions) {
    const notice = getTrialNotice(subscription.expiration_date, now);
    if (!notice) continue;

    try {
      const inserted = withTransaction(db => {
        const result = db.prepare(`
          INSERT OR IGNORE INTO subscription_notices (id, subscription_id, kind, sent_at)
          VALUES (?, ?, ?, ?)
        `).run(generateId('notice'), subscription.id, notice.kind, now.toISOString());
        if (result.changes === 0) return false;

        createNotification(
          subscription.user_id,
          notice.kind,
          notice.title,
          notice.message,
          'subscription',
          subscription.id,
          notice.urgency,
          now.toISOString(),
        );
        return true;
      });
      if (inserted) sentCount++;

      const noticeRecord = getSqliteDb().prepare(`
        SELECT email_sent_at FROM subscription_notices
        WHERE subscription_id = ? AND kind = ?
      `).get(subscription.id, notice.kind) as { email_sent_at: string | null } | undefined;
      if (!noticeRecord || noticeRecord.email_sent_at !== null) continue;

      const html = `<p>${notice.message}</p>`;
      const emailResult = await emailProvider.send(subscription.email, notice.title, html, notice.message);
      if (!emailResult.success) {
        console.error('[Trial notices] El adaptador no confirmó el envío del correo:', subscription.id, notice.kind);
        continue;
      }
      getSqliteDb().prepare(`
        UPDATE subscription_notices SET email_sent_at = ?
        WHERE subscription_id = ? AND kind = ? AND email_sent_at IS NULL
      `).run(now.toISOString(), subscription.id, notice.kind);
    } catch (error) {
      console.error('[Trial notices] No se pudo enviar un aviso de suscripción:', error);
    }
  }

  return sentCount;
}
