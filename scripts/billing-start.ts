import { pathToFileURL } from 'node:url';
import { BILLING_GRACE_DAYS } from '../server/billing.js';
import { closeSqliteDb, withTransaction } from '../server/sqlite.js';

export function extendTrialsForBillingStart(now = new Date()): number {
  const graceExpiration = new Date(now);
  graceExpiration.setDate(graceExpiration.getDate() + BILLING_GRACE_DAYS);
  const expirationDate = graceExpiration.toISOString();

  return withTransaction(db => Number(db.prepare(`
    UPDATE subscriptions
    SET expiration_date = ?
    WHERE status = 'trial' AND expiration_date < ?
  `).run(expirationDate, expirationDate).changes));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const updatedCount = extendTrialsForBillingStart();
    console.log(`Se ampliaron ${updatedCount} períodos de prueba hasta la fecha de gracia.`);
  } catch (error) {
    console.error('No se pudieron ampliar los períodos de prueba:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    closeSqliteDb();
  }
}
