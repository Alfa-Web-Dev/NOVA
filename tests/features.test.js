import test from 'node:test';
import assert from 'node:assert/strict';
import { convertUnits, parseConversion, parseTimer, parseCrypto, parseStock, parsePrayer, parseNews, parseBriefing, detectWidget, parseRSS } from '../src/lib/widgets.js';
import { studyIntent, parseStudy, studyMessages } from '../src/lib/study.js';
import { sourceCheck, checkLabel } from '../src/lib/factcheck.js';
import { toGemini, readGrounding, needsRewrite, parseList, fallbackSubQuestions, helperChain } from '../src/lib/llm.js';
import { buildMessages, STYLES } from '../src/lib/ai.js';
import { plain } from '../src/lib/share.js';

test('unit conversion: length, mass, temperature, speed, data', () => {
  assert.match(parseConversion('10 km to miles').text, /10 km = 6\.2137\d* mi/);
  assert.equal(Math.round(convertUnits(100, 'c', 'f').result), 212);
  assert.equal(Math.round(convertUnits(32, 'fahrenheit', 'celsius').result), 0);
  assert.ok(Math.abs(convertUnits(1, 'kg', 'lb').result - 2.20462) < 1e-4);
  assert.equal(convertUnits(1, 'gb', 'mb').result, 1024);
  assert.equal(convertUnits(1, 'km', 'kg'), null); // incompatible
  assert.equal(parseConversion('2 in 3'), null);
  assert.ok(parseConversion('5 feet in cm'));
});

test('timer parsing (English and Hindi)', () => {
  assert.equal(parseTimer('set a timer for 5 minutes').seconds, 300);
  assert.equal(parseTimer('timer 1 hour 30 minutes').seconds, 5400);
  assert.equal(parseTimer('10 minute ka timer').seconds, 600);
  assert.equal(parseTimer('what is a timer'), null);
});

test('crypto, stock, prayer, news, briefing detection', () => {
  assert.equal(parseCrypto('bitcoin price today').id, 'bitcoin');
  assert.equal(parseCrypto('ETH rate in inr').id, 'ethereum');
  assert.equal(parseCrypto('what is bitcoin'), null);
  assert.equal(parseStock('tesla stock price').ticker, 'tsla');
  assert.equal(parseStock('AAPL share price').ticker, 'aapl');
  assert.equal(parseStock('how do stocks work'), null);
  assert.equal(parsePrayer('namaz time in Delhi').city, 'Delhi');
  assert.equal(parsePrayer('prayer times', 'Mumbai').city, 'Mumbai');
  assert.equal(parseNews('latest news about cricket').topic, 'cricket');
  assert.equal(parseNews('top headlines').topic, '');
  assert.equal(parseNews('why is the news so negative'), null);
  assert.ok(parseBriefing('daily briefing'));
  assert.ok(parseBriefing('give me my morning brief'));
});

test('detectWidget picks the right tool and ignores normal questions', () => {
  assert.equal(detectWidget('100 usd to inr').type, 'currency');
  assert.equal(detectWidget('5 miles to km').type, 'convert');
  assert.equal(detectWidget('start a 2 minute timer').type, 'timer');
  assert.equal(detectWidget('how does photosynthesis work'), null);
  assert.equal(detectWidget('explain recursion'), null);
});

