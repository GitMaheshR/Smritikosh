import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lightbulb, Plus, Search } from 'lucide-react';
import { lessonFields, lessonToItem, situationOptions, type Item } from '@smritikosh/core';
import { useApp } from '../store/app';
import { EmptyState, Sheet } from '../components/ui';
import { Markdown } from '../components/Markdown';

const field = 'min-h-touch w-full rounded-control border border-border bg-surface-2 px-3 text-body outline-none';
const label = 'mb-1 block text-label uppercase text-muted';

function LessonForm({ lesson, onClose }: { lesson: Item | null; onClose: () => void }) {
  const { items, store, refresh, removeWithUndo } = useApp();
  const init = lesson ? lessonFields(lesson) : { situation: '', whatHappened: '', lesson: '' };
  const [situation, setSituation] = useState(init.situation);
  const [whatHappened, setWhat] = useState(init.whatHappened);
  const [text, setText] = useState(init.lesson);
  const [tags, setTags] = useState(lesson?.tags.join(', ') ?? '');
  const options = useMemo(() => situationOptions(items), [items]);
  const valid = !!situation.trim() && !!text.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !store) return;
    const derived = lessonToItem({ situation, whatHappened, lesson: text });
    const data = { ...derived, tags: tags.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean) };
    if (lesson) await store.updateItem(lesson.id, { ...data, meta: { ...lesson.meta, ...derived.meta } });
    else await store.createItem({ type: 'lesson', ...data });
    await refresh(false);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} label={lesson ? 'Edit lesson' : 'New lesson'}>
      <form onSubmit={save} className="max-h-[80vh] space-y-3 overflow-y-auto">
        <div>
          <label className={label} htmlFor="l-sit">Situation</label>
          <input id="l-sit" list="l-sit-opts" autoFocus className={field} value={situation} placeholder="e.g. Negotiating salary"
            onChange={(e) => setSituation(e.target.value)} />
          <datalist id="l-sit-opts">{options.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        <div>
          <label className={label} htmlFor="l-what">What happened</label>
          <textarea id="l-what" rows={3} className={`${field} py-2`} value={whatHappened} onChange={(e) => setWhat(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="l-lesson">Lesson</label>
          <textarea id="l-lesson" rows={3} className={`${field} py-2`} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="l-tags">Tags</label>
          <input id="l-tags" className={field} placeholder="comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          {lesson ? (
            <button type="button" className="min-h-touch rounded-control border border-border px-4 text-body text-overdue"
              onClick={async () => { onClose(); await removeWithUndo(lesson); }}>Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-control border border-border px-4 text-body">Cancel</button>
            <button type="submit" disabled={!valid} className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent disabled:opacity-50">Save</button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function LessonCard({ lesson, onOpen }: { lesson: Item; onOpen: () => void }) {
  const f = lessonFields(lesson);
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-card border border-border bg-surface p-4 text-left">
      <div className="mb-1 flex items-center gap-2 text-label uppercase text-muted">
        <span className="h-2 w-2 rounded-full bg-m-lessons" aria-hidden />{f.situation || 'Lesson'}
      </div>
      <Markdown source={f.lesson} />
      {f.whatHappened && <p className="mt-2 line-clamp-2 text-meta text-muted">{f.whatHappened}</p>}
      {lesson.tags.length > 0 && <p className="mt-2 text-meta text-muted">{lesson.tags.map((t) => `#${t}`).join(' ')}</p>}
    </button>
  );
}

export function LessonsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { items, lessons } = useApp();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => items.filter((i) => i.type === 'lesson').sort((a, b) => b.created_at.localeCompare(a.created_at)), [items]);
  const byId = useMemo(() => new Map(all.map((l) => [l.id, l])), [all]);
  const matches = useMemo(() => lessons.search(q).map((i) => byId.get(i)).filter((x): x is Item => !!x), [q, lessons, byId, all]);
  const editing = id ? byId.get(id) ?? null : null;
  useEffect(() => { if (id && !byId.has(id) && all.length) nav('/lessons', { replace: true }); }, [id, byId, all.length, nav]);

  const close = () => { setCreating(false); if (id) nav('/lessons'); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-3 text-title"><Lightbulb className="text-m-lessons" size={24} aria-hidden />Lessons</h1>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-control bg-accent px-4 text-body font-semibold text-on-accent">
          <Plus size={18} />New lesson
        </button>
      </div>

      <section className="rounded-card border border-border bg-surface p-4" aria-label="Before you start">
        <h2 className="mb-2 text-heading">Before you start…</h2>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Describe what you are about to do" className={`${field} !pl-10`} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="What are you about to do? e.g. negotiating salary" />
        </div>
        {q.trim() && (
          <div className="mt-3 space-y-3">
            {matches.length === 0 ? <p className="text-body text-muted">No related lessons yet.</p> : matches.map((l) => <LessonCard key={l.id} lesson={l} onOpen={() => nav(`/lessons/${l.id}`)} />)}
          </div>
        )}
      </section>

      {all.length === 0 ? (
        <EmptyState icon={Lightbulb} color="text-m-lessons" line="Things life taught you, ready before the next similar situation." action="Add your first lesson" onAction={() => setCreating(true)} />
      ) : (
        !q.trim() && (
          <div className="space-y-3">
            <h2 className="text-label uppercase text-muted">All lessons <span className="num">· {all.length}</span></h2>
            {all.map((l) => <LessonCard key={l.id} lesson={l} onOpen={() => nav(`/lessons/${l.id}`)} />)}
          </div>
        )
      )}

      {(creating || editing) && <LessonForm key={editing?.id ?? 'new'} lesson={editing} onClose={close} />}
    </div>
  );
}
