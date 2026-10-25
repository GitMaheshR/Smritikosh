import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Target, Trash2 } from 'lucide-react';
import {
  goalProgress, goalStatus, milestonesOf, nextMilestoneOrder, progressText, sortedGoals, targetLabel, type GoalStatus, type Item,
} from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, Checkbox, EmptyState, FormRow, PageHeader, ProgressBar } from '../components/ui';
import { useGoBack } from '../components/Shell';
import { whenLabel } from '../format';

const STATUS_LABEL: Record<GoalStatus, string> = { active: 'Active', paused: 'Paused', done: 'Done' };

function GoalRow({ goal, onOpen }: { goal: Item; onOpen: () => void }) {
  const { items } = useApp();
  const p = goalProgress(items, goal);
  const st = goalStatus(goal);
  const target = st === 'done' ? null : targetLabel(goal.due_at, new Date());
  return (
    <button type="button" onClick={onOpen} className="block min-h-0 w-full border-t border-border py-4 text-left first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <strong className="text-body">{goal.title}</strong>
        <span className="num text-meta font-bold">{p.percent}%</span>
      </div>
      <ProgressBar value={p.percent} />
      <p className="mt-2 flex flex-wrap gap-x-2 text-meta text-muted">
        <span>{progressText(p)}</span>
        {target && <span>· {target}</span>}
        {st !== 'active' && <span>· {STATUS_LABEL[st]}</span>}
      </p>
    </button>
  );
}

export function GoalsPage() {
  const { items } = useApp();
  const nav = useNavigate();
  const goals = useMemo(() => sortedGoals(items), [items]);
  const active = goals.filter((g) => goalStatus(g) === 'active');
  const rest = goals.filter((g) => goalStatus(g) !== 'active');

  return (
    <div>
      <PageHeader eyebrow="Longer-term direction" title="Goals & milestones" subtitle="Connect the everyday work to what matters over time."
        action={<button type="button" onClick={() => nav('/goals/new')} className="btn btn-primary"><Plus size={18} aria-hidden />New goal</button>} />
      {goals.length === 0 ? (
        <div className="panel"><EmptyState icon={Target} line="Goals with milestones and a target date." action="Set your first goal" onAction={() => nav('/goals/new')} /></div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && <Card title="Active goals" count={active.length}>{active.map((g) => <GoalRow key={g.id} goal={g} onOpen={() => nav(`/goals/${g.id}`)} />)}</Card>}
          {rest.length > 0 && <Card title="Paused and finished" count={rest.length}>{rest.map((g) => <GoalRow key={g.id} goal={g} onOpen={() => nav(`/goals/${g.id}`)} />)}</Card>}
        </div>
      )}
    </div>
  );
}