test('RSS parsing separates headline and source', () => {
  const xml = `<rss><channel><item><title>Big thing happens - The Hindu</title><link>https://news.example/a</link><pubDate>Tue, 13 Oct 2026 10:00:00 GMT</pubDate><source url="x">The Hindu</source></item><item><title><![CDATA[Other &amp; more - BBC]]></title><link>https://news.example/b</link></item></channel></rss>`;
  const items = parseRSS(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Big thing happens'); assert.equal(items[0].source, 'The Hindu');
  assert.equal(items[1].title, 'Other & more'); assert.equal(items[1].source, 'BBC');
});

test('study intent and JSON parsing', () => {
  assert.deepEqual(studyIntent('quiz me on photosynthesis'), { kind: 'quiz', topic: 'photosynthesis', count: 5 });
  assert.equal(studyIntent('make 10 flashcards on the French revolution').count, 10);
  assert.equal(studyIntent('make notes on cell division').kind, 'notes');
  assert.equal(studyIntent('notes app for ios'), null);
  assert.equal(studyIntent('hello'), null);
  const quiz = parseStudy('Sure!\n```json\n[{"q":"2+2?","options":["3","4"],"answer":1,"why":"Math"},{"q":"bad","options":["a"],"answer":5}]\n```', 'quiz');
  assert.equal(quiz.length, 1); assert.equal(quiz[0].answer, 1);
  assert.equal(parseStudy('[{"front":"H2O","back":"Water"},{"front":"x"}]', 'flashcards').length, 1);
  assert.equal(parseStudy('not json', 'quiz').length, 0);
  assert.match(studyMessages({ kind: 'quiz', topic: 'x', count: 4 })[0].content, /exactly 4/);
});

test('source check counts independent sites', () => {
  const src = [{ n: 1, url: 'https://en.wikipedia.org/a' }, { n: 2, url: 'https://hi.wikipedia.org/b' }, { n: 3, url: 'https://nasa.gov/c' }, { n: 4, url: 'https://bbc.com/d' }];
  assert.equal(sourceCheck('x [1] y [2]', src).independent, 1);
  assert.equal(sourceCheck('x [1] y [3]', src).level, 'medium');
  assert.equal(sourceCheck('[1][3][4]', src).level, 'high');
  assert.equal(sourceCheck('no citations', src).level, 'none');
  assert.match(checkLabel(sourceCheck('[1][3][4]', src)), /3 independent/);
  const g = [{ n: 1, via: 'google', title: 'wikipedia.org', url: 'https://vertexaisearch.cloud.google.com/x' }, { n: 2, via: 'google', title: 'nasa.gov', url: 'https://vertexaisearch.cloud.google.com/y' }];
  assert.equal(sourceCheck('answer', g, true).independent, 2);
});

test('Gemini request mapping and grounding metadata', () => {
  const r = toGemini([{ role: 'system', content: 'S' }, { role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }, { role: 'user', content: 'see', images: [{ mime: 'image/jpeg', data: 'AAA' }] }]);
  assert.equal(r.system_instruction.parts[0].text, 'S');
  assert.deepEqual(r.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(r.contents[2].parts[1].inline_data.data, 'AAA');
  const g = readGrounding({ groundingChunks: [{ web: { uri: 'https://a', title: 'a.com' } }, { web: { uri: 'https://a', title: 'a.com' } }], webSearchQueries: ['q1'] });
  assert.equal(g.sources.length, 1); assert.deepEqual(g.queries, ['q1']);
});

test('query rewriting triggers and research planning helpers', () => {
  assert.ok(needsRewrite('चंद्रमा कैसे बना'));
  assert.ok(needsRewrite('chand kaise bana batao'));
  assert.ok(needsRewrite('and the second one?', [{ text: 'x' }]));
  assert.ok(!needsRewrite('How was the Moon formed?'));
  assert.deepEqual(parseList('["a","b","c"]'), ['a', 'b', 'c']);
  assert.deepEqual(parseList('1. first one\n2. second one'), ['first one', 'second one']);
  assert.equal(fallbackSubQuestions('Is solar good?').length, 4);
  assert.deepEqual(helperChain([{ kind: 'local' }, { kind: 'custom' }, { kind: 'gemini' }, { kind: 'online' }]).map((e) => e.kind), ['custom', 'online']);
});

test('prompt: styles, auto language, deep report, images', () => {
  const sys = (o) => buildMessages({ question: 'q', ...o })[0].content;
  assert.match(sys({ style: 'hinglish' }), /Hinglish/);
  assert.match(sys({ style: 'eli5' }), /12 years old/);
  assert.match(sys({ lang: 'auto' }), /same language and script/);
  assert.match(sys({ deep: true }), /research report/);
  assert.equal(sys({ style: 'default' }).includes('Style:'), false);
  const m = buildMessages({ question: 'q', images: [{ mime: 'image/jpeg', data: 'x' }] });
  assert.equal(m[m.length - 1].images.length, 1);
  assert.ok(Object.keys(STYLES).includes('short'));
});

test('share card text cleanup', () => {
  assert.equal(plain('## Title\n**bold** and `code` [1]\n- item'), 'Title\nbold and code\n• item');
});

import { groundingPaused, pauseGrounding, isQuotaError } from '../src/lib/llm.js';
test('Google grounding pauses after a quota error', () => {
  const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  assert.equal(groundingPaused(1000), false);
  pauseGrounding(60000, 1000);
  assert.equal(groundingPaused(2000), true);
  assert.equal(groundingPaused(70000), false);
  assert.equal(isQuotaError({ status: 429 }), true);
  assert.equal(isQuotaError({ status: 500, message: 'boom' }), false);
});

import { panchang, tithiName } from '../src/lib/panchang.js';
import { parsePanchang, parseCricket } from '../src/lib/widgets.js';
import { ACCENTS, applyAccent } from '../src/lib/theme.js';
test('panchang: full moon on 2026-10-26 is Purnima in Ashwini; new moon 2026-11-09 is Amavasya', () => {
  const a = panchang(Date.parse('2026-10-26T03:30:00Z')); assert.equal(a.tithi, 15); assert.equal(a.tithiName, 'Purnima'); assert.equal(a.nakshatra, 'Ashwini');
  const b = panchang(Date.parse('2026-11-09T00:00:00Z')); assert.equal(b.tithiName, 'Amavasya'); assert.ok(b.moonPhase < 3);
  assert.equal(tithiName(8), 'Ashtami'); assert.equal(tithiName(23), 'Ashtami');
});
test('panchang and cricket detection', () => {
  assert.equal(parsePanchang('aaj ki tithi kya hai').type, 'panchang'); assert.equal(parsePanchang('today panchang').type, 'panchang');
  assert.equal(parsePanchang('what is a tithi and how is it calculated'), null);
  assert.equal(parseCricket('live cricket score').type, 'cricket'); assert.equal(parseCricket('IPL match today').type, 'cricket'); assert.equal(parseCricket('history of cricket'), null);
  assert.equal(detectWidget('cricket score').type, 'cricket');
});
test('accent colours: 11 options (Black default + 10 pastel), applied to the variables the whole UI and logo read', () => {
  assert.equal(ACCENTS.length, 11); assert.equal(ACCENTS[0].id, 'black');
  const root = { style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, dataset: {} };
  applyAccent('rose', true, root); assert.equal(root.style.props['--accent'], '#ff9fc0'); assert.equal(root.style.props['--logo-acc'], '#ff9fc0');
  applyAccent('rose', false, root); assert.equal(root.style.props['--accent'], '#cf4379'); assert.equal(root.dataset.accent, 'rose');
});

import { initials } from '../src/lib/initials.js';
test('profile initials: two words -> two letters, one word -> one letter', () => {
  assert.equal(initials('Husne Ara'), 'HA'); assert.equal(initials('aarif'), 'A'); assert.equal(initials('  Mohd  Aarif  Nawaz '), 'MN'); assert.equal(initials(''), 'N');
});
