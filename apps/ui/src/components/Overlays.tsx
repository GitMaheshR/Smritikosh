import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseQuickAdd, lessonToItem, ITEM_TYPES, type Item, type ItemType } from '@smritikosh/core';
import { useApp } from '../store/app';
import { CommandBar, Sheet } from './ui';
import { MODULES, moduleForType } from '../modules';

export function QuickAdd() {
  const { quickAddOpen, openQuickAdd, store, categories, refresh } = useApp();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [forced, setForced] = useState<ItemType | null>(null);
  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, new Date(), categories.map((c) => c.name)) : null),
    [text, categories],
  );
  const close = () => { setText(''); setForced(null); openQuickAdd(false); };

  async function save() {
    if (!parsed || !store) return;
    const type = forced ?? parsed.type;
    if (type === 'lesson') {
      const it = await store.createItem({ type, tags: parsed.tags, ...lessonToItem({ situation: 'Other', whatHappened: '', lesson: parsed.title }) });
      await refresh(false);
      close();
      nav(`/lessons/${it.id}`);
      return;
    }
    const it = await store.createItem({
      type, title: parsed.title, due_at: parsed.due_at, remind_at: parsed.due_at,
      category: parsed.category, priority: parsed.priority, tags: parsed.tags,
      status: type === 'task' ? 'todo' : null,
      ...(type === 'note' ? { body: '', meta: { level: 'note' } } : {}),
    });
    await refresh();
    close();
    if (type === 'note') nav(`/notes/${it.id}`);
  }

  const type = forced ?? parsed?.type ?? 'task';
  return (
    <CommandBar open={quickAddOpen} onClose={close} label="Quick add">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)}
          placeholder="pay LIC premium tomorrow 6pm #bank !high"
          aria-label="Quick add"
          className="min-h-touch w-full rounded-control border border-border bg-surface-2 px-3 text-body outline-none placeholder:text-muted" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Item type">
          {ITEM_TYPES.filter((t) => t !== 'vault_link').map((t) => {
            const m = moduleForType(t);
            const on = type === t;
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => setForced(t)}
                className={`flex h-9 min-h-0 items-center gap-2 rounded-full border px-3 text-meta ${on ? 'border-transparent bg-accent-soft text-accent' : 'border-border text-muted'}`}>
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}
              </button>
            );
          })}
        </div>
        {parsed && (
          <p className="num text-meta text-muted">
            {parsed.title}
            {parsed.due_at && ` · due ${parsed.due_at.replace('T', ' ')}`}
            {parsed.category && ` · ${parsed.category}`}
            {parsed.priority === 1 && ' · high'}
            {parsed.tags.map((t) => ` · #${t}`)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-control border border-border px-4 text-body">Cancel</button>
          <button type="submit" disabled={!parsed} className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent disabled:opacity-50">Add</button>
        </div>
      </form>
    </CommandBar>
  );
}

export function SearchBar() {
  const { searchOpen, openSearch, search, items } = useApp();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const { openEditor } = useApp();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const groups = useMemo(() => [...search.searchGrouped(q)], [q, search, items]);
  const close = () => { setQ(''); openSearch(false); };
  const openResult = (it: Item | undefined, fallback: string) => {
    if (!it) return nav(fallback);
    if (it.type === 'task') { nav('/tasks'); openEditor(it.id); }
    else if (it.type === 'note') nav(`/notes/${it.id}`);
    else if (it.type === 'lesson') nav(`/lessons/${it.id}`);
    else nav(fallback);
  };
  return (
    <CommandBar open={searchOpen} onClose={close} label="Search">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything…" aria-label="Search"
        className="min-h-touch w-full rounded-control border border-border bg-surface-2 px-3 text-body outline-none placeholder:text-muted" />
      <div className="mt-3 max-h-[50vh] overflow-y-auto">
        {q && groups.length === 0 && <p className="py-6 text-center text-body text-muted">Nothing found.</p>}
        {groups.map(([type, ids]) => {
          const m = moduleForType(type);
          return (
            <div key={type} className="mb-3">
              <div className="mb-1 flex items-center gap-2 text-label uppercase text-muted">
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}
              </div>
              {ids.map((id) => (
                <button key={id} type="button" onClick={() => { close(); openResult(byId.get(id), m.path); }}
                  className="block min-h-touch w-full rounded-control px-2 text-left text-body hover:bg-surface-2">
                  {byId.get(id)?.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </CommandBar>
  );
}

export { Sheet, MODULES };
