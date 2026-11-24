import { getSqliteDb } from './sqlite.js';

export interface TimeSlot {
  time: string; // HH:MM
  endTime: string; // HH:MM
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  available: boolean;
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getPersonStaffIds(db: ReturnType<typeof getSqliteDb>, staffId: string): string[] {
  const staff = db.prepare('SELECT user_id FROM staff WHERE id = ?')
    .get(staffId) as { user_id: string | null } | undefined;
  if (!staff?.user_id) return [staffId];

  return (db.prepare('SELECT id FROM staff WHERE user_id = ? ORDER BY id')
    .all(staff.user_id) as Array<{ id: string }>).map(row => row.id);
}

function getBlockIntervalsForDate(
  db: ReturnType<typeof getSqliteDb>,
  businessId: string,
  personStaffIds: string[],
  dateStr: string,
): Array<{ start: number; end: number }> {
  const placeholders = personStaffIds.map(() => '?').join(', ');
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;
  const blocks = db.prepare(`
    SELECT start_datetime, end_datetime
    FROM availability_blocks
    WHERE (
      (staff_id IS NULL AND business_id = ?)
      OR staff_id IN (${placeholders})
    )
      AND start_datetime < ?
      AND end_datetime > ?
  `).all(businessId, ...personStaffIds, dayEnd, dayStart) as Array<{
    start_datetime: string;
    end_datetime: string;
  }>;

  return blocks.map(block => ({
    start: block.start_datetime.slice(0, 10) < dateStr
      ? 0
      : parseTimeToMinutes(block.start_datetime.slice(11, 16)),
    end: block.end_datetime.slice(0, 10) > dateStr
      ? 24 * 60
      : parseTimeToMinutes(block.end_datetime.slice(11, 16)),
  }));
}

export function getAvailableSlots(params: {
  businessId: string;
  serviceId: string;
  dateStr: string; // YYYY-MM-DD
  staffId?: string;
  excludeBookingId?: string;
}): TimeSlot[] {
  const db = getSqliteDb();
  const { businessId, serviceId, dateStr, staffId, excludeBookingId } = params;

  // 1. Get business configuration
  const business = db.prepare(`
    SELECT id, name, status, min_advance_hours, max_advance_days, buffer_minutes
    FROM businesses
    WHERE id = ? AND status = 'PUBLISHED'
  `).get(businessId) as any;

  if (!business) return [];

  // 2. Validate date range and day of week
  const [year, month, day] = dateStr.split('-').map(Number);
  const reqDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = reqDate.getUTCDay(); // 0=Sunday, 1=Monday...

  const santiagoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const todayStr = santiagoNow.toISOString().split('T')[0];
  const currentMinutesToday = santiagoNow.getHours() * 60 + santiagoNow.getMinutes();

  if (dateStr < todayStr) {
    return []; // Cannot book in the past
  }

  // 3. Get business hours for this day
  const bHours = db.prepare(`
    SELECT open_time, close_time, is_closed
    FROM business_hours
    WHERE business_id = ? AND day_of_week = ?
  `).get(businessId, dayOfWeek) as any;

  if (!bHours || bHours.is_closed) {
    return []; // Closed on this day
  }

  // 4. Get service details
  const service = db.prepare(`
    SELECT id, name, duration_minutes, prep_minutes, clean_minutes
    FROM services
    WHERE id = ? AND business_id = ? AND status = 'PUBLISHED'
  `).get(serviceId, businessId) as any;

  if (!service) return [];

  const serviceDuration = service.duration_minutes || 45;
  const prepMinutes = service.prep_minutes ?? 0;
  const cleanMinutes = service.clean_minutes ?? 5;
  const bufferMinutes = business.buffer_minutes ?? 5;
  const totalOccupiedMinutes = serviceDuration + cleanMinutes + bufferMinutes;

  // 5. Candidate staff members
  let staffList: any[] = [];
  if (staffId) {
    staffList = db.prepare(`
      SELECT s.id, s.name, ss.custom_duration_minutes
      FROM staff s
      INNER JOIN staff_services ss ON ss.staff_id = s.id
      WHERE s.id = ? AND s.business_id = ? AND ss.service_id = ? AND s.is_active = 1
    `).all(staffId, businessId, serviceId) as any[];
  } else {
    staffList = db.prepare(`
      SELECT s.id, s.name, ss.custom_duration_minutes
      FROM staff s
      INNER JOIN staff_services ss ON ss.staff_id = s.id
      WHERE s.business_id = ? AND ss.service_id = ? AND s.is_active = 1
      ORDER BY s.display_order ASC
    `).all(businessId, serviceId) as any[];
  }

  if (staffList.length === 0) return [];

  const availableSlots: TimeSlot[] = [];
  const seenTimes = new Set<string>();

  // 6. Iterate through each staff member
  for (const st of staffList) {
    const effectiveDuration = st.custom_duration_minutes || serviceDuration;

    // Staff availability for this day of week
    const stAvail = db.prepare(`
      SELECT start_time, end_time, break_start, break_end, is_active
      FROM staff_availability
      WHERE staff_id = ? AND day_of_week = ?
    `).get(st.id, dayOfWeek) as any;

    if (!stAvail || !stAvail.is_active) continue;

    // Time window boundaries (intersection of business hours and staff hours)
    const windowStart = Math.max(parseTimeToMinutes(bHours.open_time), parseTimeToMinutes(stAvail.start_time));
    const windowEnd = Math.min(parseTimeToMinutes(bHours.close_time), parseTimeToMinutes(stAvail.end_time));

    const breakStart = stAvail.break_start ? parseTimeToMinutes(stAvail.break_start) : null;
    const breakEnd = stAvail.break_end ? parseTimeToMinutes(stAvail.break_end) : null;

    const personStaffIds = getPersonStaffIds(db, st.id);
    const staffPlaceholders = personStaffIds.map(() => '?').join(', ');

    // Existing active bookings for this person on this date
    const existingBookings = db.prepare(`
      SELECT b.id, b.start_time, b.end_time, sv.clean_minutes,
             COALESCE(bz.buffer_minutes, 5) AS buffer_minutes
      FROM bookings b
      LEFT JOIN services sv ON sv.id = b.service_id
      JOIN businesses bz ON bz.id = b.business_id
      WHERE b.staff_id IN (${staffPlaceholders}) AND b.booking_date = ?
      AND b.status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')
      ${excludeBookingId ? 'AND b.id != ?' : ''}
    `).all(
      ...personStaffIds,
      dateStr,
      ...(excludeBookingId ? [excludeBookingId] : [])
    ) as Array<{
      id: string;
      start_time: string;
      end_time: string;
      clean_minutes: number | null;
      buffer_minutes: number;
    }>;

    const bookedIntervals = existingBookings.map(b => ({
      start: parseTimeToMinutes(b.start_time),
      end: parseTimeToMinutes(b.end_time) + (b.clean_minutes ?? 5) + b.buffer_minutes,
    }));

    const blockIntervals = getBlockIntervalsForDate(db, businessId, personStaffIds, dateStr);

    // Step through available time window in 15-minute increments
    const step = 15;
    for (let cur = windowStart; cur + effectiveDuration <= windowEnd; cur += step) {
      const slotEnd = cur + effectiveDuration;
      const slotFullEnd = cur + totalOccupiedMinutes;

      // If today, must satisfy min_advance_hours (default 2h)
      if (dateStr === todayStr) {
        const minAdvanceMinutes = (business.min_advance_hours || 1) * 60;
        if (cur < currentMinutesToday + minAdvanceMinutes) {
          continue;
        }
      }

      // Check break overlap
      if (breakStart !== null && breakEnd !== null) {
        if (!(slotEnd <= breakStart || cur >= breakEnd)) {
          continue; // Overlaps with staff lunch/break
        }
      }

      // Check existing bookings overlap
      let overlapsBooking = false;
      for (const b of bookedIntervals) {
        if (!(slotFullEnd <= b.start || cur >= b.end)) {
          overlapsBooking = true;
          break;
        }
      }
      if (overlapsBooking) continue;

      // Check block intervals overlap
      let overlapsBlock = false;
      for (const bl of blockIntervals) {
        if (!(slotEnd <= bl.start || cur >= bl.end)) {
          overlapsBlock = true;
          break;
        }
      }
      if (overlapsBlock) continue;

      const slotTimeStr = formatMinutesToTime(cur);
      const slotEndTimeStr = formatMinutesToTime(slotEnd);
      const slotKey = `${slotTimeStr}_${st.id}`;

      if (!seenTimes.has(slotKey)) {
        seenTimes.add(slotKey);
        availableSlots.push({
          time: slotTimeStr,
          endTime: slotEndTimeStr,
          staffId: st.id,
          staffName: st.name,
          serviceId: service.id,
          serviceName: service.name,
          durationMinutes: effectiveDuration,
          available: true,
        });
      }
    }
  }

  // Sort chronologically
  return availableSlots.sort((a, b) => a.time.localeCompare(b.time));
}

// Atomically checks if a specific slot is still available for a staff member
export function isSlotAvailable(params: {
  businessId: string;
  staffId: string;
  serviceId: string;
  dateStr: string;
  startTime: string; // HH:MM
  durationMinutes: number;
  excludeBookingId?: string;
}): boolean {
  const db = getSqliteDb();
  const { businessId, staffId, serviceId, dateStr, startTime, durationMinutes, excludeBookingId } = params;

  const startMin = parseTimeToMinutes(startTime);
  const business = db.prepare('SELECT buffer_minutes FROM businesses WHERE id = ?')
    .get(businessId) as { buffer_minutes: number | null } | undefined;
  const bufferMinutes = business?.buffer_minutes ?? 5;
  const service = db.prepare('SELECT clean_minutes FROM services WHERE id = ? AND business_id = ?')
    .get(serviceId, businessId) as { clean_minutes: number | null } | undefined;
  const serviceCleanMinutes = service?.clean_minutes ?? 5;
  const endMin = startMin + durationMinutes + serviceCleanMinutes + bufferMinutes;
  const appointmentEndMin = startMin + durationMinutes;
  const personStaffIds = getPersonStaffIds(db, staffId);
  const staffPlaceholders = personStaffIds.map(() => '?').join(', ');

  const collisions = db.prepare(`
    SELECT b.id, b.start_time, b.end_time, sv.clean_minutes,
           COALESCE(bz.buffer_minutes, 5) AS buffer_minutes
    FROM bookings b
    LEFT JOIN services sv ON sv.id = b.service_id
    JOIN businesses bz ON bz.id = b.business_id
    WHERE b.staff_id IN (${staffPlaceholders}) AND b.booking_date = ?
    AND b.status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')
    ${excludeBookingId ? 'AND b.id != ?' : ''}
  `).all(
    ...personStaffIds,
    dateStr,
    ...(excludeBookingId ? [excludeBookingId] : [])
  ) as Array<{
    id: string;
    start_time: string;
    end_time: string;
    clean_minutes: number | null;
    buffer_minutes: number;
  }>;

  for (const c of collisions) {
    const cStart = parseTimeToMinutes(c.start_time);
    const cEnd = parseTimeToMinutes(c.end_time) + (c.clean_minutes ?? 5) + c.buffer_minutes;
    if (!(endMin <= cStart || startMin >= cEnd)) {
      return false; // Collision detected!
    }
  }

  const blockIntervals = getBlockIntervalsForDate(db, businessId, personStaffIds, dateStr);
  for (const block of blockIntervals) {
    if (!(appointmentEndMin <= block.start || startMin >= block.end)) return false;
  }

  return true;
}
