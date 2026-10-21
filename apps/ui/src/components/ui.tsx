import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Repeat, type LucideIcon } from 'lucide-react';
import type { Item } from '@smritikosh/core';
import { moduleForType } from '../modules';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function Card({ title, count, children, footer }: { title: string; count?: number; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-heading">{title}</h2>
        {count !== undefined && <span className="num text-meta text-muted">{count}</span>}
      </header>
      {children}
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}

export function Chip({ children, selected, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  const base = 'inline-flex h-7 min-h-0 items-center rounded-full border px-3 text-meta';
  const tone = selected ? 'border-transparent bg-accent-soft text-accent' : 'border-border text-muted';
  return onClick ? (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cx(base, tone)}>{children}</button>
  ) : (
    <span className={cx(base, tone)}>{children}</span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <div className="h-[6px] flex-1 rounded-full bg-surface-2" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
      </div>
      <span className="num w-10 text-right text-mono text-muted">{Math.round(v)}%</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, color, line, action, onAction }: { icon: LucideIcon; color: string; line: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <Icon className={color} size={28} aria-hidden />
      <p className="max-w-xs text-body text-muted">{line}</p>
      {action && (
        <button type="button" onClick={onAction} className="rounded-control bg-accent px-4 text-body font-semibold text-on-accent">{action}</button>
      )}
    </div>
  );
}

export function Sheet({ open, onClose, children, label, variant = 'sheet' }: { open: boolean; onClose: () => void; children: ReactNode; label: string; variant?: 'sheet' | 'command' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const pos = variant === 'command' ? 'items-end md:items-start md:pt-[12vh]' : 'items-end';
  return (
    <div className={cx('fixed inset-0 z-40 flex justify-center bg-text/30', pos)} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label}
        className="sheet-enter w-full max-w-[640px] rounded-t-card border border-border bg-surface p-4 shadow-float md:rounded-card">
        {children}
      </div>
    </div>
  );
}

export function CommandBar(props: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return <Sheet {...props} variant="command" />;
}

const dueLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', ...(iso.length > 10 ? { hour: 'numeric', minute: '2-digit' } : {}) });
};

export function ItemRow({ item, onToggle, onOpen, extra }: { item: Item; onToggle?: (i: Item) => void; onOpen?: (i: Item) => void; extra?: { done: number; total: number } }) {
  const m = moduleForType(item.type);
  const done = item.status === 'done';
  const overdue = !done && item.due_at && new Date(item.due_at) < new Date();
  const edge = item.priority === 1 ? 'border-l-overdue' : item.priority === 2 ? 'border-l-transparent' : 'border-l-transparent';
  return (
    <div className={cx('flex min-h-touch items-center gap-3 border-l-[3px] pl-2', edge)}>
      {item.type === 'task' && (
        <button type="button" aria-label={done ? 'Mark not done' : 'Mark done'} onClick={() => onToggle?.(item)}
          className={cx('flex h-6 min-h-0 w-6 shrink-0 items-center justify-center rounded-full border', done ? 'border-transparent bg-success text-on-accent' : 'border-muted')}>
          {done && <Check size={14} />}
        </button>
      )}
      <button type="button" onClick={() => onOpen?.(item)} className="min-h-touch flex-1 py-2 text-left">
        <div className={cx('text-body', done && 'text-muted line-through')}>{item.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-meta text-muted">
          <span className={cx('h-2 w-2 rounded-full', m.dot)} aria-hidden />
          {item.due_at && <span className={cx('num', overdue && 'text-overdue')}>{dueLabel(item.due_at)}</span>}
          {item.repeat_rule && <span aria-label="Repeats"><Repeat size={12} /></span>}
          {extra && <span className="num">{extra.done}/{extra.total}</span>}
          {item.category && <span>{item.category}</span>}
          {item.tags.slice(0, 2).map((t) => <span key={t}>#{t}</span>)}
        </div>
      </button>
    </div>
  );
}
