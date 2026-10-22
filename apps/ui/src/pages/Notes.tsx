import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen, Bold, CheckSquare, Code, Heading2, List, MoreHorizontal, Pencil, Pin, Plus, RefreshCw, Search, Trash2,
} from 'lucide-react';
import {
  isBlankNote, isLiveNote, listNotebooks, notebookOf, snippetFromBody, titleFromBody, toLocalIso, visibleNotes, type Item,
} from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, Sheet } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { toggleCheckbox } from '../markdown';
import { useGoBack } from '../components/Shell';

const field = 'min-h-touch w-full rounded-control border border-border bg-surface-2 px-3 text-body outline-none';

function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

function parseFilter(f: string) {
  if (f === 'review') return { reviewLater: true } as const;
  if (f === 'none') return { notebook: null } as const;
  if (f.startsWith('nb:')) return { notebook: f.slice(3) } as const;
  return {} as const;
}

function NotebookSheet({ onClose }: { onClose: () => void }) {
  const { addNotebook, setNotesView } = useApp();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = await addNotebook(name);
    if (!n) return setErr(name.trim() ? 'You already have a notebook with that name.' : 'Type a name.');
    setNotesView({ filter: `nb:${n}` });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} label="New notebook">
      <form onSubmit={save} className="space-y-3">
        <label className="block text-label uppercase text-muted" htmlFor="nb-name">New notebook</label>
        <input id="nb-name" autoFocus className={field} value={name} maxLength={40} placeholder="e.g. Work, Recipes, Travel"
          onChange={(e) => { setName(e.target.value); setErr(''); }} />
        {err && <p role="alert" className="text-meta text-overdue">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-control border border-border px-4 text-body">Cancel</button>
          <button type="submit" className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent">Create</button>
        </div>
      </form>
    </Sheet>
  );
}

