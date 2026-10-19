import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, topChunks, fuse, isReadable, parseYouTube, hostOf } from '../src/lib/web.js';
import { providerChain, buildMessages } from '../src/lib/ai.js';

test('isReadable skips login-wall sites and non-HTML files', () => {
  assert.ok(isReadable('https://www.bbc.com/news/world')); assert.ok(isReadable('https://en.wikipedia.org/wiki/Moon'));
  assert.ok(!isReadable('https://www.facebook.com/x')); assert.ok(!isReadable('https://x.com/a/status/1')); assert.ok(!isReadable('https://site.com/file.pdf')); assert.ok(!isReadable('ftp://x'));
  assert.equal(hostOf('https://www.example.com/a'), 'example.com');
});

test('chunkText keeps headings and respects size', () => {
  const text = '## Intro\n' + 'Alpha beta gamma. '.repeat(30) + '\n## Details\n' + 'Delta epsilon zeta. '.repeat(30);
  const chunks = chunkText(text, 300);
  assert.equal(chunks.length, 2); assert.ok(chunks[0].startsWith('Intro:'));
  assert.ok(chunks.some((c) => c.startsWith('Details:')));
});

test('topChunks (BM25) surfaces the passage that answers the query', () => {
  const para = (x) => `${x} `.repeat(40);
  const text = [para('The history of tea in China dates back thousands of years.'), para('Photosynthesis converts light into chemical energy inside chloroplasts.'), para('Stock markets rose sharply on Tuesday after earnings.')].join('\n');
  const top = topChunks(text, 'how does photosynthesis make energy', { max: 1, size: 2500 });
  assert.equal(top.length, 1); assert.match(top[0], /Photosynthesis/);
});

test('fuse (reciprocal rank fusion) promotes URLs found by several engines and de-duplicates', () => {
  const a = [{ url: 'https://a.com/1', title: 'A1', via: 'DuckDuckGo' }, { url: 'https://b.com/x', title: 'B', via: 'DuckDuckGo' }];
  const b = [{ url: 'https://www.b.com/x#top', title: 'B', via: 'Bing', snippet: 'snip' }, { url: 'https://c.com', title: 'C', via: 'Bing' }];
  const out = fuse([a, b]);
  assert.equal(out.length, 3); assert.equal(out[0].url, 'https://b.com/x'); assert.deepEqual(out[0].via.sort(), ['Bing', 'DuckDuckGo']); assert.equal(out[0].snippet, 'snip');
});

test('parseYouTube extracts video cards from ytInitialData', () => {
  const data = { contents: { x: [{ videoRenderer: { videoId: 'abc123', title: { runs: [{ text: 'Photosynthesis ' }, { text: 'explained' }] }, ownerText: { runs: [{ text: 'Khan Academy' }] }, lengthText: { simpleText: '10:03' }, viewCountText: { simpleText: '1M views' }, publishedTimeText: { simpleText: '2 years ago' } } }, { videoRenderer: { videoId: 'live1', title: { runs: [{ text: 'live' }] } } }] } };
  const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script>`;
  const v = parseYouTube(html);
  assert.equal(v.length, 1); assert.equal(v[0].id, 'abc123'); assert.equal(v[0].title, 'Photosynthesis explained'); assert.equal(v[0].duration, '10:03'); assert.match(v[0].thumb, /ytimg\.com\/vi\/abc123/);
  assert.deepEqual(parseYouTube('<html>nothing</html>'), []);
});

test('providerChain: only configured providers, in fallback order', () => {
  assert.deepEqual(providerChain({}), []);
  const c = providerChain({ groq: { key: 'g' }, gemini: { key: 'k', model: 'gemini-x' }, custom: { endpoint: 'http://x/v1', model: 'm' }, openrouter: {} });
  assert.deepEqual(c.map((p) => p.id), ['gemini', 'groq', 'custom']); assert.equal(c[0].model, 'gemini-x'); assert.match(c[1].endpoint, /groq/);
});

test('buildMessages prefers full-page context and includes today’s date', () => {
  const m = buildMessages({ question: 'q', sources: [{ n: 1, title: 'T', source: 'BBC', snippet: 'short', context: 'LONG PAGE PASSAGE', read: true }] });
  assert.match(m[0].content, /LONG PAGE PASSAGE/); assert.match(m[0].content, /full text/); assert.match(m[0].content, new RegExp(String(new Date().getFullYear())));
});
