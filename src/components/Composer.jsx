import React, { useEffect, useRef } from 'react';
import { Icon, CIcon } from '../icons.jsx';
import { STYLES } from '../lib/ai.js';
import { ENGINES, engineUrl } from '../lib/native.js';

export default function Composer({ t, query, setQuery, onSend, onStop, busy, inputRef, depth, setDepth, depthOpen, setDepthOpen, onVoice, listening, webSearch, onToggleWeb, deep, setDeep, style, setStyle, attachment, onAttach, onClearAttachment, onSaveAttachment, searchEngine = 'google', onOpenSearchPage, setSearchEngine = () => {}, onOpenSearch = () => {} }) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [sq, setSq] = React.useState('');
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const camRef = useRef(null), fileRef = useRef(null);
  const ta = inputRef;
  const menuRef = useRef(null);
  useEffect(() => { // auto-grow
    const el = ta.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [query, ta]);
  useEffect(() => {
    if (!toolsOpen && !searchOpen) return undefined;
    const h = (e) => { if (!menuRef.current?.contains(e.target)) { setToolsOpen(false); setSearchOpen(false); } };
    document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h);
  }, [toolsOpen, searchOpen]);
  const openSearch = () => { setToolsOpen(false); onOpenSearchPage?.(); };
  const goSearch = (e) => { e?.preventDefault(); onOpenSearch(engineUrl(searchEngine, (sq || query).trim() || 'nova'), searchEngine, (sq || query).trim()); setSearchOpen(false); };
  const pickFile = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { onAttach(f); setToolsOpen(false); } };
  const labels = { Quick: [t('quick'), t('quickD')], Normal: [t('normal'), t('normalD')], 'Deep Dive': [t('deep'), t('deepD')] };
  return (
    <form className={`composer ${listening ? 'listening' : ''}`} onSubmit={(e) => { e.preventDefault(); if (!busy) onSend(); }}>
      {(attachment || deep || style !== 'default') && (
        <div className="active-chips">
          {attachment && <span className="achip">{attachment.preview ? <img src={attachment.preview} alt="" /> : <Icon n="file" size={13} />}<b>{attachment.busy ? attachment.status || 'Reading…' : attachment.name}</b>
            {!attachment.busy && attachment.kind !== 'image' && attachment.text && <button type="button" onClick={onSaveAttachment} title="Save to My library">Save</button>}
            <button type="button" onClick={onClearAttachment} aria-label="Remove attachment"><Icon n="close" size={12} /></button></span>}
          {deep && <span className="achip"><Icon n="flask" size={13} /><b>Deep Research</b><button type="button" onClick={() => setDeep(false)} aria-label="Turn off Deep Research"><Icon n="close" size={12} /></button></span>}
          {style !== 'default' && <span className="achip"><Icon n="type" size={13} /><b>{STYLES[style][0]}</b><button type="button" onClick={() => setStyle('default')} aria-label="Reset style"><Icon n="close" size={12} /></button></span>}
        </div>
      )}
      <div className="c-row" ref={menuRef}>
        <div className="depth-wrap">
          <button type="button" className={`icon-btn ${toolsOpen || deep || attachment ? 'active' : ''}`} aria-haspopup="menu" aria-expanded={toolsOpen} onClick={() => { setSearchOpen(false); setToolsOpen(!toolsOpen); }} aria-label="Tools" title="Attach, depth, Deep Research, answer style"><Icon n="plus" size={19} /></button>
          {toolsOpen && (
            <div className="menu tools" role="menu">
              <button type="button" onClick={() => camRef.current?.click()}><span>Take a photo</span><small>Ask about what the camera sees</small><CIcon n="camera" size={30} /></button>
              <button type="button" onClick={() => fileRef.current?.click()}><span>Attach photo, PDF or file</span><small>Ask questions about it</small><CIcon n="clip" size={30} /></button>
              <button type="button" className={deep ? 'on' : ''} onClick={() => { setDeep(!deep); setToolsOpen(false); }}><span>Deep Research {deep ? '· on' : ''}</span><small>Several searches → one long, sourced report</small><CIcon n="flask" size={30} /></button>
              <button type="button" className={webSearch ? 'on' : ''} role="menuitemcheckbox" aria-checked={webSearch} onClick={onToggleWeb}><span>Knowledge sources {webSearch ? '· on' : '· off'}</span><small>Wikipedia, journals, news and the live web</small><CIcon n="globe" size={30} /></button>
              <div className="menu-label">Answer depth</div>
              {Object.keys(labels).map((k) => <button type="button" key={k} role="menuitemradio" aria-checked={depth === k} className={depth === k ? 'on' : ''} onClick={() => { setDepth(k); setToolsOpen(false); }}><span>{labels[k][0]}</span><small>{labels[k][1]}</small>{depth === k && <Icon n="check" size={14} />}</button>)}
              <div className="menu-label">Answer style</div>
              {Object.entries(STYLES).map(([k, [l]]) => <button type="button" key={k} role="menuitemradio" aria-checked={style === k} className={style === k ? 'on' : ''} onClick={() => { setStyle(k); setToolsOpen(false); }}><span>{l}</span>{style === k && <Icon n="check" size={14} />}</button>)}
            </div>
          )}
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.txt,.md,.csv,.json,.html" hidden onChange={pickFile} />
        </div>
        <textarea
          ref={ta} value={query} rows={1} placeholder={listening ? 'Listening… speak now' : t('placeholder')} aria-label={t('placeholder')} enterKeyHint="send" dir="auto"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) onSend(); } }}
        />
        <button type="button" className={`icon-btn ${listening ? 'rec' : ''}`} onClick={onVoice} aria-label="Voice input" aria-pressed={listening} title="Voice input"><Icon n="mic" /></button>
        <button type="button" className="icon-btn" onClick={openSearch} aria-label="Search the web" title="Search Google or DuckDuckGo"><Icon n="globe" /></button>
        {busy ? (
          <button type="button" className="send stop" onClick={onStop} aria-label={t('stop')}><Icon n="stop" size={14} fill /></button>
        ) : (
          <button type="submit" className="send" disabled={!query.trim() && !attachment?.text && !attachment?.image} aria-label={t('send')}><Icon n="send" /></button>
        )}
      </div>
    </form>
  );
}
