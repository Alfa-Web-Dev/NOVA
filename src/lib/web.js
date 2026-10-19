// Live web: multi-engine search, page reading, passage ranking, YouTube lookup.
// Everything here needs the native HTTP client (Android app) except where noted; every function fails soft.
import { netFetch, canReadWeb } from './http.js';
import { keywords } from './intent.js';
import { clean } from './util.js';

const E = encodeURIComponent;
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const BLOCKED = /(^|\.)(facebook|instagram|twitter|x|linkedin|pinterest|tiktok|reddit|quora|youtube|youtu|t|whatsapp|snapchat)\.(com|be|co|me)$/i;
export const isReadable = (u) => /^https?:/i.test(u) && !BLOCKED.test(hostOf(u)) && !/\.(pdf|zip|mp4|mp3|jpg|jpeg|png|gif|webp|apk|exe|docx?|xlsx?|pptx?)(\?|$)/i.test(u);

/* ---------------- search-result parsers (DOM-based; unit-tested in a real browser) ---------------- */
const doc = (html) => new DOMParser().parseFromString(html, 'text/html');

export function unwrapRedirect(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const h = u.hostname;
    if (/duckduckgo\.com$/.test(h) && u.searchParams.get('uddg')) return decodeURIComponent(u.searchParams.get('uddg'));
    if (/bing\.com$/.test(h) && /\/ck\/a/.test(u.pathname)) {
      const v = u.searchParams.get('u') || '';
      if (v.startsWith('a1')) { const b = v.slice(2).replace(/-/g, '+').replace(/_/g, '/'); return atob(b + '='.repeat((4 - (b.length % 4)) % 4)); }
    }
    return u.href;
  } catch { return href; }
}

export function parseDDG(html) {
  if (/anomaly-modal|Unfortunately, bots use DuckDuckGo/i.test(html)) throw new Error('duckduckgo blocked');
  const d = doc(html);
  return [...d.querySelectorAll('.result, .web-result')].filter((r) => !/result--ad/.test(r.className)).map((r) => {
    const a = r.querySelector('a.result__a, .result__title a'); if (!a) return null;
    return { title: clean(a.textContent), url: unwrapRedirect(a.getAttribute('href')), snippet: clean(r.querySelector('.result__snippet')?.textContent), via: 'DuckDuckGo' };
  }).filter((x) => x && x.title && /^https?:/.test(x.url));
}

export function parseBing(html) {
  const d = doc(html);
  const results = [...d.querySelectorAll('li.b_algo')].map((r) => {
    const a = r.querySelector('h2 a'); if (!a) return null;
    return { title: clean(a.textContent), url: unwrapRedirect(a.getAttribute('href')), snippet: clean(r.querySelector('.b_caption p, .b_lineclamp2, .b_lineclamp3, p')?.textContent), via: 'Bing' };
  }).filter((x) => x && x.title && /^https?:/.test(x.url));
  const related = [...d.querySelectorAll('.b_rs a, .b_rrsr a')].map((a) => clean(a.textContent)).filter((t) => t.length > 6 && t.length < 90);
  return { results, related: [...new Set(related)] };
}

/* ---------------- search ---------------- */
async function ddg(q, signal) { const r = await netFetch(`https://html.duckduckgo.com/html/?q=${E(q)}&kl=wt-wt`, { signal, timeout: 7000 }); return r.ok || r.status === 202 ? parseDDG(await r.text()) : []; }
async function bing(q, signal) { const r = await netFetch(`https://www.bing.com/search?q=${E(q)}&setlang=en&cc=us&count=10`, { signal, timeout: 7000 }); return r.ok ? parseBing(await r.text()) : { results: [], related: [] }; }
async function brave(q, key, signal) {
  const r = await netFetch(`https://api.search.brave.com/res/v1/web/search?q=${E(q)}&count=8`, { signal, headers: { 'X-Subscription-Token': key, Accept: 'application/json' } });
  const j = r.ok ? await r.json() : null;
  return (j?.web?.results || []).map((x) => ({ title: clean(x.title), url: x.url, snippet: clean(x.description), via: 'Brave' }));
}
async function tavily(q, key, signal) {
  const r = await netFetch('https://api.tavily.com/search', { method: 'POST', signal, headers: { Authorization: `Bearer ${key}` }, json: { query: q, max_results: 6, search_depth: 'basic', include_images: true }, timeout: 10000 });
  const j = r.ok ? await r.json() : null;
  return { results: (j?.results || []).map((x) => ({ title: clean(x.title), url: x.url, snippet: clean(x.content), via: 'Tavily' })), images: (j?.images || []).slice(0, 4).map((i) => (typeof i === 'string' ? i : i.url)) };
}

/** Reciprocal-rank fusion across engines: results several engines agree on rise to the top. */
export function fuse(lists, limit = 10) {
  const score = new Map(), keep = new Map();
  const norm = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
  lists.forEach((list) => list.forEach((r, i) => { const k = norm(r.url); score.set(k, (score.get(k) || 0) + 1 / (60 + i)); if (!keep.has(k)) keep.set(k, { ...r, via: [r.via] }); else { const o = keep.get(k); o.via.push(r.via); if (!o.snippet && r.snippet) o.snippet = r.snippet; } }));
  return [...keep.entries()].sort((a, b) => score.get(b[0]) - score.get(a[0])).slice(0, limit).map(([, v]) => v);
}

