import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';
import { SearchIndex } from './search';
import {
  hasNotebook, isBlankNote, listNotebooks, normalizeNotebookName, notebookOf, parseNotebookList, planNotesMigration,
  removeFromList, renameInList, reviseList, runNotesMigration, snippetFromBody, titleFromBody, visibleNotes, withNotebook,
} from './notes';
import { LessonIndex, lessonToItem, situationOptions } from './lessons';
import { generateSeedNotes, removeSeededNotes, seedNotes } from './seed';

describe('title and snippet come from the text', () => {
  it('first non-empty line, markdown marks removed', () => {
    expect(titleFromBody('# Hooks cheat sheet\n\nbody')).toBe('Hooks cheat sheet');
    expect(titleFromBody('\n\n  **Buy** milk  \nmore')).toBe('Buy milk');
    expect(titleFromBody('- [ ] call bank\n- [ ] pay rent')).toBe('call bank');
    expect(titleFromBody('> quoted idea')).toBe('quoted idea');
    expect(titleFromBody('1. first step')).toBe('first step');
    expect(titleFromBody('')).toBe('Untitled');
    expect(titleFromBody('   \n  ')).toBe('Untitled');
    expect(titleFromBody(null)).toBe('Untitled');
  });
  it('snippets skip code fences and table syntax', () => {
    const body = '# JOIN types\n\n| Join | Returns |\n|---|---|\n| INNER | both match |\n\n```sql\nSELECT 1;\n```\n';
    expect(snippetFromBody(body)).toBe('Join Returns INNER both match SELECT 1;');
    expect(titleFromBody('```ts\nconst a = 1;\n```')).toBe('const a = 1;');
    expect(titleFromBody('| a | b |\n|---|---|')).toBe('a b');
  });
  it('long titles are cut at 80 characters', () => {
    const t = titleFromBody('x'.repeat(200));
    expect(t.length).toBe(80);
    expect(t.endsWith('…')).toBe(true);
  });
  it('snippet is the text after the title, flattened', () => {
    expect(snippetFromBody('# Title\n\nfirst line\n- second **bold** line\n\nthird')).toBe('first line second bold line third');
    expect(snippetFromBody('only a title')).toBe('');
    expect(snippetFromBody('')).toBe('');
    const s = snippetFromBody(`# T\n${'word '.repeat(100)}`, 50);
    expect(s.length).toBe(50);
    expect(s.endsWith('…')).toBe(true);
  });
});

async function seeded() {
  const s = new MemoryStore();
  const mk = (title: string, body: string, o: { notebook?: string; tags?: string[]; pinned?: boolean; revise?: boolean; revisedAt?: string } = {}) =>
    s.createItem({
      type: 'note', title, body, tags: o.tags ?? [], pinned: o.pinned ?? false,
      meta: { ...(o.notebook ? { notebook: o.notebook } : {}), ...(o.revise ? { revise: true } : {}), ...(o.revisedAt ? { revisedAt: o.revisedAt } : {}) },
    });
  const a = await mk('A', '# A\ntext a', { notebook: 'Work', tags: ['x'] });
  const b = await mk('B', '# B\ntext b', { notebook: 'work', pinned: true });
  const c = await mk('C', '# C\ntext c', { notebook: 'Money', revise: true, revisedAt: '2026-10-10T10:00' });
  const d = await mk('D', '# D\ntext d', { revise: true });
  const blank = await mk('Untitled', '   ');
  return { s, a, b, c, d, blank, items: () => s.listItems({ includeDeleted: true }) };
}

describe('visibleNotes', () => {
  it('hides blank notes, pinned first then newest edited', async () => {
    const t = await seeded();
    const all = visibleNotes(await t.items());
    expect(all.map((n) => n.title)[0]).toBe('B');
    expect(all.map((n) => n.title)).not.toContain('Untitled');
    expect(all).toHaveLength(4);
    expect(isBlankNote(t.blank)).toBe(true);
  });
  it('filters by notebook (case-insensitive), no notebook, tag, ids', async () => {
    const t = await seeded();
    const items = await t.items();
    expect(visibleNotes(items, { notebook: 'WORK' }).map((n) => n.title).sort()).toEqual(['A', 'B']);
    expect(visibleNotes(items, { notebook: null }).map((n) => n.title)).toEqual(['D']);
    expect(visibleNotes(items, { tag: 'x' }).map((n) => n.title)).toEqual(['A']);
    expect(visibleNotes(items, { ids: new Set([t.c.id]) }).map((n) => n.title)).toEqual(['C']);
    expect(visibleNotes(items, { ids: new Set() })).toEqual([]);
  });
  it('trashed notes never show', async () => {
    const t = await seeded();
    await t.s.deleteItem(t.a.id);
    expect(visibleNotes(await t.items()).map((n) => n.title)).not.toContain('A');
  });
  it('review later: never-reviewed first, then oldest', async () => {
    const t = await seeded();
    expect(reviseList(await t.items()).map((n) => n.title)).toEqual(['D', 'C']);
  });
});

