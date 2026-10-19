import React, { useRef, useState, useEffect } from 'react';
import { Icon } from '../icons.jsx';
import { useBackClose } from '../lib/backstack.js';

/** Full-screen image viewer: pinch / wheel / double-tap zoom, drag to pan, back to close. */
export default function ImageViewer({ images, index = 0, onClose, onOpenSource }) {
  useBackClose(onClose);
  const [i, setI] = useState(index);
  const [tf, setTf] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map()), last = useRef(null), pinch = useRef(0), tap = useRef(0), sw = useRef(null);
  const img = images[i] || {};
  const reset = () => setTf({ s: 1, x: 0, y: 0 });
  const go = (d) => { const n = i + d; if (n >= 0 && n < images.length) { setI(n); reset(); } };
  const zoom = (f) => setTf((t) => { const s = Math.min(5, Math.max(1, t.s * f)); return s === 1 ? { s, x: 0, y: 0 } : { ...t, s }; });
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); if (e.key === '+') zoom(1.4); if (e.key === '-') zoom(1 / 1.4); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  const dist = () => { const [a, b] = [...pts.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = { x: e.clientX, y: e.clientY };
    sw.current = { x: e.clientX, y: e.clientY };
    if (pts.current.size === 2) pinch.current = dist();
    const now = Date.now();
    if (pts.current.size === 1 && now - tap.current < 280) { setTf((t) => (t.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })); tap.current = 0; } else tap.current = now;
  };
  const move = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) { const d = dist(); if (pinch.current) zoom(d / pinch.current); pinch.current = d; return; }
    if (tf.s > 1 && last.current) { const dx = e.clientX - last.current.x, dy = e.clientY - last.current.y; setTf((t) => ({ ...t, x: t.x + dx, y: t.y + dy })); }
    last.current = { x: e.clientX, y: e.clientY };
  };
  const up = (e) => {
    pts.current.delete(e.pointerId); pinch.current = 0;
    if (tf.s === 1 && sw.current && pts.current.size === 0) { const dx = e.clientX - sw.current.x; if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1); }
    last.current = null;
  };
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Image viewer">
      <header className="viewer-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back"><Icon n="back" size={20} /></button>
        <div className="vt">{img.title || 'Image'}{images.length > 1 && <small> · {i + 1}/{images.length}</small>}</div>
        {img.page && <button type="button" className="icon-btn" onClick={() => onOpenSource?.(img)} aria-label="Open source page"><Icon n="external" size={20} /></button>}
      </header>
      <div className="viewer-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}>
        <img src={img.src || img.url} alt={img.title || ''} draggable={false} style={{ transform: `translate(${tf.x}px,${tf.y}px) scale(${tf.s})` }} />
      </div>
      <footer className="viewer-foot">
        <button type="button" className="icon-btn" onClick={() => zoom(1 / 1.4)} aria-label="Zoom out"><Icon n="minus" size={20} /></button>
        <span>{Math.round(tf.s * 100)}%</span>
        <button type="button" className="icon-btn" onClick={() => zoom(1.4)} aria-label="Zoom in"><Icon n="plus" size={20} /></button>
        <button type="button" className="icon-btn" onClick={reset} aria-label="Reset zoom"><Icon n="refresh" size={20} /></button>
      </footer>
    </div>
  );
}