/** New goal (`/goals/new`) and goal page (`/goals/:id`) with its milestones. */
export function GoalForm() {
  const { id } = useParams();
  const { items, store, refresh, removeWithUndo } = useApp();
  const goBack = useGoBack();
  const goal = id ? items.find((i) => i.id === id && i.type === 'goal' && !i.deleted_at) ?? null : null;

  const [title, setTitle] = useState(goal?.title ?? '');
  const [body, setBody] = useState(goal?.body ?? '');
  const [due, setDue] = useState(goal?.due_at?.slice(0, 10) ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal ? goalStatus(goal) : 'active');
  const [entry, setEntry] = useState('');
  const [draft, setDraft] = useState<string[]>([]); // milestones typed before the goal is saved

  if (id && !goal) return <div className="panel"><EmptyState icon={Target} line="That goal is gone or was deleted." action="Back" onAction={goBack} /></div>;

  const milestones = goal ? milestonesOf(items, goal.id) : [];
  const progress = goal ? goalProgress(items, goal) : null;
  const allDone = !!progress && progress.total > 0 && progress.done === progress.total && status === 'active';

  async function addMilestone() {
    const text = entry.trim();
    if (!text) return;
    setEntry('');
    if (goal && store) {
      await store.createItem({ type: 'goal', title: text, parent_id: goal.id, status: 'todo', meta: { milestone: true, order: nextMilestoneOrder(items, goal.id) } });
      await refresh(false);
    } else setDraft((d) => [...d, text]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !store) return;
    const data = { title: title.trim(), body: body || null, due_at: due || null, status };
    if (goal) await store.updateItem(goal.id, data);
    else {
      const g = await store.createItem({ type: 'goal', ...data });
      for (const [i, text] of draft.entries()) {
        await store.createItem({ type: 'goal', title: text, parent_id: g.id, status: 'todo', meta: { milestone: true, order: i } });
      }
    }
    await refresh(false);
    goBack();
  }

  return (
    <div>
      <PageHeader eyebrow={goal ? 'Goal' : 'Longer-term direction'} title={goal ? goal.title : 'New goal'}
        subtitle={goal ? (targetLabel(goal.due_at, new Date()) ?? undefined) : 'What would you like to work toward?'}
        action={<button type="button" onClick={goBack} className="btn">Cancel</button>} />

      {progress && (
        <div className="panel mb-4 max-w-3xl">
          <ProgressBar value={progress.percent} label={progressText(progress)} valueLabel={`${progress.percent}%`} />
          {allDone && (
            <button type="button" className="btn btn-primary mt-3" onClick={() => setStatus('done')}>All milestones done. Mark the goal as done</button>
          )}
        </div>
      )}

      <form onSubmit={save} className="panel max-w-3xl">
        <FormRow label="Goal" htmlFor="g-title">
          <input id="g-title" required maxLength={120} autoFocus={!goal} className="input" placeholder="e.g. Build a consistent learning habit" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormRow>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label="Target date (optional)" htmlFor="g-due">
            <input id="g-due" type="date" className="input num" value={due} onChange={(e) => setDue(e.target.value)} />
          </FormRow>
          <FormRow label="Status" htmlFor="g-status">
            <select id="g-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              <option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option>
            </select>
          </FormRow>
        </div>
        <FormRow label="Details" htmlFor="g-body">
          <textarea id="g-body" rows={3} className="input py-2" placeholder="Why does this matter?" value={body} onChange={(e) => setBody(e.target.value)} />
        </FormRow>

        <span className="field-label">Milestones</span>
        <ul className="mb-2">
          {milestones.map((m) => {
            const done = m.status === 'done';
            return (
              <li key={m.id} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
                <Checkbox checked={done} label={m.title} onChange={async () => { await store!.updateItem(m.id, { status: done ? 'todo' : 'done' }); await refresh(false); }} />
                <span className={`ml-2 flex-1 text-body font-semibold ${done ? 'text-faint line-through' : ''}`}>{m.title}</span>
                <button type="button" aria-label={`Remove ${m.title}`} className="flex w-touch items-center justify-center text-muted"
                  onClick={async () => { await store!.deleteItem(m.id); await refresh(false); }}><Trash2 size={16} /></button>
              </li>
            );
          })}
          {draft.map((t, i) => (
            <li key={`${t}-${i}`} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
              <span className="ml-1 h-5 w-5 shrink-0 rounded-[6px] border-[1.6px] border-faint" aria-hidden />
              <span className="ml-2 flex-1 text-body font-semibold">{t}</span>
              <button type="button" aria-label={`Remove ${t}`} className="flex w-touch items-center justify-center text-muted" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        {milestones.length === 0 && draft.length === 0 && <p className="mb-2 text-meta text-faint">Break the goal into small steps. Progress is how many are done.</p>}
        <div className="mb-5 flex gap-2">
          <input aria-label="New milestone" className="input flex-1" placeholder="Add a milestone" value={entry} onChange={(e) => setEntry(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addMilestone(); } }} />
          <button type="button" aria-label="Add milestone" onClick={() => void addMilestone()} className="btn !px-3"><Plus size={18} /></button>
        </div>

        <div className="flex items-center justify-between gap-2">
          {goal ? <button type="button" className="btn btn-danger" onClick={async () => { goBack(); await removeWithUndo(goal); }}>Delete goal</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={goBack} className="btn">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="btn btn-primary disabled:opacity-50">Save goal</button>
          </div>
        </div>
        {goal?.due_at && <p className="mt-3 text-meta text-faint">Target: {whenLabel(goal.due_at)}</p>}
      </form>
    </div>
  );
}
