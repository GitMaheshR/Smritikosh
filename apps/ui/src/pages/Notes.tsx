import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bold, CheckSquare, Code, Heading2, List, MoreHorizontal, NotebookPen, Pin, Plus, RefreshCw, Search,
} from 'lucide-react';
import {
  isBlankNote, isLiveNote, listNotebooks, notebookOf, snippetFromBody, titleFromBody, toLocalIso, visibleNotes, type Item,
} from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, PageHeader, Sheet } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { toggleCheckbox } from '../markdown';
import { useGoBack } from '../components/Shell';
import { updatedPhrase } from '../format';

function parseFilter(f: string) {
  if (f === 'review') return { reviewLater: true } as const;
  if (f === 'none') return { notebook: null } as const;
  if (f.startsWith('nb:')) return { notebook: f.slice(3) } as const;
  return {} as const;
}

function NotesLibrary() {
  const { items, notebooks, notesView, setNotesView, search, newNote } = useApp();
  const nav = useNavigate();
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

  const create = async () => nav(`/notes/${await newNote(activeBook)}`);

  return (
    <div>
      <PageHeader eyebrow="Your thinking space" title="Notes library" subtitle="Collect ideas, keep context, find them when you need them."
        action={<button type="button" onClick={() => void create()} className="btn btn-primary"><Plus size={18} aria-hidden />New note</button>} />

      {all.length === 0 ? (
        <div className="panel"><EmptyState icon={NotebookPen} line="Jot down anything: ideas, things to remember, study notes." action="Write your first note" onAction={() => void create()} /></div>
      ) : (
        <>
          <div className="relative mb-3">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input aria-label="Search notes" className="input !pl-10" placeholder="Search your notes…" value={q} onChange={(e) => setNotesView({ q: e.target.value })} />
          </div>
          <div className="-mx-page-x mb-4 flex gap-2 overflow-x-auto px-page-x pb-1" role="group" aria-label="Categories">
            <Chip selected={filter === 'all'} onClick={() => setNotesView({ filter: 'all' })}>All notes <span className="num">{all.length}</span></Chip>
            {books.map((b) => (
              <Chip key={b.name} selected={filter === `nb:${b.name}`} onClick={() => setNotesView({ filter: `nb:${b.name}` })}>{b.name} <span className="num">{b.count}</span></Chip>
            ))}
            {books.length > 0 && unfiled > 0 && <Chip selected={filter === 'none'} onClick={() => setNotesView({ filter: 'none' })}>No category <span className="num">{unfiled}</span></Chip>}
            {reviewCount > 0 && <Chip selected={filter === 'review'} onClick={() => setNotesView({ filter: 'review' })}><RefreshCw size={13} aria-hidden />Review later <span className="num">{reviewCount}</span></Chip>}
          </div>
          {list.length === 0 ? (
            <p className="panel py-10 text-center text-body text-muted">{q.trim() ? 'No notes match your search.' : 'No notes here yet.'}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((n) => (
                <article key={n.id}>
                  <button type="button" onClick={() => nav(`/notes/${n.id}`)}
                    className="flex h-full min-h-0 w-full flex-col rounded-tile border border-border bg-surface p-4 text-left transition hover:border-primary/40">
                    <span className="flex items-center gap-2 text-label uppercase text-secondary">
                      <span className="truncate">{notebookOf(n) ?? 'Note'}{n.pinned && ' · Favorite'}</span>
                      {n.meta.revise === true && <RefreshCw size={12} className="shrink-0" aria-label="Review later" />}
                    </span>
                    <h2 className="mt-2 line-clamp-2 text-heading">{titleFromBody(n.body)}</h2>
                    <p className="mb-3 mt-1.5 line-clamp-3 flex-1 text-body text-muted">{snippetFromBody(n.body, 180) || 'No additional details yet.'}</p>
                    <footer className="border-t border-border pt-2.5 text-meta text-faint">
                      Updated {updatedPhrase(n.updated_at)}
                    </footer>
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActionsSheet({ note, onClose }: { note: Item; onClose: () => void }) {
  const { items, notebooks, store, refresh, removeWithUndo, addNotebook, showToast } = useApp();
  const goBack = useGoBack();
  const [newBook, setNewBook] = useState('');
  const [creating, setCreating] = useState(false);
  const books = useMemo(() => listNotebooks(items, notebooks), [items, notebooks]);
  const current = notebookOf(note);
  const revise = note.meta.revise === true;
  const row = 'flex min-h-touch w-full items-center gap-3 rounded-control px-3 text-body font-semibold hover:bg-surface-2';

  const patch = async (p: Partial<Item>) => { await store!.updateItem(note.id, p); await refresh(false); };
  const setMeta = (m: Record<string, unknown>) => patch({ meta: { ...note.meta, ...m } });

  async function chooseBook(value: string) {
    if (value === '__new') return setCreating(true);
    const { notebook: _drop, ...rest } = note.meta;
    void _drop;
    await patch({ meta: value ? { ...rest, notebook: value } : rest });
  }
  async function createBook() {
    const n = await addNotebook(newBook);
    if (!n) return showToast(newBook.trim() ? 'You already have a category with that name' : 'Type a name');
    await setMeta({ notebook: n });
    setCreating(false);
    setNewBook('');
  }

  return (
    <Sheet open onClose={onClose} label="Note options">
      <div className="max-h-[80vh] space-y-1 overflow-y-auto">
        <button type="button" className={row} onClick={() => void patch({ pinned: !note.pinned })}>
          <Pin size={18} aria-hidden />{note.pinned ? 'Remove from favorites' : 'Make a favorite'}
        </button>
        <button type="button" className={row} onClick={() => void setMeta({ revise: !revise })}>
          <RefreshCw size={18} aria-hidden />{revise ? 'Remove from Review later' : 'Review later'}
        </button>
        {revise && (
          <button type="button" className={`${row} pl-12 text-primary`} onClick={async () => { await setMeta({ revisedAt: toLocalIso(new Date()) }); showToast('Marked as reviewed'); }}>
            Mark as reviewed
          </button>
        )}

        <div className="px-3 pt-3">
          <label className="field-label" htmlFor="nb-pick">Category</label>
          <select id="nb-pick" className="input" value={current ?? ''} onChange={(e) => void chooseBook(e.target.value)}>
            <option value="">No category</option>
            {books.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
            <option value="__new">New category…</option>
          </select>
          {creating && (
            <div className="mt-2 flex gap-2">
              <input aria-label="New category name" autoFocus className="input flex-1" value={newBook} maxLength={40} onChange={(e) => setNewBook(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createBook(); } }} />
              <button type="button" className="btn btn-primary" onClick={() => void createBook()}>Add</button>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 px-3 pt-4">
          <button type="button" className="btn btn-danger" onClick={async () => { onClose(); goBack(); await removeWithUndo(note); }}>Delete note</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
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
    <div className="sticky bottom-0 z-10 flex justify-around rounded-b-control border-t border-border bg-surface py-1" role="toolbar" aria-label="Formatting">
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

  const book = notebookOf(note);
  return (
    <article className="min-w-0 max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-2" role="tablist" aria-label="Note view">
          <Chip selected={mode === 'read'} onClick={() => setMode('read')}>Read</Chip>
          <Chip selected={mode === 'edit'} onClick={() => setMode('edit')}>Edit</Chip>
        </div>
        <div className="flex items-center gap-1">
          {note.pinned && <Pin size={16} className="text-secondary" aria-label="Favorite" />}
          {note.meta.revise === true && <RefreshCw size={16} className="text-primary" aria-label="Review later" />}
          <button type="button" onClick={() => setMenu(true)} aria-label="Note options" className="flex w-touch items-center justify-center rounded-control text-muted hover:bg-surface-2">
            <MoreHorizontal size={22} />
          </button>
        </div>
      </div>

      {book && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip>{book}</Chip>
        </div>
      )}

      {mode === 'edit' ? (
        <div className="rounded-card border border-border bg-surface">
          <textarea ref={area} aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Start typing…"
            className="block w-full resize-none rounded-t-card bg-transparent p-4 text-body outline-none" />
          <FormatBar onApply={apply} />
        </div>
      ) : body.trim() ? (
        <div className="panel">
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
  if (!id) return <NotesLibrary />;
  const current = items.find((i) => i.id === id && isLiveNote(i)) ?? null;
  return current ? <NoteEditor key={current.id} note={current} /> : <p className="panel py-12 text-center text-body text-muted">That note is gone or was deleted.</p>;
}
