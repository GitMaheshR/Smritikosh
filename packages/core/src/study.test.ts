import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory-store';
import { STUDY_NOTES, hasStudyNotes, loadStudyNotes } from './study';
import { listNotebooks, reviseList, titleFromBody, visibleNotes } from './notes';
import { loadSampleData, removeSampleData } from './sample';
import { SearchIndex } from './search';

describe('Java and database study notes', () => {
  it('has Java and Databases notes, every one with real content', () => {
    expect(STUDY_NOTES.filter((n) => n.category === 'Java')).toHaveLength(6);
    expect(STUDY_NOTES.filter((n) => n.category === 'Databases')).toHaveLength(5);
    for (const n of STUDY_NOTES) {
      expect(n.body.length).toBeGreaterThan(400);
      expect(n.body).not.toContain('¤'); // placeholder fully replaced
      expect(n.body).toContain('`');
    }
  });

  it('loads once, as categories with the title as first line and some marked for review', async () => {
    const s = new MemoryStore();
    expect(await hasStudyNotes(s)).toBe(false);
    expect(await loadStudyNotes(s)).toBe(11);
    expect(await hasStudyNotes(s)).toBe(true);
    expect(await loadStudyNotes(s)).toBe(0); // idempotent
    const items = await s.listItems();
    const notes = visibleNotes(items);
    expect(notes).toHaveLength(11);
    expect(listNotebooks(items, []).map((b) => `${b.name}:${b.count}`).sort()).toEqual(['Databases:5', 'Java:6']);
    for (const n of notes) expect(titleFromBody(n.body)).toBe(n.title);
    expect(reviseList(items).map((n) => n.title).sort()).toEqual([
      'ACID and transaction isolation levels', 'Database indexes', 'JVM memory and garbage collection', 'equals() and hashCode() contract',
    ]);
  });

  it('is searchable by topic', async () => {
    const s = new MemoryStore();
    await loadStudyNotes(s);
    const idx = new SearchIndex();
    idx.build(await s.listItems());
    const titleOf = async (id: string) => (await s.getItem(id))!.title;
    expect(await titleOf(idx.search('hashCode')[0]!.id as string)).toContain('hashCode');
    expect(await titleOf(idx.search('isolation')[0]!.id as string)).toContain('isolation');
    expect(idx.search('PreparedStatement').length).toBeGreaterThan(0);
  });

  it('is independent of the everyday sample data, and removed together with it', async () => {
    const s = new MemoryStore();
    await loadStudyNotes(s);
    expect((await loadSampleData(s)).tasks).toBe(13); // study notes do not block the everyday set
    expect((await loadSampleData(s)).tasks).toBe(0);
    expect(await loadStudyNotes(s)).toBe(0);
    expect(await removeSampleData(s)).toBe(11 + 36);
    expect(await hasStudyNotes(s)).toBe(false);
    expect(await loadStudyNotes(s)).toBe(11); // can be added again
  });
});
