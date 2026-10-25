import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PenLine, Plus, Search } from 'lucide-react';
import { lessonFields, lessonToItem, situationOptions, type Item } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, EmptyState, FormRow, PageHeader } from '../components/ui';
import { useGoBack } from '../components/Shell';
import { updatedLabel } from '../format';

function EntryCard({ entry, onOpen }: { entry: Item; onOpen: () => void }) {
  const f = lessonFields(entry);
  const headline = f.lesson.split('\n')[0] ?? '';
  return (
    <article>
      <button type="button" onClick={onOpen} className="block min-h-0 w-full rounded-tile border border-border bg-surface p-4 text-left transition hover:border-primary/40">
        <span className="text-label uppercase text-secondary">{f.situation || 'Journal'} · {updatedLabel(entry.created_at)}</span>
        <h3 className="mt-2 line-clamp-2 text-heading">{headline.length > 90 ? `${headline.slice(0, 89)}…` : headline || entry.title}</h3>
        {f.whatHappened && <p className="mt-2 line-clamp-3 text-body text-muted"><b className="text-text">What happened:</b> {f.whatHappened}</p>}
        {f.lesson && <p className="mt-1.5 line-clamp-3 text-body text-muted"><b className="text-text">Lesson:</b> {f.lesson}</p>}
      </button>
    </article>
  );
}

export function JournalPage() {
  const nav = useNavigate();
  const { items, lessons } = useApp();
  const [q, setQ] = useState('');
  const all = useMemo(() => items.filter((i) => i.type === 'lesson').sort((a, b) => b.created_at.localeCompare(a.created_at)), [items]);
  const byId = useMemo(() => new Map(all.map((l) => [l.id, l])), [all]);
  const matches = useMemo(() => lessons.search(q).map((i) => byId.get(i)).filter((x): x is Item => !!x), [q, lessons, byId, all]);

  return (
    <div>
      <PageHeader eyebrow="Reflect & remember" title="Journal & lessons" subtitle="Keep the lesson, not just the memory."
        action={<button type="button" onClick={() => nav('/journal/new')} className="btn btn-primary"><Plus size={18} aria-hidden />Journal entry</button>} />

      <div className="space-y-4">
        <Card title="Before you start…">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input aria-label="Describe what you are about to do" className="input !pl-10" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="What are you about to do? e.g. negotiating salary" />
          </div>
          {q.trim() && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {matches.length === 0 ? <p className="text-body text-muted">No related lessons yet.</p> : matches.map((l) => <EntryCard key={l.id} entry={l} onOpen={() => nav(`/journal/${l.id}`)} />)}
            </div>
          )}
        </Card>

        {all.length === 0 ? (
          <div className="panel"><EmptyState icon={PenLine} line="Things life taught you, ready before the next similar situation." action="Add your first entry" onAction={() => nav('/journal/new')} /></div>
        ) : (
          !q.trim() && (
            <Card title="Recent reflections" count={all.length}>
              <div className="grid gap-3 md:grid-cols-2">
                {all.map((l) => <EntryCard key={l.id} entry={l} onOpen={() => nav(`/journal/${l.id}`)} />)}
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

/** New entry (`/journal/new`) and edit entry (`/journal/:id`) as a full page. */
export function JournalForm() {
  const { id } = useParams();
  const { items, store, refresh, removeWithUndo } = useApp();
  const goBack = useGoBack();
  const lesson = id ? items.find((i) => i.id === id && i.type === 'lesson' && !i.deleted_at) ?? null : null;
  const init = lesson ? lessonFields(lesson) : { situation: '', whatHappened: '', lesson: '' };
  const [situation, setSituation] = useState(init.situation);
  const [whatHappened, setWhat] = useState(init.whatHappened);
  const [text, setText] = useState(init.lesson);
  const options = useMemo(() => situationOptions(items), [items]);
  const valid = !!situation.trim() && !!text.trim();

  if (id && !lesson) return <div className="panel"><EmptyState icon={PenLine} line="That entry is gone or was deleted." action="Back" onAction={goBack} /></div>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !store) return;
    const derived = lessonToItem({ situation, whatHappened, lesson: text });
    const data = { ...derived };
    if (lesson) await store.updateItem(lesson.id, { ...data, meta: { ...lesson.meta, ...derived.meta } });
    else await store.createItem({ type: 'lesson', ...data });
    await refresh(false);
    goBack();
  }

  return (
    <div>
      <PageHeader eyebrow="Reflect & remember" title={lesson ? 'Journal entry' : 'New journal entry'}
        subtitle={lesson ? undefined : 'Record what happened and what you want to learn from it.'}
        action={<button type="button" onClick={goBack} className="btn">Cancel</button>} />
      <form onSubmit={save} className="panel max-w-3xl">
        <FormRow label="Situation" htmlFor="j-sit" hint="What kind of moment was this? Pick one or type your own.">
          <input id="j-sit" list="j-sit-opts" autoFocus={!lesson} className="input" value={situation} placeholder="e.g. Negotiating salary" onChange={(e) => setSituation(e.target.value)} />
          <datalist id="j-sit-opts">{options.map((o) => <option key={o} value={o} />)}</datalist>
        </FormRow>
        <FormRow label="What happened" htmlFor="j-what">
          <textarea id="j-what" rows={4} className="input py-2" placeholder="Add context…" value={whatHappened} onChange={(e) => setWhat(e.target.value)} />
        </FormRow>
        <FormRow label="Lesson" htmlFor="j-lesson">
          <textarea id="j-lesson" rows={4} className="input py-2" placeholder="What would you do next time?" value={text} onChange={(e) => setText(e.target.value)} />
        </FormRow>
        <div className="flex items-center justify-between gap-2">
          {lesson ? <button type="button" className="btn btn-danger" onClick={async () => { goBack(); await removeWithUndo(lesson); }}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={goBack} className="btn">Cancel</button>
            <button type="submit" disabled={!valid} className="btn btn-primary disabled:opacity-50">Save entry</button>
          </div>
        </div>
      </form>
    </div>
  );
}
