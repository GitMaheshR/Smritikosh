import type { DataStore } from './datastore';
import { migrations } from './migrations';
import { DEFAULT_CATEGORIES, type Category, type ChecklistEntry, type Item, type NewItem, type Tag } from './types';
import { uuidv7 } from './uuid';

/** Minimal driver both platforms implement (better-sqlite3 in Electron main, @capacitor-community/sqlite on Android). */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<void>;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

/** One SQL implementation of DataStore shared by every platform. */
export class SqlStore implements DataStore {
  constructor(private db: SqlDriver) {}

  async init() {
    await this.db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
    const cur = (await this.db.all<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_version'))[0]?.v ?? 0;
    for (const m of migrations.filter((x) => x.version > cur)) {
      await this.db.exec(m.sql);
      await this.db.run('INSERT INTO schema_version (version) VALUES (?)', [m.version]);
    }
    const n = (await this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))[0]?.n ?? 0;
    if (n === 0) {
      for (const [i, name] of DEFAULT_CATEGORIES.entries()) {
        await this.db.run('INSERT INTO categories (id,name,icon,sort) VALUES (?,?,NULL,?)', [uuidv7(), name, i]);
      }
    }
  }

  private async hydrate(rows: Row[]): Promise<Item[]> {
    if (rows.length === 0) return [];
    const tagRows = await this.db.all<{ item_id: string; name: string }>(
      'SELECT it.item_id, t.name FROM item_tags it JOIN tags t ON t.id = it.tag_id',
    );
    const byItem = new Map<string, string[]>();
    for (const t of tagRows) byItem.set(t.item_id, [...(byItem.get(t.item_id) ?? []), t.name]);
    return rows.map((r) => ({
      id: r.id as string,
      type: r.type as Item['type'],
      title: r.title as string,
      body: (r.body as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      priority: Number(r.priority ?? 2),
      status: (r.status as string | null) ?? null,
      due_at: (r.due_at as string | null) ?? null,
      remind_at: (r.remind_at as string | null) ?? null,
      repeat_rule: (r.repeat_rule as string | null) ?? null,
      parent_id: (r.parent_id as string | null) ?? null,
      meta: JSON.parse((r.meta as string) || '{}'),
      pinned: !!r.pinned,
      archived: !!r.archived,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      deleted_at: (r.deleted_at as string | null) ?? null,
      tags: byItem.get(r.id as string) ?? [],
    }));
  }

  async listItems(f: { type?: Item['type']; includeDeleted?: boolean; includeArchived?: boolean } = {}) {
    const where: string[] = [];
    const p: unknown[] = [];
    if (f.type) { where.push('type = ?'); p.push(f.type); }
    if (!f.includeDeleted) where.push('deleted_at IS NULL');
    if (!f.includeArchived) where.push('archived = 0');
    const sql = `SELECT * FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    return this.hydrate(await this.db.all(sql, p));
  }

  async getItem(id: string) {
    return (await this.hydrate(await this.db.all('SELECT * FROM items WHERE id = ?', [id])))[0] ?? null;
  }

  private async setTags(itemId: string, names: string[]) {
    await this.db.run('DELETE FROM item_tags WHERE item_id = ?', [itemId]);
    for (const name of names) {
      const t = await this.upsertTag(name);
      await this.db.run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?,?)', [itemId, t.id]);
    }
  }

  async createItem(input: NewItem) {
    const t = now();
    const id = uuidv7();
    await this.db.run(
      `INSERT INTO items (id,type,title,body,category,priority,status,due_at,remind_at,repeat_rule,parent_id,meta,pinned,archived,created_at,updated_at,deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      [
        id, input.type, input.title, input.body ?? null, input.category ?? null, input.priority ?? 2, input.status ?? null,
        input.due_at ?? null, input.remind_at ?? null, input.repeat_rule ?? null, input.parent_id ?? null,
        JSON.stringify(input.meta ?? {}), input.pinned ? 1 : 0, input.archived ? 1 : 0, t, t,
      ],
    );
    await this.setTags(id, input.tags ?? []);
    return (await this.getItem(id))!;
  }

  async updateItem(id: string, patch: Partial<Omit<Item, 'id' | 'created_at'>>) {
    const cur = await this.getItem(id);
    if (!cur) throw new Error(`Item ${id} not found`);
    const n = { ...cur, ...patch, updated_at: now() };
    await this.db.run(
      `UPDATE items SET type=?,title=?,body=?,category=?,priority=?,status=?,due_at=?,remind_at=?,repeat_rule=?,parent_id=?,meta=?,pinned=?,archived=?,updated_at=?,deleted_at=? WHERE id=?`,
      [
        n.type, n.title, n.body, n.category, n.priority, n.status, n.due_at, n.remind_at, n.repeat_rule, n.parent_id,
        JSON.stringify(n.meta), n.pinned ? 1 : 0, n.archived ? 1 : 0, n.updated_at, n.deleted_at, id,
      ],
    );
    if (patch.tags) await this.setTags(id, patch.tags);
    return (await this.getItem(id))!;
  }

  async deleteItem(id: string) { await this.db.run('UPDATE items SET deleted_at=?, updated_at=? WHERE id=?', [now(), now(), id]); }
  async restoreItem(id: string) { await this.db.run('UPDATE items SET deleted_at=NULL, updated_at=? WHERE id=?', [now(), id]); }
  async purgeTrash(days: number) {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await this.db.all<{ id: string }>('SELECT id FROM items WHERE deleted_at IS NOT NULL AND deleted_at <= ?', [cutoff]);
    for (const { id } of rows) {
      await this.db.run('DELETE FROM item_tags WHERE item_id=?', [id]);
      await this.db.run('DELETE FROM checklist WHERE item_id=?', [id]);
      await this.db.run('DELETE FROM items WHERE id=?', [id]);
    }
    return rows.length;
  }

  async listTags() { return this.db.all<Tag>('SELECT id,name,color FROM tags ORDER BY name'); }
  async upsertTag(name: string, color: string | null = null) {
    const n = name.trim().toLowerCase();
    const ex = (await this.db.all<Tag>('SELECT id,name,color FROM tags WHERE name=?', [n]))[0];
    if (ex) return ex;
    const tag = { id: uuidv7(), name: n, color };
    await this.db.run('INSERT INTO tags (id,name,color) VALUES (?,?,?)', [tag.id, n, color]);
    return tag;
  }
  async renameTag(id: string, name: string) { await this.db.run('UPDATE tags SET name=? WHERE id=?', [name.trim().toLowerCase(), id]); }
  async deleteTag(id: string) {
    await this.db.run('DELETE FROM item_tags WHERE tag_id=?', [id]);
    await this.db.run('DELETE FROM tags WHERE id=?', [id]);
  }

  async listCategories() { return this.db.all<Category>('SELECT id,name,icon,sort FROM categories ORDER BY sort'); }
  async addCategory(name: string) {
    const sort = (await this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))[0]?.n ?? 0;
    const c = { id: uuidv7(), name: name.trim(), icon: null, sort };
    await this.db.run('INSERT INTO categories (id,name,icon,sort) VALUES (?,?,NULL,?)', [c.id, c.name, sort]);
    return c;
  }
  async renameCategory(id: string, name: string) {
    const old = (await this.db.all<{ name: string }>('SELECT name FROM categories WHERE id=?', [id]))[0]?.name;
    await this.db.run('UPDATE categories SET name=? WHERE id=?', [name.trim(), id]);
    if (old) await this.db.run('UPDATE items SET category=? WHERE category=?', [name.trim(), old]);
  }
  async deleteCategory(id: string) { await this.db.run('DELETE FROM categories WHERE id=?', [id]); }

