// Instant "tool" answers that need no AI: timers, unit & currency conversion, crypto/stock prices,
// prayer times, news headlines and the daily briefing. Each detector is pure (unit-tested); runWidget() does the network.
import { panchang } from './panchang.js';
import { currencyQuery } from './intent.js';
import { weather } from './search.js';
import { getJSON } from './util.js';
import { canReadWeb, netFetch } from './http.js';

/* ---------- unit conversion ---------- */
const UNITS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144, nmi: 1852 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318, quintal: 100 },
  volume: { l: 1, ml: 0.001, gal: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365, floz: 0.0295735295625, tbsp: 0.01478676478, tsp: 0.00492892159 },
  area: { sqm: 1, sqkm: 1e6, sqft: 0.09290304, sqin: 0.00064516, acre: 4046.8564224, ha: 10000, sqmi: 2589988.110336, bigha: 2529.29 },
  speed: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444 },
  data: { b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 },
  time: { s: 1, min: 60, h: 3600, day: 86400, week: 604800 },
  temp: { c: 1, f: 1, k: 1 },
};
const ALIAS = {
  meter: 'm', meters: 'm', metre: 'm', metres: 'm', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km', kms: 'km', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm', cms: 'cm', millimeter: 'mm', millimeters: 'mm',
  mile: 'mi', miles: 'mi', foot: 'ft', feet: 'ft', inch: 'in', inches: 'in', yard: 'yd', yards: 'yd',
  kilogram: 'kg', kilograms: 'kg', kgs: 'kg', gram: 'g', grams: 'g', gm: 'g', gms: 'g', milligram: 'mg', milligrams: 'mg', tonne: 't', tonnes: 't', ton: 't', tons: 't', pound: 'lb', pounds: 'lb', lbs: 'lb', ounce: 'oz', ounces: 'oz', stone: 'st',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', ltr: 'l', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', gallon: 'gal', gallons: 'gal', quart: 'qt', pint: 'pt', cups: 'cup', tablespoon: 'tbsp', teaspoon: 'tsp',
  sqm: 'sqm', 'm2': 'sqm', 'sq m': 'sqm', 'square meter': 'sqm', 'square meters': 'sqm', 'square metre': 'sqm', sqft: 'sqft', 'sq ft': 'sqft', 'square feet': 'sqft', 'square foot': 'sqft', 'square km': 'sqkm', 'square kilometer': 'sqkm', 'square mile': 'sqmi', 'square miles': 'sqmi', acres: 'acre', hectare: 'ha', hectares: 'ha',
  'm/s': 'ms', mps: 'ms', 'km/h': 'kmh', kph: 'kmh', kmph: 'kmh', 'km/hr': 'kmh', 'miles per hour': 'mph', knot: 'kn', knots: 'kn', 'kilometers per hour': 'kmh', 'kilometres per hour': 'kmh',
  byte: 'b', bytes: 'b', kilobyte: 'kb', kilobytes: 'kb', megabyte: 'mb', megabytes: 'mb', gigabyte: 'gb', gigabytes: 'gb', terabyte: 'tb', terabytes: 'tb',
  sec: 's', secs: 's', second: 's', seconds: 's', minute: 'min', minutes: 'min', mins: 'min', hour: 'h', hours: 'h', hr: 'h', hrs: 'h', days: 'day', weeks: 'week',
  celsius: 'c', centigrade: 'c', '°c': 'c', fahrenheit: 'f', '°f': 'f', kelvin: 'k', '°k': 'k', degrees: null,
};
const unitKey = (raw) => {
  const u = raw.toLowerCase().trim().replace(/\.$/, '').replace(/^degrees?\s+/, '');
  const k = u in ALIAS ? ALIAS[u] : u;
  if (!k) return null;
  const cat = Object.keys(UNITS).find((c) => k in UNITS[c]);
  return cat ? { cat, k } : null;
};

export function convertUnits(value, from, to) {
  const a = unitKey(from), b = unitKey(to);
  if (!a || !b || a.cat !== b.cat) return null;
  if (a.cat === 'temp') {
    const c = a.k === 'c' ? value : a.k === 'f' ? ((value - 32) * 5) / 9 : value - 273.15;
    const r = b.k === 'c' ? c : b.k === 'f' ? (c * 9) / 5 + 32 : c + 273.15;
    return { value, from: a.k.toUpperCase(), to: b.k.toUpperCase(), result: r, unit: (x) => `°${x}` };
  }
  return { value, from: a.k, to: b.k, result: (value * UNITS[a.cat][a.k]) / UNITS[a.cat][b.k] };
}
const fmt = (n) => (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-4 && n !== 0) ? n.toExponential(4) : (+n.toPrecision(8)).toLocaleString('en-US', { maximumFractionDigits: 6 }));

