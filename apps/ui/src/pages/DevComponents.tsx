import { Gift } from 'lucide-react';
import type { Item } from '@smritikosh/core';
import { Card, Chip, EmptyState, ItemRow, ProgressBar } from '../components/ui';

const sample = (over: Partial<Item>): Item => ({
  id: 'x', type: 'task', title: 'Pay LIC premium', body: null, category: 'Bank', priority: 1, status: 'todo',
  due_at: '2020-01-01T18:00', remind_at: null, repeat_rule: null, parent_id: null, meta: {}, pinned: false,
  archived: false, created_at: '', updated_at: '', deleted_at: null, tags: ['insurance'], ...over,
});

function Specimen({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div data-theme={theme} className="space-y-4 rounded-card bg-bg p-4 text-text">
      <h2 className="text-title">{theme === 'light' ? 'Light' : 'Dark'}</h2>
      <p className="text-label uppercase text-muted">Section label</p>
      <Card title="Card heading" count={3}>
        <ItemRow item={sample({})} />
        <ItemRow item={sample({ title: 'Book dentist', priority: 2, due_at: '2999-01-01T09:00' })} />
        <ItemRow item={sample({ title: 'Done thing', status: 'done' })} />
      </Card>
      <div className="flex gap-2"><Chip>Idle</Chip><Chip selected>Selected</Chip></div>
      <ProgressBar value={64} />
      <p className="num text-mono">₹1,284.50 · -3.2%</p>
      <EmptyState icon={Gift} color="text-m-wishlists" line="Gifts and wishes go here." action="Add your first wish" />
    </div>
  );
}

/** Hidden route: /dev/components */
export function DevComponents() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Specimen theme="light" />
      <Specimen theme="dark" />
    </div>
  );
}
