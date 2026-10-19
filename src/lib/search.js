// Orchestrates the free public-source registry in providers.js.
// Every provider is key-less, runs in parallel with its own timeout, and fails soft.
import { keywords, wantsResearch, wantsBooks, weatherPlace, isMedical, classifyTopic } from './intent.js';
import { PROVIDERS, IMAGE_PROVIDERS, clean } from './providers.js';

async function getData(url, signal, ms = 6500, type = 'json') {
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

const WMO = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, heavy hail' };

export async function weather(place, signal) {
  const g = await getData(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`, signal);
  const loc = g?.results?.[0];
  if (!loc) return null;
  const w = await getData(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=4`, signal);
  if (!w?.current) return null;
  return {
    type: 'weather', place: [loc.name, loc.admin1, loc.country].filter(Boolean).join(', '),
    now: { temp: w.current.temperature_2m, feels: w.current.apparent_temperature, humidity: w.current.relative_humidity_2m, wind: w.current.wind_speed_10m, text: WMO[w.current.weather_code] || '—' },
    days: (w.daily?.time || []).map((d, i) => ({ date: d, max: w.daily.temperature_2m_max[i], min: w.daily.temperature_2m_min[i], text: WMO[w.daily.weather_code[i]] || '—' })),
    url: 'https://open-meteo.com/',
  };
}

/** Build the question context used by providers' `when()` and `url()`. */
export function makeContext(q, { lang = 'en', depth = 'Normal', signal } = {}) {
  return { q, lang, depth, signal, topic: classifyTopic(q), research: wantsResearch(q), medical: isMedical(q), books: wantsBooks(q), n: depth === 'Quick' ? 4 : depth === 'Deep Dive' ? 8 : 6 };
}

/** Which providers are worth calling for this question (exported for tests). */
export function selectProviders(ctx, disabled = [], list = PROVIDERS) {
  return list.filter((p) => !disabled.includes(p.id) && (() => { try { return p.when(ctx); } catch { return false; } })());
}

async function runProvider(p, ctx) {
  const c = { ...ctx, n: p.n || ctx.n };
  try {
    const url = p.url(c); if (!url) return [];
    let data = await getData(url, ctx.signal, 6500, p.type);
    if (p.chain) { const next = p.next(data, c); if (!next) return []; data = await getData(next, ctx.signal); }
    if (data == null) return [];
    return (p.parse(data, c) || []).map((r) => ({ ...r, _p: p.id, prior: p.prior ?? 0 }));
  } catch { return []; }
}

const normUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();

/** Lexical relevance (term overlap) + provider priors, then a per-source cap so no single site dominates. */
export function rank(results, q, { perSource = 3 } = {}) {
  const terms = keywords(q); const phrase = q.toLowerCase().trim();
  const scored = results.map((x, i) => {
    const t = x.title.toLowerCase(), s = (x.snippet || '').toLowerCase();
    let sc = terms.reduce((n, k) => n + (t.includes(k) ? 5 : 0) + (s.includes(k) ? 1.2 : 0), 0);
    if (t === phrase) sc += 8; else if (phrase.length > 3 && t.includes(phrase)) sc += 3;
    return { x, sc: sc + (x.prior || 0) + (x.kind === 'instant' ? 2 : 0) - i * 0.01 };
  }).sort((a, b) => b.sc - a.sc);
  const count = {}; const out = [];
  for (const { x } of scored) { count[x.source] = (count[x.source] || 0) + 1; if (count[x.source] <= perSource) out.push(x); }
  return out;
}

/**
 * Gather sources for a question.
 * @returns {{sources: object[], images: object[], widgets: object[], used: string[]}}
 */
export async function gather(q, { lang = 'en', depth = 'Normal', signal, disabled = [], showImages = true } = {}) {
  const ctx = makeContext(q, { lang, depth, signal });
  const picked = selectProviders(ctx, disabled);
  const place = weatherPlace(q);
  const imgs = showImages ? selectProviders(ctx, disabled, IMAGE_PROVIDERS) : [];
  const [lists, imgLists, w] = await Promise.all([
    Promise.all(picked.map((p) => runProvider(p, ctx))),
    Promise.all(imgs.map((p) => runProvider(p, ctx))),
    place && !disabled.includes('openmeteo') ? weather(place, signal) : Promise.resolve(null),
  ]);
  const seen = new Set();
  const flat = lists.flat().filter((x) => x?.title && x.url && !seen.has(normUrl(x.url)) && seen.add(normUrl(x.url)));
  const cap = depth === 'Quick' ? 6 : depth === 'Deep Dive' ? 16 : 10;
  const sources = rank(flat, q, { perSource: depth === 'Deep Dive' ? 4 : 3 }).slice(0, cap);
  if (w) sources.unshift({ source: 'Open-Meteo', kind: 'weather', title: `Weather — ${w.place}`, snippet: `${w.now.text}, ${w.now.temp}°C (feels ${w.now.feels}°C), humidity ${w.now.humidity}%, wind ${w.now.wind} km/h.`, url: w.url });
  sources.forEach((s, i) => { s.n = i + 1; s.group = PROVIDERS.find((p) => p.id === s._p)?.group || 'live'; delete s._p; delete s.prior; });
  // images: interleave providers so one site doesn't fill the grid
  const im = []; const seenImg = new Set(); const max = Math.max(0, ...imgLists.map((l) => l.length));
  for (let i = 0; i < max; i++) imgLists.forEach((l) => { const x = l[i]; if (x && !seenImg.has(x.image)) { seenImg.add(x.image); im.push({ ...x, _p: undefined, prior: undefined }); } });
  return { sources, images: im.slice(0, 8), widgets: w ? [w] : [], used: [...new Set(sources.map((s) => s.source))], stats: { queried: picked.length + (place ? 1 : 0), answered: lists.filter((l) => l.length).length + (w ? 1 : 0) } };
}
export { clean };