  private toEntry = (r: Row): ChecklistEntry => ({
    id: r.id as string, item_id: r.item_id as string, text: (r.text as string) ?? '', done: !!r.done, sort: Number(r.sort ?? 0),
  });
  async listChecklist(itemId: string) {
    return (await this.db.all('SELECT * FROM checklist WHERE item_id=? ORDER BY sort', [itemId])).map(this.toEntry);
  }
  async listAllChecklist() {
    return (await this.db.all('SELECT * FROM checklist ORDER BY sort')).map(this.toEntry);
  }
  async addChecklist(itemId: string, text: string) {
    const sort = (await this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM checklist WHERE item_id=?', [itemId]))[0]?.n ?? 0;
    const e: ChecklistEntry = { id: uuidv7(), item_id: itemId, text: text.trim(), done: false, sort };
    await this.db.run('INSERT INTO checklist (id,item_id,text,done,sort) VALUES (?,?,?,0,?)', [e.id, itemId, e.text, sort]);
    return e;
  }
  async updateChecklist(id: string, patch: { text?: string; done?: boolean }) {
    if (patch.text !== undefined) await this.db.run('UPDATE checklist SET text=? WHERE id=?', [patch.text.trim(), id]);
    if (patch.done !== undefined) await this.db.run('UPDATE checklist SET done=? WHERE id=?', [patch.done ? 1 : 0, id]);
  }
  async deleteChecklist(id: string) { await this.db.run('DELETE FROM checklist WHERE id=?', [id]); }
  async copyChecklist(fromItemId: string, toItemId: string) {
    for (const e of await this.listChecklist(fromItemId)) await this.addChecklist(toItemId, e.text);
  }

  async getSetting(key: string) {
    return (await this.db.all<{ value: string }>('SELECT value FROM settings WHERE key=?', [key]))[0]?.value ?? null;
  }
  async setSetting(key: string, value: string) {
    await this.db.run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
  }
}
