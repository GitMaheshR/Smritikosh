// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown, toggleCheckbox } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, lists, tables, emphasis', () => {
    const html = renderMarkdown('# Title\n\n- a\n- **b**\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n*em*');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li><strong>b</strong></li>');
    expect(html).toContain('<table>');
    expect(html).toContain('<em>em</em>');
  });

  it('highlights fenced code in supported languages and aliases', () => {
    const ts = renderMarkdown('```ts\nconst a: number = 1;\n```');
    expect(ts).toContain('language-typescript');
    expect(ts).toContain('hljs-keyword');
    const sql = renderMarkdown('```sql\nSELECT 1 FROM t;\n```');
    expect(sql).toContain('hljs-keyword');
    expect(renderMarkdown('```js\nreturn 1\n```')).toContain('language-javascript');
  });

  it('unknown or missing language still renders an escaped code block', () => {
    const html = renderMarkdown('```\n<b>not bold</b> & more\n```');
    expect(html).toContain('<pre><code class="hljs">');
    expect(html).toContain('&lt;b&gt;not bold&lt;/b&gt; &amp; more');
    expect(renderMarkdown('```nonsense\nx < y\n```')).toContain('x &lt; y');
  });

  it('inline code is preserved and escaped', () => {
    expect(renderMarkdown('use `<div>` here')).toContain('<code>&lt;div&gt;</code>');
  });

  it('strips scripts, event handlers and javascript: urls', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[click](javascript:alert(3))\n\n<a href="https://evil.example" onclick="x()">link</a>',
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror|onclick/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/href=/i);
    expect(html).toContain('link');
  });

  it('removes remote images but keeps data images', () => {
    expect(renderMarkdown('![x](https://evil.example/p.png)')).not.toContain('<img');
    expect(renderMarkdown('![x](data:image/png;base64,iVBORw0KGgo=)')).toContain('<img');
  });

  it('removes iframes, forms, styles and svg', () => {
    const html = renderMarkdown('<iframe src="https://e.example"></iframe><form><input></form><style>*{}</style><svg onload="x()"></svg>text');
    expect(html).not.toMatch(/<(iframe|form|input|style|svg)/i);
    expect(html).toContain('text');
  });

  it('handles empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('a single Enter is a line break', () => {
    expect(renderMarkdown('line one\nline two')).toContain('line one<br>line two');
  });

  it('renders task lists as tappable boxes numbered in order', () => {
    const html = renderMarkdown('- [ ] call bank\n- [x] pay rent\n- [ ] book trip');
    expect(html.match(/class="md-check"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="false"[^>]*data-check="0"/);
    expect(html).toMatch(/aria-checked="true"[^>]*data-check="1"/);
    expect(html).toMatch(/data-check="2"/);
    expect(html).not.toMatch(/<input/i);
    // numbering restarts on every render
    expect(renderMarkdown('- [ ] a')).toMatch(/data-check="0"/);
  });
});

describe('toggleCheckbox', () => {
  const src = '- [ ] one\n- [x] two\n- [ ] three';

  it('flips the nth checkbox either way', () => {
    expect(toggleCheckbox(src, 0)).toBe('- [x] one\n- [x] two\n- [ ] three');
    expect(toggleCheckbox(src, 1)).toBe('- [ ] one\n- [ ] two\n- [ ] three');
    expect(toggleCheckbox(src, 2)).toBe('- [ ] one\n- [x] two\n- [x] three');
  });

  it('out of range leaves the text alone', () => {
    expect(toggleCheckbox(src, 9)).toBe(src);
    expect(toggleCheckbox('no boxes', 0)).toBe('no boxes');
  });

  it('ignores checkbox-looking lines inside code blocks so numbering matches the rendered boxes', () => {
    const text = '- [ ] real a\n```\n- [ ] in code\n```\n- [ ] real b';
    expect(renderMarkdown(text).match(/md-check/g)).toHaveLength(2);
    expect(toggleCheckbox(text, 1)).toBe('- [ ] real a\n```\n- [ ] in code\n```\n- [x] real b');
  });

  it('handles numbered lists, nested items and tilde fences', () => {
    const text = '1. [ ] first\n   - [ ] nested\n~~~\n- [ ] no\n~~~\n2) [x] last';
    expect(toggleCheckbox(text, 1)).toBe('1. [ ] first\n   - [x] nested\n~~~\n- [ ] no\n~~~\n2) [x] last');
    expect(toggleCheckbox(text, 2)).toBe('1. [ ] first\n   - [ ] nested\n~~~\n- [ ] no\n~~~\n2) [ ] last');
  });

  it('keeps the rendered box count and the toggle index in agreement', () => {
    const text = '- [ ] a\n- [ ] b\n\ntext\n\n- [x] c';
    expect(renderMarkdown(text).match(/data-check="\d+"/g)).toHaveLength(3);
    expect(toggleCheckbox(toggleCheckbox(text, 2), 2)).toBe(text);
  });
});
