import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { groupTasks, upcomingReminders, type Item } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, EmptyState, ItemRow } from '../components/ui';
import { MODULES } from '../modules';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function Dashboard() {
  const { items, openQuickAdd, openEditor, complete, missed, dismissMissed } = useApp();
  const { today, overdue, upcoming } = useMemo(() => {
    const now = new Date();
    const g = Object.fromEntries(groupTasks(items, now).map((x) => [x.key, x.items])) as Partial<Record<string, Item[]>>;
    return { overdue: g.overdue ?? [], today: g.today ?? [], upcoming: upcomingReminders(items, now, 7) };
  }, [items]);
  const row = (i: Item) => <ItemRow key={i.id} item={i} onToggle={() => void complete(i)} onOpen={() => openEditor(i.id)} />;

  return (
    <div className="space-y-4">
      <h1 className="text-display">{greeting()}</h1>
      {missed.length > 0 && (
        <div role="status" className="rounded-card border border-border border-l-[3px] border-l-warning bg-surface p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-heading">Missed while closed <span className="num text-meta text-muted">· {missed.length}</span></h2>
            <button type="button" onClick={dismissMissed} className="text-meta text-muted">Dismiss</button>
          </div>
          {missed.slice(0, 5).map(row)}
        </div>
      )}
      {overdue.length > 0 && (
        <Card title="Overdue" count={overdue.length} footer={overdue.length > 5 ? <Link to="/tasks" className="text-meta text-accent">See all</Link> : undefined}>
          {overdue.slice(0, 5).map(row)}
        </Card>
      )}
      <Card title="Today" count={today.length} footer={today.length > 5 ? <Link to="/tasks" className="text-meta text-accent">See all</Link> : undefined}>
        {today.length === 0 ? (
          <p className="py-2 text-body text-muted">Nothing due today. Tap + to capture something.</p>
        ) : today.slice(0, 5).map(row)}
      </Card>
      <Card title="Next 7 days" count={upcoming.length} footer={upcoming.length > 5 ? <Link to="/tasks" className="text-meta text-accent">See all</Link> : undefined}>
        {upcoming.length === 0 ? (
          <p className="py-2 text-body text-muted">No reminders set for the coming week.</p>
        ) : upcoming.slice(0, 5).map((i) => (
          <button key={i.id} type="button" onClick={() => openEditor(i.id)} className="flex min-h-touch w-full items-center justify-between gap-3 text-left">
            <span className="text-body">{i.title}</span>
            <span className="num shrink-0 text-meta text-muted">{new Date(i.remind_at!).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          </button>
        ))}
      </Card>
      {items.length === 0 && (
        <EmptyState icon={MODULES[1]!.icon} color="text-accent" line="Your memory keeper is empty. Capture your first thing in one line."
          action="Quick add" onAction={() => openQuickAdd(true)} />
      )}
    </div>
  );
}

export function ModulePage() {
  const { pathname } = useLocation();
  const m = MODULES.find((x) => x.path === pathname)!;
  const { items, removeWithUndo, complete, reopen, openQuickAdd } = useApp();
  const toggle = (i: Item) => void (i.status === 'done' ? reopen(i) : complete(i));
  const list = items.filter((i) => i.type === m.type);

  const remove = (i: Item) => removeWithUndo(i);

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-3 text-title"><m.icon className={m.color} size={24} aria-hidden />{m.label}</h1>
      {list.length === 0 ? (
        <EmptyState icon={m.icon} color={m.color} line={m.emptyLine ?? ''} action={m.emptyAction} onAction={() => openQuickAdd(true)} />
      ) : (
        <div className="divide-y divide-border rounded-card border border-border bg-surface px-3">
          {list.map((i) => (
            <div key={i.id} className="flex items-center">
              <div className="flex-1"><ItemRow item={i} onToggle={toggle} /></div>
              <button type="button" aria-label={`Delete ${i.title}`} onClick={() => void remove(i)} className="flex w-touch items-center justify-center text-muted"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VaultPage() {
  const m = MODULES.find((x) => x.key === 'vault')!;
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-3 text-title"><m.icon className={m.color} size={24} aria-hidden />Vault</h1>
      <EmptyState icon={m.icon} color={m.color} line="Link-only entries (“Bank X is in Bitwarden”) and the optional encrypted vault arrive in Phase 6." />
    </div>
  );
}
