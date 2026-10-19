// After `vite build`: inject the precache manifest into dist/sw.js and add a production CSP to index.html.
import { readdir, readFile, writeFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const MAX_PRECACHE = 1_000_000; // big lazy chunks (the on-device AI runtime) are cached on first use instead

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}

// Bundle the on-device OCR runtime (photo → text) so it works inside the APK without a CDN.
const ocrDir = join(dist, 'ocr'); await mkdir(ocrDir, { recursive: true });
const ocrSrc = [['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js']];
for (const f of existsSync('node_modules/tesseract.js-core') ? await readdir('node_modules/tesseract.js-core') : []) if (/^tesseract-core.*\.(js|wasm)$/.test(f)) ocrSrc.push([`node_modules/tesseract.js-core/${f}`, f]);
let ocrCopied = 0; for (const [from, to] of ocrSrc) if (existsSync(from)) { await copyFile(from, join(ocrDir, to)); ocrCopied++; }
console.log(`postbuild: bundled ${ocrCopied} OCR runtime files`);

const files = [];
const hash = createHash('sha1');
for (const f of (await walk(dist)).sort()) {
  const rel = relative(dist, f).split(sep).join('/');
  if (rel === 'sw.js' || rel.endsWith('.map') || rel.startsWith('.')) continue;
  if (rel.startsWith('ocr/') || rel.startsWith('assets/icons/') || rel.startsWith('assets/legacy/')) { hash.update(rel); continue; } // brand pack: cached on first use, not at install
  const { size } = await stat(f);
  hash.update(rel).update(String(size));
  if (size <= MAX_PRECACHE) files.push(rel === 'index.html' ? './' : './' + rel);
}
if (!files.includes('./')) files.push('./');
const version = hash.digest('hex').slice(0, 10);

const swPath = join(dist, 'sw.js');
let sw = await readFile(swPath, 'utf8');
sw = sw.replace('__BUILD_VERSION__', version).replace('/*__PRECACHE__*/[\'./\']', JSON.stringify([...new Set([...files, './index.html'])]));
await writeFile(swPath, sw);

const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:* data: blob:; worker-src 'self' blob:; frame-src https:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
const idxPath = join(dist, 'index.html');
let html = await readFile(idxPath, 'utf8');
if (!html.includes('Content-Security-Policy')) html = html.replace('<meta name="description"', `<meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="description"`);
await writeFile(idxPath, html);
await writeFile(join(dist, '.nojekyll'), '');
console.log(`postbuild: precached ${files.length} files, version ${version}`);
