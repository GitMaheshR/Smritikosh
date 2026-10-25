import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, ListChecks, NotebookPen, PenLine, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { focusTasks, homeStats, recentlyCaptured, todayProgress, type Item } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, EmptyState, PageHeader, ProgressBar, StatCard, TaskRow } from '../components/ui';
import { todayLine, updatedPhrase } from '../format';

const KIND: Record<string, { label: string; icon: LucideIcon }> = {
  note: { label: 'Note', icon: NotebookPen },
  lesson: { label: 'Journal', icon: PenLine },
  goal: { label: 'Goal', icon: Target },
};
const pathFor = (i: Item) => (i.type === 'note' ? `/notes/${i.id}` : i.type === 'lesson' ? `/journal/${i.id}` : `/goals/${i.id}`);

export function HomePage() {
  const { items, complete, reopen, missed, dismissMissed, newNote } = useApp();
  const nav = useNavigate();
  const now = new Date();
  const { weekday, date } = todayLine(now);
  const stats = useMemo(() => homeStats(items, new Date()), [items]);
  const focus = useMemo(() => focusTasks(items, new Date()), [items]);
  const progress = useMemo(() => todayProgress(items, new Date()), [items]);
  const recent = useMemo(() => recentlyCaptured(items, 3), [items]);
  const toggle = (i: Item) => void (i.status === 'done' ? reopen(i) : complete(i));
  const row = (i: Item) => <TaskRow key={i.id} item={i} onToggle={toggle} onOpen={() => nav(`/tasks/${i.id}`)} />;

  const tiles: { icon: LucideIcon; title: string; sub: string; go: () => void }[] = [
    { icon: NotebookPen, title: 'Write a note', sub: 'Capture an idea', go: () => void newNote().then((id) => nav(`/notes/${id}`)) },
    { icon: ListChecks, title: 'Add a task', sub: 'Plan your next step', go: () => nav('/tasks/new') },
    { icon: PenLine, title: 'Log a lesson', sub: 'Learn from today', go: () => nav('/journal/new') },
    { icon: Target, title: 'Check a goal', sub: 'See your progress', go: () => nav('/goals') },
  ];

  return (
    <div>
      <PageHeader eyebrow={`${weekday} · Personal overview`} title="Make room for what matters."
        subtitle="Here’s your day at a glance. Start with one meaningful step."
        action={<span className="hidden items-center gap-2 rounded-control border border-border bg-surface px-3 py-2.5 text-meta text-muted md:inline-flex"><CalendarClock size={16} aria-hidden />Today · {date}</span>} />

      {missed.length > 0 && (
        <div role="status" className="mb-4 rounded-card border border-border border-l-4 border-l-medium bg-surface p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-heading">Missed while closed <span className="num text-meta font-medium text-faint">{missed.length}</span></h2>
            <button type="button" onClick={dismissMissed} className="min-h-0 py-1 text-meta font-semibold text-muted">Dismiss</button>
          </div>
          {missed.slice(0, 5).map(row)}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-3">
        <StatCard label="Open tasks" value={stats.open} foot="Across your lists" icon={ListChecks} />
        <StatCard label="Due today" value={stats.dueToday} foot="Keep an eye on these" icon={CalendarClock} />
        <StatCard label="Overdue" value={stats.overdue} foot="Worth rescheduling" icon={AlertCircle} alert />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <Card title="Today’s focus" action={<Link to="/tasks" className="text-link">All tasks ↗</Link>}>
          {focus.length === 0 ? (
            <EmptyState icon={Sparkles} line="Nothing due today. Add a task, or enjoy the space." />
          ) : (
            <div>{focus.map(row)}</div>
          )}
          <button type="button" onClick={() => nav('/tasks/new')} className="btn mt-3">＋ Add a task</button>
          {progress.total > 0 && (
            <div className="mt-5">
              <ProgressBar value={progress.percent} label="Today’s progress" valueLabel={`${progress.done} of ${progress.total} complete`} />
            </div>
          )}
        </Card>

        <Card title="Quick capture" action={<span className="hidden text-meta text-faint xl:inline">Save it before you forget</span>}>
          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map((t) => (
              <button key={t.title} type="button" onClick={t.go}
                className="min-h-0 rounded-tile border border-border bg-surface p-3.5 text-left transition hover:-translate-y-px hover:border-primary/40">
                <span className="mb-3 grid h-9 w-9 place-items-center rounded-control bg-primary-soft text-primary"><t.icon size={18} aria-hidden /></span>
                <strong className="block text-body">{t.title}</strong>
                <small className="mt-1 block text-meta text-muted">{t.sub}</small>
              </button>
            ))}
          </div>
          <div className="mb-1 mt-5 flex items-center justify-between">
            <h2 className="text-heading">Recently captured</h2>
            <Link to="/notes" className="text-link">Browse ↗</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-3 text-body text-muted">Notes, journal entries and goals you save will show up here.</p>
          ) : (
            recent.map((i) => {
              const k = KIND[i.type]!;
              return (
                <button key={i.id} type="button" onClick={() => nav(pathFor(i))} className="flex min-h-0 w-full items-center gap-3 border-t border-border py-3 text-left first:border-t-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary"><k.icon size={16} aria-hidden /></span>
                  <span className="min-w-0">
                    <strong className="block truncate text-body">{i.title}</strong>
                    <small className="mt-0.5 block text-meta text-muted">{k.label} · Updated {updatedPhrase(i.updated_at)}</small>
                  </span>
                </button>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}
