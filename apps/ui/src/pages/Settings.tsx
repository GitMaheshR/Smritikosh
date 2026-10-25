import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { isValidPin, listNotebooks, loadSampleData, removeSampleData } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, Chip, PageHeader } from '../components/ui';
import { platformName } from '../platform';
import { plural } from '../format';

const iconBtn = 'flex w-touch items-center justify-center text-muted hover:text-text';

function AppearanceCard() {
  const { theme, setTheme, readingMode, setReadingMode } = useApp();
  return (
    <Card title="Appearance">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Theme">
        {(['system', 'light', 'dark'] as const).map((t) => (
          <Chip key={t} selected={theme === t} onClick={() => void setTheme(t)}>{t[0]!.toUpperCase() + t.slice(1)}</Chip>
        ))}
      </div>
      <label className="flex min-h-touch items-center gap-3 text-body font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-secondary))]" checked={readingMode} onChange={(e) => void setReadingMode(e.target.checked)} />
        Serif text for long notes and journal entries
      </label>
    </Card>
  );
}

function NotificationsCard() {
  const { notifier, showToast } = useApp();
  const [auto, setAuto] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<string>('');
  useEffect(() => { void notifier?.getAutoStart?.().then(setAuto); }, [notifier]);
  return (
    <Card title="Reminders">
      <p className="mb-3 text-body text-muted">
        {platformName() === 'desktop'
          ? 'Closing the window keeps Smritikosh running in the system tray so reminders still fire. Use Quit in the tray menu to stop it.'
          : 'Reminders use exact alarms so they fire on time, even with the app closed.'}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={async () => setPerm((await notifier?.requestPermission()) ? 'Reminders are allowed.' : 'Not allowed yet. Enable notifications (and exact alarms) in system settings.')}>Check permissions</button>
        {auto !== null && (
          <label className="flex min-h-touch items-center gap-3 text-body font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-secondary))]" checked={auto}
              onChange={async (e) => { await notifier!.setAutoStart!(e.target.checked); setAuto(e.target.checked); showToast(e.target.checked ? 'Will start with Windows, hidden in the tray' : 'Auto-start off'); }} />
            Start with Windows
          </label>
        )}
      </div>
      {perm && <p role="status" className="mt-2 text-meta text-muted">{perm}</p>}
    </Card>
  );
}

function PinCard() {
  const { pinHash, setPin } = useApp();
  const [pin, setP] = useState('');
  const [msg, setMsg] = useState('');
  async function save() {
    if (!isValidPin(pin)) return setMsg('Use 4 to 6 digits.');
    await setPin(pin);
    setP(''); setMsg('PIN saved.');
  }
  async function remove() {
    if (!window.confirm('Remove the app PIN? Anyone with this device could open Smritikosh.')) return;
    await setPin(null); setMsg('PIN removed.');
  }
  return (
    <Card title="App lock">
      <p className="mb-3 text-body text-muted">{pinHash ? 'A PIN is set. The app locks on open and after 5 minutes in the background.' : 'Set a 4–6 digit PIN to lock the app on open.'}</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="New PIN" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setP(e.target.value.replace(/\D/g, ''))} className="input num !w-32" />
        <button type="button" onClick={() => void save()} className="btn btn-primary">{pinHash ? 'Change PIN' : 'Set PIN'}</button>
        {pinHash && <button type="button" onClick={() => void remove()} className="btn">Remove</button>}
      </div>
      {msg && <p role="status" className="mt-2 text-meta text-muted">{msg}</p>}
    </Card>
  );
}

function SampleDataCard() {
  const { store, refresh, showToast, items } = useApp();
  const [busy, setBusy] = useState(false);
  const has = items.some((i) => i.meta.sample === true);
  async function add() {
    setBusy(true);
    try {
      const r = await loadSampleData(store!);
      await refresh();
      showToast(r.tasks + r.notes + r.lessons + r.goals === 0 ? 'Sample data is already loaded' : `Added ${r.tasks} tasks, ${r.notes} notes, ${r.lessons} journal entries, ${r.goals} goals`);
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Remove all sample tasks, notes, journal entries and goals? Your own items are not touched.')) return;
    setBusy(true);
    try {
      const n = await removeSampleData(store!);
      await refresh();
      showToast(`Removed ${n} sample items`);
    } finally { setBusy(false); }
  }
  return (
    <Card title="Sample data">
      <p className="mb-3 text-body text-muted">
        Adds example tasks (overdue, today, repeating, free-time), notes with code and tables, journal entries and goals, so you can try every screen.
        A few sample tasks have reminders set for the coming days. Remove them any time; your own items stay.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || has} onClick={() => void add()} className="btn btn-primary disabled:opacity-50">{has ? 'Sample data loaded' : 'Add sample data'}</button>
        {has && <button type="button" disabled={busy} onClick={() => void remove()} className="btn">Remove sample data</button>}
      </div>
    </Card>
  );
}

