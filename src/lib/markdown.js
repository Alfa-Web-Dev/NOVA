import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer nofollow'); }
});

/** Markdown -> sanitized HTML, with [n] turned into clickable citation chips. */
export function renderMarkdown(text, maxCite = 0) {
  const html = DOMPurify.sanitize(marked.parse(text || '', { async: false }), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'iframe'] });
  if (!maxCite) return html;
  return html.split(/(<[^>]+>)/).map((seg) => (seg.startsWith('<') ? seg : seg.replace(/\[(\d{1,2})\]/g, (m, n) => (+n >= 1 && +n <= maxCite ? `<button type="button" class="cite" data-cite="${n}" aria-label="Source ${n}">${n}</button>` : m)))).join('');
}
