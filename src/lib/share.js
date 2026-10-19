// Share an answer as a picture card or a PDF, rendered on a canvas (no libraries, works offline).
const W = 1080, PAD = 72;

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let cur = '';
    for (const word of para.split(/\s+/)) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
    }
    lines.push(cur);
  }
  return lines;
}
/** Markdown → readable plain text for the card. */
export const plain = (md) => String(md || '').replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, '')).replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2').replace(/`([^`]+)`/g, '$1').replace(/^\s*[-*]\s+/gm, '• ').replace(/\[(\d{1,2})\]/g, '').replace(/\s+\n/g, '\n').trim();

export async function renderCard({ question, answer, sources = [], logoUrl }) {
  const ink = '#f4f2ff', mute = '#9b97b3', acc = '#b99cff', bg = '#0b0b10';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '30px system-ui, sans-serif';
  const q = wrap(probe, question, W - PAD * 2).slice(0, 3);
  let body = wrap(probe, plain(answer), W - PAD * 2);
  if (body.length > 34) body = [...body.slice(0, 34), '…'];
  const srcs = [...new Set(sources.filter((s) => s.kind !== 'image').map((s) => s.source))].slice(0, 6).join('  ·  ');
  const H = PAD * 2 + 80 + q.length * 44 + 30 + body.length * 42 + (srcs ? 90 : 20) + 70;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W, 0, 0, W, 0, 700); g.addColorStop(0, 'rgba(185,156,255,.22)'); g.addColorStop(1, 'rgba(185,156,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  let y = PAD;
  if (logoUrl) { try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = logoUrl; }); x.drawImage(img, PAD, y, 56, 56); } catch { /* no logo */ } }
  x.fillStyle = ink; x.font = '700 38px system-ui, sans-serif'; x.fillText('nova', PAD + 74, y + 40); y += 110;
  x.fillStyle = acc; x.font = '600 32px system-ui, sans-serif'; q.forEach((l) => { x.fillText(l, PAD, y); y += 44; }); y += 30;
  x.fillStyle = ink; x.font = '30px system-ui, sans-serif'; body.forEach((l) => { x.fillText(l, PAD, y); y += 42; });
  if (srcs) { y += 28; x.fillStyle = mute; x.font = '24px system-ui, sans-serif'; wrap(x, `Sources: ${srcs}`, W - PAD * 2).slice(0, 2).forEach((l) => { x.fillText(l, PAD, y); y += 34; }); }
  x.fillStyle = mute; x.font = '22px system-ui, sans-serif'; x.fillText('Made with Nova — free & open-source AI. Verify important facts.', PAD, H - 40);
  return c;
}

/** A one-page PDF that embeds the card as a JPEG (hand-written PDF, no dependency). */
export function canvasToPdf(canvas) {
  const jpg = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
  const img = new Uint8Array(jpg.length); for (let i = 0; i < jpg.length; i++) img[i] = jpg.charCodeAt(i);
  const pw = Math.round(canvas.width * 0.5), ph = Math.round(canvas.height * 0.5), enc = new TextEncoder(); const parts = []; const offs = []; let len = 0;
  const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; parts.push(b); len += b.length; };
  const obj = (n, d) => { offs[n] = len; push(`${n} 0 obj\n${d}\nendobj\n`); };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = len; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`); push(img); push('\nendstream\nendobj\n');
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`; obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len; push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

export const toBlob = (c, type = 'image/png') => new Promise((r) => c.toBlob(r, type, 0.92));
export async function shareFile(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}
