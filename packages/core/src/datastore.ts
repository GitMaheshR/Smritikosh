import type { Category, ChecklistEntry, Item, NewItem, Tag } from './types';

/** The only way UI code touches persistence. Adapters: electron-ipc (Windows), capacitor-sqlite (Android). */
export interface DataStore {
  init(): Promise<void>;
  listItems(filter?: { type?: Item['type']; includeDeleted?: boolean; includeArchived?: boolean }): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  createItem(input: NewItem): Promise<Item>;
  updateItem(id: string, patch: Partial<Omit<Item, 'id' | 'created_at'>>): Promise<Item>;
  /** Soft delete (trash, 30 days). */
  deleteItem(id: string): Promise<void>;
  restoreItem(id: string): Promise<void>;
  purgeTrash(olderThanDays: number): Promise<number>;

  listTags(): Promise<Tag[]>;
  upsertTag(name: string, color?: string | null): Promise<Tag>;
  renameTag(id: string, name: string): Promise<void>;
  deleteTag(id: string): Promise<void>;

  listCategories(): Promise<Category[]>;
  addCategory(name: string): Promise<Category>;
  renameCategory(id: string, name: string): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  listChecklist(itemId: string): Promise<ChecklistEntry[]>;
  /** All checklist rows (for progress counts in lists). */
  listAllChecklist(): Promise<ChecklistEntry[]>;
  addChecklist(itemId: string, text: string): Promise<ChecklistEntry>;
  updateChecklist(id: string, patch: { text?: string; done?: boolean }): Promise<void>;
  deleteChecklist(id: string): Promise<void>;
  /** Copy all entries, unchecked (used when a repeating task is copied forward). */
  copyChecklist(fromItemId: string, toItemId: string): Promise<void>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

export type ReminderAction = 'done' | 'snooze1h' | 'snoozeTomorrow' | 'open';
export interface ReminderEvent { id: string; action: ReminderAction | 'fired' }

/** Platform notifications. UI code uses only this; adapters live in apps/desktop (IPC) and apps/ui/platform (Capacitor). */
export interface Notifier {
  /** Ask for notification (and on Android, exact-alarm) permission. Resolves true if reminders can fire. */
  requestPermission(): Promise<boolean>;
  /** Replace everything scheduled with exactly these reminders. Called on launch and after every data change. */
  rescheduleAll(entries: { id: string; title: string; at: string }[]): Promise<void>;
  onEvent(handler: (e: ReminderEvent) => void): () => void;
  /** Desktop only. */
  getAutoStart?(): Promise<boolean>;
  setAutoStart?(on: boolean): Promise<void>;
}
