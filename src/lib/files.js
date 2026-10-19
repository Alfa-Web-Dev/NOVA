// Turn a user file into text: text/markdown/CSV/JSON/HTML, PDF (pdf.js) and photos (Gemini vision or on-device OCR).
// Heavy libraries are loaded on demand, so they cost nothing until used.
const MAX_CHARS = 400_000;
const ext = (n) => (n.split('.').pop() || '').toLowerCase();
const strip = (h) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

export const isImage = (f) => /^image\//.test(f.type) || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp', 'gif'].includes(ext(f.name));
export const isPdf = (f) => f.type === 'application/pdf' || ext(f.name) === 'pdf';

/** Downscale a photo and return base64 JPEG (keeps uploads small and fast). */
export async function imageToBase64(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.86);
  return { mime: 'image/jpeg', data: url.split(',')[1], url, canvas: c };
}

async function pdfText(file, onStatus) {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = ''; const n = Math.min(doc.numPages, 80);
  for (let i = 1; i <= n; i++) {
    onStatus?.(`Reading PDF page ${i}/${n}…`);
    const content = await (await doc.getPage(i)).getTextContent();
    out += content.items.map((x) => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n\n';
    if (out.length > MAX_CHARS) break;
  }
  return out.trim();
}

export async function ocr(canvasOrBlob, { langs = 'eng', onStatus } = {}) {
  const { createWorker } = await import('tesseract.js');
  const base = import.meta.env.BASE_URL;
  const opts = { logger: (m) => m.status && onStatus?.(`Reading text… ${m.progress ? Math.round(m.progress * 100) + '%' : m.status}`) };
  if (import.meta.env.PROD) { opts.workerPath = `${base}ocr/worker.min.js`; opts.corePath = `${base}ocr/`; } // bundled by scripts/postbuild.mjs; dev uses the CDN
  const w = await createWorker(langs, 1, opts);
  try { return (await w.recognize(canvasOrBlob)).data.text.trim(); } finally { await w.terminate(); }
}

/**
 * @returns {{ name, kind: 'pdf'|'text'|'image', text, image? }}  `image` is set (base64) when a vision model should look at it.
 */
export async function extractFile(file, { vision = false, langs = 'eng', onStatus } = {}) {
  if (isPdf(file)) return { name: file.name, kind: 'pdf', text: (await pdfText(file, onStatus)).slice(0, MAX_CHARS) };
  if (isImage(file)) {
    onStatus?.('Preparing photo…');
    const img = await imageToBase64(file);
    if (vision) return { name: file.name || 'photo', kind: 'image', text: '', image: { mime: img.mime, data: img.data }, preview: img.url };
    return { name: file.name || 'photo', kind: 'image', text: await ocr(img.canvas, { langs, onStatus }), preview: img.url };
  }
  const raw = await file.text();
  return { name: file.name, kind: 'text', text: (['html', 'htm', 'xml'].includes(ext(file.name)) ? strip(raw) : raw).slice(0, MAX_CHARS) };
}
