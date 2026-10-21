import { create } from 'zustand';
import {
  LessonIndex, SearchIndex, completeTask, descendants, hashPin, isOpenTask, missedReminders, pendingReminders,
  snoozeTime, toLocalIso, verifyPin,
  type Category, type ChecklistEntry, type DataStore, type Item, type Notifier, type ReminderEvent, type SnoozeKind, type Tag,
} from '@smritikosh/core';
import { createNotifier, createStore } from '../platform';

type Theme = 'system' | 'light' | 'dark';
export interface Toast { id: number; message: string; undo?: () => void | Promise<void> }

interface AppState {
  ready: boolean;
  store: DataStore | null;
  notifier: Notifier | null;
  items: Item[];
  tags: Tag[];
  categories: Category[];
  checklist: ChecklistEntry[];
  search: SearchIndex;
  lessons: LessonIndex;
  readingMode: boolean;
  pinHash: string | null;
  locked: boolean;
  theme: Theme;
  quickAddOpen: boolean;
  searchOpen: boolean;
  /** Item ids whose reminder fired and await Done / Snooze in the in-app prompt. */
  prompts: string[];
  /** Reminders that came due while the app was closed. */
  missed: Item[];
  toast: Toast | null;
  editingId: string | null;
  boot(): Promise<void>;
  /** reschedule=false for high-frequency saves (autosave) that cannot change reminders. */
  refresh(reschedule?: boolean): Promise<void>;
  setPin(pin: string | null): Promise<void>;
  unlock(pin: string): Promise<boolean>;
  lock(): void;
  setTheme(t: Theme): Promise<void>;
  setReadingMode(on: boolean): Promise<void>;
  openQuickAdd(v: boolean): void;
  openSearch(v: boolean): void;
  openEditor(id: string | null): void;
  showToast(message: string, undo?: Toast['undo']): void;
  complete(item: Item): Promise<void>;
  reopen(item: Item): Promise<void>;
  snooze(id: string, kind: SnoozeKind): Promise<void>;
  removeWithUndo(item: Item): Promise<void>;
  dismissPrompt(id: string): void;
  dismissMissed(): void;
  handleReminder(e: ReminderEvent): Promise<void>;
}

const search = new SearchIndex();
const lessons = new LessonIndex();
let toastSeq = 0;

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export const useApp = create<AppState>((set, get) => ({
  ready: false, store: null, notifier: null, items: [], tags: [], categories: [], checklist: [], search, lessons,
  readingMode: false, pinHash: null, locked: false, theme: 'system', quickAddOpen: false, searchOpen: false,
  prompts: [], missed: [], toast: null, editingId: null,

  async boot() {
    const store = await createStore();
    const notifier = await createNotifier();
    const [pinHash, theme, lastOpen, reading] = await Promise.all([
      store.getSetting('pin_hash'), store.getSetting('theme'), store.getSetting('last_open'), store.getSetting('reading_mode'),
    ]);
    const t = (theme as Theme | null) ?? 'system';
    applyTheme(t);
    set({ store, notifier, pinHash, theme: t, locked: !!pinHash, readingMode: reading === '1' });
    await store.purgeTrash(30);
    await get().refresh();

    const now = new Date();
    set({ missed: missedReminders(get().items, now, lastOpen ? new Date(lastOpen) : null) });
    const stamp = () => void store.setSetting('last_open', toLocalIso(new Date()));
    stamp();
    window.setInterval(stamp, 60_000);

    notifier.onEvent((e) => void get().handleReminder(e));
    void notifier.requestPermission().then(() => get().refresh());
    set({ ready: true });
  },

  async refresh(reschedule = true) {
    const { store, notifier } = get();
    const s = store!;
    const [items, tags, categories, checklist] = await Promise.all([
      s.listItems(), s.listTags(), s.listCategories(), s.listAllChecklist(),
    ]);
    search.build(items);
    lessons.build(items);
    set({ items, tags, categories, checklist });
    // Everything the notifier has scheduled is derived from data, so it can never drift.
    if (reschedule) await notifier?.rescheduleAll(pendingReminders(items, new Date()));
  },

  async setPin(pin) {
    const s = get().store!;
    const h = pin ? await hashPin(pin) : null;
    await s.setSetting('pin_hash', h ?? '');
    set({ pinHash: h, locked: false });
  },

  async unlock(pin) {
    const h = get().pinHash;
    if (!h) return true;
    const ok = await verifyPin(pin, h);
    if (ok) set({ locked: false });
    return ok;
  },

  lock() { if (get().pinHash) set({ locked: true }); },

  async setTheme(t) {
    await get().store!.setSetting('theme', t);
    applyTheme(t);
    set({ theme: t });
  },

  async setReadingMode(on) {
    await get().store!.setSetting('reading_mode', on ? '1' : '0');
    set({ readingMode: on });
  },

  openQuickAdd: (v) => set({ quickAddOpen: v, searchOpen: false }),
  openSearch: (v) => set({ searchOpen: v, quickAddOpen: false }),
  openEditor: (id) => set({ editingId: id }),

  showToast(message, undo) {
    const id = ++toastSeq;
    set({ toast: { id, message, undo } });
    window.setTimeout(() => get().toast?.id === id && set({ toast: null }), 6000);
  },

  async complete(item) {
    const s = get().store!;
    const { patch, next } = completeTask(item, new Date());
    await s.updateItem(item.id, patch);
    let nextId: string | null = null;
    if (next) {
      const created = await s.createItem(next);
      await s.copyChecklist(item.id, created.id);
      nextId = created.id;
    }
    set({ prompts: get().prompts.filter((p) => p !== item.id) });
    await get().refresh();
    get().showToast(next ? `Done. Next: ${next.due_at?.replace('T', ' ')}` : 'Done', async () => {
      await s.updateItem(item.id, { status: item.status ?? 'todo' });
      if (nextId) await s.deleteItem(nextId);
      await get().refresh();
    });
  },

  async reopen(item) {
    await get().store!.updateItem(item.id, { status: 'todo' });
    await get().refresh();
  },

  async snooze(id, kind) {
    const when = snoozeTime(kind, new Date());
    await get().store!.updateItem(id, { remind_at: when });
    set({ prompts: get().prompts.filter((p) => p !== id), missed: get().missed.filter((m) => m.id !== id) });
    await get().refresh();
    get().showToast(`Snoozed to ${when.replace('T', ' ')}`);
  },

  async removeWithUndo(item) {
    const s = get().store!;
    // Deleting a subject or topic takes its whole subtree to the trash; Undo brings it all back.
    const ids = item.type === 'note'
      ? [item.id, ...descendants(get().items, item.id).filter((d) => !d.deleted_at).map((d) => d.id)]
      : [item.id];
    for (const id of ids) await s.deleteItem(id);
    await get().refresh();
    const more = ids.length > 1 ? ` and ${ids.length - 1} inside` : '';
    get().showToast(`Deleted "${item.title}"${more}`, async () => {
      for (const id of ids) await s.restoreItem(id);
      await get().refresh();
    });
  },

  dismissPrompt: (id) => set({ prompts: get().prompts.filter((p) => p !== id) }),
  dismissMissed: () => set({ missed: [] }),

  async handleReminder(e) {
    const item = get().items.find((i) => i.id === e.id) ?? (await get().store!.getItem(e.id));
    if (!item || !isOpenTask(item)) return;
    if (e.action === 'done') return get().complete(item);
    if (e.action === 'snooze1h' || e.action === 'snoozeTomorrow') return get().snooze(item.id, e.action);
    if (!get().prompts.includes(item.id)) set({ prompts: [...get().prompts, item.id] });
  },
}));
