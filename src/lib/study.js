// Study mode: quiz, flashcards and notes for any topic.
import { parseList } from './llm.js';

export function studyIntent(q) {
  const t = q.trim();
  const k = /\b(quiz|mcqs?|flash ?cards?|study notes|revision notes|notes|test me)\b/i.exec(t); if (!k) return null;
  const w = k[1].toLowerCase();
  if (w === 'notes' && !/\b(make|create|generate|write|prepare|give|banao|bana)\b/i.test(t)) return null;
  const tm = /\b(?:on|about|for|of|topic)\s+(.{2,120}?)[?.!]*$/i.exec(t); if (!tm) return null;
  const kind = /quiz|mcq|test me/.test(w) ? 'quiz' : /flash/.test(w) ? 'flashcards' : 'notes';
  const n = /(\d{1,2})\s*(?:questions?|cards?|mcqs?|flash)/i.exec(t);
  return { kind, topic: tm[1].trim(), count: Math.min(15, Math.max(3, n ? +n[1] : kind === 'quiz' ? 5 : 8)) };
}

export function studyMessages({ kind, topic, count, context = '', lang = 'English' }) {
  const schema = kind === 'quiz'
    ? `[{"q":"question","options":["A","B","C","D"],"answer":0,"why":"one-sentence explanation"}]  ("answer" is the 0-based index of the correct option)`
    : `[{"front":"term or question","back":"short answer or definition"}]`;
  return [
    { role: 'system', content: `You create study material. Output ONLY a valid JSON array, no prose and no code fences. Language: ${lang}. Schema: ${schema}. Make exactly ${count} items, accurate and varied; for quizzes the three wrong options must be plausible. ${context ? 'Base the content on the SOURCES, and general knowledge where needed.' : ''}` },
    { role: 'user', content: `Topic: ${topic}${context ? `\n\nSOURCES:\n${context}` : ''}` },
  ];
}

export function parseStudy(text, kind) {
  const m = String(text || '').match(/\[[\s\S]*\]/); let arr = null;
  if (m) { try { arr = JSON.parse(m[0]); } catch { arr = null; } }
  if (!Array.isArray(arr)) return [];
  if (kind === 'quiz') return arr.filter((x) => x && x.q && Array.isArray(x.options) && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length).map((x) => ({ q: String(x.q), options: x.options.map(String), answer: x.answer, why: String(x.why || '') }));
  return arr.filter((x) => x && x.front && x.back).map((x) => ({ front: String(x.front), back: String(x.back) }));
}
export { parseList };
