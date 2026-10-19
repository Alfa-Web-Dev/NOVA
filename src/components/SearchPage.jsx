import React, { useState } from 'react';
import Page from './Page.jsx';
import { ENGINES, engineUrl } from '../lib/native.js';

export default function SearchPage({ initial = '', engine, setEngine, onSearch, onClose }) {
  const [q, setQ] = useState(initial);
  const go = (e) => { e?.preventDefault(); const s = q.trim() || 'nova'; onSearch(engineUrl(engine, s), engine, q.trim()); };
  return (
    <Page title="Search the web" onClose={onClose}>
      <form className="spg" onSubmit={go}>
        <div className="menu-label">Search with</div>
        <div className="eng-row" role="radiogroup">{Object.entries(ENGINES).map(([k, e]) => <button type="button" key={k} role="radio" aria-checked={engine === k} className={engine === k ? 'on' : ''} onClick={() => setEngine(k)}>{e.label}</button>)}</div>
        <div className="ss-input"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${(ENGINES[engine] || ENGINES.google).label}…`} aria-label="Search the web" />
          <button type="submit" className="btn primary">Search</button></div>
        <small className="muted">Opens real {(ENGINES[engine] || ENGINES.google).label} results inside Nova. Your choice is remembered.</small>
      </form>
    </Page>
  );
}
