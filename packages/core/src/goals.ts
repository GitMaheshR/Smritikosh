import type { Item } from './types';

export type GoalStatus = 'active' | 'paused' | 'done';

/** A milestone is a child item of a goal (type 'goal', meta.milestone = true). */
export const isMilestone = (i: Item) => i.type === 'goal' && i.meta.milestone === true;
export const isGoal = (i: Item) => i.type === 'goal' && !i.deleted_at && !isMilestone(i);

export const goalStatus = (g: Item): GoalStatus => (g.status === 'done' || g.status === 'paused' ? g.status : 'active');

const order = (i: Item) => (typeof i.meta.order === 'number' ? i.meta.order : 0);

/** Live milestones of a goal, in the order they were added. */
export function milestonesOf(items: Item[], goalId: string): Item[] {
  return items
    .filter((i) => isMilestone(i) && !i.deleted_at && i.parent_id === goalId)
    .sort((a, b) => order(a) - order(b) || a.created_at.localeCompare(b.created_at));
}

/** The `order` value for a milestone appended to the end of a goal. */
export const nextMilestoneOrder = (items: Item[], goalId: string) =>
  milestonesOf(items, goalId).reduce((m, i) => Math.max(m, order(i) + 1), 0);

export interface GoalProgress { done: number; total: number; percent: number }

/** Progress = done milestones / all milestones. A goal marked done always reads 100%. */
export function goalProgress(items: Item[], goal: Item): GoalProgress {
  const ms = milestonesOf(items, goal.id);
  const done = ms.filter((m) => m.status === 'done').length;
  const percent = goalStatus(goal) === 'done' ? 100 : ms.length ? Math.round((done / ms.length) * 100) : 0;
  return { done, total: ms.length, percent };
}

export const progressText = (p: GoalProgress) => (p.total === 0 ? 'No milestones yet' : `${p.done} of ${p.total} milestones done`);

export const nextMilestone = (items: Item[], goal: Item): Item | null =>
  milestonesOf(items, goal.id).find((m) => m.status !== 'done') ?? null;

const rank: Record<GoalStatus, number> = { active: 0, paused: 1, done: 2 };

/** Goals for the list: active first (soonest target date first), then paused, then done. */
export function sortedGoals(items: Item[]): Item[] {
  return items
    .filter(isGoal)
    .sort((a, b) => rank[goalStatus(a)] - rank[goalStatus(b)] || (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || a.created_at.localeCompare(b.created_at));
}

/** Whole days from today to a target date (negative = past). Null when there is no target. */
export function daysUntil(due: string | null, now: Date): number | null {
  if (!due) return null;
  const d = new Date(due.length <= 10 ? `${due}T00:00` : due);
  if (Number.isNaN(d.getTime())) return null;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function targetLabel(due: string | null, now: Date): string | null {
  const n = daysUntil(due, now);
  if (n === null) return null;
  if (n === 0) return 'Target today';
  if (n === 1) return '1 day left';
  if (n > 1) return `${n} days left`;
  return `${-n} day${n === -1 ? '' : 's'} past target`;
}
