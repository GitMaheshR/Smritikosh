import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Bold, ChevronRight, Code, FolderPlus, Heading2, List, Pin, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  breadcrumb, childLevel, childrenOf, levelOf, moveTargets, reviseList, toLocalIso, type Item, type NoteLevel,
} from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, Sheet } from '../components/ui';
import { Markdown } from '../components/Markdown';

const LEVEL_LABEL: Record<NoteLevel, string> = { subject: 'subject', topic: 'topic', note: 'note' };
const field = 'min-h-touch w-full rounded-control border border-border bg-surface-2 px-3 text-body outline-none';

function NameSheet({ level, parent, onClose }: { level: NoteLevel; parent: Item | null; onClose: () => void }) {
  const { store, refresh } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !store) return;
    const it = await store.createItem({
      type: 'note', title: name.trim(), parent_id: parent?.id ?? null,
      body: level === 'note' ? '' : null, meta: { level },
    });
    await refresh(false);
    onClose();
    nav(`/notes/${it.id}`);
  }
  return (
    <Sheet open onClose={onClose} label={`New ${level}`}>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-label uppercase text-muted" htmlFor="n-name">New {LEVEL_LABEL[level]}{parent ? ` in ${parent.title}` : ''}</label>
        <input id="n-name" autoFocus className={field} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-control border border-border px-4 text-body">Cancel</button>
          <button type="submit" disabled={!name.trim()} className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent disabled:opacity-50">Create</button>
        </div>
      </form>
    </Sheet>
  );
}

