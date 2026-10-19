// Safe math evaluator (no eval / Function). Recursive-descent parser.
const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, log10: Math.log10,
  log2: Math.log2, exp: Math.exp, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  fact: (n) => { if (n < 0 || n > 170 || !Number.isInteger(n)) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

export function evaluate(src) {
  const s = src.toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  const fail = () => { throw new Error('bad expression'); };
  function number() {
    const m = /^\d*\.?\d+(e[+-]?\d+)?/.exec(s.slice(i));
    if (!m) fail();
    i += m[0].length; return parseFloat(m[0]);
  }
  function primary() {
    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') fail(); i++; return v; }
    if (/[a-z]/.test(peek() || '')) {
      const m = /^[a-z0-9]+/.exec(s.slice(i)); let name = m[0];
      // allow "sqrt16"-style? no: require parentheses for functions; digits not part of names except log2/log10
      const known = Object.keys(FUNCS).concat(Object.keys(CONSTS)).sort((a, b) => b.length - a.length).find((k) => name.startsWith(k));
      if (!known) fail();
      name = known; i += name.length;
      if (name in CONSTS) return CONSTS[name];
      if (peek() !== '(') fail();
      i++; const a = expr(); if (peek() !== ')') fail(); i++;
      return FUNCS[name](a);
    }
    return number();
  }
  function postfix() { let v = primary(); while (peek() === '%' || peek() === '!') { if (s[i] === '%') v /= 100; else v = FUNCS.fact(v); i++; } return v; }
  function power() { const b = postfix(); if (peek() === '^' || (peek() === '*' && s[i + 1] === '*')) { i += peek() === '^' ? 1 : 2; return b ** unary(); } return b; }
  function unary() { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return power(); }
  function term() {
    let v = unary();
    while (peek() === '*' || peek() === '/') {
      if (peek() === '*' && s[i + 1] === '*') break;
      const op = s[i++]; const r = unary(); v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; }
  const v = expr();
  if (i !== s.length || !Number.isFinite(v)) fail();
  return v;
}

const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('en-US') : String(Number(n.toPrecision(12))));

/** Returns a markdown answer if the question is plain arithmetic, otherwise null. */
export function tryCalculate(q) {
  let t = q.trim().replace(/^(what('| i)?s|calculate|compute|solve|find|evaluate)\s+(is\s+)?/i, '').replace(/[=?]+\s*$/, '').trim();
  const pct = /^(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)$/i.exec(t);
  if (pct) { const r = (parseFloat(pct[1]) / 100) * parseFloat(pct[2]); return { expr: t, result: fmt(r) }; }
  if (!/^[\d\s+\-*/^().,%!×÷a-z]+$/i.test(t) || !/\d/.test(t) || !/[+\-*/^%!×÷]|[a-z]\(/i.test(t)) return null;
  if (/^[\d.,\s]+$/.test(t)) return null;
  try { return { expr: t, result: fmt(evaluate(t)) }; } catch { return null; }
}
