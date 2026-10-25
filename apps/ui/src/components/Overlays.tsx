import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, NotebookPen, PenLine, Target, type LucideIcon } from 'lucide-react';
import { isBlankNote, isMilestone, lessonToItem, parseQuickAdd, type Item, type ItemType } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, CommandBar } from './ui';

type Kind = 'task' | 'note' | 'lesson' | 'goal';
const KINDS: { type: Kind; label: string; icon: LucideIcon; path: string; full: string }[] = [
  { type: 'task', label: 'Task', icon: ListChecks, path: '/tasks', full: '/tasks/new' },
  { type: 'note', label: 'Note', icon: NotebookPen, path: '/notes', full: '/notes' },
  { type: 'lesson', label: 'Journal', icon: PenLine, path: '/journal', full: '/journal/new' },
  { type: 'goal', label: 'Goal', icon: Target, path: '/goals', full: '/goals/new' },
];
const isKind = (t: ItemType): t is Kind => KINDS.some((k) => k.type === t);

/** Smart one-line capture ("pay LIC premium tomorrow 6pm #bank !high") with shortcuts to the full forms. */
export function QuickAdd() {
  const { quickAddOpen, openQuickAdd, store, categories, refresh } = useApp();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [forced, setForced] = useState<Kind | null>(null);
  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, new Date(), categories.map((c) => c.name)) : null),
    [text, categories],
  );
  const close = () => { setText(''); setForced(null); openQuickAdd(false); };
  const type: Kind = forced ?? (parsed && isKind(parsed.type) ? parsed.type : 'task');

  async function save() {
    if (!parsed || !store) return;
    if (type === 'lesson') {
      const it = await store.createItem({ type, ...lessonToItem({ situation: 'Other', whatHappened: '', lesson: parsed.title }) });
      await refresh(false);
      close();
      return nav(`/journal/${it.id}`);
    }
    if (type === 'goal') {
      const it = await store.createItem({ type, title: parsed.title, status: 'active', due_at: parsed.due_at?.slice(0, 10) ?? null });
      await refresh(false);
      close();
      return nav(`/goals/${it.id}`);
    }
    const it = await store.createItem({
      type, title: parsed.title, due_at: parsed.due_at, remind_at: type === 'task' ? parsed.due_at : null,
      category: type === 'task' ? parsed.category : null, priority: parsed.priority,
      status: type === 'task' ? 'todo' : null,
      ...(type === 'note' ? { body: `# ${parsed.title}\n`, meta: {} } : {}),
    });
    await refresh();
    close();
    if (type === 'note') nav(`/notes/${it.id}`);
  }

  return (
    <CommandBar open={quickAddOpen} onClose={close} label="Quick add">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <p className="eyebrow">Quick capture</p>
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Quick add"
          placeholder="pay LIC premium tomorrow 6pm #bank !high" className="input" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Item type">
          {KINDS.map((k) => (
            <Chip key={k.type} selected={type === k.type} onClick={() => setForced(k.type)}><k.icon size={14} aria-hidden />{k.label}</Chip>
          ))}
        </div>
        {parsed && (
          <p className="text-meta text-muted">
            {parsed.title}
            {type === 'task' && parsed.due_at && ` · due ${parsed.due_at.replace('T', ' ')}`}
            {type === 'task' && parsed.category && ` · ${parsed.category}`}
            {type === 'task' && parsed.priority === 1 && ' · high'}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-meta text-faint">
            Need more detail?{' '}
            {KINDS.filter((k) => k.type !== 'note').map((k, i) => (
              <span key={k.type}>{i > 0 && ' · '}<button type="button" className="text-link !text-meta" onClick={() => { close(); nav(k.full); }}>Full {k.label.toLowerCase()} form</button></span>
            ))}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="btn">Cancel</button>
            <button type="submit" disabled={!parsed} className="btn btn-primary disabled:opacity-50">Add</button>
          </div>
        </div>
      </form>
    </CommandBar>
  );
}

const GROUPS: { type: ItemType; label: string }[] = [
  { type: 'task', label: 'Tasks' }, { type: 'note', label: 'Notes' }, { type: 'lesson', label: 'Journal' }, { type: 'goal', label: 'Goals' },
];

export function SearchBar() {
  const { searchOpen, openSearch, search, items } = useApp();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const groups = useMemo(() => {
    const found = search.searchGrouped(q);
    return GROUPS.map((g) => ({ ...g, rows: (found.get(g.type) ?? []).map((id) => byId.get(id)).filter((i): i is Item => !!i && !isBlankNote(i)) }))
      .filter((g) => g.rows.length > 0);
  }, [q, search, byId]);
  const close = () => { setQ(''); openSearch(false); };

  const open = (it: Item) => {
    close();
    if (it.type === 'task') nav(`/tasks/${it.id}`);
    else if (it.type === 'note') nav(`/notes/${it.id}`);
    else if (it.type === 'lesson') nav(`/journal/${it.id}`);
    else if (it.type === 'goal') nav(`/goals/${isMilestone(it) && it.parent_id ? it.parent_id : it.id}`);
  };

  return (
    <CommandBar open={searchOpen} onClose={close} label="Search">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks, notes, journal, goals…" aria-label="Search" className="input" />
      <div className="mt-3 max-h-[50vh] overflow-y-auto">
        {q.trim() && groups.length === 0 && <p className="py-6 text-center text-body text-muted">Nothing found.</p>}
        {groups.map((g) => (
          <div key={g.type} className="mb-3">
            <div className="mb-1 px-1 text-label uppercase text-faint">{g.label}</div>
            {g.rows.map((it) => (
              <button key={it.id} type="button" onClick={() => open(it)} className="block min-h-touch w-full truncate rounded-control px-3 text-left text-body font-semibold hover:bg-surface-2">
                {it.title}
              </button>
            ))}
          </div>
        ))}
      </div>
    </CommandBar>
  );
}
