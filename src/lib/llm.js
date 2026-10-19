// Helper LLM calls (query rewriting, research planning, study material) and Gemini's native API,
// which can ground answers with Google Search (free tier, bring-your-own key).
import { streamOpenAI, ONLINE_DEFAULT } from './ai.js';
import { getJSON } from './util.js';

export const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';

/* ---------- Gemini native: streaming + optional Google Search grounding + vision ---------- */
/** OpenAI-style messages -> Gemini request body. A message may carry `images: [{mime, data(base64)}]`. */
export function toGemini(messages) {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }, ...(m.images || []).map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }))],
  }));
  return { ...(sys ? { system_instruction: { parts: [{ text: sys }] } } : {}), contents };
}

/* Google-search grounding has a small free daily quota. After a quota/rate error we pause it for a while and answer
   with the normal pipeline instead of failing every question. Remembered across restarts. */
const PAUSE_KEY = 'nova-grounding-pause';
export const groundingPausedUntil = () => { try { return +localStorage.getItem(PAUSE_KEY) || 0; } catch { return 0; } };
export const groundingPaused = (now = Date.now()) => groundingPausedUntil() > now;
export const pauseGrounding = (ms = 60 * 60 * 1000, now = Date.now()) => { try { localStorage.setItem(PAUSE_KEY, String(now + ms)); } catch { /* private mode */ } };
export const isQuotaError = (e) => e && (e.status === 429 || e.status === 403 || /quota|rate/i.test(String(e.message)));

/** Collects Google-grounding metadata (sources + the queries Google ran) from a Gemini candidate. */
export function readGrounding(meta, into = { sources: [], queries: [] }) {
  if (!meta) return into;
  for (const c of meta.groundingChunks || []) {
    const w = c.web; if (w?.uri && !into.sources.some((s) => s.url === w.uri)) into.sources.push({ url: w.uri, title: w.title || w.uri });
  }
  for (const q of meta.webSearchQueries || []) if (!into.queries.includes(q)) into.queries.push(q);
  return into;
}

/**
 * Streams a Gemini answer. With `grounding: true` Gemini searches Google itself and returns the sources it used.
 * Resolves { text, grounding: { sources, queries } }. Throws on HTTP errors (the caller falls back to another engine).
 */
