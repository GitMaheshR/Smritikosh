import { create } from 'zustand';
import {
  LessonIndex, NOTEBOOKS_SETTING, isMilestone, milestonesOf, SearchIndex, completeTask, hasNotebook, hashPin, isBlankNote, isOpenTask,
  missedReminders, normalizeNotebookName, notebookOf, parseNotebookList, pendingReminders, removeFromList,
  renameInList, runNotesMigration, snoozeTime, toLocalIso, verifyPin, withNotebook,
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
  /** True when the system refused to schedule reminders (notifications off). The app keeps working. */
  remindersBlocked: boolean;
  /** Saved notebook names, in the user's order (notes may also use names that are not saved yet). */
  notebooks: string[];
  /** Notes screen state kept across navigation: search text and filter ("all", "review", "none" or "nb:<name>"). */
  notesView: { q: string; filter: string };
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
  boot(): Promise<void>;
  /** reschedule=false for high-frequency saves (autosave) that cannot change reminders. */
  refresh(reschedule?: boolean): Promise<void>;
  setPin(pin: string | null): Promise<void>;
  unlock(pin: string): Promise<boolean>;
  lock(): void;
  setTheme(t: Theme): Promise<void>;
  setReadingMode(on: boolean): Promise<void>;
  setNotesView(v: Partial<AppState['notesView']>): void;
  /** Returns the saved name, or null if it was empty or already exists. */
  addNotebook(name: string): Promise<string | null>;
  renameNotebook(from: string, to: string): Promise<boolean>;
  deleteNotebook(name: string): Promise<void>;
  /** Deletes a task category; tasks that used it keep working, just without a category. Returns how many tasks changed. */
  deleteTaskCategory(id: string): Promise<number>;
  openQuickAdd(v: boolean): void;
  openSearch(v: boolean): void;
  showToast(message: string, undo?: Toast['undo']): void;
  complete(item: Item): Promise<void>;
  reopen(item: Item): Promise<void>;
  snooze(id: string, kind: SnoozeKind): Promise<void>;
  removeWithUndo(item: Item): Promise<void>;
  /** Creates an empty note (hidden until typed into) and returns its id. */
  newNote(notebook?: string | null): Promise<string>;
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
  readingMode: false, remindersBlocked: false, notebooks: [], notesView: { q: '', filter: 'all' }, pinHash: null, locked: false, theme: 'system', quickAddOpen: false, searchOpen: false,
  prompts: [], missed: [], toast: null,

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
    await runNotesMigration(store);
    // Notes opened with "New note" but never typed into are discarded (the editor does this on exit; this covers a crash).
    for (const n of await store.listItems({ type: 'note' })) if (isBlankNote(n)) await store.deleteItem(n.id);
    set({ notebooks: parseNotebookList(await store.getSetting(NOTEBOOKS_SETTING)) });
    await get().refresh();

    const now = new Date();
    set({ missed: missedReminders(get().items, now, lastOpen ? new Date(lastOpen) : null) });
    const stamp = () => void store.setSetting('last_open', toLocalIso(new Date()));
    stamp();
    window.setInterval(stamp, 60_000);

    notifier.onEvent((e) => void get().handleReminder(e));
    void notifier.requestPermission().then(() => get().refresh()).catch(() => set({ remindersBlocked: true }));
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
    if (reschedule) {
      try {
        await notifier?.rescheduleAll(pendingReminders(items, new Date()));
        if (get().remindersBlocked) set({ remindersBlocked: false });
      } catch (e) {
        // Reminders failing (for example notifications switched off for the app) must never stop the app from working.
        console.warn('Reminders could not be scheduled', e);
        if (!get().remindersBlocked) set({ remindersBlocked: true });
      }
    }
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

  setNotesView: (v) => set({ notesView: { ...get().notesView, ...v } }),

  async addNotebook(name) {
    const n = normalizeNotebookName(name);
    if (!n || hasNotebook(get().notebooks, n)) return null;
    const next = withNotebook(get().notebooks, n);
    await get().store!.setSetting(NOTEBOOKS_SETTING, JSON.stringify(next));
    set({ notebooks: next });
    return n;
  },

  async renameNotebook(from, to) {
    const n = normalizeNotebookName(to);
    const { store, notebooks, items } = get();
    const clash = notebooks.some((x) => x.toLowerCase() === n.toLowerCase() && x.toLowerCase() !== from.toLowerCase());
    if (!n || clash) return false;
    const next = renameInList(notebooks, from, n);
    await store!.setSetting(NOTEBOOKS_SETTING, JSON.stringify(next));
    for (const i of items.filter((x) => x.type === 'note' && notebookOf(x)?.toLowerCase() === from.toLowerCase())) {
      await store!.updateItem(i.id, { meta: { ...i.meta, notebook: n } });
    }
    set({ notebooks: next, notesView: get().notesView.filter === `nb:${from}` ? { ...get().notesView, filter: `nb:${n}` } : get().notesView });
    await get().refresh(false);
    return true;
  },

  async deleteNotebook(name) {
    const { store, notebooks, items } = get();
    const next = removeFromList(notebooks, name);
    await store!.setSetting(NOTEBOOKS_SETTING, JSON.stringify(next));
    // The notes stay; they just no longer belong to a notebook.
    for (const i of items.filter((x) => x.type === 'note' && notebookOf(x)?.toLowerCase() === name.toLowerCase())) {
      const { notebook: _n, ...meta } = i.meta;
      void _n;
      await store!.updateItem(i.id, { meta });
    }
    set({ notebooks: next, notesView: get().notesView.filter === `nb:${name}` ? { ...get().notesView, filter: 'all' } : get().notesView });
    await get().refresh(false);
  },

  async deleteTaskCategory(id) {
    const { store, categories, items } = get();
    const c = categories.find((x) => x.id === id);
    if (!c) return 0;
    const affected = items.filter((i) => i.type === 'task' && i.category === c.name);
    for (const t of affected) await store!.updateItem(t.id, { category: null });
    await store!.deleteCategory(id);
    await get().refresh(false);
    return affected.length;
  },

  openQuickAdd: (v) => set({ quickAddOpen: v, searchOpen: false }),
  openSearch: (v) => set({ searchOpen: v, quickAddOpen: false }),

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
    // A goal takes its milestones with it; Undo brings them all back.
    const ids = item.type === 'goal' && !isMilestone(item) ? [item.id, ...milestonesOf(get().items, item.id).map((m) => m.id)] : [item.id];
    for (const id of ids) await s.deleteItem(id);
    await get().refresh();
    get().showToast(`Deleted "${item.title}"`, async () => {
      for (const id of ids) await s.restoreItem(id);
      await get().refresh();
    });
  },

  async newNote(notebook) {
    const it = await get().store!.createItem({ type: 'note', title: 'Untitled', body: '', meta: notebook ? { notebook } : {} });
    await get().refresh(false); // so the editor finds it before we navigate
    return it.id;
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
