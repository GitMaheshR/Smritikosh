import { useMemo } from 'react';
import { renderMarkdown } from '../markdown';
import { useApp } from '../store/app';

/** Renders sanitised markdown. Reading mode swaps to the serif face with a 68-character measure. */
export function Markdown({ source }: { source: string }) {
  const reading = useApp((s) => s.readingMode);
  const html = useMemo(() => renderMarkdown(source), [source]);
  return <div className={`md text-body ${reading ? 'md-reading' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
