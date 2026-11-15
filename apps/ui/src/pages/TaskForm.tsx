import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../store/app';
import { Checkbox, EmptyState, FormRow, PageHeader } from '../components/ui';
import { useGoBack } from '../components/Shell';
import { ListChecks } from 'lucide-react';

export const REPEATS = [
  ['', 'Does not repeat'], ['FREQ=DAILY', 'Every day'], ['FREQ=WEEKLY', 'Every week'],
  ['FREQ=MONTHLY', 'Every month'], ['FREQ=YEARLY', 'Every year'],
] as const;

interface Draft {
  title: string; body: string; due_at: string; remind_at: string; priority: number; category: string;
  repeat_rule: string; freeTime: boolean; estimateMins: string;
}
const blank: Draft = { title: '', body: '', due_at: '', remind_at: '', priority: 2, category: '', repeat_rule: '', freeTime: false, estimateMins: '' };

/** New task (`/tasks/new`) and edit task (`/tasks/:id/edit`) as a full page, like the Daymark form view. */
export function TaskForm() {
  const { id } = useParams();
  const { items, categories, checklist, store, refresh, removeWithUndo } = useApp();
  const goBack = useGoBack();
  const existing = id ? items.find((i) => i.id === id && i.type === 'task' && !i.deleted_at) ?? null : null;

  const [d, setD] = useState<Draft>(() => existing ? {
    title: existing.title, body: existing.body ?? '', due_at: existing.due_at ?? '', remind_at: existing.remind_at ?? '',
    priority: existing.priority, category: existing.category ?? '', repeat_rule: existing.repeat_rule ?? '',
    freeTime: existing.meta.freeTime === true, estimateMins: typeof existing.meta.estimateMins === 'number' ? String(existing.meta.estimateMins) : '',
  } : blank);
  const [newEntry, setNewEntry] = useState('');
  const [draftList, setDraftList] = useState<string[]>([]); // checklist typed before the task is saved

  if (id && !existing) {
    return <div className="panel"><EmptyState icon={ListChecks} line="That task is gone or was deleted." action="Back" onAction={goBack} /></div>;
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const entries = existing ? checklist.filter((c) => c.item_id === existing.id) : [];
  const customRule = d.repeat_rule && !REPEATS.some(([v]) => v === d.repeat_rule);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.title.trim() || !store) return;
    const est = Number(d.estimateMins);
    const meta: Record<string, unknown> = { ...(existing?.meta ?? {}), freeTime: d.freeTime };
    if (est > 0) meta.estimateMins = est; else delete meta.estimateMins;
    const data = {
      title: d.title.trim(), body: d.body || null, due_at: d.due_at || null, remind_at: d.remind_at || null,
      priority: d.priority, category: d.category || null, repeat_rule: d.repeat_rule || null, meta,
    };
    if (existing) await store.updateItem(existing.id, data);
    else {
      const it = await store.createItem({ type: 'task', status: 'todo', ...data });
      for (const text of draftList) await store.addChecklist(it.id, text);
    }
    await refresh();
    goBack();
  }

  async function addEntry() {
    const text = newEntry.trim();
    if (!text) return;
    setNewEntry('');
    if (existing && store) { await store.addChecklist(existing.id, text); await refresh(false); }
    else setDraftList((l) => [...l, text]);
  }

  return (
    <div>
      <PageHeader eyebrow={existing ? 'Edit task' : 'Quick capture'} title={existing ? 'Task details' : 'New task'}
        subtitle={existing ? undefined : 'Capture a next step. You can refine the details later.'}
        action={<button type="button" onClick={goBack} className="btn">Cancel</button>} />

      <form onSubmit={save} className="panel max-w-3xl">
        <FormRow label="Title" htmlFor="t-title">
          <input id="t-title" required maxLength={120} autoFocus={!existing} className="input" placeholder="Give it a clear name" value={d.title} onChange={(e) => set('title', e.target.value)} />
        </FormRow>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <FormRow label="Category" htmlFor="t-cat" hint="Edit the list in Settings">
            <select id="t-cat" className="input" value={d.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              {d.category && !categories.some((c) => c.name === d.category) && <option value={d.category}>{d.category}</option>}
            </select>
          </FormRow>
          <FormRow label="Priority" htmlFor="t-pri">
            <select id="t-pri" className="input" value={d.priority} onChange={(e) => set('priority', Number(e.target.value))}>
              <option value={1}>High</option><option value={2}>Medium</option><option value={3}>Low</option>
            </select>
          </FormRow>
          <FormRow label="Due (optional)" htmlFor="t-due">
            <input id="t-due" type="datetime-local" className="input num" value={d.due_at} onChange={(e) => set('due_at', e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="Details" htmlFor="t-body">
          <textarea id="t-body" rows={4} className="input py-2" placeholder="Add context or next steps…" value={d.body} onChange={(e) => set('body', e.target.value)} />
        </FormRow>

        <details className="mb-4 rounded-tile border border-border" open={!!existing && (!!d.remind_at || !!d.repeat_rule || d.freeTime || entries.length > 0)}>
          <summary className="min-h-touch cursor-pointer list-none px-4 py-3 text-body font-bold text-primary">More options</summary>
          <div className="border-t border-border p-4">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <FormRow label="Remind me" htmlFor="t-rem">
                <input id="t-rem" type="datetime-local" className="input num" value={d.remind_at} onChange={(e) => set('remind_at', e.target.value)} />
              </FormRow>
              <FormRow label="Repeat" htmlFor="t-rep">
                <select id="t-rep" className="input" value={d.repeat_rule} onChange={(e) => set('repeat_rule', e.target.value)}>
                  {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  {customRule && <option value={d.repeat_rule}>Custom ({d.repeat_rule})</option>}
                </select>
              </FormRow>
              <FormRow label="Estimate (minutes)" htmlFor="t-est">
                <input id="t-est" type="number" min={0} className="input num" value={d.estimateMins} onChange={(e) => set('estimateMins', e.target.value)} />
              </FormRow>
              <div className="mb-4 flex items-end">
                <label className="flex min-h-touch items-center gap-3 text-body font-semibold">
                  <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-secondary))]" checked={d.freeTime} onChange={(e) => set('freeTime', e.target.checked)} />
                  Do when I have free time
                </label>
              </div>
            </div>

            <span className="field-label">Checklist</span>
            <ul>
              {entries.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1">
                  <Checkbox checked={c.done} label={c.text} onChange={async () => { await store!.updateChecklist(c.id, { done: !c.done }); await refresh(false); }} />
                  <span className={`ml-2 flex-1 text-body ${c.done ? 'text-faint line-through' : ''}`}>{c.text}</span>
                  <button type="button" aria-label={`Remove ${c.text}`} className="flex w-touch items-center justify-center text-muted"
                    onClick={async () => { await store!.deleteChecklist(c.id); await refresh(false); }}><Trash2 size={16} /></button>
                </li>
              ))}
              {draftList.map((t, i) => (
                <li key={`${t}-${i}`} className="flex items-center gap-3 py-1">
                  <span className="ml-1 h-5 w-5 rounded-[6px] border-[1.6px] border-faint" aria-hidden />
                  <span className="ml-2 flex-1 text-body">{t}</span>
                  <button type="button" aria-label={`Remove ${t}`} className="flex w-touch items-center justify-center text-muted"
                    onClick={() => setDraftList((l) => l.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex gap-2">
              <input aria-label="New checklist item" className="input flex-1" placeholder="Add an item" value={newEntry} onChange={(e) => setNewEntry(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addEntry(); } }} />
              <button type="button" aria-label="Add checklist item" onClick={() => void addEntry()} className="btn !px-3"><Plus size={18} /></button>
            </div>
          </div>
        </details>

        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <button type="button" className="btn btn-danger" onClick={async () => { goBack(); await removeWithUndo(existing); }}>Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={goBack} className="btn">Cancel</button>
            <button type="submit" disabled={!d.title.trim()} className="btn btn-primary disabled:opacity-50">Save entry</button>
          </div>
        </div>
      </form>
    </div>
  );
}
