// "Source check": how well is the answer backed by independent sources?
// Honest definition: we count the distinct web domains whose sources the answer actually cites ([n]).
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
/** wikipedia.org and en.wikipedia.org count as one site. */
const site = (u) => hostOf(u).split('.').slice(-2).join('.');

export function sourceCheck(text = '', sources = [], grounded = false) {
  const cited = new Set([...String(text).matchAll(/\[(\d{1,2})\]/g)].map((m) => +m[1]));
  // when Google Search grounded the answer, the sources Google returned count as support too
  const used = sources.filter((s) => (cited.has(s.n) || (grounded && s.via === 'google')) && s.kind !== 'image');
  const sites = new Set(used.map((s) => (s.via === 'google' ? String(s.title).split('.').slice(-2).join('.') : site(s.url)) || s.source));
  const level = !used.length ? 'none' : sites.size >= 3 ? 'high' : sites.size === 2 ? 'medium' : 'low';
  return { level, cited: used.length, independent: sites.size, available: sources.filter((s) => s.kind !== 'image').length };
}

export const checkLabel = (c) => ({
  high: `Supported by ${c.independent} independent sites`,
  medium: 'Supported by 2 sites',
  low: 'Based on 1 source — verify',
  none: 'No sources cited — general knowledge',
}[c.level]);
