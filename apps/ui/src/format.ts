const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function dayName(d: Date, now: Date): string {
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

/** "Today, 5:00 PM", "Tomorrow", "Oct 25, 6:00 PM". Accepts local ISO ("2026-10-22T17:00") or a date ("2026-10-22"). */
export function whenLabel(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const hasTime = iso.length > 10;
  const d = new Date(hasTime ? iso : `${iso}T00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return hasTime ? `${dayName(d, now)}, ${time(d)}` : dayName(d, now);
}

/** "Today", "Yesterday", "Oct 20" for a stored (UTC ISO) timestamp such as updated_at. */
export function updatedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dayName(d, now);
}

/** "today", "yesterday" or "Oct 20" for "Updated …" lines (only the two relative words are lowercase). */
export function updatedPhrase(iso: string, now: Date = new Date()): string {
  const l = updatedLabel(iso, now);
  return l === 'Today' || l === 'Yesterday' ? l.toLowerCase() : l;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Thursday · Oct 22" style line for the Home header. */
export function todayLine(now: Date = new Date()): { weekday: string; date: string } {
  return {
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    date: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}
