import type { Item, NewItem } from './types';
import { nextOccurrence } from './repeat';
import { toLocalIso } from './quickadd';

export type TaskGroupKey = 'overdue' | 'today' | 'week' | 'later' | 'none';
export const GROUP_LABELS: Record<TaskGroupKey, string> = {
  overdue: 'Overdue', today: 'Today', week: 'This week', later: 'Later', none: 'No date',
};
const ORDER: TaskGroupKey[] = ['overdue', 'today', 'week', 'later', 'none'];

export const isOpenTask = (i: Item) => i.type === 'task' && i.status !== 'done' && i.status !== 'cancelled' && !i.deleted_at;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function groupOf(item: Item, now: Date): TaskGroupKey {
  if (!item.due_at) return 'none';
  const due = new Date(item.due_at);
  const today = startOfDay(now);
  if (due < today) return 'overdue';
  if (due < addDays(today, 1)) return 'today';
  if (due < addDays(today, 8)) return 'week';
  return 'later';
}

const byDue = (a: Item, b: Item) =>
  (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || a.priority - b.priority || a.created_at.localeCompare(b.created_at);

export interface TaskFilter {
  category?: string | null;
  priority?: number | null;
  freeTime?: boolean;
}

export function filterTasks(tasks: Item[], f: TaskFilter): Item[] {
  let out = tasks.filter(isOpenTask);
  if (f.category) out = out.filter((t) => t.category === f.category);
  if (f.priority) out = out.filter((t) => t.priority === f.priority);
  if (f.freeTime) out = freeTimeTasks(out);
  return out;
}

/** Free-time tasks only, shortest estimate first (no estimate sorts last). */
export function freeTimeTasks(tasks: Item[]): Item[] {
  const est = (t: Item) => (typeof t.meta.estimateMins === 'number' ? t.meta.estimateMins : Infinity);
  return tasks
    .filter((t) => t.meta.freeTime === true)
    .sort((a, b) => (est(a) === est(b) ? 0 : est(a) < est(b) ? -1 : 1));
}

export function groupTasks(tasks: Item[], now: Date): { key: TaskGroupKey; label: string; items: Item[] }[] {
  const open = tasks.filter(isOpenTask);
  return ORDER.map((key) => ({
    key, label: GROUP_LABELS[key],
    items: open.filter((t) => groupOf(t, now) === key).sort(byDue),
  })).filter((g) => g.items.length > 0);
}

/** Shift an ISO local datetime by the same delta that moved `from` to `to`. */
function shift(iso: string | null, from: string, to: string): string | null {
  if (!iso) return null;
  const delta = new Date(to).getTime() - new Date(from).getTime();
  return toLocalIso(new Date(new Date(iso).getTime() + delta));
}

export interface CompleteResult {
  patch: Partial<Item>;
  /** Next occurrence to create for repeating tasks, or null */
  next: NewItem | null;
}

export function completeTask(task: Item, now: Date): CompleteResult {
  const patch: Partial<Item> = { status: 'done' };
  if (!task.repeat_rule || !task.due_at) return { patch, next: null };
  const due = nextOccurrence(task.due_at, task.repeat_rule, now);
  if (!due) return { patch, next: null };
  return {
    patch,
    next: {
      type: 'task', title: task.title, body: task.body, category: task.category, priority: task.priority,
      status: 'todo', due_at: due, remind_at: shift(task.remind_at, task.due_at, due), repeat_rule: task.repeat_rule,
      parent_id: task.parent_id, meta: { ...task.meta }, tags: [...task.tags],
    },
  };
}

export type SnoozeKind = 'snooze1h' | 'snoozeTomorrow';

/** Tomorrow 09:00 is in the device's local time zone (settings time zone defaults to Asia/Kolkata). */
export function snoozeTime(kind: SnoozeKind, now: Date): string {
  if (kind === 'snooze1h') return toLocalIso(new Date(now.getTime() + 3_600_000));
  return toLocalIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0));
}

export interface ReminderEntry { id: string; title: string; at: string }

/** Reminders still in the future (what the notifier must have scheduled). */
export function pendingReminders(items: Item[], now: Date): ReminderEntry[] {
  return items
    .filter((i) => isOpenTask(i) && i.remind_at && new Date(i.remind_at) > now)
    .map((i) => ({ id: i.id, title: i.title, at: i.remind_at! }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Reminders that came due while the app was closed: after `lastOpen`, up to now, task still open. */
export function missedReminders(items: Item[], now: Date, lastOpen: Date | null): Item[] {
  return items
    .filter((i) => {
      if (!isOpenTask(i) || !i.remind_at) return false;
      const r = new Date(i.remind_at);
      return r <= now && (!lastOpen || r > lastOpen);
    })
    .sort((a, b) => a.remind_at!.localeCompare(b.remind_at!));
}

/** Reminders (open tasks) from now through the next `days` days. */
export function upcomingReminders(items: Item[], now: Date, days = 7): Item[] {
  const end = addDays(startOfDay(now), days + 1);
  return items
    .filter((i) => isOpenTask(i) && i.remind_at && new Date(i.remind_at) > now && new Date(i.remind_at) < end)
    .sort((a, b) => a.remind_at!.localeCompare(b.remind_at!));
}
