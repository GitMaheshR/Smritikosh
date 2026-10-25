import { useState } from 'react';
import { ListChecks, Target } from 'lucide-react';
import type { Item } from '@smritikosh/core';
import { Card, Chip, EmptyState, PriorityPill, ProgressBar, StatCard, TaskRow } from '../components/ui';

const sample = (over: Partial<Item>): Item => ({
  id: 'x', type: 'task', title: 'Apply for PAN card', body: null, category: 'Personal', priority: 1, status: 'todo',
  due_at: '2020-01-01T17:00', remind_at: null, repeat_rule: null, parent_id: null, meta: {}, pinned: false,
  archived: false, created_at: '', updated_at: '', deleted_at: null, tags: [], ...over,
});

function Specimen({ theme }: { theme: 'light' | 'dark' }) {
  const [done, setDone] = useState(false);
  return (
    <div data-theme={theme} className="space-y-4 rounded-card bg-bg p-4 text-text">
      <h2 className="text-title">{theme === 'light' ? 'Light' : 'Dark'}</h2>
      <p className="eyebrow">Eyebrow label</p>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Open tasks" value={7} foot="Across your lists" icon={ListChecks} />
        <StatCard label="Due today" value={3} foot="Keep an eye" icon={ListChecks} />
        <StatCard label="Overdue" value={1} foot="Worth rescheduling" icon={ListChecks} alert />
      </div>
      <Card title="Today’s focus" count={3}>
        <TaskRow item={sample({})} />
        <TaskRow item={sample({ title: 'Review project notes', priority: 2, due_at: '2999-01-01T18:30' })} />
        <TaskRow item={sample({ title: 'Read 10 pages', priority: 3, status: done ? 'done' : 'todo' })} onToggle={() => setDone(!done)} />
      </Card>
      <div className="flex flex-wrap gap-2"><Chip>Idle</Chip><Chip selected>Selected</Chip><PriorityPill priority={1} /><PriorityPill priority={2} /><PriorityPill priority={3} /></div>
      <ProgressBar value={60} label="Today’s progress" valueLabel="3 of 5" />
      <div className="flex gap-2"><button className="btn">Default</button><button className="btn btn-primary">Primary</button><button className="btn btn-danger">Danger</button></div>
      <input className="input" placeholder="Input" />
      <EmptyState icon={Target} line="Goals with milestones and a target date." action="Set your first goal" />
    </div>
  );
}

/** Hidden route: /dev/components */
export function DevComponents() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Specimen theme="light" />
      <Specimen theme="dark" />
    </div>
  );
}
