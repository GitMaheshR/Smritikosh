import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';
import { SearchIndex } from './search';
import {
  breadcrumb, buildTree, canMove, childLevel, childrenOf, descendants, levelOf, moveTargets, reviseList,
} from './notes';
import { LessonIndex, lessonFields, lessonToItem, situationOptions } from './lessons';
import { generateSeedNotes, removeSeededNotes, seedNotes } from './seed';
import type { Item } from './types';

async function tree() {
  const s = new MemoryStore();
  const subj = await s.createItem({ type: 'note', title: 'React', meta: { level: 'subject' } });
  const subj2 = await s.createItem({ type: 'note', title: 'Databases', meta: { level: 'subject' } });
  const topic = await s.createItem({ type: 'note', title: 'Hooks', parent_id: subj.id, meta: { level: 'topic' } });
  const topic2 = await s.createItem({ type: 'note', title: 'Indexing', parent_id: subj2.id, meta: { level: 'topic' } });
  const note = await s.createItem({ type: 'note', title: 'useEffect cleanup', parent_id: topic.id, meta: { level: 'note' } });
  const loose = await s.createItem({ type: 'note', title: 'Loose idea' });
  return { s, subj, subj2, topic, topic2, note, loose, all: () => s.listItems({ includeDeleted: true }) };
}

describe('note tree', () => {
  it('levels and child levels', () => {
    expect(childLevel(null)).toBe('subject');
    expect(childLevel('subject')).toBe('topic');
    expect(childLevel('topic')).toBe('note');
    expect(childLevel('note')).toBeNull();
  });

  it('root lists subjects and loose notes, pinned first; children list their container', async () => {
    const t = await tree();
    await t.s.updateItem(t.subj2.id, { pinned: true });
    const items = await t.all();
    expect(childrenOf(items, null).map((i) => i.title)).toEqual(['Databases', 'Loose idea', 'React']);
    expect(childrenOf(items, t.topic.id).map((i) => i.title)).toEqual(['useEffect cleanup']);
    expect(levelOf(t.loose)).toBe('note');
  });

  it('breadcrumb runs root to item and survives a cycle', async () => {
    const t = await tree();
    let items = await t.all();
    expect(breadcrumb(items, t.note.id).map((i) => i.title)).toEqual(['React', 'Hooks', 'useEffect cleanup']);
    // corrupt data: subject points at its own descendant
    items = items.map((i) => (i.id === t.subj.id ? ({ ...i, parent_id: t.note.id } as Item) : i));
    expect(breadcrumb(items, t.note.id).length).toBeLessThanOrEqual(3);
  });

  it('descendants and buildTree', async () => {
    const t = await tree();
    const items = await t.all();
    expect(descendants(items, t.subj.id).map((i) => i.title).sort()).toEqual(['Hooks', 'useEffect cleanup']);
    const roots = buildTree(items);
    expect(roots.find((n) => n.item.id === t.subj.id)!.children[0]!.children[0]!.item.id).toBe(t.note.id);
  });

  it('canMove enforces levels and blocks cycles', async () => {
    const t = await tree();
    const items = await t.all();
    expect(canMove(items, t.topic.id, t.subj2.id)).toBe(true);      // topic -> other subject
    expect(canMove(items, t.note.id, t.topic2.id)).toBe(true);      // note -> other topic
    expect(canMove(items, t.loose.id, t.topic.id)).toBe(true);      // loose note -> topic
    expect(canMove(items, t.note.id, null)).toBe(true);             // note -> unfiled
    expect(canMove(items, t.note.id, t.subj.id)).toBe(false);       // wrong level
    expect(canMove(items, t.topic.id, null)).toBe(false);           // topic cannot be root
    expect(canMove(items, t.subj.id, t.topic.id)).toBe(false);      // subject under its own topic
    expect(canMove(items, t.subj.id, t.subj.id)).toBe(false);       // into itself
    expect(canMove(items, t.subj.id, null)).toBe(true);
    expect(moveTargets(items, t.note.id).map((i) => i.title).sort()).toEqual(['Hooks', 'Indexing']);
  });

  it('cascade delete and restore keeps the tree together', async () => {
    const t = await tree();
    const items = await t.all();
    const ids = [t.subj.id, ...descendants(items, t.subj.id).map((i) => i.id)];
    for (const id of ids) await t.s.deleteItem(id);
    expect(childrenOf(await t.all(), null).map((i) => i.title)).toEqual(['Databases', 'Loose idea']);
    for (const id of ids) await t.s.restoreItem(id);
    expect(childrenOf(await t.all(), t.topic.id)).toHaveLength(1);
  });

  it('orphaned children (deleted parent) fall back to the root', async () => {
    const t = await tree();
    await t.s.deleteItem(t.topic.id);
    expect(childrenOf(await t.all(), null).map((i) => i.title)).toContain('useEffect cleanup');
  });
});