function NotesList({ activeId }: { activeId: string | undefined }) {
  const { items, notebooks, notesView, setNotesView, search, store, refresh, renameNotebook, deleteNotebook, showToast } = useApp();
  const nav = useNavigate();
  const [addingBook, setAddingBook] = useState(false);
  const { q, filter } = notesView;

  const books = useMemo(() => listNotebooks(items, notebooks), [items, notebooks]);
  const all = useMemo(() => visibleNotes(items), [items]);
  const reviewCount = useMemo(() => all.filter((n) => n.meta.revise === true).length, [all]);
  const unfiled = useMemo(() => all.filter((n) => !notebookOf(n)).length, [all]);
  const ids = useMemo(
    () => (q.trim() ? new Set(search.search(q, { type: 'note' }).map((r) => r.id as string)) : null),
    [q, search, items],
  );
  const list = useMemo(() => visibleNotes(items, { ...parseFilter(filter), ids }), [items, filter, ids]);
  const activeBook = filter.startsWith('nb:') ? filter.slice(3) : null;

  async function newNote() {
    const it = await store!.createItem({ type: 'note', title: 'Untitled', body: '', meta: activeBook ? { notebook: activeBook } : {} });
    await refresh(false); // so the editor finds it before we navigate
    nav(`/notes/${it.id}`);
  }

  async function rename() {
    if (!activeBook) return;
    const n = window.prompt('Rename notebook', activeBook);
    if (!n?.trim() || n.trim() === activeBook) return;
    if (!(await renameNotebook(activeBook, n))) showToast('A notebook with that name already exists');
  }

  async function remove() {
    if (!activeBook) return;
    const count = books.find((b) => b.name === activeBook)?.count ?? 0;
    if (!window.confirm(`Delete the notebook "${activeBook}"? Its ${count} note${count === 1 ? '' : 's'} will be kept, just without a notebook.`)) return;
    await deleteNotebook(activeBook);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-title"><BookOpen className="text-m-notes" size={24} aria-hidden />Notes</h1>
        <button type="button" onClick={() => void newNote()} className="flex items-center gap-2 rounded-control bg-accent px-4 text-body font-semibold text-on-accent">
          <Plus size={18} aria-hidden />New note
        </button>
      </div>

      {all.length > 0 && (
        <>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input aria-label="Search notes" className={`${field} !pl-10`} placeholder="Search notes" value={q}
              onChange={(e) => setNotesView({ q: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Notebooks">
            <Chip selected={filter === 'all'} onClick={() => setNotesView({ filter: 'all' })}>All · {all.length}</Chip>
            {books.map((b) => (
              <Chip key={b.name} selected={filter === `nb:${b.name}`} onClick={() => setNotesView({ filter: `nb:${b.name}` })}>{b.name} · {b.count}</Chip>
            ))}
            {books.length > 0 && unfiled > 0 && <Chip selected={filter === 'none'} onClick={() => setNotesView({ filter: 'none' })}>No notebook · {unfiled}</Chip>}
            {reviewCount > 0 && <Chip selected={filter === 'review'} onClick={() => setNotesView({ filter: 'review' })}><RefreshCw size={13} className="mr-1" aria-hidden />Review later · {reviewCount}</Chip>}
            <Chip onClick={() => setAddingBook(true)}><Plus size={13} className="mr-1" aria-hidden />Notebook</Chip>
          </div>
          {activeBook && (
            <div className="flex gap-4 text-meta">
              <button type="button" onClick={() => void rename()} className="flex min-h-0 items-center gap-1 py-1 text-muted"><Pencil size={14} aria-hidden />Rename notebook</button>
              <button type="button" onClick={() => void remove()} className="flex min-h-0 items-center gap-1 py-1 text-muted"><Trash2 size={14} aria-hidden />Delete notebook</button>
            </div>
          )}
        </>
      )}

      {all.length === 0 ? (
        <EmptyState icon={BookOpen} color="text-m-notes" line="Jot down anything: ideas, things to remember, study notes." action="Write your first note" onAction={() => void newNote()} />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-body text-muted">{q.trim() ? 'No notes match your search.' : 'No notes here yet.'}</p>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {list.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => nav(`/notes/${n.id}`)} aria-current={activeId === n.id ? 'true' : undefined}
                className={`block w-full px-4 py-3 text-left ${activeId === n.id ? 'bg-accent-soft' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-body font-semibold">{titleFromBody(n.body)}</span>
                  {n.pinned && <Pin size={14} className="shrink-0 text-muted" aria-label="Pinned" />}
                  {n.meta.revise === true && <RefreshCw size={14} className="shrink-0 text-m-notes" aria-label="Review later" />}
                </div>
                {snippetFromBody(n.body) && <p className="truncate text-meta text-muted">{snippetFromBody(n.body)}</p>}
                <p className="num mt-1 flex gap-2 text-meta text-muted">
                  <span>{shortDate(n.updated_at)}</span>
                  {notebookOf(n) && filter === 'all' && <span className="truncate">· {notebookOf(n)}</span>}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {addingBook && <NotebookSheet onClose={() => setAddingBook(false)} />}
    </div>
  );
}

function ActionsSheet({ note, onClose }: { note: Item; onClose: () => void }) {
  const { items, notebooks, store, refresh, removeWithUndo, addNotebook, showToast } = useApp();
  const goBack = useGoBack();
  const [tags, setTags] = useState(note.tags.join(', '));
  const [newBook, setNewBook] = useState('');
  const [creating, setCreating] = useState(false);
  const books = useMemo(() => listNotebooks(items, notebooks), [items, notebooks]);
  const current = notebookOf(note);
  const revise = note.meta.revise === true;
  const row = 'flex min-h-touch w-full items-center justify-between rounded-control px-3 text-body hover:bg-surface-2';

  const patch = async (p: Partial<Item>) => { await store!.updateItem(note.id, p); await refresh(false); };
  const setMeta = (m: Record<string, unknown>) => patch({ meta: { ...note.meta, ...m } });
  const saveTags = () => patch({ tags: tags.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean) });

  async function chooseBook(value: string) {
    if (value === '__new') return setCreating(true);
    const { notebook: _drop, ...rest } = note.meta;
    void _drop;
    await patch({ meta: value ? { ...rest, notebook: value } : rest });
  }
  async function createBook() {
    const n = await addNotebook(newBook);
    if (!n) return showToast(newBook.trim() ? 'You already have a notebook with that name' : 'Type a name');
    await setMeta({ notebook: n });
    setCreating(false);
    setNewBook('');
  }

  return (
    <Sheet open onClose={onClose} label="Note options">
      <div className="max-h-[80vh] space-y-1 overflow-y-auto">
        <button type="button" className={row} onClick={() => void patch({ pinned: !note.pinned })}>
          <span className="flex items-center gap-3"><Pin size={18} aria-hidden />{note.pinned ? 'Unpin' : 'Pin to top'}</span>
        </button>
        <button type="button" className={row} onClick={() => void setMeta({ revise: !revise })}>
          <span className="flex items-center gap-3"><RefreshCw size={18} aria-hidden />{revise ? 'Remove from Review later' : 'Review later'}</span>
        </button>
        {revise && (
          <button type="button" className={`${row} text-accent`} onClick={async () => { await setMeta({ revisedAt: toLocalIso(new Date()) }); showToast('Marked as reviewed'); }}>
            <span className="pl-9">Mark as reviewed</span>
          </button>
        )}

        <div className="px-3 pt-2">
          <label className="mb-1 block text-label uppercase text-muted" htmlFor="nb-pick">Notebook</label>
          <select id="nb-pick" className={field} value={current ?? ''} onChange={(e) => void chooseBook(e.target.value)}>
            <option value="">No notebook</option>
            {books.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
            <option value="__new">New notebook…</option>
          </select>
          {creating && (
            <div className="mt-2 flex gap-2">
              <input aria-label="New notebook name" autoFocus className={`${field} flex-1`} value={newBook} maxLength={40} onChange={(e) => setNewBook(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createBook(); } }} />
              <button type="button" className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent" onClick={() => void createBook()}>Add</button>
            </div>
          )}
        </div>

        <div className="px-3 pt-2">
          <label className="mb-1 block text-label uppercase text-muted" htmlFor="tag-input">Tags</label>
          <input id="tag-input" className={field} placeholder="comma separated" value={tags} onChange={(e) => setTags(e.target.value)}
            onBlur={() => void saveTags()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveTags(); } }} />
        </div>

        <div className="flex justify-between gap-2 px-3 pt-4">
          <button type="button" className="min-h-touch rounded-control border border-border px-4 text-body text-overdue"
            onClick={async () => { onClose(); goBack(); await removeWithUndo(note); }}>Delete note</button>
          <button type="button" className="min-h-touch rounded-control bg-accent px-4 text-body font-semibold text-on-accent" onClick={async () => { await saveTags(); onClose(); }}>Done</button>
        </div>
      </div>
    </Sheet>
  );
}

type FormatKind = 'bold' | 'heading' | 'list' | 'check' | 'code';

function FormatBar({ onApply }: { onApply: (kind: FormatKind) => void }) {
  const b = 'flex w-touch items-center justify-center rounded-control text-muted hover:bg-surface-2';
  // pointer-down is cancelled so the text box keeps focus (and the keyboard stays open) while a button is pressed
  const bind = (kind: FormatKind) => ({ onPointerDown: (e: React.PointerEvent) => e.preventDefault(), onClick: () => onApply(kind) });
  return (
    <div className="sticky bottom-0 z-10 flex justify-around border-t border-border bg-surface py-1" role="toolbar" aria-label="Formatting">
      <button type="button" className={b} aria-label="Bold" {...bind('bold')}><Bold size={20} /></button>
      <button type="button" className={b} aria-label="Heading" {...bind('heading')}><Heading2 size={20} /></button>
      <button type="button" className={b} aria-label="Bulleted list" {...bind('list')}><List size={20} /></button>
      <button type="button" className={b} aria-label="Checklist" {...bind('check')}><CheckSquare size={20} /></button>
      <button type="button" className={b} aria-label="Code block" {...bind('code')}><Code size={20} /></button>
    </div>
  );
}

function NoteEditor({ note }: { note: Item }) {
  const { store, refresh } = useApp();
  const [body, setBody] = useState(note.body ?? '');
  const [mode, setMode] = useState<'edit' | 'read'>(isBlankNote(note) ? 'edit' : 'read');
  const [menu, setMenu] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  const saved = useRef(body);
  const latest = useRef(body);
  latest.current = body;

  // Grow the text box with its content so the page scrolls instead of the box.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 240)}px`;
  }, [body, mode]);

  useEffect(() => { if (mode === 'edit') area.current?.focus(); }, [mode]);

  // Autosave 600 ms after the last keystroke. The title is simply the first line.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = window.setTimeout(async () => {
      saved.current = body;
      await store!.updateItem(note.id, { title: titleFromBody(body), body });
      await refresh(false);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  // Leaving the note: save what was typed in the last moment; a note left blank is discarded.
  // Deferred a tick and skipped if the editor mounts again straight away (React dev mode re-mounts once).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.setTimeout(() => {
        if (alive.current) return;
        const text = latest.current;
        const s = store!;
        void (async () => {
          if (!text.trim()) await s.deleteItem(note.id);
          else if (text !== saved.current) await s.updateItem(note.id, { title: titleFromBody(text), body: text });
          await useApp.getState().refresh(false);
        })();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(kind: FormatKind) {
    const el = area.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = body.slice(s, e);
    let next: string, from: number, to: number;
    if (kind === 'bold') {
      const t = sel || 'bold';
      next = `${body.slice(0, s)}**${t}**${body.slice(e)}`; from = s + 2; to = from + t.length;
    } else if (kind === 'code') {
      const t = sel || 'code';
      next = `${body.slice(0, s)}\n\`\`\`\n${t}\n\`\`\`\n${body.slice(e)}`; from = s + 5; to = from + t.length;
    } else {
      const prefix = kind === 'heading' ? '## ' : kind === 'list' ? '- ' : '- [ ] ';
      const ls = body.lastIndexOf('\n', s - 1) + 1;
      next = `${body.slice(0, ls)}${prefix}${body.slice(ls)}`; from = s + prefix.length; to = e + prefix.length;
    }
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from, to); });
  }

  const tags = note.tags;
  const book = notebookOf(note);
  return (
    <article className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-2" role="tablist" aria-label="Note view">
          <Chip selected={mode === 'read'} onClick={() => setMode('read')}>Read</Chip>
          <Chip selected={mode === 'edit'} onClick={() => setMode('edit')}>Edit</Chip>
        </div>
        <div className="flex items-center gap-1">
          {note.pinned && <Pin size={16} className="text-muted" aria-label="Pinned" />}
          {note.meta.revise === true && <RefreshCw size={16} className="text-m-notes" aria-label="Review later" />}
          <button type="button" onClick={() => setMenu(true)} aria-label="Note options" className="flex w-touch items-center justify-center rounded-control text-muted hover:bg-surface-2">
            <MoreHorizontal size={22} />
          </button>
        </div>
      </div>

      {(book || tags.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {book && <Chip>{book}</Chip>}
          {tags.map((t) => <Chip key={t}>#{t}</Chip>)}
        </div>
      )}

      {mode === 'edit' ? (
        <>
          <textarea ref={area} aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Start typing…"
            className="block w-full resize-none rounded-control border border-border bg-surface px-3 py-3 text-body outline-none" />
          <FormatBar onApply={apply} />
        </>
      ) : body.trim() ? (
        <div className="rounded-control border border-border bg-surface p-4">
          <Markdown source={body} onToggleCheck={(i) => setBody((b) => toggleCheckbox(b, i))} />
        </div>
      ) : (
        <p className="py-8 text-center text-body text-muted">Nothing written yet. Tap Edit to start.</p>
      )}

      {menu && <ActionsSheet note={note} onClose={() => setMenu(false)} />}
    </article>
  );
}

export function NotesPage() {
  const { id } = useParams();
  const { items } = useApp();
  const current = id ? items.find((i) => i.id === id && isLiveNote(i)) ?? null : null;

  return (
    <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
      <div className={id ? 'hidden lg:block' : ''}><NotesList activeId={id} /></div>
      <div className="min-w-0">
        {id ? (
          current ? <NoteEditor key={current.id} note={current} /> : <p className="py-12 text-center text-body text-muted">That note is gone or was deleted.</p>
        ) : (
          <p className="hidden pt-16 text-center text-body text-muted lg:block">Pick a note to read it, or start a new one.</p>
        )}
      </div>
    </div>
  );
}
