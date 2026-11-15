import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { MoreHorizontal, NotebookPen, Pencil, Pin, Plus, RefreshCw, Search } from 'lucide-react';
import {
  RICH_FORMAT, htmlToText, isBlankNote, isLiveNote, listNotebooks, noteSnippet, noteTitle, notebookOf, titleFromBody, toLocalIso, visibleNotes, type Item,
} from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, PageHeader, Sheet } from '../components/ui';
import { RichToolbar } from '../components/RichToolbar';
import { noteForEditing } from '../noteHtml';
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
                    <h2 className="mt-2 line-clamp-2 text-heading">{noteTitle(n)}</h2>
                    <p className="mb-3 mt-1.5 line-clamp-3 flex-1 text-body text-muted">{noteSnippet(n, 180) || 'No additional details yet.'}</p>
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

function ActionsSheet({ note, onClose, onDelete }: { note: Item; onClose: () => void; onDelete: () => void }) {
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
          <button type="button" className="btn btn-danger" onClick={async () => { onDelete(); onClose(); goBack(); await removeWithUndo(note); }}>Delete note</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Sheet>
  );
}

const SAVE_PROMPT = 'You have changes that are not saved.';

/** The note screen: reading view, and an editing view with a Title field, formatting toolbar, Save and Cancel. */
function NoteEditor({ note }: { note: Item }) {
  const { store, refresh, showToast, readingMode } = useApp();
  const goBack = useGoBack();
  const initial = useMemo(() => noteForEditing(note), []); // read once: the editor owns the text while this screen is open
  const [title, setTitle] = useState(initial.title);
  const [mode, setMode] = useState<'edit' | 'read'>(isBlankNote(note) ? 'edit' : 'read');
  const [menu, setMenu] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [empty, setEmpty] = useState(!initial.html);
  const [ask, setAsk] = useState<'leave' | 'cancel' | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef(title);
  const dirtyRef = useRef(false);
  const saved = useRef({ title: initial.title, html: '', blank: isBlankNote(note) });
  titleRef.current = title;
  dirtyRef.current = dirty;

  const recompute = () => {
    const ed = editorRef.current;
    if (!ed) return;
    setEmpty(ed.isEmpty);
    setDirty(titleRef.current !== saved.current.title || ed.getHTML() !== saved.current.html);
  };

  // Writes the note to the database. The title is the Title field, or the first line when that is left empty.
  async function write(): Promise<boolean> {
    const ed = editorRef.current;
    if (!ed || !store) return false;
    const html = ed.getHTML();
    const text = htmlToText(html);
    const typedTitle = titleRef.current.trim();
    if (!typedTitle && !text) return false;
    const finalTitle = typedTitle || titleFromBody(text);
    await store.updateItem(note.id, { title: finalTitle, body: html, meta: { ...note.meta, fmt: RICH_FORMAT } });
    saved.current = { title: finalTitle, html, blank: false };
    titleRef.current = finalTitle;
    setTitle(finalTitle);
    setDirty(false);
    await refresh(false);
    return true;
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }), // links stay inert in this offline app
      TextStyle, FontSize, TaskList,
      TaskItem.configure({
        nested: true,
        // Ticking a box while reading: apply it to the text and save straight away.
        onReadOnlyChecked: (_node, checked) => {
          const ed = editorRef.current;
          if (!ed) return false;
          // The item handed over can be an older copy, so find the box that just changed: the first one on screen whose
          // state differs from the text, in document order.
          const boxes = Array.from(ed.view.dom.querySelectorAll<HTMLInputElement>('ul[data-type="taskList"] > li > label > input[type="checkbox"]'));
          let index = 0;
          let at = -1;
          ed.state.doc.descendants((n, pos) => {
            if (n.type.name !== 'taskItem') return true;
            if (at < 0 && boxes[index] && boxes[index]!.checked !== n.attrs.checked) at = pos;
            index++;
            return true;
          });
          if (at < 0) return false;
          const target = ed.state.doc.nodeAt(at)!;
          ed.view.dispatch(ed.state.tr.setNodeMarkup(at, undefined, { ...target.attrs, checked }));
          void write();
          return true;
        },
      }),
    ],
    content: initial.html,
    editable: mode === 'edit',
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { 'aria-label': 'Note text', class: 'md rich-text' } },
    onUpdate: recompute,
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor && !saved.current.html) saved.current.html = editor.getHTML();
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(mode === 'edit');
    if (mode === 'edit' && !isBlankNote(note)) editor.commands.focus('end');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mode]);

  // Leaving with unsaved changes (Back, Android Back, another screen) asks first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => { if (blocker.state === 'blocked') setAsk('leave'); }, [blocker.state]);

  // A new note that was never saved is removed when the screen closes. Deferred a tick and skipped if the screen mounts
  // again straight away (React dev mode re-mounts once).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.setTimeout(() => {
        if (alive.current || !saved.current.blank) return;
        void (async () => { await store!.deleteItem(note.id); await useApp.getState().refresh(false); })();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (await write()) { setMode('read'); showToast('Note saved'); }
  }
  function revert() {
    setTitle(saved.current.title);
    titleRef.current = saved.current.title;
    editorRef.current?.commands.setContent(saved.current.html);
    setDirty(false);
    setMode('read');
  }
  function cancel() {
    if (dirty) setAsk('cancel');
    else if (saved.current.blank) goBack();
    else revert();
  }
  async function answer(choice: 'save' | 'discard' | 'keep') {
    const kind = ask;
    setAsk(null);
    if (choice === 'keep') { if (kind === 'leave') blocker.reset?.(); return; }
    if (choice === 'save') {
      if (!(await write())) { if (kind === 'leave') blocker.reset?.(); showToast('Add a title or some text first'); return; }
      if (kind === 'leave') blocker.proceed?.(); else { setMode('read'); showToast('Note saved'); }
      return;
    }
    if (kind === 'leave') blocker.proceed?.();
    else if (saved.current.blank) { dirtyRef.current = false; goBack(); } else revert();
  }

  const book = notebookOf(note);
  const canSave = !!title.trim() || !empty;
  return (
    <article className="min-w-0 max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        {mode === 'edit' ? (
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary disabled:opacity-50" disabled={!canSave} onClick={() => void save()}>Save</button>
            <button type="button" className="btn" onClick={cancel}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setMode('edit')}><Pencil size={16} aria-hidden />Edit</button>
        )}
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

      <div className="rounded-card border border-border bg-surface">
        {mode === 'edit' ? (
          <input aria-label="Title" placeholder="Title" maxLength={120} autoFocus={saved.current.blank} value={title}
            onChange={(e) => { setTitle(e.target.value); titleRef.current = e.target.value; recompute(); }}
            className="block w-full rounded-t-card bg-transparent px-4 pt-4 text-title font-extrabold outline-none placeholder:text-faint" />
        ) : title.trim() ? (
          <h1 className="px-4 pt-4 text-title font-extrabold">{title}</h1>
        ) : null}
        <div className={`relative px-4 py-4 ${mode === 'read' && readingMode ? 'md-reading' : ''}`}>
          <EditorContent editor={editor} />
          {mode === 'edit' && empty && <p aria-hidden className="pointer-events-none absolute left-4 top-4 text-body text-faint">Start typing…</p>}
          {mode === 'read' && empty && <p className="py-4 text-center text-body text-muted">Nothing written yet. Tap Edit to start.</p>}
        </div>
        {mode === 'edit' && editor && <RichToolbar editor={editor} />}
      </div>

      {menu && <ActionsSheet note={note} onClose={() => setMenu(false)} onDelete={() => { dirtyRef.current = false; }} />}

      <Sheet open={ask !== null} onClose={() => void answer('keep')} label="Unsaved changes">
        <h2 className="text-heading">Save your changes?</h2>
        <p className="mt-1 text-body text-muted">{SAVE_PROMPT} {ask === 'cancel' ? 'Cancel the edit and lose them?' : 'Save them before you leave?'}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-danger" onClick={() => void answer('discard')}>Discard</button>
          <button type="button" className="btn" onClick={() => void answer('keep')}>Keep editing</button>
          <button type="button" className="btn btn-primary" onClick={() => void answer('save')}>Save</button>
        </div>
      </Sheet>
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