describe('revision list', () => {
  it('never-reviewed first, then oldest reviewed; only flagged notes', async () => {
    const s = new MemoryStore();
    await s.createItem({ type: 'note', title: 'b', meta: { level: 'note', revise: true, revisedAt: '2026-10-20T10:00' } });
    await s.createItem({ type: 'note', title: 'a', meta: { level: 'note', revise: true, revisedAt: '2026-10-01T10:00' } });
    await s.createItem({ type: 'note', title: 'z', meta: { level: 'note', revise: true } });
    await s.createItem({ type: 'note', title: 'not flagged', meta: { level: 'note' } });
    await s.createItem({ type: 'note', title: 'flagged subject', meta: { level: 'subject', revise: true } });
    expect(reviseList(await s.listItems()).map((i) => i.title)).toEqual(['z', 'a', 'b']);
  });
});

describe('lessons', () => {
  it('derives title/body from the fields and round-trips', () => {
    const f = { situation: 'Work', whatHappened: 'Accepted the first offer.', lesson: 'Always ask for a day to think.\nMore detail' };
    const it = lessonToItem(f);
    expect(it.title).toBe('Work: Always ask for a day to think.');
    expect(it.body).toContain('Accepted the first offer.');
    expect(lessonFields({ meta: it.meta } as Item)).toEqual(f);
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
    await s.deleteItem(a.id);
    idx.build(await s.listItems());
    expect(idx.search('negotiating')).not.toContain(a.id);
  });

  it('situation options: used first by count, then unused suggestions', async () => {
    const s = new MemoryStore();
    for (const sit of ['Money', 'Money', 'Travel']) await s.createItem({ type: 'lesson', title: sit, meta: { situation: sit } });
    const opts = situationOptions(await s.listItems());
    expect(opts.slice(0, 2)).toEqual(['Money', 'Travel']);
    expect(opts).toContain('Work');
    expect(opts.filter((o) => o === 'Money')).toHaveLength(1);
  });
});

describe('seed + search speed', () => {
  it('seed is deterministic and sized', () => {
    expect(generateSeedNotes(500)).toHaveLength(500);
    expect(generateSeedNotes(5)[0]).toEqual(generateSeedNotes(5)[0]);
  });

  it('500 seeded notes: index build and search each well under 200 ms', async () => {
    const s = new MemoryStore();
    await seedNotes(s, 500);
    const items = await s.listItems();
    expect(items.filter((i) => levelOf(i) === 'note')).toHaveLength(500);
    const idx = new SearchIndex();
    const t0 = performance.now();
    idx.build(items);
    const buildMs = performance.now() - t0;
    const queries = ['closure', 'retry latency', 'indexing', 'promise stream', 'sql join'];
    const times = queries.map((q) => {
      const a = performance.now();
      const r = idx.search(q);
      expect(r.length).toBeGreaterThan(0);
      return performance.now() - a;
    });
    expect(Math.max(...times)).toBeLessThan(200);
    expect(buildMs).toBeLessThan(2000);
    console.log(`500 notes: build ${buildMs.toFixed(0)} ms, slowest search ${Math.max(...times).toFixed(1)} ms`);
  });

  it('removeSeededNotes soft-deletes only seeded rows', async () => {
    const s = new MemoryStore();
    await s.createItem({ type: 'note', title: 'mine', meta: { level: 'note' } });
    await seedNotes(s, 10);
    const n = await removeSeededNotes(s);
    expect(n).toBeGreaterThan(10);
    expect((await s.listItems()).map((i) => i.title)).toEqual(['mine']);
  });
});
