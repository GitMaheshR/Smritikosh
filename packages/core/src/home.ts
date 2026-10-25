import type { Item } from './types';
import { groupOf, isOpenTask } from './tasks';
import { isBlankNote } from './notes';
import { isGoal } from './goals';

export interface HomeStats { open: number; dueToday: number; overdue: number }

/** The three numbers on the Home cards. */
export function homeStats(items: Item[], now: Date): HomeStats {
  const open = items.filter(isOpenTask);
  return {
    open: open.length,
    dueToday: open.filter((t) => groupOf(t, now) === 'today').length,
    overdue: open.filter((t) => groupOf(t, now) === 'overdue').length,
  };
}

const isTodayTask = (t: Item, now: Date) =>
  t.type === 'task' && !t.deleted_at && t.status !== 'cancelled' && !!t.due_at && new Date(t.due_at).toDateString() === now.toDateString();

/** "n of m complete" for tasks due today (finished ones still count, so ticking one moves the bar). */
export function todayProgress(items: Item[], now: Date): { done: number; total: number; percent: number } {
  const today = items.filter((t) => isTodayTask(t, now));
  const done = today.filter((t) => t.status === 'done').length;
  return { done, total: today.length, percent: today.length ? Math.round((done / today.length) * 100) : 0 };
}

const pri = (a: Item, b: Item) => a.priority - b.priority;

/**
 * Today's focus: open overdue tasks first, then everything due today (open ones by time, finished ones last),
 * so a task you tick stays visible, struck through.
 */
export function focusTasks(items: Item[], now: Date, limit = 8): Item[] {
  const overdue = items.filter((t) => isOpenTask(t) && groupOf(t, now) === 'overdue').sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '') || pri(a, b));
  const today = items.filter((t) => isTodayTask(t, now));
  const open = today.filter((t) => t.status !== 'done').sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '') || pri(a, b));
  const done = today.filter((t) => t.status === 'done').sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));
  return [...overdue, ...open, ...done].slice(0, limit);
}

/** Latest notes, journal entries and goals, newest first. */
export function recentlyCaptured(items: Item[], limit = 3): Item[] {
  return items
    .filter((i) => !i.deleted_at && ((i.type === 'note' && !isBlankNote(i)) || i.type === 'lesson' || isGoal(i)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}
