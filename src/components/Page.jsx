import React, { useEffect } from 'react';
import { Icon } from '../icons.jsx';
import { useBackClose } from '../lib/backstack.js';

/** Full-screen page: compact header with back arrow, scrolling body. Replaces floating modals. */
export default function Page({ title, onClose, actions, children, className = '', footer, noHead }) {
  useBackClose(onClose);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className={`page ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      {!noHead && (
        <header className="page-head">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Back"><Icon n="back" size={20} /></button>
          <h2>{title}</h2>
          <div className="page-actions">{actions}</div>
        </header>
      )}
      <div className="page-body">{children}</div>
      {footer && <footer className="page-foot">{footer}</footer>}
    </div>
  );
}