/** Search the live web with every available engine in parallel. Returns { results, related, images, engines }. */
export async function webSearch(q, { signal, keys = {} } = {}) {
  if (!canReadWeb()) return { results: [], related: [], images: [], engines: [] };
  const jobs = [
    ['DuckDuckGo', ddg(q, signal)], ['Bing', bing(q, signal)],
    ...(keys.brave ? [['Brave', brave(q, keys.brave, signal)]] : []),
    ...(keys.tavily ? [['Tavily', tavily(q, keys.tavily, signal)]] : []),
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j[1]));
  const lists = [], engines = []; let related = [], images = [];
  settled.forEach((s, i) => {
    if (s.status !== 'fulfilled' || !s.value) return;
    const v = s.value; const arr = Array.isArray(v) ? v : v.results;
    if (arr?.length) { lists.push(arr); engines.push(jobs[i][0]); }
    if (v.related) related = related.concat(v.related);
    if (v.images) images = images.concat(v.images);
  });
  return { results: fuse(lists, 10), related: [...new Set(related)].slice(0, 6), images, engines };
}

/* ---------------- page reading ---------------- */
const NOISE = 'script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,select,dialog,[role=navigation],[role=banner],[role=complementary],[aria-hidden=true],.cookie,.cookies,.consent,.advert,.ads,.ad,.share,.social,.newsletter,.comments,.related,.sidebar,.menu,.nav';

export function extractMain(html, baseUrl = '') {
  const d = doc(html);
  const meta = (sel) => d.querySelector(sel)?.getAttribute('content') || '';
  const abs = (u) => { try { return u ? new URL(u, baseUrl || undefined).href : ''; } catch { return ''; } };
  const title = clean(meta('meta[property="og:title"]') || d.title || d.querySelector('h1')?.textContent);
  const image = abs(meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]'));
  const description = clean(meta('meta[property="og:description"]') || meta('meta[name="description"]'));
  d.querySelectorAll(NOISE).forEach((n) => n.remove());
  let root = d.querySelector('article') || d.querySelector('[role=main]') || d.querySelector('main');
  if (!root || (root.textContent || '').length < 400) {
    let best = null, bestLen = 0;
    d.querySelectorAll('div,section').forEach((c) => { let len = 0; for (const ch of c.children) if (ch.tagName === 'P') len += (ch.textContent || '').length; if (len > bestLen) { bestLen = len; best = c; } });
    root = best && bestLen > 300 ? best : d.body;
  }
  const lines = []; let last = '';
  root?.querySelectorAll('h1,h2,h3,p,li,pre,blockquote').forEach((n) => {
    const t = clean(n.textContent); const isH = /^H\d$/.test(n.tagName);
    if (!t || t === last || (!isH && t.length < 30) || t.length > 3000) return;
    lines.push(isH ? `## ${t}` : t); last = t;
  });
  const text = lines.join('\n').slice(0, 24000);
  return { title, image, description, text };
}

export async function readPage(url, { signal, timeout = 8000 } = {}) {
  try {
    const r = await netFetch(url, { signal, timeout, headers: { Accept: 'text/html,application/xhtml+xml' } });
    if (!r.ok) return null;
    const html = await r.text();
    if (!/<(html|body|p|div|article)\b/i.test(html.slice(0, 5000))) return null;
    const p = extractMain(html, r.url || url);
    return p.text.length > 200 ? { ...p, url: r.url || url } : (p.description ? { ...p, text: p.description, url: r.url || url } : null);
  } catch (e) { if (e?.name === 'AbortError') throw e; return null; }
}

/* ---------------- passage ranking (BM25 over chunks) ---------------- */
export function chunkText(text, size = 650) {
  const out = []; let cur = '', heading = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) { heading = line.slice(3); continue; }
    if (cur && cur.length + line.length > size) { out.push(cur.trim()); cur = ''; }
    if (!cur && heading) cur = `${heading}: `;
    cur += line + ' ';
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function topChunks(text, query, { max = 3, size = 650 } = {}) {
  const chunks = chunkText(text, size); if (!chunks.length) return [];
  const terms = keywords(query); if (!terms.length) return chunks.slice(0, max);
  const docs = chunks.map((c) => c.toLowerCase());
  const N = docs.length, avg = docs.reduce((a, d) => a + d.length, 0) / N;
  const df = Object.fromEntries(terms.map((t) => [t, docs.filter((d) => d.includes(t)).length]));
  const scored = docs.map((d, i) => {
    let s = 0;
    for (const t of terms) {
      const tf = d.split(t).length - 1; if (!tf) continue;
      const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
      s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.length / avg))));
    }
    return { i, s: s + (i === 0 ? 0.3 : 0) };
  });
  const picked = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, max).sort((a, b) => a.i - b.i);
  return (picked.length ? picked.map((x) => chunks[x.i]) : chunks.slice(0, 1));
}

/* ---------------- YouTube (keyless; native app only) ---------------- */
export function parseYouTube(html) {
  const m = /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html) || /ytInitialData"\]\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1]); } catch { return []; }
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object' || out.length >= 8) return;
    if (o.videoRenderer?.videoId && o.videoRenderer.lengthText) {
      const v = o.videoRenderer; const txt = (x) => x?.simpleText || x?.runs?.map((r) => r.text).join('') || '';
      out.push({ id: v.videoId, title: txt(v.title), channel: txt(v.ownerText || v.longBylineText), duration: txt(v.lengthText), views: txt(v.viewCountText), published: txt(v.publishedTimeText), thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${v.videoId}` });
      return;
    }
    for (const k in o) walk(o[k]);
  };
  walk(data);
  return out.filter((v) => v.title);
}

export async function youtubeSearch(q, signal) {
  if (!canReadWeb()) return [];
  try {
    const r = await netFetch(`https://www.youtube.com/results?search_query=${E(q)}&hl=en&gl=US`, { signal, timeout: 7000, maxChars: 3_000_000 });
    return r.ok ? parseYouTube(await r.text()).slice(0, 4) : [];
  } catch (e) { if (e?.name === 'AbortError') throw e; return []; }
}
