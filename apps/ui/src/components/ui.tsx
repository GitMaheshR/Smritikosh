import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Repeat, type LucideIcon } from 'lucide-react';
import type { Item } from '@smritikosh/core';
import { whenLabel } from '../format';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---- Page furniture -----------------------------------------------------------------------------

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div aria-hidden className={cx('grid shrink-0 place-items-center bg-primary font-extrabold text-on-primary shadow-mark', size === 'md' ? 'h-11 w-11 rounded-tile text-title' : 'h-9 w-9 rounded-control text-heading')}>✳</div>
  );
}

/** Teal eyebrow, big title, short subtitle, optional action on the right (as on every Daymark page). */
export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-1 text-title md:text-display">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({ title, count, action, children, footer, className }: { title?: string; count?: number; action?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section className={cx('panel min-w-0', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-heading">{title}{count !== undefined && <span className="num ml-2 text-meta font-medium text-faint">{count}</span>}</h2>
          )}
          {action}
        </header>
      )}
      {children}
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}

export function StatCard({ label, value, foot, icon: Icon, alert }: { label: string; value: number; foot: string; icon: LucideIcon; alert?: boolean }) {
  return (
    <div className="min-w-0 rounded-tile border border-border bg-surface p-3 md:rounded-card md:p-4">
      <div className="flex items-start justify-between gap-2 text-meta font-bold text-muted">
        <span>{label}</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-control bg-primary-soft text-primary md:h-9 md:w-9"><Icon size={16} aria-hidden /></span>
      </div>
      <div className="num mt-2 text-stat md:mt-3">{value}</div>
      <div className={cx('mt-1 text-meta', alert && value > 0 ? 'text-overdue' : 'text-faint')}>{foot}</div>
    </div>
  );
}

export function Chip({ children, selected, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  const base = 'inline-flex h-9 min-h-0 shrink-0 items-center gap-1 rounded-control border px-3 text-meta font-semibold';
  const tone = selected ? 'border-transparent bg-primary-soft text-primary' : 'border-border bg-surface text-muted';
  return onClick ? (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cx(base, tone, 'hover:text-text')}>{children}</button>
  ) : (
    <span className={cx(base, tone)}>{children}</span>
  );
}

const PRIORITY = {
  1: { label: 'High', tone: 'bg-high-soft text-high' },
  2: { label: 'Medium', tone: 'bg-medium-soft text-medium' },
  3: { label: 'Low', tone: 'bg-low-soft text-low' },
} as const;

export function PriorityPill({ priority }: { priority: number }) {
  const p = PRIORITY[priority as 1 | 2 | 3] ?? PRIORITY[2];
  return <span className={cx('inline-flex shrink-0 items-center rounded-control px-2 py-1 text-label font-extrabold tracking-normal', p.tone)}>{p.label}</span>;
}

export function ProgressBar({ value, label, valueLabel }: { value: number; label?: string; valueLabel?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      {(label || valueLabel) && (
        <div className="mb-2 flex justify-between text-meta"><span>{label}</span><strong>{valueLabel}</strong></div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
        <div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, line, action, onAction }: { icon: LucideIcon; line: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-tile bg-primary-soft text-primary"><Icon size={22} aria-hidden /></span>
      <p className="max-w-xs text-body text-muted">{line}</p>
      {action && <button type="button" onClick={onAction} className="btn btn-primary">{action}</button>}
    </div>
  );
}

export function FormRow({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-meta text-faint">{hint}</p>}
    </div>
  );
}

/** Square tick box (teal when done). The hit area is 44px even though the box is 20px. */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className="-m-3 flex h-11 w-11 min-h-0 shrink-0 items-center justify-center">
      <span className={cx('grid h-5 w-5 place-items-center rounded-[6px] border-[1.6px]', checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-faint bg-surface')}>
        {checked && <Check size={14} strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
}

// ---- Tasks ------------------------------------------------------------------------------------

export function TaskRow({ item, onToggle, onOpen, extra }: { item: Item; onToggle?: (i: Item) => void; onOpen?: (i: Item) => void; extra?: { done: number; total: number } }) {
  const done = item.status === 'done';
  const when = whenLabel(item.due_at);
  const overdue = !done && !!item.due_at && new Date(item.due_at.length > 10 ? item.due_at : `${item.due_at}T23:59`) < new Date();
  return (
    <div className="flex items-start gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="pt-0.5">
        <Checkbox checked={done} label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`} onChange={() => onToggle?.(item)} />
      </div>
      <button type="button" onClick={() => onOpen?.(item)} className="min-h-0 min-w-0 flex-1 text-left">
        <p className={cx('text-body font-bold', done && 'text-faint line-through')}>{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-meta text-muted">
          {item.category && <span>{item.category}</span>}
          {when && <span className={cx(overdue && 'font-semibold text-overdue')}>{when}</span>}
          {item.repeat_rule && <span aria-label="Repeats" className="inline-flex"><Repeat size={12} aria-hidden /></span>}
          {extra && extra.total > 0 && <span className="num">{extra.done}/{extra.total}</span>}
        </p>
      </button>
      <PriorityPill priority={item.priority} />
    </div>
  );
}

// ---- Sheets --------------------------------------------------------------------------------------

/** Open sheets, topmost last. The Android Back button closes the topmost one before it navigates anywhere. */
const overlayStack: (() => void)[] = [];
export function closeTopOverlay(): boolean {
  const close = overlayStack.pop();
  close?.();
  return !!close;
}

export function Sheet({ open, onClose, children, label, variant = 'sheet' }: { open: boolean; onClose: () => void; children: ReactNode; label: string; variant?: 'sheet' | 'command' }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const fn = () => closeRef.current();
    overlayStack.push(fn);
    return () => {
      const i = overlayStack.indexOf(fn);
      if (i >= 0) overlayStack.splice(i, 1);
    };
  }, [open]);
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
    <div className={cx('fixed inset-0 z-40 flex justify-center bg-text/40', pos)} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label}
        className="sheet-enter w-full max-w-[640px] rounded-t-card border border-border bg-surface p-4 shadow-float md:rounded-card md:p-5">
        {children}
      </div>
    </div>
  );
}

export function CommandBar(props: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return <Sheet {...props} variant="command" />;
}
