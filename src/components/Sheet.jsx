import React, { useRef, useState, useEffect } from 'react';
import { Icon } from '../icons.jsx';
import { useBackClose } from '../lib/backstack.js';

/** Bottom sheet: opens half-height, drag the handle/header up to fill the screen, down to close. */
export default function Sheet({ title, onClose, children, top = false }) {
  useBackClose(onClose);
  const vh = () => (typeof window === 'undefined' ? 800 : window.innerHeight);
  const full = () => vh() - 56, half = () => Math.round(vh() * 0.55);
  const [h, setH] = useState(half());
  const [drag, setDrag] = useState(false);
  const st = useRef(null);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); st.current = { y: e.clientY, h, moved: 0 }; setDrag(true); };
  const move = (e) => { if (!st.current) return; const dy = e.clientY - st.current.y; st.current.moved = Math.abs(dy); setH(Math.max(80, Math.min(full(), st.current.h - dy))); };
  const up = () => {
    if (!st.current) return; const { h: h0, moved } = st.current; st.current = null; setDrag(false);
    if (moved < 6) { setH(h0 >= full() - 4 ? half() : full()); return; } // tap toggles
    setH((cur) => { if (cur < half() * 0.6) { setTimeout(onClose, 0); return cur; } return cur > (half() + full()) / 2 ? full() : half(); });
  };
  const expanded = h >= full() - 4;
  const bodyRef = useRef(null), ty = useRef(null);
  // content drag: swipe up on the list lifts the sheet to full screen first; swipe down at the top lowers it
  const tStart = (e) => { ty.current = e.touches[0].clientY; };
  const tMove = (e) => {
    if (ty.current == null) return; const dy = e.touches[0].clientY - ty.current;
    if (!expanded && dy < -12) { setH(full()); ty.current = null; }
    else if (expanded && dy > 70 && (bodyRef.current?.scrollTop || 0) <= 0) { setH(half()); ty.current = null; }
  };
  return (
    <div className={`sheet-wrap ${top ? 'top' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-scrim" onClick={onClose} aria-label="Close" />
      <section className={`sheet ${drag ? 'dragging' : ''}`} style={{ height: h }}>
        <div className="sheet-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <i className="grab" />
          <div className="sheet-head"><button type="button" className="icon-btn" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close"><Icon n="close" size={20} /></button><h3>{title}</h3><span className="sheet-sp" /></div>
        </div>
        <div className="sheet-body" ref={bodyRef} onTouchStart={tStart} onTouchMove={tMove}>{children}</div>
      </section>
    </div>
  );
}
