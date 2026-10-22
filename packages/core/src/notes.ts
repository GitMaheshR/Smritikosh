import type { DataStore } from './datastore';
import type { Item } from './types';

export const NOTEBOOKS_SETTING = 'notebooks';
export const NOTEBOOK_MAX = 40;

// ---- Titles and snippets: a note is just text; the first line is its title ---------------------

const FENCE_LINE = /^\s*(```|~~~)/;
const TABLE_RULE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/** One line of note text as plain words: markdown marks, code fences and table syntax removed. */
const stripMarks = (line: string) => {
  if (FENCE_LINE.test(line) || (line.includes('|') && TABLE_RULE.test(line))) return '';
  return line
    .replace(/^\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)?/, '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/[*_`~]/g, '')
    .trim();
};

const lines = (body: string) => body.split(/\r?\n/);

/** First non-empty line of the text, without markdown marks, at most 80 characters. */
export function titleFromBody(body: string | null | undefined): string {
  for (const l of lines(body ?? '')) {
    const t = stripMarks(l);
    if (t) return t.length > 80 ? `${t.slice(0, 79)}…` : t;
  }
  return 'Untitled';
}

/** Text after the title line, flattened to one line for list rows. */
export function snippetFromBody(body: string | null | undefined, max = 110): string {
  const ls = lines(body ?? '');
  const first = ls.findIndex((l) => stripMarks(l));
  if (first < 0) return '';
  const rest = ls.slice(first + 1).map(stripMarks).filter(Boolean).join(' ');
  return rest.length > max ? `${rest.slice(0, max - 1)}…` : rest;
}

// ---- Notes, notebooks, filters ------------------------------------------------------------------

export const isLiveNote = (i: Item) => i.type === 'note' && !i.deleted_at;
/** A note nobody has typed into yet (created when "New note" opens, removed if left blank). */
export const isBlankNote = (i: Item) => !(i.body ?? '').trim();
export const notebookOf = (i: Item): string | null =>
  typeof i.meta.notebook === 'string' && i.meta.notebook.trim() ? i.meta.notebook.trim() : null;

export function normalizeNotebookName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NOTEBOOK_MAX);
}

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

export function parseNotebookList(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
  } catch {
    return [];
  }
}

export interface NotebookInfo { name: string; count: number }

/** Saved notebooks (in the user's order) plus any name used by a note but missing from the list. */
export function listNotebooks(items: Item[], saved: string[]): NotebookInfo[] {
  const notes = items.filter((i) => isLiveNote(i) && !isBlankNote(i));
  const names = [...saved];
  const extra: string[] = [];
  for (const n of notes.map(notebookOf).sort((a, b) => (a ?? '').localeCompare(b ?? ''))) {
    if (n && !names.some((s) => same(s, n)) && !extra.some((s) => same(s, n))) extra.push(n);
  }
  return [...names, ...extra].map((name) => ({ name, count: notes.filter((n) => { const b = notebookOf(n); return !!b && same(b, name); }).length }));
}

export const hasNotebook = (saved: string[], name: string) => saved.some((s) => same(s, name));

/** Adds a notebook; returns the same list if it already exists or the name is empty. */
export function withNotebook(saved: string[], name: string): string[] {
  const n = normalizeNotebookName(name);
  return !n || hasNotebook(saved, n) ? saved : [...saved, n];
}
export const renameInList = (saved: string[], from: string, to: string) =>
  saved.map((s) => (same(s, from) ? normalizeNotebookName(to) : s));
export const removeFromList = (saved: string[], name: string) => saved.filter((s) => !same(s, name));

export interface NoteFilter {
  /** undefined = every note, null = notes without a notebook, string = that notebook */
  notebook?: string | null;
  reviewLater?: boolean;
  tag?: string;
  /** restrict to these ids (e.g. search hits) */
  ids?: Set<string> | null;
}

const byPinThenRecent = (a: Item, b: Item) =>
  Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at);

/** Notes for the list: filtered, blank ones hidden, pinned first then most recently edited. */
export function visibleNotes(items: Item[], f: NoteFilter = {}): Item[] {
  return items
    .filter((i) => {
      if (!isLiveNote(i) || isBlankNote(i)) return false;
      if (f.ids && !f.ids.has(i.id)) return false;
      if (f.notebook !== undefined) {
        const b = notebookOf(i);
        if (f.notebook === null ? b !== null : b === null || !same(b, f.notebook)) return false;
      }
      if (f.reviewLater && i.meta.revise !== true) return false;
      if (f.tag && !i.tags.includes(f.tag)) return false;
      return true;
    })
    .sort(f.reviewLater ? reviewOrder : byPinThenRecent);
}

