import type { PointerEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, List, ListChecks, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react';

/** Text sizes offered in the toolbar. "Normal" removes the size, so it follows the app's own text size. */
export const TEXT_SIZES = [
  { key: 'small', label: 'Small', value: '0.875rem' },
  { key: 'normal', label: 'Normal', value: '' },
  { key: 'large', label: 'Large', value: '1.25rem' },
  { key: 'xlarge', label: 'Extra large', value: '1.625rem' },
] as const;

const button = 'flex min-h-touch w-touch shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 aria-pressed:bg-primary-soft aria-pressed:text-primary disabled:opacity-40';
// pointer-down is cancelled so the text keeps focus (and the keyboard stays open) while a button is pressed
const keepFocus = { onPointerDown: (e: PointerEvent) => e.preventDefault() };

/** Formatting buttons that act on the selected text (or on the lines being typed), like a word processor. */
export function RichToolbar({ editor }: { editor: Editor }) {
  const size = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '';
  const current = TEXT_SIZES.find((s) => s.value === size)?.key ?? 'normal';

  const toggle = (label: string, Icon: typeof Bold, active: boolean, run: () => void) => (
    <button type="button" className={button} aria-label={label} title={label} aria-pressed={active} onClick={run} {...keepFocus}><Icon size={20} aria-hidden /></button>
  );

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-0.5 rounded-b-card border-t border-border bg-surface px-1 py-1" role="toolbar" aria-label="Formatting">
      {toggle('Bold', Bold, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {toggle('Italic', Italic, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {toggle('Underline', Underline, editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
      <select aria-label="Text size" value={current} className="input !min-h-touch !w-auto shrink-0 !px-2 text-meta"
        onChange={(e) => {
          const next = TEXT_SIZES.find((s) => s.key === e.target.value);
          const chain = editor.chain().focus();
          if (next?.value) chain.setFontSize(next.value).run(); else chain.unsetFontSize().run();
        }}>
        {TEXT_SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {toggle('Bullets', List, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {toggle('Numbering', ListOrdered, editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      {toggle('Checklist', ListChecks, editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run())}
      <button type="button" className={button} aria-label="Undo" title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} {...keepFocus}><Undo2 size={20} aria-hidden /></button>
      <button type="button" className={button} aria-label="Redo" title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} {...keepFocus}><Redo2 size={20} aria-hidden /></button>
    </div>
  );
}
