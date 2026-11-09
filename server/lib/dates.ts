export const CHILE_TIMEZONE = 'America/Santiago';
const DAY_MS = 24 * 60 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

/** Fecha calendario (YYYY-MM-DD) en America/Santiago. */
export function getSantiagoDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function calculateNextDate(startDateStr: string, intervalDays: number): string {
  return new Date(toUtcMs(startDateStr) + intervalDays * DAY_MS).toISOString().split('T')[0];
}

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  return Math.round((toUtcMs(toDateStr) - toUtcMs(fromDateStr)) / DAY_MS);
}

export function getRetouchStatus(nextRetouchDateStr: string, todayStr: string) {
  const diffDays = daysBetween(todayStr, nextRetouchDateStr);
  if (diffDays < 0) return { status: 'overdue', label: 'Retoque atrasado', diffDays, urgency: 'high' };
  if (diffDays === 0) return { status: 'today', label: 'Retoque hoy', diffDays: 0, urgency: 'high' };
  if (diffDays <= 7) return { status: 'this_week', label: 'Esta semana', diffDays, urgency: 'medium' };
  return { status: 'upcoming', label: 'Próximo', diffDays, urgency: 'low' };
}
