export const clean = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export const clip = (s, n) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '');

/** Fetch with timeout + external abort. Never throws: resolves null on any failure. */
export async function getJSON(url, signal, ms = 7000, type = 'json') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    return type === 'text' ? await r.text() : await r.json();
  } catch { return null; } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort); }
}
