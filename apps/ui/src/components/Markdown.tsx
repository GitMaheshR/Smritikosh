import { useMemo, type MouseEvent } from 'react';
import { renderMarkdown } from '../markdown';
import { useApp } from '../store/app';

/**
 * Renders sanitised markdown. Reading mode swaps to the serif face with a 68-character measure.
 * `onToggleCheck(n)` makes the checklist boxes tappable (n = position of the box in the text).
 */
export function Markdown({ source, onToggleCheck }: { source: string; onToggleCheck?: (index: number) => void }) {
  const reading = useApp((s) => s.readingMode);
  const html = useMemo(() => renderMarkdown(source), [source]);

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const box = (e.target as HTMLElement).closest<HTMLElement>('[data-check]');
    if (box && onToggleCheck) onToggleCheck(Number(box.dataset.check));
  }

  return <div className={`md text-body ${reading ? 'md-reading' : ''} ${onToggleCheck ? 'md-live' : ''}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
