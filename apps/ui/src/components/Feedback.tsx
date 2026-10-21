import { useApp } from '../store/app';
import { Sheet } from './ui';

/** In-app reminder prompt: Done / Snooze 1h / Tomorrow 9am. First queued reminder shows; the rest wait. */
export function ReminderPrompt() {
  const { prompts, items, complete, snooze, dismissPrompt, openEditor } = useApp();
  const item = items.find((i) => i.id === prompts[0]);
  if (!item) return null;
  const btn = 'min-h-touch rounded-control border border-border px-4 text-body';
  return (
    <Sheet open onClose={() => dismissPrompt(item.id)} label="Reminder">
      <p className="text-label uppercase text-muted">Reminder{prompts.length > 1 ? ` · ${prompts.length} waiting` : ''}</p>
      <h2 className="mb-1 mt-1 text-heading">{item.title}</h2>
      {item.due_at && <p className="num mb-4 text-meta text-muted">Due {item.due_at.replace('T', ' ')}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void complete(item)} className="min-h-touch rounded-control bg-accent px-4 text-body font-semibold text-on-accent">Done</button>
        <button type="button" onClick={() => void snooze(item.id, 'snooze1h')} className={btn}>Snooze 1h</button>
        <button type="button" onClick={() => void snooze(item.id, 'snoozeTomorrow')} className={btn}>Tomorrow 9am</button>
        <button type="button" onClick={() => { dismissPrompt(item.id); openEditor(item.id); }} className={btn}>Open</button>
      </div>
    </Sheet>
  );
}

export function ToastHost() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      <div className="sheet-enter flex items-center gap-4 rounded-control border border-border bg-surface px-4 py-2 text-body shadow-float">
        {toast.message}
        {toast.undo && (
          <button type="button" className="min-h-touch font-semibold text-accent"
            onClick={() => { void toast.undo?.(); useApp.setState({ toast: null }); }}>Undo</button>
        )}
      </div>
    </div>
  );
}
