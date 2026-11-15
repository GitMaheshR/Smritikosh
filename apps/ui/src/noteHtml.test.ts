// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Item } from '@smritikosh/core';
import { markdownToEditorHtml, noteForEditing } from './noteHtml';

const note = (title: string, body: string, fmt?: string) => ({ id: 'n', type: 'note', title, body, meta: fmt ? { fmt } : {} }) as unknown as Item;

describe('markdownToEditorHtml', () => {
  it('turns markdown into formatted text with no markdown signs left', () => {
    const html = markdownToEditorHtml('## Plan\n\n**bold** and *italic*\n\n- one\n- two\n\n1. a\n2. b');
    expect(html).toContain('<h2>Plan</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).not.toMatch(/\*\*|^## /m);
  });
  it('marks checklists the way the editor expects, keeping ticked boxes', () => {
    const html = markdownToEditorHtml('- [ ] call bank\n- [x] pay rent');
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-type="taskItem" data-checked="false"');
    expect(html).toContain('data-checked="true"');
    expect(html).not.toContain('<input');
  });
});

describe('noteForEditing', () => {
  it('takes a plain first line out of an older note as its Title', () => {
    const r = noteForEditing(note('Gift ideas', 'Gift ideas\n\n- book\n- scarf'));
    expect(r.title).toBe('Gift ideas');
    expect(r.html).toContain('<li>book</li>');
    expect(r.html).not.toContain('Gift ideas');
  });
  it('a heading first line becomes the Title too', () => {
    const r = noteForEditing(note('x', '# Hooks cheat sheet\n\nuseState'));
    expect(r.title).toBe('Hooks cheat sheet');
    expect(r.html).toContain('useState');
  });
  it('keeps a first line that is a list item, and leaves the Title empty', () => {
    const r = noteForEditing(note('call bank', '- [ ] call bank\n- [ ] pay rent'));
    expect(r.title).toBe('');
    expect(r.html).toContain('call bank');
    expect(r.html).toContain('pay rent');
  });
  it('formatted notes come back as saved; the placeholder title is empty', () => {
    expect(noteForEditing(note('Ideas', '<p>x</p>', 'html'))).toEqual({ title: 'Ideas', html: '<p>x</p>' });
    expect(noteForEditing(note('Untitled', '', 'html')).title).toBe('');
  });
  it('an empty older note is empty', () => {
    expect(noteForEditing(note('Untitled', ''))).toEqual({ title: '', html: '' });
  });
});
