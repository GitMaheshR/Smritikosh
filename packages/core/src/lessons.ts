import MiniSearch from 'minisearch';
import type { Item } from './types';

export const SITUATION_SUGGESTIONS = ['Work', 'Money', 'Relationships', 'Health', 'Learning', 'Other'] as const;

export interface LessonFields { situation: string; whatHappened: string; lesson: string }

export const lessonFields = (i: Item): LessonFields => ({
  situation: typeof i.meta.situation === 'string' ? i.meta.situation : '',
  whatHappened: typeof i.meta.whatHappened === 'string' ? i.meta.whatHappened : '',
  lesson: typeof i.meta.lesson === 'string' ? i.meta.lesson : '',
});

/** Items store a derived title and a searchable body next to the structured meta. */
export function lessonToItem(f: LessonFields): { title: string; body: string; meta: Record<string, unknown> } {
  const first = f.lesson.trim().split(/\n/)[0] ?? '';
  const summary = first.length > 70 ? `${first.slice(0, 67)}…` : first;
  const title = [f.situation.trim(), summary].filter(Boolean).join(': ') || 'Lesson';
  return {
    title,
    body: [f.whatHappened.trim(), f.lesson.trim()].filter(Boolean).join('\n\n'),
    meta: { situation: f.situation.trim(), whatHappened: f.whatHappened.trim(), lesson: f.lesson.trim() },
  };
}

interface Doc { id: string; situation: string; whatHappened: string; lesson: string; tags: string }

/** "Before you start…": situation matches weigh most, then the lesson itself, then the story. */
export class LessonIndex {
  private ms = new MiniSearch<Doc>({
    fields: ['situation', 'lesson', 'whatHappened', 'tags'],
    searchOptions: { boost: { situation: 3, lesson: 2, tags: 2 }, prefix: true, fuzzy: 0.2, combineWith: 'OR' },
  });

  build(items: Item[]) {
    this.ms.removeAll();
    this.ms.addAll(
      items.filter((i) => i.type === 'lesson' && !i.deleted_at).map((i) => ({ id: i.id, ...lessonFields(i), tags: i.tags.join(' ') })),
    );
  }

  /** Best-matching lesson ids first. */
  search(query: string, limit = 8): string[] {
    if (!query.trim()) return [];
    return this.ms.search(query).slice(0, limit).map((r) => r.id as string);
  }
}

/** Situation types already used, most used first, followed by unused suggestions. */
export function situationOptions(items: Item[]): string[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (i.type !== 'lesson' || i.deleted_at) continue;
    const s = lessonFields(i).situation;
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  return [...used, ...SITUATION_SUGGESTIONS.filter((s) => !used.includes(s))];
}