const reviewed = (i: Item) => (typeof i.meta.revisedAt === 'string' ? i.meta.revisedAt : '');
const reviewOrder = (a: Item, b: Item) => reviewed(a).localeCompare(reviewed(b)) || byPinThenRecent(a, b);

/** Notes marked "Review later", never-reviewed first, then least recently reviewed. */
export function reviseList(items: Item[]): Item[] {
  return visibleNotes(items, { reviewLater: true });
}

// ---- One-time migration from the old Subject / Topic / Note tree ------------------------------

export interface NotesMigrationPlan {
  patches: { id: string; patch: Partial<Item> }[];
  /** old Subject / Topic container rows, moved to the trash */
  deleteIds: string[];
  notebooks: string[];
}

/**
 * Old tree -> flat notes with a notebook. A topic becomes the notebook "Subject / Topic" (or just the topic name if it
 * has no subject), notes directly under a subject use the subject's name, and the note's old title becomes the first
 * line of its text so nothing about it changes. Notes already migrated are skipped, so running twice is harmless.
 */
export function planNotesMigration(items: Item[]): NotesMigrationPlan {
  const notes = items.filter(isLiveNote);
  const byId = new Map(notes.map((i) => [i.id, i]));
  const level = (i: Item) => (i.meta.level === 'subject' || i.meta.level === 'topic' ? (i.meta.level as 'subject' | 'topic') : 'note');
  const containers = notes.filter((i) => level(i) !== 'note');

  const nameFor = (container: Item): string => {
    if (level(container) === 'subject') return container.title;
    const parent = container.parent_id ? byId.get(container.parent_id) : undefined;
    return parent && level(parent) === 'subject' ? `${parent.title} / ${container.title}` : container.title;
  };

  const patches: NotesMigrationPlan['patches'] = [];
  const names = new Set<string>();

  for (const i of notes) {
    if (level(i) !== 'note' || i.meta.migrated === true) continue;
    const parent = i.parent_id ? byId.get(i.parent_id) : undefined;
    const notebook = parent && level(parent) !== 'note' ? normalizeNotebookName(nameFor(parent)) : null;
    const { level: _drop, ...meta } = i.meta;
    void _drop;
    const text = (i.body ?? '').trim();
    patches.push({
      id: i.id,
      patch: {
        parent_id: null,
        body: `# ${i.title}\n\n${text}`.trimEnd() + '\n',
        meta: { ...meta, migrated: true, ...(notebook ? { notebook } : {}) },
      },
    });
    if (notebook) names.add(notebook);
  }
  // keep empty containers as (empty) notebooks too
  for (const c of containers) {
    const hasTopics = level(c) === 'subject' && containers.some((t) => t.parent_id === c.id);
    if (!hasTopics) names.add(normalizeNotebookName(nameFor(c)));
  }

  return { patches, deleteIds: containers.map((c) => c.id), notebooks: [...names].sort((a, b) => a.localeCompare(b)) };
}

const MIGRATION_SETTING = 'notes_v2';

/** Runs the migration once per database. Safe to call on every launch. */
export async function runNotesMigration(store: DataStore): Promise<{ migrated: number; notebooks: string[] }> {
  if ((await store.getSetting(MIGRATION_SETTING)) === '1') return { migrated: 0, notebooks: [] };
  const items = await store.listItems({ includeArchived: true });
  const plan = planNotesMigration(items);
  for (const p of plan.patches) await store.updateItem(p.id, p.patch);
  for (const id of plan.deleteIds) await store.deleteItem(id);
  let saved = parseNotebookList(await store.getSetting(NOTEBOOKS_SETTING));
  for (const n of plan.notebooks) saved = withNotebook(saved, n);
  if (plan.notebooks.length) await store.setSetting(NOTEBOOKS_SETTING, JSON.stringify(saved));
  await store.setSetting(MIGRATION_SETTING, '1');
  return { migrated: plan.patches.length, notebooks: plan.notebooks };
}
