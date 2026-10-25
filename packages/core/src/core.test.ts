import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin, isValidPin } from './pin';
import { parseQuickAdd } from './quickadd';
import { SearchIndex } from './search';
import { MemoryStore } from './memory-store';
import { uuidv7 } from './uuid';
import { migrations } from './migrations';

const CATS = ['Bank', 'Legal', 'Health'];
// Thursday 22 Oct 2026, 10:00
const NOW = new Date(2026, 9, 22, 10, 0);

describe('parseQuickAdd', () => {
  it('parses the spec example', () => {
    const r = parseQuickAdd('pay LIC premium tomorrow 6pm #bank !high', NOW, CATS);
    expect(r).toMatchObject({ type: 'task', title: 'pay LIC premium', due_at: '2026-10-23T18:00', category: 'Bank', priority: 1, tags: [] });
  });
  it('unknown hashtags become tags', () => {
    // there are no tags: a #word that is not a category stays in the title
    const r = parseQuickAdd('call Ravi #family', NOW, CATS);
    expect(r).toMatchObject({ title: 'call Ravi #family', category: null, tags: [] });
    // only the first matching category is used; the rest stay in the text
    expect(parseQuickAdd('pay #bank #legal', NOW, CATS)).toMatchObject({ title: 'pay #legal', category: 'Bank' });
  });
  it('type prefix and plain title', () => {
    const r = parseQuickAdd('note: React hooks cheatsheet', NOW, CATS);
    expect(r).toMatchObject({ type: 'note', title: 'React hooks cheatsheet', due_at: null });
  });
  it('time only rolls to tomorrow when already past', () => {
    expect(parseQuickAdd('stretch 9am', NOW).due_at).toBe('2026-10-23T09:00');
    expect(parseQuickAdd('stretch 6pm', NOW).due_at).toBe('2026-10-22T18:00');
  });
  it('weekday and 24h time', () => {
    expect(parseQuickAdd('review friday 17:30', NOW).due_at).toBe('2026-10-23T17:30');
  });
  it('date without time defaults to 09:00', () => {
    expect(parseQuickAdd('renew insurance in 3 days', NOW).due_at).toBe('2026-10-25T09:00');
  });
});

describe('pin', () => {
  it('validates and verifies', async () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12')).toBe(false);
    const h = await hashPin('4821', 1000);
    expect(h).not.toContain('4821');
    expect(await verifyPin('4821', h)).toBe(true);
    expect(await verifyPin('0000', h)).toBe(false);
  });
});

describe('uuidv7', () => {
  it('is sortable by time and well formed', () => {
    const a = uuidv7(1_000_000_000_000);
    const b = uuidv7(1_000_000_000_001);
    expect(a < b).toBe(true);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('MemoryStore + SearchIndex', () => {
  it('seeds categories, soft deletes, and searches', async () => {
    const s = new MemoryStore();
    await s.init();
    expect((await s.listCategories()).map((c) => c.name)).toContain('Bank');
    const a = await s.createItem({ type: 'task', title: 'Pay LIC premium', tags: ['bills'] });
    const b = await s.createItem({ type: 'note', title: 'React hooks', body: 'useEffect cleanup' });
    const idx = new SearchIndex();
    idx.build(await s.listItems());
    expect(idx.search('premium')[0]?.id).toBe(a.id);
    expect(idx.searchGrouped('useEffect').get('note')).toEqual([b.id]);
    expect(idx.search('bills', { type: 'task' })).toHaveLength(1);
    expect(idx.search('bills', { type: 'note' })).toHaveLength(0);
    await s.deleteItem(a.id);
    idx.upsert((await s.getItem(a.id))!);
    expect(idx.search('premium')).toHaveLength(0);
    expect(await s.listItems()).toHaveLength(1);
    await s.restoreItem(a.id);
    expect(await s.listItems()).toHaveLength(2);
  });
  it('renaming a tag updates items', async () => {
    const s = new MemoryStore();
    const i = await s.createItem({ type: 'task', title: 'x', tags: ['old'] });
    const t = (await s.listTags())[0]!;
    await s.renameTag(t.id, 'new');
    expect((await s.getItem(i.id))!.tags).toEqual(['new']);
  });
});

describe('migrations', () => {
  it('are sequential from 1', () => {
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1));
  });
});