describe('notebooks', () => {
  it('names are trimmed, collapsed and capped', () => {
    expect(normalizeNotebookName('  My   notes ')).toBe('My notes');
    expect(normalizeNotebookName('x'.repeat(60)).length).toBe(40);
  });
  it('list = saved order, then names only notes use; counts ignore blanks and case', async () => {
    const t = await seeded();
    const list = listNotebooks(await t.items(), ['Money', 'Empty']);
    expect(list.map((n) => [n.name.toLowerCase(), n.count])).toEqual([['money', 1], ['empty', 0], ['work', 2]]); // "work" and "Work" are one notebook
  });
  it('add, rename, remove are case-insensitive and reject duplicates', () => {
    expect(withNotebook(['Work'], 'work')).toEqual(['Work']);
    expect(withNotebook(['Work'], '  ')).toEqual(['Work']);
    expect(withNotebook(['Work'], 'Home')).toEqual(['Work', 'Home']);
    expect(hasNotebook(['Work'], 'WORK')).toBe(true);
    expect(renameInList(['Work', 'Home'], 'work', 'Office')).toEqual(['Office', 'Home']);
    expect(removeFromList(['Work', 'Home'], 'HOME')).toEqual(['Work']);
  });
  it('parseNotebookList survives bad data', () => {
    expect(parseNotebookList(null)).toEqual([]);
    expect(parseNotebookList('not json')).toEqual([]);
    expect(parseNotebookList('{"a":1}')).toEqual([]);
    expect(parseNotebookList('["A", 3, "", "B"]')).toEqual(['A', 'B']);
  });
  it('notebookOf ignores blanks', () => {
    expect(notebookOf({ meta: { notebook: '  ' } } as never)).toBeNull();
    expect(notebookOf({ meta: { notebook: ' Work ' } } as never)).toBe('Work');
  });
});

async function oldTree() {
  const s = new MemoryStore();
  const mk = (title: string, level: string, parent: string | null = null, body: string | null = null, extra: Record<string, unknown> = {}) =>
    s.createItem({ type: 'note', title, body, parent_id: parent, meta: { level, ...extra } });
  const react = await mk('React', 'subject');
  const hooks = await mk('Hooks', 'topic', react.id);
  const emptyTopic = await mk('Testing', 'topic', react.id);
  const money = await mk('Money', 'subject');
  const emptySubject = await mk('Ideas', 'subject');
  const n1 = await mk('useEffect cleanup', 'note', hooks.id, 'Cleanup runs before re-run.', { revise: true });
  const n2 = await mk('Budget basics', 'note', money.id, '');
  const loose = await mk('Loose idea', 'note', null, 'just text');
  void emptyTopic; void emptySubject;
  return { s, react, hooks, money, n1, n2, loose };
}

describe('migration from the old tree', () => {
  it('plans notebooks "Subject / Topic" and subject names, keeps titles as first lines', async () => {
    const t = await oldTree();
    const plan = planNotesMigration(await t.s.listItems({ includeArchived: true }));
    const patch = (id: string) => plan.patches.find((p) => p.id === id)!.patch;
    expect(patch(t.n1.id).meta).toMatchObject({ notebook: 'React / Hooks', revise: true, migrated: true });
    expect(patch(t.n1.id).meta).not.toHaveProperty('level');
    expect(patch(t.n1.id).body).toBe('# useEffect cleanup\n\nCleanup runs before re-run.\n');
    expect(patch(t.n2.id).meta).toMatchObject({ notebook: 'Money' });
    expect(patch(t.n2.id).body).toBe('# Budget basics\n');
    expect(patch(t.loose.id).meta).not.toHaveProperty('notebook');
    expect(patch(t.loose.id).parent_id).toBeNull();
    expect(plan.deleteIds).toHaveLength(5);
    expect(plan.notebooks).toEqual(['Ideas', 'Money', 'React / Hooks', 'React / Testing']);
  });

  it('applies once, keeps every note visible with the same title, and is idempotent', async () => {
    const t = await oldTree();
    const first = await runNotesMigration(t.s);
    expect(first.migrated).toBe(3);
    const notes = visibleNotes(await t.s.listItems());
    expect(notes.map((n) => titleFromBody(n.body)).sort()).toEqual(['Budget basics', 'Loose idea', 'useEffect cleanup']);
    expect(JSON.parse((await t.s.getSetting('notebooks'))!)).toContain('React / Hooks');
    // containers are gone from the list (trashed), notes keep working
    expect((await t.s.listItems()).filter((i) => i.meta.level === 'subject' || i.meta.level === 'topic')).toHaveLength(0);

    const before = JSON.stringify(await t.s.listItems());
    const second = await runNotesMigration(t.s);
    expect(second.migrated).toBe(0);
    expect(JSON.stringify(await t.s.listItems())).toBe(before);
    // even without the flag, already-migrated notes are skipped
    expect(planNotesMigration(await t.s.listItems({ includeArchived: true })).patches).toHaveLength(0);
  });

  it('an empty database just records the migration', async () => {
    const s = new MemoryStore();
    expect(await runNotesMigration(s)).toEqual({ migrated: 0, notebooks: [] });
    expect(await s.getSetting('notes_v2')).toBe('1');
  });
});

