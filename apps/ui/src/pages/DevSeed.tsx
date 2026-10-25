import { useState } from 'react';
import { removeSeededNotes, seedNotes } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, PageHeader } from '../components/ui';

/** Hidden route: #/dev/seed. Test data only; not linked from anywhere. */
export function DevSeed() {
  const { store, refresh, search, items } = useApp();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(true);
    const t = performance.now();
    try { setMsg(`${label}: ${await fn()} (${Math.round(performance.now() - t)} ms)`); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader eyebrow="Developer" title="Sample data" />
      <Card title="500 sample notes">
        <p className="mb-3 text-body text-muted">Adds generated notes (subject as notebook, topic as tag), flagged so they can be removed again.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => run('Seeded', async () => { await seedNotes(store!, 500); await refresh(false); return '500 notes'; })}>Add 500 notes</button>
          <button className="btn" disabled={busy} onClick={() => run('Searched', async () => {
            const qs = ['closure', 'retry latency', 'indexing', 'promise stream'];
            const worst = Math.max(...qs.map((q) => { const t = performance.now(); search.search(q); return performance.now() - t; }));
            return `4 queries over ${items.length} items, slowest ${worst.toFixed(1)} ms`;
          })}>Time search</button>
          <button className="btn" disabled={busy} onClick={() => run('Removed', async () => { const n = await removeSeededNotes(store!); await refresh(false); return `${n} rows to trash`; })}>Remove sample notes</button>
        </div>
        {msg && <p role="status" className="num mt-3 text-meta">{msg}</p>}
      </Card>
    </div>
  );
}
