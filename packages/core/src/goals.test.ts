import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';
import {
  daysUntil, goalProgress, goalStatus, isGoal, isMilestone, milestonesOf, nextMilestone, nextMilestoneOrder, progressText,
  sortedGoals, targetLabel,
} from './goals';
import { focusTasks, homeStats, recentlyCaptured, todayProgress } from './home';
import type { Item } from './types';

// Thursday 22 Oct 2026, 10:00
const NOW = new Date(2026, 9, 22, 10, 0);

async function setup() {
  const s = new MemoryStore();
  const goal = (title: string, o: Partial<Item> = {}) => s.createItem({ type: 'goal', title, status: 'active', ...o });
  const ms = (parent: Item, title: string, order: number, done = false) =>
    s.createItem({ type: 'goal', title, parent_id: parent.id, status: done ? 'done' : 'todo', meta: { milestone: true, order } });
  return { s, goal, ms, items: () => s.listItems({ includeDeleted: true }) };
}

describe('goals', () => {
  it('goals and milestones are told apart', async () => {
    const t = await setup();
    const g = await t.goal('Learn');
    const m = await t.ms(g, 'Step one', 0);
    expect(isGoal(g)).toBe(true);
    expect(isGoal(m)).toBe(false);
    expect(isMilestone(m)).toBe(true);
    expect(sortedGoals(await t.items()).map((x) => x.title)).toEqual(['Learn']);
  });

  it('progress is done milestones over all milestones, rounded', async () => {
    const t = await setup();
    const g = await t.goal('Docs');
    await t.ms(g, 'a', 0, true);
    await t.ms(g, 'b', 1, true);
    await t.ms(g, 'c', 2);
    const items = await t.items();
    expect(goalProgress(items, g)).toEqual({ done: 2, total: 3, percent: 67 });
    expect(progressText(goalProgress(items, g))).toBe('2 of 3 milestones done');
  });

  it('no milestones is 0%; a goal marked done is 100% regardless', async () => {
    const t = await setup();
    const g = await t.goal('Empty');
    expect(goalProgress(await t.items(), g)).toEqual({ done: 0, total: 0, percent: 0 });
    expect(progressText({ done: 0, total: 0, percent: 0 })).toBe('No milestones yet');
    const d = await t.s.updateItem(g.id, { status: 'done' });
    expect(goalProgress(await t.items(), d).percent).toBe(100);
  });

  it('trashed milestones do not count; order is kept; next milestone is the first not done', async () => {
    const t = await setup();
    const g = await t.goal('G');
    const a = await t.ms(g, 'a', 0, true);
    const b = await t.ms(g, 'b', 1);
    const c = await t.ms(g, 'c', 2);
    await t.s.deleteItem(c.id);
    const items = await t.items();
    expect(milestonesOf(items, g.id).map((m) => m.title)).toEqual(['a', 'b']);
    expect(goalProgress(items, g).total).toBe(2);
    expect(nextMilestone(items, g)?.id).toBe(b.id);
    expect(nextMilestoneOrder(items, g.id)).toBe(2);
    await t.s.updateItem(b.id, { status: 'done' });
    expect(nextMilestone(await t.items(), g)).toBeNull();
    void a;
  });

  it('sorts active first by target date, then paused, then done', async () => {
    const t = await setup();
    await t.goal('done one', { status: 'done', due_at: '2026-01-01' });
    await t.goal('paused', { status: 'paused' });
    await t.goal('later', { due_at: '2027-01-01' });
    await t.goal('soon', { due_at: '2026-11-01' });
    await t.goal('no date');
    expect(sortedGoals(await t.items()).map((g) => g.title)).toEqual(['soon', 'later', 'no date', 'paused', 'done one']);
    expect(goalStatus({ status: 'whatever' } as Item)).toBe('active');
  });

  it('target date labels', () => {
    expect(daysUntil('2026-10-22', NOW)).toBe(0);
    expect(daysUntil('2026-10-25', NOW)).toBe(3);
    expect(daysUntil('2026-10-20', NOW)).toBe(-2);
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil('nonsense', NOW)).toBeNull();
    expect(targetLabel('2026-10-22', NOW)).toBe('Target today');
    expect(targetLabel('2026-10-23', NOW)).toBe('1 day left');
    expect(targetLabel('2026-11-01', NOW)).toBe('10 days left');
    expect(targetLabel('2026-10-21', NOW)).toBe('1 day past target');
    expect(targetLabel('2026-10-10', NOW)).toBe('12 days past target');
  });
});

describe('home helpers', () => {
  const task = (o: Partial<Item>): Item => ({
    id: Math.random().toString(36), type: 'task', title: 't', body: null, category: null, priority: 2, status: 'todo',
    due_at: null, remind_at: null, repeat_rule: null, parent_id: null, meta: {}, pinned: false, archived: false,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null, tags: [], ...o,
  });
  const items = [
    task({ title: 'overdue', due_at: '2026-10-20T09:00' }),
    task({ title: 'today late', due_at: '2026-10-22T21:00', priority: 3 }),
    task({ title: 'today early', due_at: '2026-10-22T09:00', priority: 1 }),
    task({ title: 'today done', due_at: '2026-10-22T08:00', status: 'done' }),
    task({ title: 'tomorrow', due_at: '2026-10-23T09:00' }),
    task({ title: 'no date' }),
    task({ title: 'cancelled today', due_at: '2026-10-22T09:00', status: 'cancelled' }),
    task({ title: 'trashed', due_at: '2026-10-22T09:00', deleted_at: '2026-10-21T00:00:00Z' }),
  ];

  it('stats: open, due today, overdue', () => {
    expect(homeStats(items, NOW)).toEqual({ open: 5, dueToday: 2, overdue: 1 });
    expect(homeStats([], NOW)).toEqual({ open: 0, dueToday: 0, overdue: 0 });
  });

  it('today progress counts finished tasks, ignores cancelled and trashed', () => {
    expect(todayProgress(items, NOW)).toEqual({ done: 1, total: 3, percent: 33 });
    expect(todayProgress([], NOW)).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("today's focus: overdue, then today by time, finished last", () => {
    expect(focusTasks(items, NOW).map((t) => t.title)).toEqual(['overdue', 'today early', 'today late', 'today done']);
    expect(focusTasks(items, NOW, 2).map((t) => t.title)).toEqual(['overdue', 'today early']);
  });

  it('recently captured: newest notes, journal entries and goals; no blanks, milestones or trash', async () => {
    const s = new MemoryStore();
    const n1 = await s.createItem({ type: 'note', title: 'a', body: '# a' });
    await s.createItem({ type: 'note', title: 'blank', body: '' });
    const l = await s.createItem({ type: 'lesson', title: 'l' });
    const g = await s.createItem({ type: 'goal', title: 'g' });
    await s.createItem({ type: 'goal', title: 'ms', parent_id: g.id, meta: { milestone: true } });
    const gone = await s.createItem({ type: 'note', title: 'gone', body: '# gone' });
    await s.deleteItem(gone.id);
    await s.createItem({ type: 'task', title: 'a task' });
    await s.updateItem(n1.id, { body: '# a2' }); // most recently touched
    const all = await s.listItems();
    const r = recentlyCaptured(all, 5);
    expect(r.map((i) => i.title).sort()).toEqual(['a', 'g', 'l']);
    expect(r[0]!.id).toBe(n1.id);
    expect(recentlyCaptured(all, 2)).toHaveLength(2);
    void l;
  });
});
