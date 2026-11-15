import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';
import { loadSampleData, removeSampleData } from './sample';
import { listNotebooks, reviseList, titleFromBody, visibleNotes } from './notes';
import { freeTimeTasks, groupTasks, pendingReminders } from './tasks';
import { parseRRule } from './repeat';
import { goalProgress, sortedGoals } from './goals';
import { DEFAULT_PLACE_CATEGORIES, hasPlaceCategory, placeInfo, placeVisit, visiblePlaces } from './places';

// Thursday 22 Oct 2026, 10:00
const NOW = new Date(2026, 9, 22, 10, 0);

describe('sample data', () => {
  it('loads tasks, notes and lessons spread across every task group', async () => {
    const s = new MemoryStore();
    const r = await loadSampleData(s, NOW);
    expect(r).toEqual({ tasks: 13, notes: 7, lessons: 3, goals: 2, places: 5 });
    const items = await s.listItems();
    const groups = groupTasks(items, NOW).map((g) => g.key);
    expect(groups).toEqual(['overdue', 'today', 'week', 'later', 'none']);
    expect(freeTimeTasks(items.filter((i) => i.type === 'task')).length).toBeGreaterThanOrEqual(4);
    expect(pendingReminders(items, NOW).length).toBeGreaterThanOrEqual(2);
  });

  it('repeat rules are valid and one task is already done', async () => {
    const s = new MemoryStore();
    await loadSampleData(s, NOW);
    const tasks = (await s.listItems({ type: 'task' }));
    for (const t of tasks.filter((x) => x.repeat_rule)) expect(parseRRule(t.repeat_rule)).not.toBeNull();
    expect(tasks.filter((t) => t.status === 'done')).toHaveLength(1);
  });

  it('adds checklists', async () => {
    const s = new MemoryStore();
    await loadSampleData(s, NOW);
    expect((await s.listAllChecklist()).length).toBe(10);
  });

  it('adds flat notes with notebooks, tags, review-later flags, a pinned note and a loose one', async () => {
    const s = new MemoryStore();
    await loadSampleData(s, NOW);
    const items = await s.listItems();
    const notes = visibleNotes(items);
    expect(notes).toHaveLength(7);
    expect(listNotebooks(items, []).map((n) => `${n.name}:${n.count}`).sort()).toEqual(['Money:1', 'Tech interviews:5']);
    expect(notes.filter((n) => !n.meta.notebook).map((n) => titleFromBody(n.body))).toEqual(['Gift ideas for Mom']);
    expect(reviseList(items).length).toBe(3);
    expect(notes.filter((i) => i.pinned)).toHaveLength(1);
    // the first line of every sample note is its title
    for (const n of notes) expect(titleFromBody(n.body)).toBe(n.title);
  });

  it('adds two goals with milestones at 60% and 33%', async () => {
    const s = new MemoryStore();
    await loadSampleData(s, NOW);
    const items = await s.listItems();
    const goals = sortedGoals(items);
    expect(goals).toHaveLength(2);
    expect(goals.map((g) => goalProgress(items, g).percent).sort()).toEqual([33, 60]);
    expect(goals.every((g) => !!g.due_at)).toBe(true);
  });

  it('adds places in both states, some with coordinates and a favourite', async () => {
    const s = new MemoryStore();
    await loadSampleData(s, NOW);
    const places = visiblePlaces(await s.listItems());
    expect(places).toHaveLength(5);
    expect(places[0]!.pinned).toBe(true);
    expect(places.filter((p) => placeVisit(p) === 'visited')).toHaveLength(2);
    expect(places.filter((p) => placeInfo(p).lat !== null)).toHaveLength(2);
    for (const p of places) expect(placeInfo(p).category && hasPlaceCategory([...DEFAULT_PLACE_CATEGORIES], placeInfo(p).category!)).toBe(true);
  });

  it('is idempotent: a second load adds nothing', async () => {
    const s = new MemoryStore();
    await loadSampleData(s, NOW);
    const before = (await s.listItems()).length;
    expect(await loadSampleData(s, NOW)).toEqual({ tasks: 0, notes: 0, lessons: 0, goals: 0, places: 0 });
    expect((await s.listItems()).length).toBe(before);
  });

  it('removal takes only sample rows and leaves the user\'s own data', async () => {
    const s = new MemoryStore();
    const mine = await s.createItem({ type: 'task', title: 'My own task', status: 'todo' });
    await loadSampleData(s, NOW);
    const n = await removeSampleData(s);
    expect(n).toBe(41);
    expect((await s.listItems()).map((i) => i.id)).toEqual([mine.id]);
    // can be loaded again after removal? the trashed rows are hidden, so yes
    expect((await loadSampleData(s, NOW)).tasks).toBe(13);
  });
});
