import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';
import { SqlStore, type SqlDriver } from './sql-store';
import { loadSampleData, removeSampleData } from './sample';
import { loadStudyNotes } from './study';
import { runNotesMigration } from './notes';
import { goalProgress, sortedGoals } from './goals';

// node:sqlite is built into Node 22+; loaded this way so the test bundler does not try to resolve it.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

function sqlStore() {
  const db = new DatabaseSync(':memory:');
  const calls = { n: 0 };
  const driver: SqlDriver = {
    exec: async (sql) => { calls.n++; db.exec(sql); },
    run: async (sql, p = []) => { calls.n++; db.prepare(sql).run(...(p as never[])); },
    all: async <T,>(sql: string, p: unknown[] = []) => { calls.n++; return db.prepare(sql).all(...(p as never[])) as T[]; },
  };
  return { store: new SqlStore(driver), calls };
}

const NOW = new Date(2026, 9, 25, 10, 0);

describe('SqlStore (the real SQL used on the phone and PC)', () => {
  it('creates the schema and default categories', async () => {
    const { store } = sqlStore();
    await store.init();
    expect((await store.listCategories()).map((c) => c.name)).toEqual(['Bank', 'Legal', 'Health', 'Skills', 'Office', 'Home', 'Personal']);
  });

  it('holds the same sample and study data as the in-memory store', async () => {
    const { store } = sqlStore();
    await store.init();
    const mem = new MemoryStore();
    await mem.init();
    for (const s of [store, mem]) {
      await runNotesMigration(s);
      await loadSampleData(s, NOW);
      await loadStudyNotes(s);
    }
    const [a, b] = [await store.listItems(), await mem.listItems()];
    const count = (items: typeof a, t: string) => items.filter((i) => i.type === t).length;
    for (const t of ['task', 'note', 'lesson', 'goal']) expect(count(a, t), t).toBe(count(b, t));
    expect(a).toHaveLength(b.length);
    expect((await store.listAllChecklist()).length).toBe((await mem.listAllChecklist()).length);
    expect(sortedGoals(a).map((g) => goalProgress(a, g).percent)).toEqual(sortedGoals(b).map((g) => goalProgress(b, g).percent));
    // JSON meta and flags survive the round trip
    expect(a.find((i) => i.title === 'equals() and hashCode() contract')?.meta).toMatchObject({ notebook: 'Java', revise: true, sample: true, sampleSet: 'study' });
  });

  it('removes sample data again', async () => {
    const { store } = sqlStore();
    await store.init();
    await loadSampleData(store, NOW);
    await loadStudyNotes(store);
    expect(await removeSampleData(store)).toBe(36 + 11);
    expect(await store.listItems()).toHaveLength(0);
  });

  it('returns tags for a single item and for many items', async () => {
    const { store } = sqlStore();
    await store.init();
    const one = await store.createItem({ type: 'task', title: 'one', tags: ['a', 'b'] });
    expect(one.tags.sort()).toEqual(['a', 'b']);
    for (let i = 0; i < 30; i++) await store.createItem({ type: 'task', title: `t${i}`, tags: [`tag${i % 3}`] });
    const all = await store.listItems();
    expect(all).toHaveLength(31);
    expect(all.find((i) => i.id === one.id)!.tags.sort()).toEqual(['a', 'b']);
    expect(all.filter((i) => i.tags.includes('tag1'))).toHaveLength(10);
    const untouched = await store.createItem({ type: 'task', title: 'no tags' });
    expect(untouched.tags).toEqual([]);
    expect((await store.updateItem(one.id, { tags: ['z'] })).tags).toEqual(['z']);
  });

  it('a single item lookup does not read every tag in the database', async () => {
    const { store } = sqlStore();
    await store.init();
    for (let i = 0; i < 40; i++) await store.createItem({ type: 'task', title: `t${i}`, tags: ['x'] });
    const item = (await store.listItems())[0]!;
    // spy on the driver through a second store sharing nothing: just assert the query text used for one row
    const seen: string[] = [];
    const db = new DatabaseSync(':memory:');
    const spy: SqlDriver = {
      exec: async (s) => { db.exec(s); },
      run: async (s, p = []) => { db.prepare(s).run(...(p as never[])); },
      all: async <T,>(s: string, p: unknown[] = []) => { seen.push(s); return db.prepare(s).all(...(p as never[])) as T[]; },
    };
    const s2 = new SqlStore(spy);
    await s2.init();
    const made = await s2.createItem({ type: 'task', title: 'x' });
    seen.length = 0;
    await s2.getItem(made.id);
    expect(seen.some((q) => q.includes('WHERE it.item_id IN'))).toBe(true);
    void item;
  });
});
