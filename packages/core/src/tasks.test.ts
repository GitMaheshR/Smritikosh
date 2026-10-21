import { describe, expect, it } from 'vitest';
import { formatRRule, nextOccurrence, parseRRule } from './repeat';
import {
  completeTask, filterTasks, freeTimeTasks, groupTasks, missedReminders, pendingReminders, snoozeTime, upcomingReminders,
} from './tasks';
import type { Item } from './types';
import { MemoryStore } from './memory-store';

// Thursday 22 Oct 2026, 10:00
const NOW = new Date(2026, 9, 22, 10, 0);

const task = (o: Partial<Item> = {}): Item => ({
  id: Math.random().toString(36), type: 'task', title: 't', body: null, category: null, priority: 2, status: 'todo',
  due_at: null, remind_at: null, repeat_rule: null, parent_id: null, meta: {}, pinned: false, archived: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '', deleted_at: null, tags: [], ...o,
});

describe('RRULE', () => {
  it('parses and formats', () => {
    const r = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR')!;
    expect(r).toMatchObject({ freq: 'WEEKLY', interval: 2, byDay: [1, 5] });
    expect(formatRRule(r)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR');
    expect(parseRRule('nonsense')).toBeNull();
    expect(parseRRule('FREQ=HOURLY')).toBeNull();
  });
  it('daily and plain weekly', () => {
    expect(nextOccurrence('2026-10-22T09:00', 'FREQ=DAILY')).toBe('2026-10-23T09:00');
    expect(nextOccurrence('2026-10-22T09:00', 'FREQ=DAILY;INTERVAL=3')).toBe('2026-10-25T09:00');
    expect(nextOccurrence('2026-10-22T09:00', 'FREQ=WEEKLY')).toBe('2026-10-29T09:00');
  });
  it('weekly BYDAY within and across weeks', () => {
    // Thu 22 -> next of MO,FR is Fri 23
    expect(nextOccurrence('2026-10-22T09:00', 'FREQ=WEEKLY;BYDAY=MO,FR')).toBe('2026-10-23T09:00');
    // Fri 23 -> Mon 26
    expect(nextOccurrence('2026-10-23T09:00', 'FREQ=WEEKLY;BYDAY=MO,FR')).toBe('2026-10-26T09:00');
    // every 2 weeks: Fri 23 -> Mon 2 Nov
    expect(nextOccurrence('2026-10-23T09:00', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR')).toBe('2026-11-02T09:00');
  });
  it('monthly clamps month ends and honours BYMONTHDAY', () => {
    expect(nextOccurrence('2026-01-31T09:00', 'FREQ=MONTHLY')).toBe('2026-02-28T09:00');
    expect(nextOccurrence('2026-01-31T09:00', 'FREQ=MONTHLY;BYMONTHDAY=31')).toBe('2026-02-28T09:00');
    expect(nextOccurrence('2026-10-05T18:00', 'FREQ=MONTHLY;BYMONTHDAY=5')).toBe('2026-11-05T18:00');
    expect(nextOccurrence('2026-12-15T09:00', 'FREQ=MONTHLY')).toBe('2027-01-15T09:00');
  });
  it('yearly handles leap day', () => {
    expect(nextOccurrence('2028-02-29T09:00', 'FREQ=YEARLY')).toBe('2029-02-28T09:00');
  });
  it('skips to a future date when long overdue', () => {
    expect(nextOccurrence('2026-07-05T18:00', 'FREQ=MONTHLY;BYMONTHDAY=5', NOW)).toBe('2026-11-05T18:00');
  });
  it('invalid rule or date returns null', () => {
    expect(nextOccurrence('2026-10-22T09:00', 'bad')).toBeNull();
    expect(nextOccurrence('garbage', 'FREQ=DAILY')).toBeNull();
  });
});

describe('grouping', () => {
  it('splits at day boundaries and drops done/cancelled/no-op', () => {
    const items = [
      task({ title: 'old', due_at: '2026-10-21T23:59' }),
      task({ title: 'earlier today', due_at: '2026-10-22T00:00' }),
      task({ title: 'tonight', due_at: '2026-10-22T23:59' }),
      task({ title: 'tomorrow', due_at: '2026-10-23T00:00' }),
      task({ title: 'day 7', due_at: '2026-10-29T12:00' }),
      task({ title: 'day 8', due_at: '2026-10-30T12:00' }),
      task({ title: 'nodate' }),
      task({ title: 'done', due_at: '2026-10-22T12:00', status: 'done' }),
      task({ title: 'cancelled', due_at: '2026-10-22T12:00', status: 'cancelled' }),
      task({ title: 'note', type: 'note', due_at: '2026-10-22T12:00' }),
    ];
    const g = Object.fromEntries(groupTasks(items, NOW).map((x) => [x.key, x.items.map((i) => i.title)]));
    expect(g).toEqual({
      overdue: ['old'], today: ['earlier today', 'tonight'], week: ['tomorrow', 'day 7'], later: ['day 8'], none: ['nodate'],
    });
  });
  it('sorts by due then priority', () => {
    const g = groupTasks([
      task({ title: 'b', due_at: '2026-10-22T12:00', priority: 3 }),
      task({ title: 'a', due_at: '2026-10-22T12:00', priority: 1 }),
      task({ title: 'c', due_at: '2026-10-22T11:00', priority: 3 }),
    ], NOW);
    expect(g[0]!.items.map((i) => i.title)).toEqual(['c', 'a', 'b']);
  });
});

describe('filters and free time', () => {
  const items = [
    task({ title: 'a', category: 'Bank', priority: 1, meta: { freeTime: true, estimateMins: 30 } }),
    task({ title: 'b', category: 'Home', meta: { freeTime: true, estimateMins: 5 } }),
    task({ title: 'c', category: 'Home', meta: { freeTime: true } }),
    task({ title: 'd', category: 'Home' }),
  ];
  it('filters by category and priority', () => {
    expect(filterTasks(items, { category: 'Home' }).map((t) => t.title)).toEqual(['b', 'c', 'd']);
    expect(filterTasks(items, { priority: 1 }).map((t) => t.title)).toEqual(['a']);
  });
  it('free time is shortest first, unestimated last', () => {
    expect(freeTimeTasks(items).map((t) => t.title)).toEqual(['b', 'a', 'c']);
    expect(filterTasks(items, { freeTime: true, category: 'Home' }).map((t) => t.title)).toEqual(['b', 'c']);
  });
});

describe('completeTask', () => {
  it('plain task: done, no next', () => {
    expect(completeTask(task({ due_at: '2026-10-22T09:00' }), NOW)).toEqual({ patch: { status: 'done' }, next: null });
  });
  it('repeating: next occurrence keeps reminder offset, tags and meta', () => {
    const r = completeTask(
      task({ title: 'LIC', due_at: '2026-10-22T18:00', remind_at: '2026-10-22T17:00', repeat_rule: 'FREQ=MONTHLY', tags: ['bills'], meta: { freeTime: false } }),
      NOW,
    );
    expect(r.next).toMatchObject({
      title: 'LIC', status: 'todo', due_at: '2026-11-22T18:00', remind_at: '2026-11-22T17:00',
      repeat_rule: 'FREQ=MONTHLY', tags: ['bills'],
    });
  });
  it('overdue repeating task skips to a future date', () => {
    const r = completeTask(task({ due_at: '2026-10-15T09:00', repeat_rule: 'FREQ=DAILY' }), NOW);
    expect(r.next!.due_at).toBe('2026-10-23T09:00');
  });
  it('end to end with MemoryStore: next occurrence + unchecked checklist', async () => {
    const s = new MemoryStore();
    const t = await s.createItem({ type: 'task', title: 'Rent', status: 'todo', due_at: '2026-10-22T09:00', repeat_rule: 'FREQ=MONTHLY' });
    const c = await s.addChecklist(t.id, 'transfer');
    await s.updateChecklist(c.id, { done: true });
    const { patch, next } = completeTask((await s.getItem(t.id))!, NOW);
    await s.updateItem(t.id, patch);
    const n = await s.createItem(next!);
    await s.copyChecklist(t.id, n.id);
    expect((await s.listChecklist(n.id)).map((e) => [e.text, e.done])).toEqual([['transfer', false]]);
    expect((await s.getItem(t.id))!.status).toBe('done');
  });
});

describe('snooze and reminders', () => {
  it('snooze times', () => {
    expect(snoozeTime('snooze1h', NOW)).toBe('2026-10-22T11:00');
    expect(snoozeTime('snoozeTomorrow', NOW)).toBe('2026-10-23T09:00');
    expect(snoozeTime('snoozeTomorrow', new Date(2026, 11, 31, 23, 0))).toBe('2027-01-01T09:00');
  });
  const items = [
    task({ title: 'future', remind_at: '2026-10-22T10:01' }),
    task({ title: 'past-recent', remind_at: '2026-10-22T09:30' }),
    task({ title: 'past-old', remind_at: '2026-10-20T09:30' }),
    task({ title: 'done', remind_at: '2026-10-22T11:00', status: 'done' }),
    task({ title: 'later', remind_at: '2026-11-30T09:00' }),
  ];
  it('pending only includes future reminders of open tasks', () => {
    expect(pendingReminders(items, NOW).map((r) => r.title)).toEqual(['future', 'later']);
  });
  it('missed = due between last open and now', () => {
    const last = new Date(2026, 9, 22, 8, 0);
    expect(missedReminders(items, NOW, last).map((i) => i.title)).toEqual(['past-recent']);
    expect(missedReminders(items, NOW, null).map((i) => i.title)).toEqual(['past-old', 'past-recent']);
  });
  it('upcoming covers the next 7 days', () => {
    expect(upcomingReminders(items, NOW).map((i) => i.title)).toEqual(['future']);
  });
});
