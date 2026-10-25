import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useApp } from '../store/app';
import { whenLabel } from '../format';
import { Sheet } from './ui';

/** In-app reminder prompt: Done / Snooze 1h / Tomorrow 9am. First queued reminder shows; the rest wait. */
export function ReminderPrompt() {
  const { prompts, items, complete, snooze, dismissPrompt } = useApp();
  const nav = useNavigate();
  const item = items.find((i) => i.id === prompts[0]);
  if (!item) return null;
  return (
    <Sheet open onClose={() => dismissPrompt(item.id)} label="Reminder">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-control bg-primary-soft text-primary"><Bell size={18} aria-hidden /></span>
        <p className="eyebrow">Reminder{prompts.length > 1 ? ` · ${prompts.length} waiting` : ''}</p>
      </div>
      <h2 className="text-heading">{item.title}</h2>
      {item.due_at && <p className="mb-4 mt-1 text-meta text-muted">Due {whenLabel(item.due_at)}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void complete(item)} className="btn btn-primary">Done</button>
        <button type="button" onClick={() => void snooze(item.id, 'snooze1h')} className="btn">Snooze 1h</button>
        <button type="button" onClick={() => void snooze(item.id, 'snoozeTomorrow')} className="btn">Tomorrow 9am</button>
        <button type="button" onClick={() => { dismissPrompt(item.id); nav(`/tasks/${item.id}`); }} className="btn">Open</button>
      </div>
    </Sheet>
  );
}

export function ToastHost() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      <div className="sheet-enter pointer-events-auto flex items-center gap-4 rounded-control border border-border bg-surface px-4 py-2 text-body font-semibold shadow-float">
        {toast.message}
        {toast.undo && (
          <button type="button" className="min-h-touch font-bold text-primary"
            onClick={() => { void toast.undo?.(); useApp.setState({ toast: null }); }}>Undo</button>
        )}
      </div>
    </div>
  );
}
