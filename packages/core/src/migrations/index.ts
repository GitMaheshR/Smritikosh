export interface Migration {
  version: number;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT,
  priority INTEGER DEFAULT 2,
  status TEXT,
  due_at TEXT,
  remind_at TEXT,
  repeat_rule TEXT,
  parent_id TEXT REFERENCES items(id),
  meta TEXT DEFAULT '{}',
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, color TEXT);
CREATE TABLE item_tags (item_id TEXT, tag_id TEXT, PRIMARY KEY (item_id, tag_id));
CREATE TABLE checklist (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, text TEXT, done INTEGER DEFAULT 0, sort INTEGER);
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, icon TEXT, sort INTEGER);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX idx_items_type_status ON items(type, status);
CREATE INDEX idx_items_due ON items(due_at);
`,
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1]!.version;
