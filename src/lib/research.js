// The research pipeline:  question → (databases ∥ live web ∥ videos) → read top pages → rank passages → sources
import { gather } from './search.js';
import { contextualize } from './intent.js';
import { canReadWeb } from './http.js';
import { webSearch, readPage, topChunks, youtubeSearch, hostOf, isReadable } from './web.js';

const normUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();

/**
 * @returns {{sources, images, widgets, videos, related, stats}}
 */
export async function research(question, { searchQuery = '', extra = [], history = [], lang = 'en', depth = 'Normal', signal, disabled = [], showImages = true, keys = {}, liveWeb = true, wantVideos = false, onStep = () => {} } = {}) {
  const q = searchQuery || contextualize(question, history);
  const native = liveWeb && canReadWeb();
  onStep(native ? 'Searching the web and knowledge databases…' : 'Gathering knowledge…');

  const [db, web, videos] = await Promise.all([
    gather(q, { lang, depth, signal, disabled, showImages }),
    native ? webSearch(q, { signal, keys }).catch((e) => { if (e?.name === 'AbortError') throw e; return null; }) : null,
    native && wantVideos ? youtubeSearch(q, signal).catch(() => []) : [],
  ]);
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');

  /* read the best pages in parallel */
  const toRead = (web?.results || []).filter((r) => isReadable(r.url)).slice(0, depth === 'Quick' ? 2 : depth === 'Deep Dive' ? 6 : 4);
  let done = 0;
  if (toRead.length) onStep(`Reading ${toRead.length} pages…`);
  const perPage = depth === 'Quick' ? 1 : depth === 'Deep Dive' ? 4 : 3;
  const pages = await Promise.all(toRead.map(async (r) => {
    const page = await readPage(r.url, { signal });
    done++; onStep(`Reading pages (${done}/${toRead.length})…`);
    const host = hostOf(r.url);
    if (!page) return { source: host, kind: 'web', title: r.title, snippet: r.snippet, context: r.snippet, url: r.url, read: false, via: r.via };
    const chunks = topChunks(page.text, q, { max: perPage });
    const context = chunks.join('\n');
    return { source: host, kind: 'web', title: page.title || r.title, snippet: chunks[0]?.slice(0, 700) || r.snippet, context: context.slice(0, 2400), url: page.url || r.url, image: page.image, read: true, via: r.via };
  }));
  const pageSources = pages.filter((p) => p.snippet);

  /* merge: authoritative instant answers → read pages → everything else */
  const auth = db.sources.filter((s) => s.kind === 'instant' || s.kind === 'weather');
  const rest = db.sources.filter((s) => !auth.includes(s));
  const seen = new Set(); const merged = [];
  for (const s of [...auth, ...pageSources, ...rest]) { const k = normUrl(s.url); if (k && !seen.has(k)) { seen.add(k); merged.push(s); } }
  const cap = depth === 'Quick' ? 6 : depth === 'Deep Dive' ? 14 : 10;
  const sources = [...extra, ...merged].slice(0, cap).map((s, i) => ({ ...s, n: i + 1 }));

  /* images: database images + pictures from the pages we actually read + search-engine images */
  const imgs = [...db.images];
  if (showImages) {
    pages.filter((p) => p.image).forEach((p) => imgs.push({ source: p.source, kind: 'image', title: p.title, snippet: `From ${p.source}`, url: p.url, image: p.image }));
    (web?.images || []).forEach((u) => imgs.push({ source: 'Web', kind: 'image', title: question, snippet: 'From the web', url: u, image: u }));
  }
  const seenImg = new Set(); const images = [];
  // page images first (most relevant), then database tiles
  [...imgs.filter((i) => i.source !== 'Wikimedia Commons' && i.source !== 'Openverse' && i.source !== 'NASA'), ...imgs.filter((i) => ['Wikimedia Commons', 'Openverse', 'NASA'].includes(i.source))]
    .forEach((i) => { if (i.image && !seenImg.has(i.image)) { seenImg.add(i.image); images.push(i); } });

  const stats = { ...db.stats, web: web?.engines || [], pagesRead: pages.filter((p) => p.read).length, pagesTried: toRead.length, native };
  return { sources, images: images.slice(0, 8), widgets: db.widgets, videos: videos || [], related: web?.related || [], stats };
}

/**
 * Deep Research: run several focused searches (one per sub-question), then merge everything into one numbered source list.
 * Two sub-questions run at a time so a phone isn't flooded with requests.
 */
export async function deepResearch(question, subQuestions, opts = {}) {
  const { onStep = () => {}, signal } = opts;
  const results = []; let done = 0;
  for (let i = 0; i < subQuestions.length; i += 2) {
    const batch = subQuestions.slice(i, i + 2);
    const out = await Promise.all(batch.map((sq) => research(question, { ...opts, searchQuery: sq, depth: 'Normal', wantVideos: false, onStep: () => {} }).catch((e) => { if (e?.name === 'AbortError') throw e; return null; })));
    out.forEach((r) => { if (r) results.push(r); }); done += batch.length;
    onStep(`Researching… (${Math.min(done, subQuestions.length)}/${subQuestions.length} angles)`);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  }
  const seen = new Set(); const merged = [];
  const pool = results.flatMap((r) => r.sources);
  pool.sort((a, b) => (b.read ? 1 : 0) - (a.read ? 1 : 0));
  for (const s of [...(opts.extra || []), ...pool]) { const k = normUrl(s.url); if (k && !seen.has(k)) { seen.add(k); merged.push(s); } }
  const sources = merged.slice(0, 16).map((s, i) => ({ ...s, n: i + 1 }));
  const seenI = new Set(); const images = results.flatMap((r) => r.images).filter((i) => i.image && !seenI.has(i.image) && seenI.add(i.image)).slice(0, 8);
  const stats = results.reduce((a, r) => ({ queried: a.queried + (r.stats?.queried || 0), answered: a.answered + (r.stats?.answered || 0), pagesRead: a.pagesRead + (r.stats?.pagesRead || 0), web: [...new Set([...a.web, ...(r.stats?.web || [])])], native: a.native || r.stats?.native }), { queried: 0, answered: 0, pagesRead: 0, web: [], native: false });
  return { sources, images, widgets: results.flatMap((r) => r.widgets).slice(0, 1), videos: [], related: [...new Set(results.flatMap((r) => r.related))].slice(0, 6), stats, subQuestions };
}
