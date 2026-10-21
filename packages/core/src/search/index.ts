import MiniSearch from 'minisearch';
import type { Item, ItemType } from './../types';

export interface SearchFilters {
  type?: ItemType;
  tag?: string;
  category?: string;
  status?: string;
}

interface Doc {
  id: string;
  type: ItemType;
  title: string;
  body: string;
  tags: string;
  category: string;
  status: string;
  meta: string;
}

const toDoc = (i: Item): Doc => ({
  id: i.id,
  type: i.type,
  title: i.title,
  body: i.body ?? '',
  tags: i.tags.join(' '),
  category: i.category ?? '',
  status: i.status ?? '',
  meta: Object.values(i.meta).filter((v) => typeof v === 'string' || typeof v === 'number').join(' '),
});

/** In-memory full-text index. Vault entries must never be passed in (vault lives in vault.db, not items). */
export class SearchIndex {
  private ms = new MiniSearch<Doc>({
    fields: ['title', 'body', 'tags', 'category', 'meta'],
    storeFields: ['type', 'tags', 'category', 'status'],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 },
  });
  private ids = new Set<string>();

  build(items: Item[]) {
    this.ms.removeAll();
    this.ids.clear();
    this.ms.addAll(items.filter((i) => !i.deleted_at).map(toDoc));
    items.forEach((i) => !i.deleted_at && this.ids.add(i.id));
  }

  upsert(item: Item) {
    this.remove(item.id);
    if (item.deleted_at) return;
    this.ms.add(toDoc(item));
    this.ids.add(item.id);
  }

  remove(id: string) {
    if (this.ids.has(id)) {
      this.ms.discard(id);
      this.ids.delete(id);
    }
  }

  search(query: string, filters: SearchFilters = {}) {
    if (!query.trim()) return [];
    return this.ms.search(query, {
      filter: (r) =>
        (!filters.type || r.type === filters.type) &&
        (!filters.category || r.category === filters.category) &&
        (!filters.status || r.status === filters.status) &&
        (!filters.tag || (r.tags as string[] | string).toString().split(' ').includes(filters.tag)),
    });
  }

  /** Results grouped by item type, as shown in the search UI. */
  searchGrouped(query: string, filters: SearchFilters = {}): Map<ItemType, string[]> {
    const out = new Map<ItemType, string[]>();
    for (const r of this.search(query, filters)) {
      const t = r.type as ItemType;
      if (!out.has(t)) out.set(t, []);
      out.get(t)!.push(r.id as string);
    }
    return out;
  }
}
