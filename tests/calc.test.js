import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, tryCalculate } from '../src/lib/calc.js';
import { isGreeting, weatherPlace, keywords } from '../src/lib/intent.js';
import { extractiveAnswer, buildMessages } from '../src/lib/ai.js';

test('evaluate: precedence, parentheses, powers', () => {
  assert.equal(evaluate('2+3*4'), 14);
  assert.equal(evaluate('(2+3)*4'), 20);
  assert.equal(evaluate('2^3^2'), 512); // right-associative
  assert.equal(evaluate('-3+5'), 2);
  assert.equal(evaluate('50%'), 0.5);
  assert.equal(evaluate('sqrt(16)+abs(-2)'), 6);
  assert.ok(Math.abs(evaluate('pi*2') - 6.283185307) < 1e-6);
  assert.equal(evaluate('5!'), 120);
});
test('evaluate: rejects anything that is not math (no code execution)', () => {
  for (const bad of ['alert(1)', 'process.exit()', '2+', '1/0', '()', 'constructor', '__proto__']) assert.throws(() => evaluate(bad), bad);
});
test('tryCalculate: only plain arithmetic', () => {
  assert.equal(tryCalculate('what is 15% of 200').result, '30');
  assert.equal(tryCalculate('12 * 12').result, '144');
  assert.equal(tryCalculate('1,000 + 250').result, '1,250');
  assert.equal(tryCalculate('what is a black hole'), null);
  assert.equal(tryCalculate('2024'), null);
  assert.equal(tryCalculate('hello'), null);
});
test('intent helpers', () => {
  assert.ok(isGreeting('Hello!')); assert.ok(isGreeting('नमस्ते')); assert.ok(!isGreeting('hello world how does it work'));
  assert.equal(weatherPlace('weather in Delhi'), 'Delhi'); assert.equal(weatherPlace('Paris weather'), 'Paris'); assert.equal(weatherPlace('what is rain'), null);
  assert.deepEqual(keywords('What is the capital of France?'), ['capital', 'france']);
});
test('extractiveAnswer cites sources and handles empty', () => {
  const md = extractiveAnswer({ question: 'x', sources: [{ n: 1, kind: 'wiki', title: 'X', snippet: 'X is a letter. It is the 24th letter.', url: 'u' }] });
  assert.match(md, /\[1\]/);
  assert.match(extractiveAnswer({ question: 'zzz', sources: [] }), /couldn't find/);
});
test('buildMessages grounds the model in numbered sources', () => {
  const m = buildMessages({ question: 'q', sources: [{ n: 1, title: 'T', source: 'Wikipedia', snippet: 'body' }], lang: 'hi', depth: 'Quick' });
  assert.equal(m[0].role, 'system'); assert.match(m[0].content, /\[1\] T/); assert.match(m[0].content, /Hindi/); assert.equal(m.at(-1).content, 'q');
});

import { selectProviders, makeContext, rank, gather } from '../src/lib/search.js';
import { PROVIDERS, IMAGE_PROVIDERS, ALL_PROVIDER_META, currencyPair, defineTarget } from '../src/lib/providers.js';
import { needsKnowledge, selfIntro, contextualize } from '../src/lib/intent.js';

const ids = (q, o = {}) => selectProviders(makeContext(q, o), o.disabled || []).map((p) => p.id);

test('registry: unique ids, complete definitions, 35+ databases', () => {
  const all = [...PROVIDERS, ...IMAGE_PROVIDERS];
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  assert.ok(all.length >= 35, `only ${all.length}`);
  for (const p of all) assert.ok(p.label && p.group && typeof p.when === 'function' && typeof p.url === 'function' && typeof p.parse === 'function', p.id);
  assert.equal(ALL_PROVIDER_META.length, all.length + 1);
});
test('every provider builds a valid https URL for a typical question', () => {
  for (const p of [...PROVIDERS, ...IMAGE_PROVIDERS]) {
    const u = p.url(makeContext('define serendipity capital of japan 100 usd to inr'));
    if (u) assert.match(u, /^https:\/\//, p.id);
  }
});
test('routing sends each question to the right databases', () => {
  assert.ok(ids('latest research on diabetes treatment').includes('pubmed'));
  assert.ok(ids('latest research on diabetes treatment').includes('openalex'));
  assert.ok(ids('python list sort error').includes('stackexchange'));
  assert.ok(ids('best books by Tolkien').includes('openlibrary'));
  assert.ok(ids('capital of Japan').includes('restcountries'));
  assert.ok(ids('100 usd to inr').includes('frankfurter'));
  assert.ok(ids('define serendipity').includes('dictionary'));
  assert.ok(ids('define serendipity').includes('wiktionary'));
  assert.ok(ids('travel tips for Goa').includes('wikivoyage'));
  assert.ok(ids('latest news about elections').includes('gdelt'));
  assert.ok(!ids('what is photosynthesis').includes('pubmed'), 'no scholarly noise for plain questions');
});
test('depth and disabled sources are respected', () => {
  assert.ok(ids('latest research on diabetes', { depth: 'Deep Dive' }).length > ids('latest research on diabetes', { depth: 'Quick' }).length);
  assert.ok(!ids('latest research on diabetes', { disabled: ['pubmed'] }).includes('pubmed'));
});
test('rank caps results per database', () => {
  const r = Array.from({ length: 10 }, (_, i) => ({ source: 'A', title: 'topic ' + i, snippet: 'topic' }));
  const out = rank(r.concat([{ source: 'B', title: 'topic b', snippet: 'topic' }]), 'topic', { perSource: 3 });
  assert.equal(out.filter((x) => x.source === 'A').length, 3); assert.equal(out.length, 4);
});
test('currency & define extractors', () => {
  assert.deepEqual(currencyPair('convert 100 usd to inr'), { amount: 100, from: 'USD', to: 'INR' });
  assert.equal(currencyPair('what is a black hole'), null);
  assert.equal(defineTarget('define serendipity'), 'serendipity');
});
test('assistant routing: creative/chat skip lookup, facts do not', () => {
  assert.equal(needsKnowledge('write a poem about rain'), false);
  assert.equal(needsKnowledge('translate this to Hindi'), false);
  assert.equal(needsKnowledge('who are you'), false);
  assert.equal(needsKnowledge('what is a black hole'), true);
  assert.equal(needsKnowledge('write latest research on sleep'), true);
  assert.match(selfIntro('who are you'), /Nova/); assert.equal(selfIntro('what is a black hole'), null);
});
test('contextualize borrows the previous subject for short follow-ups', () => {
  const h = [{ role: 'user', text: 'Tell me about Japan' }];
  assert.match(contextualize('and its capital?', h), /Japan/);
  assert.equal(contextualize('explain the theory of general relativity in detail please for a student', h), 'explain the theory of general relativity in detail please for a student');
});
test('gather degrades gracefully when every network call fails', async () => {
  const real = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try { const g = await gather('what is a black hole', {}); assert.deepEqual(g.sources, []); assert.equal(g.stats.answered, 0); } finally { globalThis.fetch = real; }
});
test('gather merges, de-duplicates and numbers sources from mocked databases', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url); const ok = (j) => ({ ok: true, json: async () => j, text: async () => '' });
    if (u.includes('wikipedia.org')) return ok({ query: { pages: { 1: { index: 1, title: 'Black hole', fullurl: 'https://en.wikipedia.org/wiki/Black_hole', extract: 'A black hole is a region of spacetime.' } } } });
    if (u.includes('wikidata.org')) return ok({ search: [{ id: 'Q589', label: 'black hole', description: 'region of spacetime' }] });
    if (u.includes('duckduckgo')) return ok({ AbstractText: 'A black hole is a region.', Heading: 'Black hole', AbstractURL: 'https://en.wikipedia.org/wiki/Black_hole' });
    return { ok: false, json: async () => null };
  };
  try {
    const g = await gather('what is a black hole', { showImages: false });
    assert.ok(g.sources.length >= 2); assert.deepEqual(g.sources.map((s) => s.n), g.sources.map((_, i) => i + 1));
    const urls = g.sources.map((s) => s.url.replace(/^https?:\/\//, '')); assert.equal(new Set(urls).size, urls.length, 'URLs de-duplicated');
    assert.ok(g.stats.answered >= 2 && g.stats.queried >= g.stats.answered);
  } finally { globalThis.fetch = real; }
});
