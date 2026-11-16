import { generateId } from './db.js';
import { getSqliteDb, withTransaction } from './sqlite.js';

export function expireStalePendingBookings(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const nowTime = `${values.hour}:${values.minute}`;
  const nowIso = now.toISOString();

  return withTransaction(db => {
    const staleBookings = db.prepare(`
      SELECT id, booking_date, start_time, customer_user_id
      FROM bookings
      WHERE status = 'PENDING'
        AND (booking_date < ? OR (booking_date = ? AND start_time <= ?))
    `).all(today, today, nowTime) as Array<{
      id: string;
      booking_date: string;
      start_time: string;
      customer_user_id: string | null;
    }>;
    const updateBooking = db.prepare(`
      UPDATE bookings SET status = 'EXPIRED', updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `);
    const insertHistory = db.prepare(`
      INSERT INTO booking_status_history (
        id, booking_id, from_status, to_status, changed_by_user_id, reason, created_at
      ) VALUES (?, ?, 'PENDING', 'EXPIRED', NULL, 'Expirada sin confirmación', ?)
    `);
    const insertNotification = db.prepare(`
      INSERT INTO notifications (
        id, user_id, type, title, message, is_read, entity_type, entity_id, urgency, created_at
      ) VALUES (?, ?, 'booking_expired', 'Reserva expirada', ?, 0, 'booking', ?, 'medium', ?)
    `);
    let expiredCount = 0;

    for (const booking of staleBookings) {
      const result = updateBooking.run(nowIso, booking.id);
      if (result.changes === 0) continue;
      insertHistory.run(generateId('bsh'), booking.id, nowIso);
      if (booking.customer_user_id) {
        insertNotification.run(
          generateId('notif'),
          booking.customer_user_id,
          `Tu solicitud para el ${booking.booking_date} a las ${booking.start_time} hrs no fue confirmada a tiempo y expiró.`,
          booking.id,
          nowIso
        );
      }
      expiredCount++;
    }

    return expiredCount;
  });
}
