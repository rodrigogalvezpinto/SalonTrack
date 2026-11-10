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

export function getAvailableSlots(params: {
  businessId: string;
  serviceId: string;
  dateStr: string; // YYYY-MM-DD
  staffId?: string;
}): TimeSlot[] {
  const db = getSqliteDb();
  const { businessId, serviceId, dateStr, staffId } = params;

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
  const prepMinutes = service.prep_minutes || 0;
  const cleanMinutes = service.clean_minutes || 5;
  const bufferMinutes = business.buffer_minutes || 5;
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

    // Existing active bookings for this staff on this date
    const existingBookings = db.prepare(`
      SELECT start_time, end_time
      FROM bookings
      WHERE staff_id = ? AND booking_date = ?
      AND status NOT IN ('CANCELLED', 'REJECTED')
    `).all(st.id, dateStr) as Array<{ start_time: string; end_time: string }>;

    const bookedIntervals = existingBookings.map(b => ({
      start: parseTimeToMinutes(b.start_time),
      end: parseTimeToMinutes(b.end_time) + bufferMinutes,
    }));

    // Availability blocks (vacations, absences, locks)
    const blocks = db.prepare(`
      SELECT start_datetime, end_datetime
      FROM availability_blocks
      WHERE (staff_id = ? OR staff_id IS NULL)
      AND business_id = ?
      AND (start_datetime LIKE ? OR end_datetime LIKE ?)
    `).all(st.id, businessId, `${dateStr}%`, `${dateStr}%`) as any[];

    const blockIntervals = blocks.map(bl => {
      const bStartTime = bl.start_datetime.includes('T') ? bl.start_datetime.split('T')[1].substring(0, 5) : '00:00';
      const bEndTime = bl.end_datetime.includes('T') ? bl.end_datetime.split('T')[1].substring(0, 5) : '23:59';
      return {
        start: parseTimeToMinutes(bStartTime),
        end: parseTimeToMinutes(bEndTime),
      };
    });

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
}): boolean {
  const db = getSqliteDb();
  const { staffId, dateStr, startTime, durationMinutes } = params;

  const startMin = parseTimeToMinutes(startTime);
  const endMin = startMin + durationMinutes;

  const collisions = db.prepare(`
    SELECT id, start_time, end_time
    FROM bookings
    WHERE staff_id = ? AND booking_date = ?
    AND status NOT IN ('CANCELLED', 'REJECTED')
  `).all(staffId, dateStr) as Array<{ id: string; start_time: string; end_time: string }>;

  for (const c of collisions) {
    const cStart = parseTimeToMinutes(c.start_time);
    const cEnd = parseTimeToMinutes(c.end_time);
    if (!(endMin <= cStart || startMin >= cEnd)) {
      return false; // Collision detected!
    }
  }

  return true;
}