describe('lessons', () => {
  it('derives title/body from the fields', () => {
    const f = { situation: 'Work', whatHappened: 'Accepted the first offer.', lesson: 'Always ask for a day to think.\nMore detail' };
    const it = lessonToItem(f);
    expect(it.title).toBe('Work: Always ask for a day to think.');
    expect(it.body).toContain('Accepted the first offer.');
    expect(lessonToItem({ situation: '', whatHappened: '', lesson: '' }).title).toBe('Lesson');
  });

  it('"Before you start" ranks situation matches first', async () => {
    const s = new MemoryStore();
    const mk = (situation: string, whatHappened: string, lesson: string, tags: string[] = []) =>
      s.createItem({ type: 'lesson', tags, ...lessonToItem({ situation, whatHappened, lesson }) });
    const a = await mk('Negotiating salary', 'Took the first number.', 'Counter once, politely.');
    const b = await mk('Money', 'Lent cash to a friend, never repaid.', 'Only lend what you can gift.', ['salary']);
    const c = await mk('Health', 'Skipped sleep before a deadline.', 'Sleep is part of the schedule.');
    const idx = new LessonIndex();
    idx.build(await s.listItems());
    const r = idx.search('negotiating salary');
    expect(r[0]).toBe(a.id);
    expect(r).toContain(b.id);
    expect(r).not.toContain(c.id);
    expect(idx.search('   ')).toEqual([]);
  });

  it('situation options: used first by count, then unused suggestions', async () => {
    const s = new MemoryStore();
    for (const sit of ['Money', 'Money', 'Travel']) await s.createItem({ type: 'lesson', title: sit, meta: { situation: sit } });
    const opts = situationOptions(await s.listItems());
    expect(opts.slice(0, 2)).toEqual(['Money', 'Travel']);
    expect(opts).toContain('Work');
  });
});

describe('seed + search speed', () => {
  it('seed is deterministic and sized', () => {
    expect(generateSeedNotes(500)).toHaveLength(500);
    expect(generateSeedNotes(5)[0]).toEqual(generateSeedNotes(5)[0]);
  });

  it('500 seeded notes: notebooks and tags set, index build and search well under 200 ms', async () => {
    const s = new MemoryStore();
    await seedNotes(s, 500);
    const items = await s.listItems();
    expect(visibleNotes(items)).toHaveLength(500);
    expect(listNotebooks(items, []).length).toBeGreaterThanOrEqual(5);
    expect(items[0]!.tags).toHaveLength(1);
    const idx = new SearchIndex();
    const t0 = performance.now();
    idx.build(items);
    const buildMs = performance.now() - t0;
    const times = ['closure', 'retry latency', 'indexing', 'promise stream', 'sql join'].map((q) => {
      const a = performance.now();
      expect(idx.search(q).length).toBeGreaterThan(0);
      return performance.now() - a;
    });
    expect(Math.max(...times)).toBeLessThan(200);
    expect(buildMs).toBeLessThan(2000);
    console.log(`500 notes: build ${buildMs.toFixed(0)} ms, slowest search ${Math.max(...times).toFixed(1)} ms`);
  });

  it('removeSeededNotes soft-deletes only seeded rows', async () => {
    const s = new MemoryStore();
    await s.createItem({ type: 'note', title: 'mine', body: '# mine' });
    await seedNotes(s, 10);
    expect(await removeSeededNotes(s)).toBe(10);
    expect((await s.listItems()).map((i) => i.title)).toEqual(['mine']);
  });
});
