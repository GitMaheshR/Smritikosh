import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../store/app';
import { Sheet } from './ui';

const field = 'min-h-touch w-full rounded-control border border-border bg-surface-2 px-3 text-body outline-none';
const label = 'mb-1 block text-label uppercase text-muted';
const REPEATS = [
  ['', 'Does not repeat'],
  ['FREQ=DAILY', 'Every day'],
  ['FREQ=WEEKLY', 'Every week'],
  ['FREQ=MONTHLY', 'Every month'],
  ['FREQ=YEARLY', 'Every year'],
] as const;

interface Draft {
  title: string; body: string; due_at: string; remind_at: string; priority: number; category: string;
  repeat_rule: string; freeTime: boolean; estimateMins: string;
}
const blank: Draft = { title: '', body: '', due_at: '', remind_at: '', priority: 2, category: '', repeat_rule: '', freeTime: false, estimateMins: '' };

export function TaskEditor() {
  const { editingId, openEditor, items, categories, checklist, store, refresh, removeWithUndo } = useApp();
  const existing = items.find((i) => i.id === editingId) ?? null;
  const [d, setD] = useState<Draft>(blank);
  const [newEntry, setNewEntry] = useState('');

  useEffect(() => {
    if (!editingId) return;
    setNewEntry('');
    setD(existing ? {
      title: existing.title, body: existing.body ?? '', due_at: existing.due_at ?? '', remind_at: existing.remind_at ?? '',
      priority: existing.priority, category: existing.category ?? '', repeat_rule: existing.repeat_rule ?? '',
      freeTime: existing.meta.freeTime === true, estimateMins: typeof existing.meta.estimateMins === 'number' ? String(existing.meta.estimateMins) : '',
    } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  if (!editingId) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const close = () => openEditor(null);
  const entries = existing ? checklist.filter((c) => c.item_id === existing.id) : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.title.trim() || !store) return;
    const est = Number(d.estimateMins);
    const meta = { ...(existing?.meta ?? {}), freeTime: d.freeTime, ...(est > 0 ? { estimateMins: est } : { estimateMins: undefined }) };
    const data = {
      title: d.title.trim(), body: d.body || null, due_at: d.due_at || null, remind_at: d.remind_at || null,
      priority: d.priority, category: d.category || null, repeat_rule: d.repeat_rule || null, meta,
    };
    if (existing) await store.updateItem(existing.id, data);
    else await store.createItem({ type: 'task', status: 'todo', ...data });
    await refresh();
    close();
  }

  async function addEntry() {
    if (!existing || !newEntry.trim() || !store) return;
    await store.addChecklist(existing.id, newEntry);
    setNewEntry('');
    await refresh();
  }

  const customRule = d.repeat_rule && !REPEATS.some(([v]) => v === d.repeat_rule);

  return (
    <Sheet open onClose={close} label={existing ? 'Edit task' : 'New task'}>
      <form onSubmit={save} className="max-h-[80vh] space-y-3 overflow-y-auto">
        <div>
          <label className={label} htmlFor="t-title">Task</label>
          <input id="t-title" autoFocus className={field} value={d.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="t-due">Due</label>
            <input id="t-due" type="datetime-local" className={`${field} num`} value={d.due_at} onChange={(e) => set('due_at', e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="t-rem">Remind me</label>
            <input id="t-rem" type="datetime-local" className={`${field} num`} value={d.remind_at} onChange={(e) => set('remind_at', e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="t-pri">Priority</label>
            <select id="t-pri" className={field} value={d.priority} onChange={(e) => set('priority', Number(e.target.value))}>
              <option value={1}>High</option><option value={2}>Medium</option><option value={3}>Low</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="t-cat">Category</label>
            <select id="t-cat" className={field} value={d.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="t-rep">Repeat</label>
            <select id="t-rep" className={field} value={d.repeat_rule} onChange={(e) => set('repeat_rule', e.target.value)}>
              {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {customRule && <option value={d.repeat_rule}>Custom ({d.repeat_rule})</option>}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="t-est">Estimate (minutes)</label>
            <input id="t-est" type="number" min={0} className={`${field} num`} value={d.estimateMins} onChange={(e) => set('estimateMins', e.target.value)} />
          </div>
        </div>
        <label className="flex min-h-touch items-center gap-3 text-body">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-accent))]" checked={d.freeTime} onChange={(e) => set('freeTime', e.target.checked)} />
          Do when I have free time
        </label>
        <div>
          <label className={label} htmlFor="t-body">Notes</label>
          <textarea id="t-body" rows={3} className={`${field} py-2`} value={d.body} onChange={(e) => set('body', e.target.value)} />
        </div>

        <div>
          <span className={label}>Checklist</span>
          {!existing && <p className="text-meta text-muted">Save the task first, then add checklist items.</p>}
          {existing && (
            <>
              <ul>
                {entries.map((c) => (
                  <li key={c.id} className="flex min-h-touch items-center gap-2">
                    <input type="checkbox" aria-label={c.text} className="h-5 w-5 accent-[rgb(var(--c-accent))]" checked={c.done}
                      onChange={async (e) => { await store!.updateChecklist(c.id, { done: e.target.checked }); await refresh(); }} />
                    <span className={`flex-1 text-body ${c.done ? 'text-muted line-through' : ''}`}>{c.text}</span>
                    <button type="button" aria-label={`Remove ${c.text}`} className="flex w-touch items-center justify-center text-muted"
                      onClick={async () => { await store!.deleteChecklist(c.id); await refresh(); }}><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-2">
                <input aria-label="New checklist item" className={`${field} flex-1`} placeholder="Add an item" value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addEntry(); } }} />
                <button type="button" aria-label="Add checklist item" onClick={() => void addEntry()} className="flex w-touch items-center justify-center rounded-control border border-border"><Plus size={18} /></button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {existing ? (
            <button type="button" className="min-h-touch rounded-control border border-border px-4 text-body text-overdue"
              onClick={async () => { close(); await removeWithUndo(existing); }}>Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={close} className="rounded-control border border-border px-4 text-body">Cancel</button>
            <button type="submit" disabled={!d.title.trim()} className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent disabled:opacity-50">Save</button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
