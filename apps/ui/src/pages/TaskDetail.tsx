import { useParams, useNavigate } from 'react-router-dom';
import { ListChecks, Pencil } from 'lucide-react';
import { useApp } from '../store/app';
import { Checkbox, EmptyState, PageHeader, PriorityPill } from '../components/ui';
import { useGoBack } from '../components/Shell';
import { whenLabel } from '../format';
import { REPEATS } from './TaskForm';

/** A task shown as read-only details (`/tasks/:id`). Editing happens on its own page (`/tasks/:id/edit`). */
export function TaskDetail() {
  const { id } = useParams();
  const { items, checklist, store, refresh, complete, reopen, removeWithUndo } = useApp();
  const nav = useNavigate();
  const goBack = useGoBack();
  const task = items.find((i) => i.id === id && i.type === 'task' && !i.deleted_at) ?? null;

  if (!task) {
    return <div className="panel"><EmptyState icon={ListChecks} line="That task is gone or was deleted." action="Back" onAction={goBack} /></div>;
  }

  const done = task.status === 'done';
  const entries = checklist.filter((c) => c.item_id === task.id);
  const repeat = task.repeat_rule ? (REPEATS.find(([v]) => v === task.repeat_rule)?.[1] ?? `Custom (${task.repeat_rule})`) : null;
  const estimate = typeof task.meta.estimateMins === 'number' ? `${task.meta.estimateMins} min` : null;
  const rows: [string, string | null][] = [
    ['Category', task.category],
    ['Due', whenLabel(task.due_at)],
    ['Reminder', whenLabel(task.remind_at)],
    ['Repeats', repeat],
    ['Estimate', estimate],
    ['When', task.meta.freeTime === true ? 'When I have free time' : null],
  ];

  return (
    <div>
      <PageHeader eyebrow={done ? 'Completed task' : 'Task'} title={task.title}
        action={<button type="button" onClick={() => nav(`/tasks/${task.id}/edit`)} className="btn btn-primary"><Pencil size={16} aria-hidden />Edit</button>} />

      <section className="panel max-w-3xl" aria-label="Task details">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PriorityPill priority={task.priority} />
          <span className={`text-meta font-semibold ${done ? 'text-secondary' : 'text-muted'}`}>{done ? 'Done' : 'To do'}</span>
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <dt className="text-label uppercase text-faint">{k}</dt>
              <dd className="mt-1 text-body">{v}</dd>
            </div>
          ))}
        </dl>

        {task.body && (
          <div className="mt-4 border-t border-border pt-4">
            <h2 className="text-label uppercase text-faint">Details</h2>
            <p className="mt-1 whitespace-pre-wrap text-body">{task.body}</p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <h2 className="mb-1 text-label uppercase text-faint">Checklist</h2>
            <ul>
              {entries.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1">
                  <Checkbox checked={c.done} label={c.text} onChange={async () => { await store!.updateChecklist(c.id, { done: !c.done }); await refresh(false); }} />
                  <span className={`ml-2 flex-1 text-body ${c.done ? 'text-faint line-through' : ''}`}>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn btn-danger" onClick={async () => { goBack(); await removeWithUndo(task); }}>Delete</button>
          <div className="flex gap-2">
            <button type="button" onClick={goBack} className="btn">Back</button>
            <button type="button" onClick={() => void (done ? reopen(task) : complete(task))} className="btn">{done ? 'Mark not done' : 'Mark done'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
