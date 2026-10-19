// Registry of free, key-less public data sources.
// Each provider: { id, label, group, when(ctx), url(ctx), type?, parse(data, ctx) -> results[], prior? }
// `when` decides whether the provider is worth calling for this question (keeps requests light).
// Every provider fails soft. Result shape: { source, kind, title, snippet, url, image?, thumb? }
import { keywords } from './intent.js';

export const clean = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n = 700) => { s = clean(s); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };
const E = encodeURIComponent;

export const GROUPS = {
  encyclopedia: 'Encyclopedias & knowledge', web: 'Web index', academic: 'Academic papers', medical: 'Medical & health',
  books: 'Books & archives', code: 'Code & tech', reference: 'Reference & data', media: 'Images', live: 'Live data',
};

const WIKI_LANGS = ['hi', 'es', 'fr', 'de', 'pt', 'ar', 'bn', 'ta', 'te', 'zh', 'ja', 'ru', 'ur'];
export const wikiLang = (l) => (WIKI_LANGS.includes(l) ? l : 'en');

/* ---- helpers to detect intent from the question ---- */
const has = (re) => (c) => re.test(c.q);
const topicIn = (...t) => (c) => t.includes(c.topic);
const words = (q) => q.trim().split(/\s+/).length;
export const defineTarget = (q) => {
  const m = /(?:define|definition of|meaning of|what does)\s+["']?([\p{L}'-]+)["']?(?:\s+mean)?/iu.exec(q) || /^["']?([\p{L}'-]{3,})["']?[?.]?$/u.exec(q.trim());
  return m ? m[1].toLowerCase() : null;
};
const STOP_X = new Set('capital population currency country flag area languages language official president of the in what is which has how many much big large people live'.split(' '));
const subject = (q, extra = []) => keywords(q).filter((k) => !STOP_X.has(k) && !extra.includes(k)).join(' ');
export const currencyPair = (q) => {
  const m = /(\d+(?:[.,]\d+)?)?\s*\b([a-z]{3})\b\s*(?:to|in|into|=)\s*\b([a-z]{3})\b/i.exec(q);
  if (!m) return null;
  const [a, b] = [m[2].toUpperCase(), m[3].toUpperCase()];
  const ok = (c) => /^(USD|EUR|GBP|INR|JPY|CNY|AUD|CAD|CHF|SGD|AED|SAR|NZD|SEK|NOK|DKK|HKD|KRW|MXN|BRL|ZAR|RUB|TRY|THB|MYR|IDR|PHP|PLN|CZK|HUF|ILS|RON|BGN|ISK)$/.test(c);
  return ok(a) && ok(b) && a !== b ? { amount: parseFloat((m[1] || '1').replace(',', '')), from: a, to: b } : null;
};
/** MediaWiki search ANDs every word, so a full question ("what were the main causes of the french revolution") matches nothing.
 *  Use the content words instead. */
export const wikiQuery = (q) => {
  const w = q.trim().split(/\s+/);
  if (w.length <= 3) return q.trim();
  const k = keywords(q).slice(0, 7).join(' ');
  return k || q.trim();
};
const mediawiki = (domain, label, kind = 'wiki') => (c) =>
  `https://${domain}/w/api.php?action=query&generator=search&gsrsearch=${E(wikiQuery(c.q))}&gsrlimit=${c.n}&prop=extracts|info|pageimages&exintro=1&explaintext=1&exchars=900&exlimit=max&inprop=url&piprop=thumbnail&pithumbsize=480&format=json&origin=*`;
const parseMediawiki = (label, kind = 'wiki') => (d) => Object.values(d?.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => ({ source: label, kind, title: clean(p.title), snippet: cut(p.extract, 900), url: p.fullurl, thumb: p.thumbnail?.source })).filter((x) => x.snippet && x.url);

/* ---- abstract reconstruction for OpenAlex ---- */
const invert = (idx) => { if (!idx) return ''; const out = []; for (const [w, pos] of Object.entries(idx)) pos.forEach((p) => { out[p] = w; }); return out.join(' '); };

export const PROVIDERS = [
  /* ===== Encyclopedias & knowledge ===== */
  { id: 'wikipedia', label: 'Wikipedia', group: 'encyclopedia', when: () => true, prior: 1.5,
    url: (c) => mediawiki(`${wikiLang(c.lang)}.wikipedia.org`)(c), parse: parseMediawiki('Wikipedia') },
  { id: 'simplewiki', label: 'Simple English Wikipedia', group: 'encyclopedia', when: (c) => wikiLang(c.lang) === 'en' && c.depth !== 'Quick' && ['science', 'math', 'history', 'general', 'compare'].includes(c.topic), prior: 0.8, n: 3,
    url: (c) => mediawiki('simple.wikipedia.org')(c), parse: parseMediawiki('Simple Wikipedia') },
  { id: 'wiktionary', label: 'Wiktionary', group: 'reference', when: (c) => !!defineTarget(c.q), prior: 2, n: 2,
    url: (c) => mediawiki('en.wiktionary.org')({ ...c, q: defineTarget(c.q) }), parse: parseMediawiki('Wiktionary', 'instant') },
  { id: 'wikidata', label: 'Wikidata', group: 'encyclopedia', when: (c) => words(c.q) <= 6 && c.depth !== 'Quick', prior: 0,
    url: (c) => `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${E(wikiQuery(c.q.replace(/^(what|who) (is|was|are) (a |an |the )?/i, '')))}&language=${wikiLang(c.lang)}&uselang=${wikiLang(c.lang)}&limit=3&format=json&origin=*`,
    parse: (d) => (d?.search || []).filter((x) => x.description).map((x) => ({ source: 'Wikidata', kind: 'wiki', title: clean(x.label), snippet: clean(`${x.label} — ${x.description}`), url: `https://www.wikidata.org/wiki/${x.id}` })) },
  { id: 'wikibooks', label: 'Wikibooks', group: 'encyclopedia', when: (c) => c.depth !== 'Quick' && ['science', 'math', 'code', 'general'].includes(c.topic), prior: 0.5, n: 3,
    url: (c) => mediawiki('en.wikibooks.org')(c), parse: parseMediawiki('Wikibooks') },
  { id: 'wikiversity', label: 'Wikiversity', group: 'encyclopedia', when: (c) => c.depth !== 'Quick' && ['science', 'math', 'history', 'general'].includes(c.topic), prior: 0.5, n: 3,
    url: (c) => mediawiki('en.wikiversity.org')(c), parse: parseMediawiki('Wikiversity') },
  { id: 'wikinews', label: 'Wikinews', group: 'encyclopedia', when: topicIn('current'), prior: 1, n: 3,
    url: (c) => mediawiki('en.wikinews.org')(c), parse: parseMediawiki('Wikinews', 'news') },
  { id: 'wikivoyage', label: 'Wikivoyage', group: 'encyclopedia', when: has(/\b(travel|visit|trip|tourist|things to do|itinerary|places to see)\b/i), prior: 1.5, n: 3,
    url: (c) => mediawiki('en.wikivoyage.org')(c), parse: parseMediawiki('Wikivoyage') },
  { id: 'wikisource', label: 'Wikisource', group: 'encyclopedia', when: has(/\b(poem|poetry|speech|text of|original text|scripture|treaty|declaration)\b/i), prior: 0.5, n: 3,
    url: (c) => mediawiki('en.wikisource.org')(c), parse: parseMediawiki('Wikisource') },

  /* ===== Web index ===== */
  { id: 'duckduckgo', label: 'DuckDuckGo', group: 'web', when: () => true,
    url: (c) => `https://api.duckduckgo.com/?q=${E(c.q)}&format=json&no_html=1&skip_disambig=1`,
    parse: (d, c) => { if (!d) return []; const o = []; if (d.AbstractText) o.push({ source: 'DuckDuckGo', kind: 'instant', title: clean(d.Heading || c.q), snippet: clean(d.AbstractText), url: d.AbstractURL || `https://duckduckgo.com/?q=${E(c.q)}` });
      (d.RelatedTopics || []).slice(0, 4).forEach((x) => { if (x.Text && x.FirstURL) o.push({ source: 'DuckDuckGo', kind: 'web', title: clean(x.Text.split(' - ')[0]), snippet: clean(x.Text), url: x.FirstURL }); }); return o; } },
  { id: 'marginalia', label: 'Marginalia Search (independent web)', group: 'web', when: (c) => c.depth !== 'Quick', prior: 0,
    url: (c) => `https://api.marginalia.nu/public/search/${E(c.q)}?count=5`,
    parse: (d) => (d?.results || []).map((x) => ({ source: 'Marginalia', kind: 'web', title: clean(x.title), snippet: cut(x.description, 400), url: x.url })).filter((x) => x.title && x.snippet) },

  /* ===== Academic ===== */
  { id: 'crossref', label: 'Crossref', group: 'academic', when: (c) => c.research, prior: 2,
    url: (c) => `https://api.crossref.org/works?query=${E(c.q)}&rows=4&select=title,author,published,URL,container-title,DOI,abstract`,
    parse: (d) => (d?.message?.items || []).map((x) => ({ source: 'Crossref', kind: 'paper', title: clean(x.title?.[0]), snippet: cut(x.abstract) || [x.author?.slice(0, 3).map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', '), x['container-title']?.[0], x.published?.['date-parts']?.[0]?.[0]].filter(Boolean).join(' · '), url: x.URL || `https://doi.org/${x.DOI}` })).filter((x) => x.title) },
  { id: 'openalex', label: 'OpenAlex', group: 'academic', when: (c) => c.research || c.depth === 'Deep Dive', prior: 2,
    url: (c) => `https://api.openalex.org/works?search=${E(c.q)}&per-page=4&select=id,title,abstract_inverted_index,publication_year,doi,authorships,cited_by_count,primary_location`,
    parse: (d) => (d?.results || []).map((x) => ({ source: 'OpenAlex', kind: 'paper', title: clean(x.title), snippet: cut(invert(x.abstract_inverted_index)) || [x.authorships?.slice(0, 3).map((a) => a.author?.display_name).join(', '), x.publication_year, x.cited_by_count != null && `${x.cited_by_count} citations`].filter(Boolean).join(' · '), url: x.doi || x.primary_location?.landing_page_url || x.id })).filter((x) => x.title) },
  { id: 'semanticscholar', label: 'Semantic Scholar', group: 'academic', when: (c) => c.research && c.depth !== 'Quick', prior: 1.5,
    url: (c) => `https://api.semanticscholar.org/graph/v1/paper/search?query=${E(c.q)}&limit=4&fields=title,abstract,year,url,tldr,citationCount`,
    parse: (d) => (d?.data || []).map((x) => ({ source: 'Semantic Scholar', kind: 'paper', title: clean(x.title), snippet: cut(x.tldr?.text || x.abstract) || `${x.year || ''} · ${x.citationCount ?? 0} citations`, url: x.url })).filter((x) => x.title && x.url) },
  { id: 'arxiv', label: 'arXiv', group: 'academic', type: 'text', when: (c) => c.research && ['science', 'math', 'code', 'general'].includes(c.topic), prior: 1.5,
    url: (c) => `https://export.arxiv.org/api/query?search_query=all:${E(c.q)}&max_results=3`,
    parse: (xml) => { try { const doc = new DOMParser().parseFromString(xml, 'application/xml'); return [...doc.querySelectorAll('entry')].map((e) => ({ source: 'arXiv', kind: 'paper', title: clean(e.querySelector('title')?.textContent), snippet: cut(e.querySelector('summary')?.textContent), url: clean(e.querySelector('id')?.textContent) })).filter((x) => x.title); } catch { return []; } } },
  { id: 'doaj', label: 'DOAJ (open-access journals)', group: 'academic', when: (c) => c.research && c.depth !== 'Quick', prior: 1,
    url: (c) => `https://doaj.org/api/search/articles/${E(c.q)}?pageSize=3`,
    parse: (d) => (d?.results || []).map((r) => r.bibjson).filter(Boolean).map((b) => ({ source: 'DOAJ', kind: 'paper', title: clean(b.title), snippet: cut(b.abstract) || [b.journal?.title, b.year].filter(Boolean).join(' · '), url: b.link?.[0]?.url })).filter((x) => x.title && x.url) },

  /* ===== Medical ===== */
  { id: 'europepmc', label: 'Europe PMC', group: 'medical', when: (c) => c.research || c.medical, prior: 2,
    url: (c) => `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${E(c.q)}&format=json&pageSize=4&resultType=core`,
    parse: (d) => (d?.resultList?.result || []).map((x) => ({ source: 'Europe PMC', kind: 'paper', title: clean(x.title), snippet: cut(x.abstractText) || [x.authorString, x.journalTitle, x.pubYear].filter(Boolean).join(' · '), url: x.doi ? `https://doi.org/${x.doi}` : `https://europepmc.org/article/${x.source}/${x.id}` })).filter((x) => x.title) },
  { id: 'pubmed', label: 'PubMed', group: 'medical', when: (c) => c.medical, prior: 1.5, chain: true,
    url: (c) => `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${E(c.q)}&retmax=4&retmode=json&sort=relevance`,
    next: (d) => { const ids = d?.esearchresult?.idlist || []; return ids.length ? `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json` : null; },
    parse: (d) => (d?.result?.uids || []).map((id) => d.result[id]).filter(Boolean).map((x) => ({ source: 'PubMed', kind: 'paper', title: clean(x.title), snippet: [x.authors?.slice(0, 3).map((a) => a.name).join(', '), x.source, x.pubdate].filter(Boolean).join(' · '), url: `https://pubmed.ncbi.nlm.nih.gov/${x.uid}/` })) },
  { id: 'clinicaltrials', label: 'ClinicalTrials.gov', group: 'medical', when: (c) => c.medical && /\b(trial|trials|study|treatment|therapy|drug|vaccine|cancer|diabetes)\b/i.test(c.q), prior: 0.5,
    url: (c) => `https://clinicaltrials.gov/api/v2/studies?query.term=${E(c.q)}&pageSize=3&format=json`,
    parse: (d) => (d?.studies || []).map((s) => { const p = s.protocolSection || {}; const id = p.identificationModule?.nctId; return { source: 'ClinicalTrials.gov', kind: 'paper', title: clean(p.identificationModule?.briefTitle), snippet: cut(p.descriptionModule?.briefSummary, 500) + (p.statusModule?.overallStatus ? ` (Status: ${p.statusModule.overallStatus})` : ''), url: `https://clinicaltrials.gov/study/${id}` }; }).filter((x) => x.title) },
  { id: 'openfda', label: 'openFDA drug labels', group: 'medical', when: (c) => /\b(drug|medicine|tablet|dose|dosage|side effects?|ibuprofen|paracetamol|acetaminophen|aspirin|metformin|amoxicillin|warnings?)\b/i.test(c.q), prior: 1.5,
    url: (c) => { const k = keywords(c.q).find((w) => !/^(drug|medicine|dose|dosage|side|effects?|effect|tablet|warnings?|use|uses|safe|take|taking|label)$/.test(w)); return k ? `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${E('"' + k + '"')}&limit=1` : null; },
    parse: (d) => (d?.results || []).map((r) => ({ source: 'openFDA', kind: 'med', title: clean(r.openfda?.brand_name?.[0] || r.openfda?.generic_name?.[0] || 'Drug label'), snippet: cut(r.indications_and_usage?.[0] || r.purpose?.[0] || r.warnings?.[0], 600), url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${E(r.openfda?.generic_name?.[0] || '')}` })).filter((x) => x.snippet) },

  /* ===== Books & archives ===== */
  { id: 'openlibrary', label: 'Open Library', group: 'books', when: (c) => c.books, prior: 0.5,
    url: (c) => `https://openlibrary.org/search.json?q=${E(c.q)}&limit=4&fields=title,author_name,first_publish_year,key`,
    parse: (d) => (d?.docs || []).map((x) => ({ source: 'Open Library', kind: 'book', title: clean(x.title), snippet: [x.author_name?.slice(0, 2).join(', '), x.first_publish_year && `first published ${x.first_publish_year}`].filter(Boolean).join(' · '), url: `https://openlibrary.org${x.key}` })) },
  { id: 'googlebooks', label: 'Google Books', group: 'books', when: (c) => c.books, prior: 0.5,
    url: (c) => `https://www.googleapis.com/books/v1/volumes?q=${E(c.q)}&maxResults=4`,
    parse: (d) => (d?.items || []).map((i) => i.volumeInfo).filter(Boolean).map((v) => ({ source: 'Google Books', kind: 'book', title: clean(v.title), snippet: cut(v.description, 450) || [v.authors?.join(', '), v.publishedDate].filter(Boolean).join(' · '), url: v.infoLink })).filter((x) => x.url) },
  { id: 'gutendex', label: 'Project Gutenberg', group: 'books', when: (c) => c.books && /\b(novel|classic|poem|read|free|ebook|author|shakespeare|dickens|austen|tolstoy)\b/i.test(c.q), prior: 0,
    url: (c) => `https://gutendex.com/books?search=${E(c.q.replace(/\b(book|books|novel|read|about|by|free|ebook)\b/gi, ' ').trim())}`,
    parse: (d) => (d?.results || []).slice(0, 3).map((b) => ({ source: 'Project Gutenberg', kind: 'book', title: clean(b.title), snippet: [b.authors?.map((a) => a.name).join(', '), b.subjects?.slice(0, 3).join('; '), 'free to read'].filter(Boolean).join(' · '), url: `https://www.gutenberg.org/ebooks/${b.id}` })) },
  { id: 'archive', label: 'Internet Archive', group: 'books', when: (c) => (c.books || c.topic === 'history') && c.depth !== 'Quick', prior: 0,
    url: (c) => `https://archive.org/advancedsearch.php?q=${E(c.q)}&fl[]=identifier&fl[]=title&fl[]=description&rows=4&output=json`,
    parse: (d) => (d?.response?.docs || []).map((x) => ({ source: 'Internet Archive', kind: 'book', title: clean(x.title), snippet: cut(Array.isArray(x.description) ? x.description[0] : x.description, 400) || 'Digitised item in the Internet Archive', url: `https://archive.org/details/${x.identifier}` })).filter((x) => x.title) },
  { id: 'loc', label: 'Library of Congress', group: 'books', when: (c) => c.topic === 'history' && c.depth !== 'Quick', prior: 0.5,
    url: (c) => `https://www.loc.gov/search/?q=${E(c.q)}&fo=json&c=4`,
    parse: (d) => (d?.results || []).map((x) => ({ source: 'Library of Congress', kind: 'archive', title: clean(x.title), snippet: cut(Array.isArray(x.description) ? x.description.join(' ') : x.description, 400) || [x.date, 'Library of Congress collection item'].filter(Boolean).join(' · '), url: (x.url || '').replace(/^http:/, 'https:') })).filter((x) => x.title && x.url) },

  /* ===== Code & tech ===== */
  { id: 'stackexchange', label: 'Stack Exchange', group: 'code', when: (c) => c.topic === 'code' || c.topic === 'math' || /\bhow (do|to|can)\b/i.test(c.q), prior: 1,
    url: (c) => `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${E(c.q)}&site=${({ code: 'stackoverflow', math: 'math' })[c.topic] || 'superuser'}&pagesize=4&filter=withbody`,
    parse: (d) => (d?.items || []).map((x) => ({ source: 'Stack Exchange', kind: 'qa', title: clean(x.title), snippet: cut(x.body, 500), url: x.link })).filter((x) => x.title) },
  { id: 'mdn', label: 'MDN Web Docs', group: 'code', when: (c) => c.topic === 'code' && /\b(javascript|js|css|html|dom|fetch|promise|web|api|react|browser|array|string)\b/i.test(c.q), prior: 2,
    url: (c) => `https://developer.mozilla.org/api/v1/search?q=${E(c.q)}&locale=en-US&size=4`,
    parse: (d) => (d?.documents || []).map((x) => ({ source: 'MDN', kind: 'docs', title: clean(x.title), snippet: cut(x.summary, 400), url: `https://developer.mozilla.org${x.mdn_url}` })).filter((x) => x.title) },
  { id: 'github', label: 'GitHub repositories', group: 'code', when: (c) => c.topic === 'code' && /\b(library|framework|tool|package|open source|repo|repository|github|project)\b/i.test(c.q), prior: 0.5,
    url: (c) => `https://api.github.com/search/repositories?q=${E(c.q)}&per_page=3&sort=stars`,
    parse: (d) => (d?.items || []).map((r) => ({ source: 'GitHub', kind: 'repo', title: r.full_name, snippet: [cut(r.description, 300), r.language, `★ ${r.stargazers_count?.toLocaleString?.('en-US')}`].filter(Boolean).join(' · '), url: r.html_url })) },
  { id: 'npm', label: 'npm registry', group: 'code', when: (c) => c.topic === 'code' && /\b(npm|package|node|library|module|dependency)\b/i.test(c.q), prior: 0.5,
    url: (c) => `https://registry.npmjs.org/-/v1/search?text=${E(c.q.replace(/\b(npm|package|node|library|module|best|for)\b/gi, ' ').trim() || c.q)}&size=4`,
    parse: (d) => (d?.objects || []).map((o) => o.package).filter(Boolean).map((k) => ({ source: 'npm', kind: 'repo', title: `${k.name}@${k.version}`, snippet: cut(k.description, 300) || 'npm package', url: k.links?.npm || `https://www.npmjs.com/package/${k.name}` })) },
  { id: 'hackernews', label: 'Hacker News', group: 'code', when: (c) => c.topic === 'code' || (c.topic === 'current' && /\b(ai|tech|software|startup|programming|openai|google|apple|linux)\b/i.test(c.q)), prior: 0,
    url: (c) => `https://hn.algolia.com/api/v1/search?query=${E(c.q)}&tags=story&hitsPerPage=4`,
    parse: (d) => (d?.hits || []).filter((h) => h.title).map((h) => ({ source: 'Hacker News', kind: 'news', title: clean(h.title), snippet: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments · discussion on Hacker News`, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}` })) },

  /* ===== News ===== */
  { id: 'gdelt', label: 'GDELT global news index', group: 'live', when: (c) => c.topic === 'current' && c.depth !== 'Quick', prior: 0.5,
    url: (c) => `https://api.gdeltproject.org/api/v2/doc/doc?query=${E(c.q)}&mode=artlist&maxrecords=5&format=json&sort=hybridrel`,
    parse: (d) => (d?.articles || []).map((a) => ({ source: 'GDELT', kind: 'news', title: clean(a.title), snippet: `${a.domain || ''} · ${String(a.seendate || '').slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')} · news article`, url: a.url })).filter((x) => x.title && x.url) },

  /* ===== Reference & data ===== */
  { id: 'dictionary', label: 'Free Dictionary', group: 'reference', when: (c) => !!defineTarget(c.q), prior: 3,
    url: (c) => `https://api.dictionaryapi.dev/api/v2/entries/en/${E(defineTarget(c.q))}`,
    parse: (d) => (Array.isArray(d) ? d : []).slice(0, 1).map((e) => ({ source: 'Free Dictionary', kind: 'instant', title: clean(e.word), snippet: clean([e.phonetic, ...(e.meanings || []).slice(0, 3).map((m) => `(${m.partOfSpeech}) ${m.definitions?.[0]?.definition || ''}`)].filter(Boolean).join(' · ')), url: e.sourceUrls?.[0] || `https://en.wiktionary.org/wiki/${E(e.word)}` })) },
  { id: 'restcountries', label: 'REST Countries', group: 'reference', when: has(/\b(capital|population|currency|flag|official languages?|country|area of|how many people)\b/i), prior: 3,
    url: (c) => { const s = subject(c.q); return s ? `https://restcountries.com/v3.1/name/${E(s)}?fields=name,capital,population,region,subregion,area,currencies,languages` : null; },
    parse: (d) => (Array.isArray(d) ? d : []).slice(0, 1).map((x) => ({ source: 'REST Countries', kind: 'instant', title: x.name?.common, snippet: `${x.name?.official}. Capital: ${(x.capital || []).join(', ') || '—'}. Population: ${x.population?.toLocaleString?.('en-US')}. Region: ${[x.region, x.subregion].filter(Boolean).join(' / ')}. Area: ${x.area?.toLocaleString?.('en-US')} km². Currencies: ${Object.values(x.currencies || {}).map((c) => `${c.name} (${c.symbol || ''})`).join(', ')}. Languages: ${Object.values(x.languages || {}).join(', ')}.`, url: `https://en.wikipedia.org/wiki/${E((x.name?.common || '').replace(/ /g, '_'))}` })) },
  { id: 'frankfurter', label: 'Frankfurter exchange rates (ECB)', group: 'reference', when: (c) => !!currencyPair(c.q), prior: 4,
    url: (c) => { const p = currencyPair(c.q); return `https://api.frankfurter.dev/v1/latest?amount=${p.amount}&base=${p.from}&symbols=${p.to}`; },
    parse: (d, c) => { if (!d?.rates) return []; const p = currencyPair(c.q); const v = d.rates[p.to]; return [{ source: 'Frankfurter (ECB)', kind: 'instant', title: `${p.from} → ${p.to}`, snippet: `${p.amount} ${p.from} = ${v.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${p.to} (European Central Bank reference rate, ${d.date}).`, url: 'https://frankfurter.dev' }]; } },
  { id: 'pubchem', label: 'PubChem', group: 'reference', when: has(/\b(chemical|compound|molecule|molecular|formula of|iupac|chemistry|acid|salt|element)\b/i), prior: 2.5,
    url: (c) => { const s = subject(c.q, ['chemical', 'compound', 'molecule', 'molecular', 'formula', 'iupac', 'chemistry', 'element', 'weight', 'mass', 'structure']); return s ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${E(s)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON` : null; },
    parse: (d) => (d?.PropertyTable?.Properties || []).slice(0, 1).map((p) => ({ source: 'PubChem', kind: 'instant', title: p.IUPACName || `CID ${p.CID}`, snippet: `Molecular formula ${p.MolecularFormula}; molecular weight ${p.MolecularWeight} g/mol; IUPAC name ${p.IUPACName}.`, url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}` })) },
];

/* ---- image providers (kept separate: they return tiles, not text sources) ---- */
export const IMAGE_PROVIDERS = [
  { id: 'commons', label: 'Wikimedia Commons', group: 'media', when: () => true,
    url: (c) => `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${E(wikiQuery(c.q) + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=520&format=json&origin=*`,
    parse: (d) => Object.values(d?.query?.pages || {}).map((p) => { const i = p.imageinfo?.[0] || {}; return { source: 'Wikimedia Commons', kind: 'image', title: clean(p.title?.replace(/^File:/, '').replace(/\.[a-z]+$/i, '')), snippet: cut(i.extmetadata?.ImageDescription?.value, 300) || 'Image from Wikimedia Commons', url: i.descriptionurl, image: i.thumburl || i.url }; }).filter((x) => x.image && x.url) },
  { id: 'openverse', label: 'Openverse (CC-licensed)', group: 'media', when: () => true,
    url: (c) => `https://api.openverse.org/v1/images/?q=${E(c.q)}&page_size=6&mature=false`,
    parse: (d) => (d?.results || []).map((r) => ({ source: 'Openverse', kind: 'image', title: clean(r.title) || 'Image', snippet: [r.creator && `By ${r.creator}`, r.license && `License: CC ${String(r.license).toUpperCase()}`].filter(Boolean).join(' · '), url: r.foreign_landing_url || r.url, image: r.thumbnail || r.url })).filter((x) => x.image && x.url) },
  { id: 'nasa', label: 'NASA Image Library', group: 'media', when: has(/\b(space|planet|galaxy|nebula|star|moon|mars|jupiter|saturn|sun|solar system|astronaut|nasa|telescope|black hole|comet|rocket|earth from)\b/i),
    url: (c) => `https://images-api.nasa.gov/search?q=${E(c.q)}&media_type=image&page_size=6`,
    parse: (d) => (d?.collection?.items || []).map((i) => ({ source: 'NASA', kind: 'image', title: clean(i.data?.[0]?.title), snippet: cut(i.data?.[0]?.description, 300), url: `https://images.nasa.gov/details/${i.data?.[0]?.nasa_id}`, image: i.links?.[0]?.href })).filter((x) => x.image) },
];

/* Live widgets handled in search.js (Open-Meteo weather). */
export const ALL_PROVIDER_META = [...PROVIDERS, ...IMAGE_PROVIDERS, { id: 'openmeteo', label: 'Open-Meteo weather', group: 'live' }].map(({ id, label, group }) => ({ id, label, group }));
