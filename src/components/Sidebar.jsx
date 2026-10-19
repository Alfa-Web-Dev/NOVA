import React, { useMemo, useState } from 'react';
import { Icon, Logo, CIcon } from '../icons.jsx';
import { initials } from '../lib/initials.js';

function group(chats, t) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const d0 = start.getTime(), d1 = d0 - 864e5;
  const g = { Pinned: [], [t('today')]: [], [t('yesterday')]: [], [t('earlier')]: [] };
  chats.forEach((c) => c.pinned ? g.Pinned.push(c) : g[c.updatedAt >= d0 ? t('today') : c.updatedAt >= d1 ? t('yesterday') : t('earlier')].push(c));
  return Object.entries(g).filter(([, v]) => v.length);
}

export default function Sidebar({ t, chats, activeId, onSelect, onNew, onDelete, onSettings, onSaved, onLibrary, onTools, avatar, onRename, onPin, onLibrary2, open, collapsed, onCollapse, onClose, canInstall, onInstall, offline, name = '', onQuick = () => {} }) {
  const [q, setQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [drag, setDrag] = useState(0);
  const tx = React.useRef(null);
  const [cm, setCm] = useState(null); // long-press menu {id, x, y}
  const lp = React.useRef(null);
  const startLp = (e, id) => { const x = e.clientX, y = e.clientY; clearTimeout(lp.current); lp.current = setTimeout(() => setCm({ id, x, y }), 480); };
  const endLp = () => clearTimeout(lp.current);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sorted = chats.filter((c) => !c.private).sort((a, b) => b.updatedAt - a.updatedAt);
    return s ? sorted.filter((c) => c.title.toLowerCase().includes(s) || c.messages.some((m) => m.text?.toLowerCase().includes(s))) : sorted;
  }, [chats, q]);
  const groups = useMemo(() => group(filtered, t), [filtered, t]);
  return (
    <>
      {open && <button className="scrim" onClick={onClose} aria-label="Close menu" />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`} aria-label="Sidebar"
        style={drag ? { transform: `translateX(${drag}px)`, transition: 'none' } : undefined}
        onTouchStart={(e) => { if (open) tx.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchMove={(e) => { const t0 = tx.current; if (!t0) return; const dx = e.touches[0].clientX - t0.x, dy = e.touches[0].clientY - t0.y; if (Math.abs(dx) > Math.abs(dy) && dx < 0) setDrag(dx); }}
        onTouchEnd={() => { tx.current = null; if (drag < -70) onClose(); setDrag(0); }}>
        <div className="side-top">
          <button className="brand" onClick={onNew} aria-label="Nova home"><Logo size={30} />{!collapsed && <span className="word">nova</span>}</button>
          {!collapsed && <button className={`round-btn sm ${showSearch ? 'on' : ''}`} onClick={() => setShowSearch(!showSearch)} aria-label="Search chats" aria-pressed={showSearch}><Icon n="search" size={17} /></button>}
          <button className="icon-btn hide-mobile" onClick={onCollapse} aria-label="Toggle sidebar"><Icon n="panel" size={18} /></button>
        </div>
        {!collapsed && showSearch && <label className="search-chats"><Icon n="search" size={15} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchChats')} aria-label={t('searchChats')} /></label>}
        <nav className="side-nav nav-grid" aria-label="Shortcuts">
          <button className="nav new-chat" onClick={onNew}><CIcon n="message" size={28} />{!collapsed && <span>{t('newChat')}</span>}</button>
          <button className="nav" onClick={onSaved}><CIcon n="bookmark" size={28} />{!collapsed && <span>Saved</span>}</button>
          <button className="nav" onClick={onLibrary}><CIcon n="book" size={28} />{!collapsed && <span>Library</span>}</button>
          <button className="nav" onClick={() => onQuick('briefing')}><CIcon n="sun" size={28} />{!collapsed && <span>Briefing</span>}</button>
          <button className="nav" onClick={() => onQuick('study')}><CIcon n="lightbulb" size={28} />{!collapsed && <span>Study</span>}</button>
          <button className="nav" onClick={onTools}><CIcon n="sliders" size={28} />{!collapsed && <span>Tools</span>}</button>
        </nav>
        {!collapsed && (
          <nav className="chat-list" aria-label="Chats">
            {groups.length === 0 && <p className="empty">{q ? t('noMatch') : t('noChats')}</p>}
            {groups.map(([label, list]) => (
              <div key={label}>
                <div className="group-label">{label}</div>
                {list.map((c) => (
                  <div key={c.id} className={`row ${c.id === activeId ? 'active' : ''}`}>
                    <button className="main" onClick={() => { if (!cm) onSelect(c.id); }} title={c.title}
                      onPointerDown={(e) => startLp(e, c.id)} onPointerUp={endLp} onPointerLeave={endLp} onPointerCancel={endLp} onPointerMove={(e) => { if (Math.abs(e.movementY) > 3) endLp(); }}
                      onContextMenu={(e) => { e.preventDefault(); setCm({ id: c.id, x: e.clientX, y: e.clientY }); }}>
                      <span>{c.pinned ? '📌 ' : ''}{c.title}</span></button>
                  </div>
                ))}
              </div>
            ))}
          </nav>
        )}
        <div className="side-bottom">
          {offline && !collapsed && <div className="pill warn"><Icon n="wifioff" size={13} /> {t('offline')}</div>}
          {canInstall && <button className="nav" onClick={onInstall}><Icon n="download" size={17} />{!collapsed && <span>{t('install')}</span>}</button>}
          <div className="side-foot">
            <button className="profile-pill" onClick={onSettings} aria-label={t('settings')} title={t('settings')}><span className="avatar-lg sm">{avatar ? <img src={avatar} alt="" /> : initials(name)}</span>{!collapsed && <span className="pn">{name || 'Nova user'}<small>{t('settings')}</small></span>}{!collapsed && <Icon n="chevronr" size={16} />}</button>
            {!collapsed && <button className="fab-chat" onClick={onNew}><Icon n="plus" size={17} /> Chat</button>}
          </div>
        </div>
      {cm && (() => { const c = chats.find((x) => x.id === cm.id); if (!c) return null; const close = () => setCm(null);
        return (<>
          <button className="cm-scrim" onClick={close} aria-label="Close menu" />
          <div className="cm" role="menu" style={{ top: Math.min(cm.y, window.innerHeight - 250), left: Math.min(Math.max(cm.x, 12), window.innerWidth - 232) }}>
            <button onClick={() => { close(); onRename(c); }}><CIcon n="cm-rename" size={24} />Rename</button>
            <button onClick={() => { close(); onPin(c); }}><CIcon n="cm-pin" size={24} />{c.pinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => { close(); onLibrary2(c); }}><CIcon n="cm-library" size={24} />Add to library</button>
            <button className="danger" onClick={() => { close(); onDelete(c.id); }}><CIcon n="cm-delete" size={24} />Delete</button>
          </div></>); })()}
      </aside>
    </>
  );
}