export function parseConversion(q) {
  const m = /^(?:convert\s+)?(-?\d[\d,]*\.?\d*)\s*°?\s*([a-z°/²³0-9 ]+?)\s+(?:to|in|into|as|ko)\s+([a-z°/²³0-9 ]+?)(?:\s+(?:me|mein|में))?\s*[?.!]*$/i.exec(q.trim());
  if (!m) return null;
  const r = convertUnits(parseFloat(m[1].replace(/,/g, '')), m[2], m[3]);
  if (!r) return null;
  const f = r.unit ? r.unit(r.from) : r.from, t = r.unit ? r.unit(r.to) : r.to;
  return { type: 'convert', text: `**${fmt(r.value)} ${f} = ${fmt(r.result)} ${t}**`, ...r, result: r.result };
}

/* ---------- timer ---------- */
export function parseTimer(q) {
  if (!/\b(timer|countdown|stopwatch)\b|टाइमर/i.test(q)) return null;
  let s = 0, any = false;
  for (const m of q.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|ghant[ea]|घंटे?|घण्टे?|minutes?|mins?|min|m|मिनट|seconds?|secs?|sec|s|सेकंड)\b/gi)) {
    const n = parseFloat(m[1]), u = m[2].toLowerCase();
    s += /^(h|hr|hrs|hour|hours|ghant|घंट|घण्ट)/.test(u) ? n * 3600 : /^(m|min|mins|minute|minutes|मिनट)$/.test(u) ? n * 60 : n; any = true;
  }
  return any && s > 0 && s <= 86400 ? { type: 'timer', seconds: Math.round(s) } : null;
}

/* ---------- crypto / stocks ---------- */
const COINS = { bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', solana: 'solana', sol: 'solana', dogecoin: 'dogecoin', doge: 'dogecoin', bnb: 'binancecoin', xrp: 'ripple', ripple: 'ripple', cardano: 'cardano', ada: 'cardano', litecoin: 'litecoin', ltc: 'litecoin', polkadot: 'polkadot', tether: 'tether', usdt: 'tether', shiba: 'shiba-inu', matic: 'matic-network', polygon: 'matic-network', tron: 'tron', toncoin: 'the-open-network' };
export function parseCrypto(q) {
  if (!/\b(price|rate|value|worth|cost|kitna|kitne|today|aaj|quote|to (usd|inr)|in (usd|inr|rupees?|dollars?))\b/i.test(q)) return null;
  for (const w of q.toLowerCase().split(/[^a-z]+/)) if (COINS[w]) return { type: 'crypto', id: COINS[w], name: w.length <= 4 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1) };
  return null;
}
const STOCKS = { apple: 'aapl', tesla: 'tsla', microsoft: 'msft', google: 'googl', alphabet: 'googl', amazon: 'amzn', nvidia: 'nvda', meta: 'meta', facebook: 'meta', netflix: 'nflx', intel: 'intc', amd: 'amd', ibm: 'ibm', disney: 'dis', walmart: 'wmt', nike: 'nke', coca: 'ko', boeing: 'ba', paypal: 'pypl', uber: 'uber', spotify: 'spot' };
export function parseStock(q) {
  if (!/\b(stock|share|shares)\b/i.test(q) || !/\b(price|quote|rate|value|kitna|today|aaj)\b/i.test(q)) return null;
  for (const w of q.toLowerCase().split(/[^a-z]+/)) if (STOCKS[w]) return { type: 'stock', ticker: STOCKS[w] };
  const t = /\b([A-Z]{2,5})\b/.exec(q.replace(/\b(I|A|AM|PM|USD|INR|THE|STOCK|SHARE|PRICE)\b/g, ''));
  return t ? { type: 'stock', ticker: t[1].toLowerCase() } : null;
}