interface CategoryRow { key: string; name: string; count: number }

/** Add / rename / delete list used for both the task categories and the note categories. */
function CategoryManager({ title, intro, noun, rows, onAdd, onRename, onDelete }: {
  title: string; intro: string; noun: string; rows: CategoryRow[];
  onAdd: (name: string) => Promise<string | null>;
  onRename: (row: CategoryRow, name: string) => Promise<string | null>;
  onDelete: (row: CategoryRow) => Promise<void>;
}) {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const fail = (msg: string | null) => { if (msg) showToast(msg); return !msg; };
  return (
    <Card title={title} count={rows.length}>
      <p className="mb-3 text-body text-muted">{intro}</p>
      {rows.length === 0 ? (
        <p className="mb-3 text-body text-faint">No categories yet. Add your first one below.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.key} className="flex min-h-touch items-center justify-between gap-2 border-t border-border text-body font-semibold first:border-t-0">
              <span className="min-w-0 truncate">{r.name}<span className="num ml-2 text-meta font-medium text-faint">{r.count}</span></span>
              <span className="flex shrink-0">
                <button type="button" aria-label={`Rename ${r.name}`} className={iconBtn}
                  onClick={async () => { const n = window.prompt(`Rename ${noun} category`, r.name); if (n?.trim() && n.trim() !== r.name) fail(await onRename(r, n)); }}><Pencil size={16} /></button>
                <button type="button" aria-label={`Delete ${r.name}`} className={iconBtn} onClick={() => void onDelete(r)}><Trash2 size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (name.trim() && fail(await onAdd(name))) setName(''); }}>
        <input aria-label={`New ${noun} category`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="New category" className="input flex-1" />
        <button type="submit" className="btn">Add</button>
      </form>
    </Card>
  );
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function TaskCategoriesCard() {
  const { categories, items, store, refresh, deleteTaskCategory, showToast } = useApp();
  const rows = categories.map((c) => ({ key: c.id, name: c.name, count: items.filter((i) => i.type === 'task' && i.category === c.name).length }));
  const clash = (n: string, except?: string) => categories.some((c) => same(c.name, n) && c.id !== except);
  return (
    <CategoryManager title="Task categories" noun="task" rows={rows}
      intro="The Category dropdown when you add or edit a task."
      onAdd={async (n) => { if (clash(n)) return 'You already have a task category with that name'; await store!.addCategory(n); await refresh(false); return null; }}
      onRename={async (r, n) => { if (clash(n, r.key)) return 'You already have a task category with that name'; await store!.renameCategory(r.key, n); await refresh(false); return null; }}
      onDelete={async (r) => {
        const msg = r.count ? `Delete "${r.name}"? Its ${plural(r.count, 'task')} will be kept, just without a category.` : `Delete "${r.name}"?`;
        if (!window.confirm(msg)) return;
        await deleteTaskCategory(r.key);
        showToast(`Deleted "${r.name}"`);
      }} />
  );
}

function NoteCategoriesCard() {
  const { items, notebooks, addNotebook, renameNotebook, deleteNotebook, showToast } = useApp();
  const rows = listNotebooks(items, notebooks).map((b) => ({ key: b.name, name: b.name, count: b.count }));
  return (
    <CategoryManager title="Note categories" noun="note" rows={rows}
      intro="The Category dropdown on each note, and the filters on the Notes screen. Separate from task categories."
      onAdd={async (n) => ((await addNotebook(n)) ? null : 'You already have a note category with that name')}
      onRename={async (r, n) => ((await renameNotebook(r.name, n)) ? null : 'You already have a note category with that name')}
      onDelete={async (r) => {
        const msg = r.count ? `Delete "${r.name}"? Its ${plural(r.count, 'note')} will be kept, just without a category.` : `Delete "${r.name}"?`;
        if (!window.confirm(msg)) return;
        await deleteNotebook(r.name);
        showToast(`Deleted "${r.name}"`);
      }} />
  );
}

export function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Your app, your data" title="Settings & data" subtitle="Keep your workspace useful and your information portable." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <AppearanceCard />
          <NotificationsCard />
          <PinCard />
          <SampleDataCard />
        </div>
        <div className="space-y-4">
          <TaskCategoriesCard />
          <NoteCategoriesCard />
          <Card title="About your data">
            <p className="text-body text-muted">Everything stays on this device. Nothing is sent anywhere, and the app works without internet. Export and backup tools are planned.</p>
            <p className="num mt-3 text-meta text-faint">Smritikosh 0.1.0 · running on {platformName()}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
