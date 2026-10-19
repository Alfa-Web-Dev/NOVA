// Generates the colourful glyph icons in public/assets/cicons (needs playwright + chromium). Run: node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const src = fs.readFileSync(new URL('../src/icons.jsx', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export const P = {') + 17, src.indexOf('};', src.indexOf('export const P = {')));
const P = Object.fromEntries([...body.matchAll(/^\s*([a-z0-9]+): '([^']+)'/gm)].map((m) => [m[1], m[2]]));
const PAL = [['#fdeccf', '#f59e0b'], ['#fde0ec', '#ec4899'], ['#d9f5ee', '#14b8a6'], ['#fde0e0', '#ef4444'], ['#e6dffc', '#7c4ddb'], ['#fde7d6', '#f97316'], ['#d8f0fb', '#0ea5e9'], ['#e4f7d4', '#65a30d'], ['#dfe5fc', '#4f6bed'], ['#fbe0fb', '#c026d3'], ['#d6f5e3', '#16a34a'], ['#fff3c4', '#ca8a04']];
const FIX = { message: '#7c9cff', bookmark: '#f2b04a', book: '#f2788c', sun: '#ff9858', lightbulb: '#3fc39a', sliders: '#4fb0e6', trash: '#ef6b6b', type: '#8a8fa8', folder: '#e8a24a' };
const names = Object.keys(P).filter((k) => !['send', 'stop', 'close', 'back', 'chevron', 'chevronr', 'check'].includes(k));
const ALIAS = { 'cm-rename': ['type', '#5b8def'], 'cm-pin': ['bookmark', '#f2b04a'], 'cm-library': ['book', '#19b5a5'], 'cm-delete': ['trash', '#ef5350'] };
for (const [k, [src]] of Object.entries(ALIAS)) { P[k] = P[src]; FIX[k] = ALIAS[k][1]; names.push(k); }
const html = names.map((n, i) => { const [bg, fg0] = PAL[i % PAL.length]; const fg = FIX[n] || fg0; return `<div id="${n}" style="width:96px;height:96px;display:grid;place-items:center"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg></div>`; }).join('');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pg = await b.newPage({ viewport: { width: 200, height: 200 } });
await pg.setContent(`<body style="margin:0;background:transparent;display:grid;gap:8px;width:96px">${html}</body>`);
for (const n of names) await pg.locator('#' + n).screenshot({ path: new URL(`../public/assets/cicons/${n}.png`, import.meta.url).pathname, omitBackground: true });
await b.close(); console.log('icons', names.length);
