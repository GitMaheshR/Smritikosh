import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { isValidPin } from '@smritikosh/core';
import { useApp } from '../store/app';
import { Card, Chip } from '../components/ui';
import { platformName } from '../platform';

const input = 'min-h-touch rounded-control border border-border bg-surface-2 px-3 text-body outline-none';
const btn = 'rounded-control border border-border px-4 text-body';

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
      <p className="mb-3 text-meta text-muted">{pinHash ? 'A PIN is set. The app locks on open and after 5 minutes in the background.' : 'Set a 4–6 digit PIN to lock the app on open.'}</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="New PIN" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setP(e.target.value.replace(/\D/g, ''))} className={`${input} num w-32`} />
        <button type="button" onClick={() => void save()} className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent">{pinHash ? 'Change PIN' : 'Set PIN'}</button>
        {pinHash && <button type="button" onClick={() => void remove()} className={btn}>Remove</button>}
      </div>
      {msg && <p role="status" className="mt-2 text-meta text-muted">{msg}</p>}
    </Card>
  );
}

function CategoriesCard() {
  const { categories, store, refresh } = useApp();
  const [name, setName] = useState('');
  return (
    <Card title="Categories" count={categories.length}>
      <ul className="divide-y divide-border">
        {categories.map((c) => (
          <li key={c.id} className="flex min-h-touch items-center justify-between text-body">
            {c.name}
            <span className="flex">
              <button type="button" aria-label={`Rename ${c.name}`} className="flex w-touch items-center justify-center text-muted"
                onClick={async () => { const n = window.prompt('Rename category', c.name); if (n?.trim()) { await store!.renameCategory(c.id, n); await refresh(); } }}><Pencil size={16} /></button>
              <button type="button" aria-label={`Delete ${c.name}`} className="flex w-touch items-center justify-center text-muted"
                onClick={async () => { if (window.confirm(`Delete category "${c.name}"? Items keep their label.`)) { await store!.deleteCategory(c.id); await refresh(); } }}><Trash2 size={16} /></button>
            </span>
          </li>
        ))}
      </ul>
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) { await store!.addCategory(name); setName(''); await refresh(); } }}>
        <input aria-label="New category" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className={`${input} flex-1`} />
        <button type="submit" className={btn}>Add</button>
      </form>
    </Card>
  );
}

function TagsCard() {
  const { tags, store, refresh } = useApp();
  return (
    <Card title="Tags" count={tags.length}>
      {tags.length === 0 ? (
        <p className="text-meta text-muted">Tags appear here when you use #tag in quick add.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tags.map((t) => (
            <li key={t.id} className="flex min-h-touch items-center justify-between text-body">
              #{t.name}
              <span className="flex">
                <button type="button" aria-label={`Rename ${t.name}`} className="flex w-touch items-center justify-center text-muted"
                  onClick={async () => { const n = window.prompt('Rename tag', t.name); if (n?.trim()) { await store!.renameTag(t.id, n); await refresh(); } }}><Pencil size={16} /></button>
                <button type="button" aria-label={`Delete ${t.name}`} className="flex w-touch items-center justify-center text-muted"
                  onClick={async () => { if (window.confirm(`Delete tag #${t.name}? It is removed from all items.`)) { await store!.deleteTag(t.id); await refresh(); } }}><Trash2 size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReadingCard() {
  const { readingMode, setReadingMode } = useApp();
  return (
    <Card title="Reading mode">
      <label className="flex min-h-touch items-center gap-3 text-body">
        <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-accent))]" checked={readingMode} onChange={(e) => void setReadingMode(e.target.checked)} />
        Serif text for long notes and lessons
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
      <p className="mb-3 text-meta text-muted">
        {platformName() === 'desktop'
          ? 'Closing the window keeps Smritikosh running in the system tray so reminders still fire. Use Quit in the tray menu to stop it.'
          : 'Reminders use exact alarms so they fire on time, even with the app closed.'}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={async () => setPerm((await notifier?.requestPermission()) ? 'Reminders are allowed.' : 'Not allowed yet. Enable notifications (and exact alarms) in system settings.')}>Check permissions</button>
        {auto !== null && (
          <label className="flex min-h-touch items-center gap-3 text-body">
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-accent))]" checked={auto}
              onChange={async (e) => { await notifier!.setAutoStart!(e.target.checked); setAuto(e.target.checked); showToast(e.target.checked ? 'Will start with Windows, hidden in the tray' : 'Auto-start off'); }} />
            Start with Windows
          </label>
        )}
      </div>
      {perm && <p role="status" className="mt-2 text-meta text-muted">{perm}</p>}
    </Card>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useApp();
  return (
    <div className="space-y-4">
      <h1 className="text-title">Settings</h1>
      <Card title="Theme">
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <Chip key={t} selected={theme === t} onClick={() => void setTheme(t)}>{t[0]!.toUpperCase() + t.slice(1)}</Chip>
          ))}
        </div>
      </Card>
      <ReadingCard />
      <NotificationsCard />
      <PinCard />
      <CategoriesCard />
      <TagsCard />
      <p className="num text-meta text-muted">Smritikosh 0.1.0 · running on {platformName()} · all data stays on this device</p>
    </div>
  );
}
