import { Marked } from 'marked';
import { titleFromBody, type Item } from '@smritikosh/core';

// Older notes were saved as markdown. They are converted to formatted text the first time they are opened for editing,
// and saved in the new format on the next Save. Nothing is converted until the person saves.
const converter = new Marked({ gfm: true, breaks: true });

/** Markdown (with "- [ ]" checklists) as HTML the editor understands, including its checklist markup. */
export function markdownToEditorHtml(markdown: string): string {
  const html = converter.parse(markdown, { async: false }) as string;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const box of Array.from(doc.querySelectorAll('li > input[type="checkbox"]'))) {
    const li = box.parentElement!;
    li.setAttribute('data-type', 'taskItem');
    li.setAttribute('data-checked', box.hasAttribute('checked') ? 'true' : 'false');
    li.parentElement?.setAttribute('data-type', 'taskList');
    box.remove();
  }
  return doc.body.innerHTML;
}

// First line that is plain text or a heading; a first line that is a list item, quote, code or table row stays in the text.
const KEEPS_LINE = /^\s*(?:[-*+]\s|\d+[.)]\s|>|```|~~~|\|)/;

/** The Title field and the editor content for a note, whichever format it was saved in. */
export function noteForEditing(note: Item): { title: string; html: string } {
  if (note.meta.fmt === 'html') {
    return { title: note.title === 'Untitled' ? '' : note.title, html: note.body ?? '' };
  }
  const body = note.body ?? '';
  const lines = body.split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim());
  if (first < 0) return { title: '', html: '' };
  if (KEEPS_LINE.test(lines[first]!)) return { title: '', html: markdownToEditorHtml(body) };
  const rest = lines.filter((_, i) => i !== first).join('\n');
  return { title: titleFromBody(lines[first]), html: markdownToEditorHtml(rest) };
}
