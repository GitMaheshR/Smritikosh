import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

// Bundled and trimmed on purpose (offline, small): nothing is fetched at runtime.
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);
const ALIASES: Record<string, string> = { js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', py: 'python', cs: 'csharp', html: 'xml', yml: 'yaml', tsx: 'typescript', jsx: 'javascript' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Numbered per render so a click can be mapped back to the nth task line in the source text.
let checkIndex = 0;

const marked = new Marked({
  gfm: true,
  breaks: true, // a single Enter is a new line, as people expect when typing notes
  renderer: {
    checkbox({ checked }) {
      return `<span class="md-check" role="checkbox" tabindex="0" aria-checked="${checked ? 'true' : 'false'}" data-check="${checkIndex++}"></span>`;
    },
    code({ text, lang }) {
      const raw = (lang ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
      const l = ALIASES[raw] ?? raw;
      if (l && hljs.getLanguage(l)) {
        return `<pre><code class="hljs language-${l}">${hljs.highlight(text, { language: l, ignoreIllegals: true }).value}</code></pre>\n`;
      }
      return `<pre><code class="hljs">${esc(text)}</code></pre>\n`;
    },
  },
});

// Notes are untrusted text. This is an offline app, so links are inert: shown underlined, never navigated.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.removeAttribute('href');
    node.removeAttribute('target');
  }
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? '';
    if (!src.startsWith('data:image/')) node.remove();
  }
});

/** Markdown → sanitised HTML string, safe for dangerouslySetInnerHTML. */
export function renderMarkdown(source: string): string {
  checkIndex = 0;
  const html = marked.parse(source ?? '', { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['style', 'srcset'],
    ADD_ATTR: ['data-check', 'role', 'tabindex', 'aria-checked'],
  });
}

const TASK_LINE = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Flips the nth checkbox (`- [ ]` / `- [x]`) in the note text, skipping fenced code blocks. Returns the new text,
 * or the original text if there is no such checkbox.
 */
export function toggleCheckbox(source: string, index: number): string {
  const lines = source.split('\n');
  let n = 0;
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const f = FENCE.exec(line);
    if (f) {
      fence = fence === null ? f[1]! : fence === f[1] ? null : fence;
      continue;
    }
    if (fence) continue;
    const m = TASK_LINE.exec(line);
    if (!m) continue;
    if (n++ === index) {
      lines[i] = line.replace(TASK_LINE, `$1[${m[2] === ' ' ? 'x' : ' '}]`);
      return lines.join('\n');
    }
  }
  return source;
}
