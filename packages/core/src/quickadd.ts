import type { ItemType } from './types';

export interface ParsedQuickAdd {
  type: ItemType;
  title: string;
  due_at: string | null;
  category: string | null;
  priority: number;
  tags: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO 8601 local datetime without zone, e.g. 2026-10-22T18:00 */
export const toLocalIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TYPE_PREFIX: Record<string, ItemType> = {
  task: 'task', note: 'note', lesson: 'lesson', wish: 'wish', stock: 'stock', goal: 'goal', weekend: 'weekend',
};
const PRIORITY: Record<string, number> = { high: 1, h: 1, medium: 2, med: 2, m: 2, low: 3, l: 3 };

/**
 * Smart one-line parser: "pay LIC premium tomorrow 6pm #bank !high"
 * -> task, due tomorrow 18:00, category bank, priority 1.
 * #word matches a known category (case-insensitive) else becomes a tag.
 */
export function parseQuickAdd(input: string, now: Date = new Date(), categories: string[] = []): ParsedQuickAdd {
  let text = input.trim();
  let type: ItemType = 'task';

  const prefix = /^(task|note|lesson|wish|stock|goal|weekend)\s*:\s*/i.exec(text);
  if (prefix) {
    type = TYPE_PREFIX[prefix[1]!.toLowerCase()]!;
    text = text.slice(prefix[0].length);
  }

  let priority = 2;
  text = text.replace(/(^|\s)!(\w+)/g, (m, sp: string, w: string) => {
    const p = PRIORITY[w.toLowerCase()];
    if (p === undefined) return m;
    priority = p;
    return sp;
  });

  let category: string | null = null;
  // The app has no tags: #word is a category only when it names one, otherwise it stays in the text.
  const tags: string[] = [];
  const catMap = new Map(categories.map((c) => [c.toLowerCase(), c]));
  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (m, sp: string, w: string) => {
    const cat = catMap.get(w.toLowerCase());
    if (!cat || category) return m;
    category = cat;
    return sp;
  });

  // Time: 6pm, 6:30pm, 18:00
  let hh: number | null = null;
  let mm = 0;
  text = text.replace(/(^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$)/i, (_m, sp: string, h: string, m: string | undefined, ap: string) => {
    let hour = Number(h) % 12;
    if (ap.toLowerCase() === 'pm') hour += 12;
    hh = hour;
    mm = m ? Number(m) : 0;
    return sp;
  });
  if (hh === null) {
    text = text.replace(/(^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/, (_m, sp: string, h: string, m: string) => {
      hh = Number(h);
      mm = Number(m);
      return sp;
    });
  }

  // Date words
  let date: Date | null = null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  text = text.replace(/(^|\s)(today|tomorrow|tmrw|tonight|in\s+(\d+)\s+days?|next\s+week|(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday))(?=\s|$)/i,
    (_m, sp: string, word: string, n: string | undefined, wd: string | undefined) => {
      const w = word.toLowerCase();
      if (w === 'today' || w === 'tonight') date = addDays(0);
      else if (w === 'tomorrow' || w === 'tmrw') date = addDays(1);
      else if (n) date = addDays(Number(n));
      else if (w === 'next week') date = addDays(7);
      else if (wd) {
        const target = WEEKDAYS.indexOf(wd.toLowerCase());
        let diff = (target - base.getDay() + 7) % 7;
        if (diff === 0 || w.startsWith('next')) diff = diff === 0 ? 7 : diff;
        date = addDays(diff);
      }
      if (w === 'tonight' && hh === null) { hh = 20; mm = 0; }
      return sp;
    });

  let due: Date | null = date;
  if (!due && hh !== null) {
    // time only: today if still ahead, else tomorrow
    const t = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm);
    due = t > now ? base : addDays(1);
  }
  let due_at: string | null = null;
  if (due) {
    const d = due as Date;
    due_at = toLocalIso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh ?? 9, hh === null ? 0 : mm));
  }

  const title = text.replace(/\s+/g, ' ').trim();
  return { type, title: title || input.trim(), due_at, category, priority, tags };
}
