import type { Item } from './types';

export type NoteLevel = 'subject' | 'topic' | 'note';
const ORDER: NoteLevel[] = ['subject', 'topic', 'note'];

/** Items created without a level (e.g. quick-add "note: ...") are loose notes. */
export const levelOf = (i: Item): NoteLevel =>
  i.meta.level === 'subject' || i.meta.level === 'topic' ? i.meta.level : 'note';

/** The level a new child of a container has; null at note level (leaf). */
export function childLevel(parentLevel: NoteLevel | null): NoteLevel | null {
  if (parentLevel === null) return 'subject';
  const i = ORDER.indexOf(parentLevel);
  return ORDER[i + 1] ?? null;
}

const live = (items: Item[]) => items.filter((i) => i.type === 'note' && !i.deleted_at);

const byPinThenTitle = (a: Item, b: Item) =>
  Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

/** Direct children of a container (null = root: subjects plus loose notes). */
export function childrenOf(items: Item[], parentId: string | null): Item[] {
  return live(items)
    .filter((i) => (parentId === null ? !i.parent_id || !items.some((p) => p.id === i.parent_id && !p.deleted_at) : i.parent_id === parentId))
    .sort(byPinThenTitle);
}

/** Root → … → item (inclusive). Stops safely if the data contains a cycle. */
export function breadcrumb(items: Item[], id: string): Item[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: Item[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    out.unshift(cur);
    seen.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return out;
}

/** All descendants (children, grandchildren…) of an item. */
export function descendants(items: Item[], id: string): Item[] {
  const kids = new Map<string, Item[]>();
  for (const i of items) if (i.parent_id) kids.set(i.parent_id, [...(kids.get(i.parent_id) ?? []), i]);
  const out: Item[] = [];
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    stack.push(...(kids.get(n.id) ?? []));
  }
  return out;
}

export interface TreeNode { item: Item; children: TreeNode[] }
export function buildTree(items: Item[]): TreeNode[] {
  const build = (parentId: string | null): TreeNode[] =>
    childrenOf(items, parentId).map((item) => ({ item, children: build(item.id) }));
  return build(null);
}

/**
 * A move is valid when the item ends up under a container exactly one level above it
 * (topic → subject, note → topic), a subject goes to the root, and it never moves into itself or a descendant.
 * A loose note may also sit at the root (newParent = null).
 */
export function canMove(items: Item[], id: string, newParentId: string | null): boolean {
  const item = items.find((i) => i.id === id);
  if (!item || item.type !== 'note') return false;
  const level = levelOf(item);
  if (newParentId === null) return level === 'subject' || level === 'note';
  if (newParentId === id || descendants(items, id).some((d) => d.id === newParentId)) return false;
  const parent = items.find((i) => i.id === newParentId && !i.deleted_at);
  if (!parent || parent.type !== 'note') return false;
  return childLevel(levelOf(parent)) === level;
}

/** Valid destination containers for an item (for a "Move to…" picker). */
export function moveTargets(items: Item[], id: string): Item[] {
  return live(items).filter((p) => canMove(items, id, p.id)).sort(byPinThenTitle);
}

/** Notes flagged for revision, least recently reviewed first (never reviewed first of all). */
export function reviseList(items: Item[]): Item[] {
  const reviewed = (i: Item) => (typeof i.meta.revisedAt === 'string' ? i.meta.revisedAt : '');
  return live(items)
    .filter((i) => levelOf(i) === 'note' && i.meta.revise === true)
    .sort((a, b) => reviewed(a).localeCompare(reviewed(b)) || a.title.localeCompare(b.title));
}
