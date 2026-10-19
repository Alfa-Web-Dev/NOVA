// "My library": notes and files the user adds (PDF, text, photos). Stored only on this device (IndexedDB)
// and used as extra sources for answers, so Nova can chat with your own material — fully private and offline-capable.
import { kvGet, kvSet } from './db.js';
import { chunkText, topChunks } from './web.js';
import { keywords } from './intent.js';

const KEY = 'library';
let cache = null;
export const listLibrary = async () => (cache ||= await kvGet(KEY, []));
const save = async (docs) => { cache = docs; await kvSet(KEY, docs); return docs; };

export async function addDoc({ name, text, kind = 'note' }) {
  const clean = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!clean) throw new Error('Nothing to save');
  const doc = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name || 'Untitled', kind, addedAt: Date.now(), chars: clean.length, chunks: chunkText(clean, 800).slice(0, 600) };
  await save([doc, ...(await listLibrary())]);
  return doc;
}
export const removeDoc = async (id) => save((await listLibrary()).filter((d) => d.id !== id));
export const clearLibrary = async () => save([]);

/** Best passages across the whole library for a question, as numbered-source objects (n is assigned by the caller). */
export async function searchLibrary(question, { max = 4 } = {}) {
  const docs = await listLibrary(); if (!docs.length) return [];
  const need = Math.min(2, keywords(question).length); if (!need) return []; // too vague to match anything
  const out = [];
  for (const d of docs) {
    const top = topChunks(d.chunks.join('\n'), question, { max: 2, size: 800 });
    const sc = scoreOf(top.join(' '), question);
    if (top.length && sc >= need) out.push({ source: `My library · ${d.name}`, kind: 'file', title: d.name, snippet: top[0].slice(0, 700), context: top.join('\n').slice(0, 2200), url: `nova-file:${d.id}`, read: true, _score: sc });
  }
  return out.sort((a, b) => b._score - a._score).slice(0, max).map(({ _score, ...s }) => s);
}
const scoreOf = (text, q) => { const t = text.toLowerCase(); return q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2).reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0); };