function Crumbs({ trail }: { trail: Item[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-meta text-muted">
      <Link to="/notes" className="min-h-0 py-1">Notes</Link>
      {trail.map((t, i) => (
        <span key={t.id} className="flex items-center gap-1">
          <ChevronRight size={14} aria-hidden />
          {i === trail.length - 1 ? <span className="text-text">{t.title}</span> : <Link to={`/notes/${t.id}`}>{t.title}</Link>}
        </span>
      ))}
    </nav>
  );
}

function Row({ item, items }: { item: Item; items: Item[] }) {
  const lvl = levelOf(item);
  const kids = items.filter((i) => i.type === 'note' && !i.deleted_at && i.parent_id === item.id).length;
  return (
    <Link to={`/notes/${item.id}`} className="flex min-h-touch items-center gap-3 px-3 py-2">
      <span className="h-2 w-2 shrink-0 rounded-full bg-m-notes" aria-hidden />
      <span className="flex-1 text-body">{item.title}</span>
      {item.meta.revise === true && <RefreshCw size={14} className="text-m-notes" aria-label="Marked for revision" />}
      {item.pinned && <Pin size={14} className="text-muted" aria-label="Pinned" />}
      {lvl !== 'note' && <span className="num text-meta text-muted">{kids}</span>}
      <ChevronRight size={16} className="text-muted" aria-hidden />
    </Link>
  );
}

function Toolbar({ onInsert }: { onInsert: (before: string, after?: string, placeholder?: string) => void }) {
  const b = 'flex w-touch items-center justify-center rounded-control text-muted hover:bg-surface-2';
  return (
    <div className="flex" role="toolbar" aria-label="Formatting">
      <button type="button" className={b} aria-label="Bold" onClick={() => onInsert('**', '**', 'bold')}><Bold size={18} /></button>
      <button type="button" className={b} aria-label="Heading" onClick={() => onInsert('## ', '', 'Heading')}><Heading2 size={18} /></button>
      <button type="button" className={b} aria-label="List" onClick={() => onInsert('- ', '', 'item')}><List size={18} /></button>
      <button type="button" className={b} aria-label="Code block" onClick={() => onInsert('\n```ts\n', '\n```\n', 'code')}><Code size={18} /></button>
    </div>
  );
}

function NoteView({ note }: { note: Item }) {
  const { items, store, refresh, removeWithUndo, showToast } = useApp();
  const nav = useNavigate();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body ?? '');
  const [tags, setTags] = useState(note.tags.join(', '));
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const area = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);

  // Autosave 600 ms after the last keystroke. Draft state is keyed to the note, so refreshes never clobber typing.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = window.setTimeout(async () => {
      await store!.updateItem(note.id, {
        title: title.trim() || 'Untitled', body,
        tags: tags.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean),
      });
      saved.current = { title, body, tags };
      await refresh(false);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, tags]);

  // Flush a pending edit when leaving the note so nothing typed in the last 600 ms is lost.
  const latest = useRef({ title, body, tags });
  latest.current = { title, body, tags };
  const saved = useRef({ title, body, tags });
  useEffect(() => () => {
    const { title: t, body: b, tags: g } = latest.current;
    const s = saved.current;
    if (t === s.title && b === s.body && g === s.tags) return;
    void store!.updateItem(note.id, { title: t.trim() || 'Untitled', body: b, tags: g.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean) })
      .then(() => useApp.getState().refresh(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchMeta = async (m: Record<string, unknown>) => {
    await store!.updateItem(note.id, { meta: { ...note.meta, ...m } });
    await refresh(false);
  };
  const targets = useMemo(() => moveTargets(items, note.id), [items, note.id]);

  function insert(before: string, after = '', placeholder = '') {
    const el = area.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }

  const revise = note.meta.revise === true;
  return (
    <article className="min-w-0 space-y-3">
      <input aria-label="Title" className={`${field} text-heading`} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={note.pinned} onClick={async () => { await store!.updateItem(note.id, { pinned: !note.pinned }); await refresh(false); }}>
          <Pin size={14} className="mr-1" />Pin
        </Chip>
        <Chip selected={revise} onClick={() => patchMeta({ revise: !revise })}><RefreshCw size={14} className="mr-1" />Revise</Chip>
        {revise && (
          <button type="button" className="min-h-0 text-meta text-accent"
            onClick={async () => { await patchMeta({ revisedAt: toLocalIso(new Date()) }); showToast('Marked as revised'); }}>Mark revised</button>
        )}
        <select aria-label="Move to" className="ml-auto min-h-touch rounded-control border border-border bg-surface-2 px-2 text-meta" value=""
          onChange={async (e) => { const v = e.target.value; if (v) { await store!.updateItem(note.id, { parent_id: v === '__root' ? null : v }); await refresh(false); showToast('Moved'); } }}>
          <option value="">Move to…</option>
          {levelOf(note) === 'note' && note.parent_id && <option value="__root">Unfiled</option>}
          {targets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button type="button" aria-label="Delete note" className="flex w-touch items-center justify-center text-muted"
          onClick={async () => { nav(note.parent_id ? `/notes/${note.parent_id}` : '/notes'); await removeWithUndo(note); }}><Trash2 size={18} /></button>
      </div>
      <input aria-label="Tags" className={field} placeholder="tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />

      <div className="flex items-center justify-between lg:hidden">
        <div className="flex gap-2" role="tablist">
          <Chip selected={tab === 'edit'} onClick={() => setTab('edit')}>Edit</Chip>
          <Chip selected={tab === 'preview'} onClick={() => setTab('preview')}>Preview</Chip>
        </div>
        <Toolbar onInsert={insert} />
      </div>
      <div className="hidden justify-end lg:flex"><Toolbar onInsert={insert} /></div>

      <div className="grid gap-4 lg:grid-cols-2">
        <textarea ref={area} aria-label="Note text (markdown)" value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Write in markdown. Fenced code blocks are highlighted."
          className={`${field} num min-h-[320px] min-w-0 resize-y py-2 font-mono ${tab === 'preview' ? 'hidden lg:block' : ''}`} />
        <div className={`min-h-[120px] min-w-0 rounded-control border border-border bg-surface p-3 ${tab === 'edit' ? 'hidden lg:block' : ''}`}>
          {body.trim() ? <Markdown source={body} /> : <p className="text-meta text-muted">Preview appears here.</p>}
        </div>
      </div>
    </article>
  );
}

export function NotesPage() {
  const { id } = useParams();
  const { items, openQuickAdd } = useApp();
  const [showRevise, setShowRevise] = useState(false);
  const [adding, setAdding] = useState(false);

  const current = id ? items.find((i) => i.id === id && i.type === 'note' && !i.deleted_at) ?? null : null;
  const isNote = current ? levelOf(current) === 'note' : false;
  const container = current ? (isNote ? items.find((i) => i.id === current.parent_id && !i.deleted_at) ?? null : current) : null;
  const trail = current ? breadcrumb(items, current.id) : [];
  const list = childrenOf(items, container?.id ?? null);
  const revise = useMemo(() => reviseList(items), [items]);
  const addLevel = childLevel(container ? levelOf(container) : null);
  const hasAny = items.some((i) => i.type === 'note' && !i.deleted_at);

  if (id && !current) {
    return (
      <div className="space-y-4">
        <Crumbs trail={[]} />
        <EmptyState icon={BookOpen} color="text-m-notes" line="That note is gone or was deleted." action="Back to notes" onAction={() => history.back()} />
      </div>
    );
  }

  const listPane = (
    <div className="space-y-3">
      {!isNote && !container && revise.length > 0 && (
        <Chip selected={showRevise} onClick={() => setShowRevise(!showRevise)}><RefreshCw size={14} className="mr-1" />To revise · {revise.length}</Chip>
      )}
      {showRevise && !container ? (
        <div className="divide-y divide-border rounded-card border border-border bg-surface">{revise.map((n) => <Row key={n.id} item={n} items={items} />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={BookOpen} color="text-m-notes"
          line={container ? `Nothing in this ${levelOf(container)} yet.` : 'Subjects, topics and notes for learning and interview prep.'}
          action={addLevel ? `Add ${addLevel === 'note' ? 'a note' : `a ${addLevel}`}` : undefined} onAction={() => setAdding(true)} />
      ) : (
        <div className="divide-y divide-border rounded-card border border-border bg-surface">{list.map((n) => <Row key={n.id} item={n} items={items} />)}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-title"><BookOpen className="text-m-notes" size={24} aria-hidden />Notes</h1>
        <div className="flex gap-2">
          {addLevel && (
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-control bg-accent px-4 text-body font-semibold text-on-accent">
              {addLevel === 'subject' ? <FolderPlus size={18} /> : <Plus size={18} />}New {addLevel}
            </button>
          )}
          {!container && <button type="button" onClick={() => openQuickAdd(true)} className="hidden min-h-touch rounded-control border border-border px-4 text-body md:block">Quick note</button>}
        </div>
      </div>
      <Crumbs trail={trail} />
      {!hasAny && !adding ? (
        <EmptyState icon={BookOpen} color="text-m-notes" line="Subjects, topics and notes for learning and interview prep." action="Add your first subject" onAction={() => setAdding(true)} />
      ) : (
        <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">
          <div className={isNote ? 'hidden lg:block' : ''}>{listPane}</div>
          <div className="min-w-0">{isNote && current ? <NoteView key={current.id} note={current} /> : (
            <p className="hidden pt-12 text-center text-body text-muted lg:block">Select a note to read or edit it.</p>
          )}</div>
        </div>
      )}
      {adding && addLevel && <NameSheet level={addLevel} parent={container} onClose={() => setAdding(false)} />}
    </div>
  );
}
