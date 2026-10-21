import { toLocalIso } from './quickadd';

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export interface RRule {
  freq: Freq;
  interval: number;
  byDay: number[]; // 0 = Sunday
  byMonthDay: number | null;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Parses the RRULE subset we support, e.g. "FREQ=MONTHLY;BYMONTHDAY=5". Returns null if invalid. */
export function parseRRule(rule: string | null | undefined): RRule | null {
  if (!rule) return null;
  const parts = new Map(rule.replace(/^RRULE:/i, '').split(';').map((p) => p.split('=') as [string, string]));
  const freq = parts.get('FREQ')?.toUpperCase() as Freq | undefined;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
  const interval = Math.max(1, Number(parts.get('INTERVAL') ?? 1) || 1);
  const byDay = (parts.get('BYDAY') ?? '').split(',').filter(Boolean).map((d) => DAYS.indexOf(d.toUpperCase())).filter((i) => i >= 0).sort();
  const bmd = parts.get('BYMONTHDAY');
  return { freq, interval, byDay, byMonthDay: bmd ? Number(bmd) : null };
}

export function formatRRule(r: RRule): string {
  const p = [`FREQ=${r.freq}`];
  if (r.interval > 1) p.push(`INTERVAL=${r.interval}`);
  if (r.byDay.length) p.push(`BYDAY=${r.byDay.map((d) => DAYS[d]).join(',')}`);
  if (r.byMonthDay) p.push(`BYMONTHDAY=${r.byMonthDay}`);
  return p.join(';');
}

const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function step(d: Date, r: RRule): Date {
  const h = d.getHours();
  const mi = d.getMinutes();
  switch (r.freq) {
    case 'DAILY':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + r.interval, h, mi);
    case 'WEEKLY': {
      if (r.byDay.length === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * r.interval, h, mi);
      const later = r.byDay.find((x) => x > d.getDay());
      if (later !== undefined) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (later - d.getDay()), h, mi);
      // wrap to the first BYDAY of the week `interval` weeks ahead (weeks start Sunday)
      const first = r.byDay[0]!;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 7 * r.interval + first, h, mi);
    }
    case 'MONTHLY': {
      const m = d.getMonth() + r.interval;
      const y = d.getFullYear() + Math.floor(m / 12);
      const mm = ((m % 12) + 12) % 12;
      const want = r.byMonthDay ?? d.getDate();
      return new Date(y, mm, Math.min(want, daysIn(y, mm)), h, mi);
    }
    case 'YEARLY': {
      const y = d.getFullYear() + r.interval;
      return new Date(y, d.getMonth(), Math.min(d.getDate(), daysIn(y, d.getMonth())), h, mi);
    }
  }
}

/**
 * Next occurrence strictly after `due` and, when `after` is given, strictly after that moment too
 * (so completing a long-overdue bill schedules the next *future* date).
 */
export function nextOccurrence(due: string, rule: string, after?: Date): string | null {
  const r = parseRRule(rule);
  if (!r) return null;
  let d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  for (let i = 0; i < 1000; i++) {
    d = step(d, r);
    if (!after || d > after) return toLocalIso(d);
  }
  return null;
}
