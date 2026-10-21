import type { DataStore } from './datastore';
import { DEFAULT_CATEGORIES, type Category, type ChecklistEntry, type Item, type NewItem, type Tag } from './types';
import { uuidv7 } from './uuid';

const now = () => new Date().toISOString();

/** In-memory DataStore: used by tests and for browser dev (`pnpm dev:ui`) where no native shell exists. */
export class MemoryStore implements DataStore {
  private items = new Map<string, Item>();
  private tags = new Map<string, Tag>();
  private cats = new Map<string, Category>();
  private settings = new Map<string, string>();

  async init() {
    if (this.cats.size === 0) {
      DEFAULT_CATEGORIES.forEach((name, sort) => {
        const id = uuidv7();
        this.cats.set(id, { id, name, icon: null, sort });
      });
    }
  }

  async listItems(f: { type?: Item['type']; includeDeleted?: boolean; includeArchived?: boolean } = {}) {
    return [...this.items.values()].filter(
      (i) => (!f.type || i.type === f.type) && (f.includeDeleted || !i.deleted_at) && (f.includeArchived || !i.archived),
    );
  }
  async getItem(id: string) { return this.items.get(id) ?? null; }

  async createItem(input: NewItem) {
    const t = now();
    const item: Item = {
      body: null, category: null, priority: 2, status: null, due_at: null, remind_at: null, repeat_rule: null,
      parent_id: null, meta: {}, pinned: false, archived: false, deleted_at: null, tags: [],
      ...input, id: uuidv7(), created_at: t, updated_at: t,
    };
    for (const name of item.tags) await this.upsertTag(name);
    this.items.set(item.id, item);
    return item;
  }

  async updateItem(id: string, patch: Partial<Omit<Item, 'id' | 'created_at'>>) {
    const cur = this.items.get(id);
    if (!cur) throw new Error(`Item ${id} not found`);
    const next = { ...cur, ...patch, updated_at: now() };
    for (const name of next.tags) await this.upsertTag(name);
    this.items.set(id, next);
    return next;
  }
  async deleteItem(id: string) { await this.updateItem(id, { deleted_at: now() }); }
  async restoreItem(id: string) { await this.updateItem(id, { deleted_at: null }); }
  async purgeTrash(days: number) {
    const cutoff = Date.now() - days * 86_400_000;
    let n = 0;
    for (const [id, i] of this.items) {
      if (i.deleted_at && Date.parse(i.deleted_at) <= cutoff) { this.items.delete(id); n++; }
    }
    return n;
  }

  async listTags() { return [...this.tags.values()].sort((a, b) => a.name.localeCompare(b.name)); }
  async upsertTag(name: string, color: string | null = null) {
    const n = name.trim().toLowerCase();
    const ex = [...this.tags.values()].find((t) => t.name === n);
    if (ex) return ex;
    const tag = { id: uuidv7(), name: n, color };
    this.tags.set(tag.id, tag);
    return tag;
  }
  async renameTag(id: string, name: string) {
    const t = this.tags.get(id);
    if (!t) return;
    const old = t.name;
    t.name = name.trim().toLowerCase();
    for (const i of this.items.values()) i.tags = i.tags.map((x) => (x === old ? t.name : x));
  }
  async deleteTag(id: string) {
    const t = this.tags.get(id);
    if (!t) return;
    this.tags.delete(id);
    for (const i of this.items.values()) i.tags = i.tags.filter((x) => x !== t.name);
  }

  async listCategories() { return [...this.cats.values()].sort((a, b) => a.sort - b.sort); }
  async addCategory(name: string) {
    const c = { id: uuidv7(), name: name.trim(), icon: null, sort: this.cats.size };
    this.cats.set(c.id, c);
    return c;
  }
  async renameCategory(id: string, name: string) {
    const c = this.cats.get(id);
    if (!c) return;
    for (const i of this.items.values()) if (i.category === c.name) i.category = name.trim();
    c.name = name.trim();
  }
  async deleteCategory(id: string) { this.cats.delete(id); }

  private checklist = new Map<string, ChecklistEntry>();
  async listChecklist(itemId: string) {
    return [...this.checklist.values()].filter((e) => e.item_id === itemId).sort((a, b) => a.sort - b.sort);
  }
  async listAllChecklist() { return [...this.checklist.values()]; }
  async addChecklist(itemId: string, text: string) {
    const sort = (await this.listChecklist(itemId)).length;
    const e: ChecklistEntry = { id: uuidv7(), item_id: itemId, text: text.trim(), done: false, sort };
    this.checklist.set(e.id, e);
    return e;
  }
  async updateChecklist(id: string, patch: { text?: string; done?: boolean }) {
    const e = this.checklist.get(id);
    if (!e) return;
    if (patch.text !== undefined) e.text = patch.text.trim();
    if (patch.done !== undefined) e.done = patch.done;
  }
  async deleteChecklist(id: string) { this.checklist.delete(id); }
  async copyChecklist(fromItemId: string, toItemId: string) {
    for (const e of await this.listChecklist(fromItemId)) await this.addChecklist(toItemId, e.text);
  }

  async getSetting(key: string) { return this.settings.get(key) ?? null; }
  async setSetting(key: string, value: string) { this.settings.set(key, value); }
}
