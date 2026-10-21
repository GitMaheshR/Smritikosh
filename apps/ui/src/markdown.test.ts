// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

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
});