/* ---------- prayer times, news, briefing ---------- */
export function parsePrayer(q, defaultCity = '') {
  if (!/\b(namaz|namaaz|salah|salat|azan|adhan|ajaan|prayer)\b|नमाज़?|अज़ान/i.test(q) || !/\b(time|times|timing|timings|schedule|kab|waqt)\b|समय|वक़्त|वक्त/i.test(q)) return null;
  const m = /\b(?:in|of|for|at)\s+([\p{L}][\p{L} ]{1,30}?)\s*(?:today|now|aaj)?[?.!]*$/iu.exec(q.trim()) || /^([\p{L}][\p{L} ]{1,30}?)\s+(?:me|mein|में|ka|ki|की|का)\b/iu.exec(q.trim());
  const city = (m?.[1] || defaultCity || '').trim();
  return city ? { type: 'prayer', city } : { type: 'prayer', city: '' };
}
export function parseNews(q) {
  if (!/\b(news|headlines?|khabar|khabrein|samachar)\b|समाचार|खबर/i.test(q)) return null;
  if (/\b(how|why|explain|what is|meaning|history of)\b/i.test(q)) return null;
  const topic = q.replace(/\b(latest|top|today'?s?|todays|breaking|recent|news|headlines?|about|on|of|for|in|the|me|show|give|tell|aaj|ki|ka|ke|khabar|khabrein|samachar|please|batao|dikhao)\b|समाचार|खबर/gi, ' ').replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim();
  return { type: 'news', topic };
}
export function parsePanchang(q) {
  return /\b(panchang|panchangam|panchanga|tithi|nakshatra|hindu (?:calendar|date)|aaj ki tithi|aaj ka panchang)\b|पंचांग|तिथि|नक्षत्र/i.test(q) && !/\b(how|why|explain|what is a)\b/i.test(q) ? { type: 'panchang' } : null;
}
export function parseCricket(q) {
  if (!/\b(cricket|ipl|t20|odi|test match|cricbuzz|cricinfo)\b|क्रिकेट/i.test(q) && !/\b(live|match)\s+score\b|\bscore\s+of\s+(?:the\s+)?(?:india|match)\b/i.test(q)) return null;
  if (!/\b(score|scores|live|result|results|match|matches|scorecard|today|aaj)\b|स्कोर|मैच/i.test(q)) return null;
  if (/\b(history|rules?|how|why|explain|who (?:is|was)|record|records|player|wiki)\b/i.test(q)) return null;
  return { type: 'cricket' };
}
export const parseBriefing = (q) => (/\b(daily|morning|today'?s?|aaj ka)\s*(brief(ing)?|summary|update|digest)\b|\bbrief me\b|\bmy day\b|\bmera din\b/i.test(q) ? { type: 'briefing' } : null);

/** What kind of widget (if any) does this question want? */
export function detectWidget(q, { city = '' } = {}) {
  const t = q.trim(); if (!t) return null;
  return parseBriefing(t) || parseTimer(t) || parseConversion(t) || (currencyQuery(t) ? { type: 'currency', ...currencyQuery(t) } : null) || parseCrypto(t) || parseStock(t) || parsePrayer(t, city) || parsePanchang(t) || parseCricket(t) || parseNews(t);
}

/* ---------- network side ---------- */
const decode = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '').trim();
export function parseRSS(xml, max = 8) {
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const pick = (tag) => decode((new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(m[1]) || [])[1]);
    let title = pick('title'), source = pick('source');
    if (!source) { const i = title.lastIndexOf(' - '); if (i > 10) { source = title.slice(i + 3); title = title.slice(0, i); } }
    else title = title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    const url = pick('link'); if (title && url) items.push({ title, source, url, date: pick('pubDate') });
    if (items.length >= max) break;
  }
  return items;
}
async function newsItems(topic, signal, max = 8) {
  if (!canReadWeb()) return null;
  const base = topic ? `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-IN&gl=IN&ceid=IN:en` : 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
  try { const r = await netFetch(base, { signal, timeout: 8000 }); if (!r.ok) return null; const items = parseRSS(await r.text(), max); return items.length ? items : null; } catch (e) { if (e?.name === 'AbortError') throw e; return null; }
}
const money = (n, cur) => `${cur === 'inr' ? '₹' : '$'}${n.toLocaleString(cur === 'inr' ? 'en-IN' : 'en-US', { maximumFractionDigits: n < 1 ? 6 : 2 })}`;

/**
 * Runs a detected widget. Resolves { text, widgets?, sources? } or null when it can't answer (the normal pipeline takes over).
 */
export async function runWidget(w, { signal, city = '' } = {}) {
  switch (w.type) {
    case 'convert': return { text: w.text };
    case 'timer': {
      const label = w.seconds >= 3600 ? `${+(w.seconds / 3600).toFixed(2)} h` : w.seconds >= 60 ? `${+(w.seconds / 60).toFixed(2)} min` : `${w.seconds} s`;
      return { text: `Timer set for **${label}**.`, widgets: [{ type: 'timer', seconds: w.seconds, endsAt: Date.now() + w.seconds * 1000 }] };
    }
    case 'currency': {
      const d = await getJSON(`https://api.frankfurter.dev/v1/latest?amount=${w.amount}&base=${w.from}&symbols=${w.to}`, signal);
      const v = d?.rates?.[w.to]; if (v == null) return null;
      return { text: `**${w.amount.toLocaleString('en-US')} ${w.from} = ${v.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${w.to}**\n\nEuropean Central Bank reference rate, ${d.date} [1]. Bank and card rates differ slightly.`, sources: [{ n: 1, source: 'Frankfurter (ECB)', kind: 'instant', title: `${w.from} → ${w.to} exchange rate`, snippet: `${w.amount} ${w.from} = ${v} ${w.to} on ${d.date}`, url: 'https://frankfurter.dev' }] };
    }
    case 'crypto': {
      const d = await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${w.id}&vs_currencies=usd,inr&include_24hr_change=true`, signal);
      const r = d?.[w.id]; if (!r?.usd) return null;
      const ch = r.usd_24h_change;
      return { text: `**${w.name}: ${money(r.usd, 'usd')}** (${money(r.inr, 'inr')})${ch != null ? ` · ${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}% in 24 h` : ''} [1]`, sources: [{ n: 1, source: 'CoinGecko', kind: 'instant', title: `${w.name} price`, snippet: `${w.name}: ${money(r.usd, 'usd')} / ${money(r.inr, 'inr')}`, url: 'https://www.coingecko.com/en/coins/' + w.id }] };
    }
    case 'stock': {
      if (!canReadWeb()) return null;
      try {
        const r = await netFetch(`https://stooq.com/q/l/?s=${w.ticker}.us&f=sd2t2ohlcv&h&e=csv`, { signal, timeout: 7000 }); if (!r.ok) return null;
        const row = (await r.text()).trim().split('\n')[1]?.split(','); if (!row || row[6] === 'N/D' || !+row[6]) return null;
        const [sym, date, , open, high, low, close] = row;
        return { text: `**${sym.replace('.US', '')}: $${(+close).toFixed(2)}** — open ${(+open).toFixed(2)}, high ${(+high).toFixed(2)}, low ${(+low).toFixed(2)} (${date}) [1]. Delayed data; not financial advice.`, sources: [{ n: 1, source: 'Stooq', kind: 'instant', title: `${sym} quote`, snippet: `Close $${close} on ${date}`, url: `https://stooq.com/q/?s=${w.ticker}.us` }] };
      } catch (e) { if (e?.name === 'AbortError') throw e; return null; }
    }
    case 'prayer': {
      const place = w.city || city; if (!place) return { text: 'Which city? Try “namaz time in Delhi”, or set your city in Settings → General.' };
      const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`, signal); const loc = g?.results?.[0]; if (!loc) return null;
      const d = await getJSON(`https://api.aladhan.com/v1/timings?latitude=${loc.latitude}&longitude=${loc.longitude}`, signal); const tm = d?.data?.timings; if (!tm) return null;
      const times = Object.fromEntries(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((k) => [k, String(tm[k]).slice(0, 5)]));
      return { text: `Prayer times for **${loc.name}${loc.country ? `, ${loc.country}` : ''}** today.`, widgets: [{ type: 'prayer', place: loc.name, date: d.data.date?.readable, times, url: 'https://aladhan.com' }] };
    }
    case 'panchang': {
      const p = panchang(); const fmt = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
      return { text: `Today's panchang — **${p.tithiName}** tithi, ${p.paksha}, **${p.nakshatra}** nakshatra. Calculated on your device (accurate to about an hour; confirm important timings with a local almanac).`, widgets: [{ type: 'panchang', p: { ...p, tithiEnds: fmt(p.tithiEnds), nakshatraEnds: fmt(p.nakshatraEnds) } }] };
    }
    case 'cricket': {
      if (!canReadWeb()) return { text: 'Live cricket scores need the Nova Android app (a normal browser blocks reading score sites). Install the APK, or open the scores on ESPNcricinfo.', widgets: [{ type: 'cricket', items: [], url: 'https://www.espncricinfo.com/live-cricket-score' }] };
      try {
        const r = await netFetch('https://static.espncricinfo.com/rss/livescores.xml', { signal, timeout: 8000 }); if (!r.ok) return null;
        const items = [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({ title: decode((/<title>([\s\S]*?)<\/title>/.exec(m[1]) || [])[1]), url: decode((/<link>([\s\S]*?)<\/link>/.exec(m[1]) || [])[1]) })).filter((i) => i.title).slice(0, 10);
        if (!items.length) return null;
        return { text: 'Live and recent cricket scores:', widgets: [{ type: 'cricket', items, url: 'https://www.espncricinfo.com/live-cricket-score' }] };
      } catch (e) { if (e?.name === 'AbortError') throw e; return null; }
    }
    case 'news': {
      const items = await newsItems(w.topic, signal); if (!items) return null;
      return { text: w.topic ? `Latest headlines on **${w.topic}**:` : 'Top headlines right now:', widgets: [{ type: 'news', topic: w.topic, items }] };
    }
    case 'briefing': {
      const [wx, items] = await Promise.all([city ? weather(city, signal) : null, newsItems('', signal, 6)]);
      const day = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const widgets = [wx, items && { type: 'news', topic: '', items }].filter(Boolean);
      const hr = new Date().getHours();
      return { text: `**${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}!** Here is your briefing for ${day}.${city ? '' : '\n\n*Add your city in Settings → General to include the weather.*'}${items ? '' : '\n\n*Headlines need the Android app (live web access).*'}`, widgets };
    }
    default: return null;
  }
}
