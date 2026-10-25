import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Plus, Search } from 'lucide-react';
import { freeTimeTasks, groupOf, groupTasks, isOpenTask, type Item } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, PageHeader, TaskRow } from '../components/ui';

type Filter = 'all' | 'today' | 'overdue' | 'upcoming' | 'free' | 'done';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'today', label: 'Today' }, { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' }, { key: 'free', label: 'Free time' }, { key: 'done', label: 'Completed' },
];

const matches = (t: Item, q: string) =>
  !q || [t.title, t.category ?? '', t.body ?? '', ...t.tags].join(' ').toLowerCase().includes(q.toLowerCase());

export function TasksPage() {
  const { items, categories, checklist, complete, reopen } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  const tasks = useMemo(() => items.filter((i) => i.type === 'task' && matches(i, q) && (!category || i.category === category)), [items, q, category]);
  const progress = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const c of checklist) {
      const p = m.get(c.item_id) ?? { done: 0, total: 0 };
      p.total++;
      if (c.done) p.done++;
      m.set(c.item_id, p);
    }
    return m;
  }, [checklist]);

  const sections = useMemo(() => {
    const now = new Date();
    const open = tasks.filter(isOpenTask);
    if (filter === 'done') {
      const done = tasks.filter((t) => t.status === 'done').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 50);
      return done.length ? [{ key: 'done', label: 'Completed', items: done }] : [];
    }
    if (filter === 'free') {
      const free = freeTimeTasks(open);
      return free.length ? [{ key: 'free', label: 'Free time, shortest first', items: free }] : [];
    }
    const groups = groupTasks(open, now);
    if (filter === 'today') return groups.filter((g) => g.key === 'today');
    if (filter === 'overdue') return groups.filter((g) => g.key === 'overdue');
    if (filter === 'upcoming') return groups.filter((g) => g.key === 'week' || g.key === 'later');
    return groups;
  }, [tasks, filter]);

  const toggle = (i: Item) => void (i.status === 'done' ? reopen(i) : complete(i));
  const anyTasks = items.some((i) => i.type === 'task');
  const counts = useMemo(() => {
    const now = new Date();
    const open = items.filter(isOpenTask);
    return { overdue: open.filter((t) => groupOf(t, now) === 'overdue').length, today: open.filter((t) => groupOf(t, now) === 'today').length };
  }, [items]);

  return (
    <div>
      <PageHeader eyebrow="Make progress visible" title="Tasks" subtitle="Small steps, clear priorities, fewer things to remember."
        action={<button type="button" onClick={() => nav('/tasks/new')} className="btn btn-primary"><Plus size={18} aria-hidden />New task</button>} />

      {!anyTasks ? (
        <div className="panel"><EmptyState icon={ListChecks} line="Tasks and reminders you need to act on go here." action="Add your first task" onAction={() => nav('/tasks/new')} /></div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input aria-label="Search tasks" className="input !pl-10" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {categories.length > 0 && (
              <select aria-label="Category" className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="-mx-page-x mb-4 flex gap-2 overflow-x-auto px-page-x pb-1" role="group" aria-label="Filters">
            {FILTERS.map((f) => (
              <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}{f.key === 'overdue' && counts.overdue > 0 && <span className="num text-overdue"> {counts.overdue}</span>}{f.key === 'today' && counts.today > 0 && <span className="num"> {counts.today}</span>}
              </Chip>
            ))}
          </div>

          {sections.length === 0 ? (
            <p className="panel py-10 text-center text-body text-muted">{q || category ? 'No tasks match.' : filter === 'done' ? 'Nothing completed yet.' : 'Nothing here. Nice and clear.'}</p>
          ) : (
            <div className="space-y-4">
              {sections.map((g) => (
                <section key={g.key} aria-label={g.label} className="panel">
                  {(filter === 'all' || filter === 'upcoming') && (
                    <h2 className={`mb-3 text-label uppercase ${g.key === 'overdue' ? 'text-overdue' : 'text-faint'}`}>{g.label} <span className="num font-medium">· {g.items.length}</span></h2>
                  )}
                  {g.items.map((t) => <TaskRow key={t.id} item={t} extra={progress.get(t.id)} onToggle={toggle} onOpen={() => nav(`/tasks/${t.id}`)} />)}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