export async function streamGemini({ apiKey, model = 'gemini-2.5-flash', grounding = false }, messages, { signal, onToken = () => {} } = {}) {
  const body = { ...toGemini(messages), generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }, ...(grounding ? { tools: [{ google_search: {} }] } : {}) };
  const res = await fetch(`${GEMINI_API}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = new Error(`Gemini returned ${res.status}`); e.status = res.status; throw e; }
  const g = { sources: [], queries: [] };
  let out = '';
  const eat = (data) => {
    let j; try { j = JSON.parse(data); } catch { return; }
    const cand = j.candidates?.[0];
    for (const p of cand?.content?.parts || []) if (p.text && !p.thought) { out += p.text; onToken(out); }
    readGrounding(cand?.groundingMetadata, g);
  };
  if (!res.body) { const j = await res.text(); j.split('\n').forEach((l) => l.startsWith('data:') && eat(l.slice(5).trim())); }
  else {
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) if (l.startsWith('data:')) eat(l.slice(5).trim());
    }
    if (buf.startsWith('data:')) eat(buf.slice(5).trim());
  }
  if (!out) throw new Error('Empty response');
  return { text: out, grounding: g };
}

/* ---------- one-shot helper completions ---------- */
/** Engines suited to short helper calls: keyed providers and the free online one (never the slow on-device model). */
export const helperChain = (chain = []) => chain.filter((e) => e.kind === 'custom' || e.kind === 'online');

export async function completeOnce(chain, messages, { signal, timeout = 15000 } = {}) {
  for (const e of helperChain(chain)) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout); const onAbort = () => ctl.abort(); signal?.addEventListener('abort', onAbort);
    try {
      const cfg = e.kind === 'online' ? { endpoint: ONLINE_DEFAULT.endpoint, model: ONLINE_DEFAULT.model } : { endpoint: e.cfg.endpoint, apiKey: e.cfg.apiKey, model: e.cfg.model };
      const text = await streamOpenAI(cfg, messages, { signal: ctl.signal, onToken: () => {} });
      if (text?.trim()) return text.trim();
    } catch { if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort); }
  }
  return null;
}

/* ---------- query rewriting: any language / Hinglish / follow-up -> a good English search query ---------- */
const HINGLISH = /\b(kya|kaise|kaisa|kyun|kyu|kab|kaun|kaha|kahan|kitna|kitni|kitne|hai|hain|ho|tha|thi|ka|ki|ke|ko|se|mein|me|par|pe|aur|nahi|nahin|batao|bataiye|bata|samjhao|samjhaiye|chahiye|karna|karo|kaam|aaj|abhi|wala|wali|liye|bare|mujhe|hamen|humein|apne|isse|usse|jaise)\b/i;
const NON_LATIN = /[ऀ-ॿঀ-৿஀-௿ఀ-౿؀-ۿЀ-ӿ一-鿿぀-ヿ]/;
export const needsRewrite = (q, history = []) => NON_LATIN.test(q) || (q.split(/\s+/).filter((w) => HINGLISH.test(w)).length >= 2) || (history.length > 0 && q.split(/\s+/).length <= 5);

const SCRIPT_LANG = [[/[ऀ-ॿ]/, 'hi'], [/[ঀ-৿]/, 'bn'], [/[஀-௿]/, 'ta'], [/[ఀ-౿]/, 'te'], [/[؀-ۿ]/, 'ar'], [/[Ѐ-ӿ]/, 'ru'], [/[一-鿿]/, 'zh'], [/[぀-ヿ]/, 'ja']];
/** Free fallback with no AI key: MyMemory machine translation for non-Latin scripts. */
export async function translateToEnglish(q, signal) {
  const lang = SCRIPT_LANG.find(([re]) => re.test(q))?.[1]; if (!lang) return null;
  const d = await getJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 450))}&langpair=${lang}|en`, signal, 6000);
  const t = d?.responseData?.translatedText;
  return t && !/MYMEMORY WARNING|INVALID/i.test(t) && t.toLowerCase() !== q.toLowerCase() ? t.trim() : null;
}

export async function rewriteQuery(question, history, chain, signal) {
  if (!needsRewrite(question, history)) return null;
  const recent = history.filter((m) => m.text).slice(-4).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.slice(0, 200)}`).join('\n');
  const out = await completeOnce(chain, [
    { role: 'system', content: 'You turn a user message into one concise English web-search query (max 12 words). Resolve pronouns using the conversation. The message may be in any language or in Hinglish (Hindi written in Latin letters). Output ONLY the query, no quotes or explanation.' },
    { role: 'user', content: `${recent ? `Conversation so far:\n${recent}\n\n` : ''}Message: ${question}` },
  ], { signal, timeout: 9000 });
  const q = out?.split('\n')[0]?.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (q && q.length >= 3 && q.length < 160) return q;
  return translateToEnglish(question, signal);
}

/* ---------- Deep Research: split a question into sub-questions ---------- */
export function fallbackSubQuestions(q) {
  const base = q.replace(/[?.!]+$/, '').trim();
  return [base, `${base} latest developments`, `${base} advantages and disadvantages`, `${base} explained for beginners`].slice(0, 4);
}
export function parseList(text) {
  if (!text) return [];
  const m = text.match(/\[[\s\S]*\]/);
  if (m) { try { const a = JSON.parse(m[0]); if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean); } catch { /* fall through */ } }
  return text.split('\n').map((l) => l.replace(/^[\s\-*\d.)]+/, '').trim()).filter((l) => l.length > 3);
}
export async function planSubQuestions(question, chain, signal) {
  const out = await completeOnce(chain, [
    { role: 'system', content: 'You plan web research. Break the user\'s question into 3 or 4 specific, non-overlapping English search queries that together cover it (definitions, current facts, comparisons, evidence, counter-views). Output ONLY a JSON array of strings.' },
    { role: 'user', content: question },
  ], { signal, timeout: 12000 });
  const list = parseList(out).slice(0, 4);
  return list.length >= 2 ? list : fallbackSubQuestions(question);
}
