import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Plus } from 'lucide-react';
import { filterTasks, groupTasks, isOpenTask, type Item } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, ItemRow } from '../components/ui';

const PRI: [number, string][] = [[1, 'High'], [2, 'Medium'], [3, 'Low']];

export function TasksPage() {
  const { items, categories, checklist, complete, reopen, openEditor } = useApp();
  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<number | null>(null);
  const [freeTime, setFreeTime] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const tasks = useMemo(() => items.filter((i) => i.type === 'task'), [items]);
  const open = useMemo(() => filterTasks(tasks, { category, priority, freeTime }), [tasks, category, priority, freeTime]);
  const groups = useMemo(() => (freeTime ? [{ key: 'free', label: 'Free time, shortest first', items: open }] : groupTasks(open, new Date())), [open, freeTime]);
  const done = useMemo(() => tasks.filter((t) => t.status === 'done').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30), [tasks]);
  const progress = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const c of checklist) {
      const p = m.get(c.item_id) ?? { done: 0, total: 0 };
      p.total++; if (c.done) p.done++;
      m.set(c.item_id, p);
    }
    return m;
  }, [checklist]);

  const toggle = (i: Item) => (isOpenTask(i) ? complete(i) : reopen(i));
  const row = (i: Item) => (
    <ItemRow key={i.id} item={i} onToggle={() => void toggle(i)} onOpen={() => openEditor(i.id)} extra={progress.get(i.id)} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-3 text-title"><CheckCircle2 className="text-m-tasks" size={24} aria-hidden />Tasks</h1>
        <button type="button" onClick={() => openEditor('new')} className="flex items-center gap-2 rounded-control bg-accent px-4 text-body font-semibold text-on-accent">
          <Plus size={18} />New
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
        <Chip selected={freeTime} onClick={() => setFreeTime(!freeTime)}><Clock size={14} className="mr-1" />I have free time</Chip>
        {PRI.map(([p, l]) => <Chip key={p} selected={priority === p} onClick={() => setPriority(priority === p ? null : p)}>{l}</Chip>)}
        {categories.map((c) => <Chip key={c.id} selected={category === c.name} onClick={() => setCategory(category === c.name ? null : c.name)}>{c.name}</Chip>)}
      </div>

      {open.length === 0 ? (
        tasks.some(isOpenTask) ? (
          <p className="py-8 text-center text-body text-muted">No tasks match these filters.</p>
        ) : (
          <EmptyState icon={CheckCircle2} color="text-m-tasks" line="Tasks and reminders you need to act on go here." action="Add your first task" onAction={() => openEditor('new')} />
        )
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h2 className={`mb-2 text-label uppercase ${g.key === 'overdue' ? 'text-overdue' : g.key === 'today' ? 'text-warning' : 'text-muted'}`}>
              {g.label} <span className="num">· {g.items.length}</span>
            </h2>
            <div className="divide-y divide-border rounded-card border border-border bg-surface px-3">{g.items.map(row)}</div>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone(!showDone)} className="text-label uppercase text-muted">
            {showDone ? 'Hide' : 'Show'} completed · <span className="num">{done.length}</span>
          </button>
          {showDone && <div className="mt-2 divide-y divide-border rounded-card border border-border bg-surface px-3">{done.map(row)}</div>}
        </section>
      )}
    </div>
  );
}
