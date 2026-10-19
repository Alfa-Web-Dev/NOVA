import React, { useEffect, useState } from 'react';
import { Icon } from '../icons.jsx';
import Page from './Page.jsx';
import { addDoc, listLibrary, removeDoc } from '../lib/library.js';
import { extractFile } from '../lib/files.js';


/** Pinned answers across all chats, organised into collections. */
export function SavedPanel({ chats, onOpen, onUnpin, onClose, collections = [], onAddCollection = () => {}, onMove = () => {} }) {
  const [sel, setSel] = useState('all'); const [adding, setAdding] = useState(false); const [name, setName] = useState('');
  const all = chats.flatMap((c) => c.messages.map((m, i) => ({ c, m, i }))).filter(({ m }) => m.pinned).sort((a, b) => (b.m.ts || 0) - (a.m.ts || 0));
  const cols = [...new Set([...collections, ...all.map(({ m }) => m.collection).filter(Boolean)])];
  const items = sel === 'all' ? all : sel === 'none' ? all.filter(({ m }) => !m.collection) : all.filter(({ m }) => m.collection === sel);
  const create = () => { const n = name.trim().slice(0, 24); if (n) { onAddCollection(n); setSel(n); } setName(''); setAdding(false); };
  return (
    <Page title="Saved answers" onClose={onClose}>
      <div className="page-pad">
        <div className="eng-row cols" role="tablist" aria-label="Collections">
          {[['all', `All (${all.length})`], ...cols.map((c) => [c, c]), ...(all.some(({ m }) => !m.collection) && cols.length ? [['none', 'Unsorted']] : [])].map(([k, l]) => <button key={k} role="tab" aria-selected={sel === k} className={sel === k ? 'on' : ''} onClick={() => setSel(k)}>{l}</button>)}
          {adding ? <span className="newcol"><input autoFocus value={name} maxLength={24} placeholder="Collection name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} aria-label="New collection name" /><button type="button" onClick={create}>Add</button></span>
            : <button className="plus" onClick={() => setAdding(true)} aria-label="New collection"><Icon n="plus" size={14} /> New</button>}
        </div>
        {!items.length && <p className="muted">{all.length ? 'Nothing in this collection yet. Use the menu on an answer to move it here.' : 'Tap the bookmark under any answer to keep it here.'}</p>}
        <div className="plist">{items.map(({ c, m, i }) => (
          <div key={m.id} className="pitem">
            <button className="grow" onClick={() => onOpen(c.id)}><b>{c.messages[i - 1]?.text || m.query || c.title}</b><small>{(m.text || '').replace(/[#*_`>[\]]/g, '').slice(0, 140)}…</small></button>
            {cols.length > 0 && <select className="move" aria-label="Move to collection" value={m.collection || ''} onChange={(e) => onMove(c.id, m.id, e.target.value)}><option value="">Unsorted</option>{cols.map((x) => <option key={x} value={x}>{x}</option>)}</select>}
            <button className="icon-btn" onClick={() => onUnpin(c.id, m.id)} aria-label="Remove from saved"><Icon n="trash" size={15} /></button>
          </div>))}</div>
      </div>
    </Page>
  );
}

/** Notes and files stored on this device; Nova searches them when you ask a question. */
export function LibraryPanel({ onClose, vision, langs, notify }) {
  const [docs, setDocs] = useState([]); const [busy, setBusy] = useState(''); const [title, setTitle] = useState(''); const [note, setNote] = useState('');
  const refresh = async () => setDocs(await listLibrary());
  useEffect(() => { refresh(); }, []);
  const addFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { setBusy('Reading…'); const x = await extractFile(f, { vision: false, langs, onStatus: setBusy }); await addDoc({ name: x.name, text: x.text, kind: x.kind }); notify(`Added ${x.name}`); }
    catch (err) { notify(err?.message === 'Nothing to save' ? 'No readable text found in that file.' : 'Could not read that file.'); }
    setBusy(''); refresh();
  };
  const saveNote = async () => { if (!note.trim()) return; await addDoc({ name: title.trim() || note.trim().slice(0, 30), text: note, kind: 'note' }); setTitle(''); setNote(''); refresh(); notify('Note saved'); };
  return (
    <Page title="My library" onClose={onClose}>
      <div className="page-pad">
        <span className="tag">Private · stays on this device</span>
        <p className="muted">Add notes, PDFs, photos of pages or text files. When you ask a question, Nova searches them first and cites them as sources.</p>
        <div className="row-btns"><label className="btn file"><Icon n="file" size={14} /> {busy || 'Add PDF / file / photo'}<input type="file" accept="image/*,application/pdf,.txt,.md,.csv,.json,.html" onChange={addFile} disabled={!!busy} /></label></div>
        <input className="field" placeholder="Note title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <textarea className="field" rows={3} placeholder="Write or paste a note…" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row-btns"><button className="btn primary" onClick={saveNote} disabled={!note.trim()}>Save note</button></div>
        <div className="plist">{docs.map((d) => (
          <div key={d.id} className="pitem"><div className="grow"><b>{d.name}</b><small>{d.kind} · {Math.max(1, Math.round(d.chars / 1000))}k characters · {new Date(d.addedAt).toLocaleDateString()}</small></div>
            <button className="icon-btn" onClick={async () => { await removeDoc(d.id); refresh(); }} aria-label={`Delete ${d.name}`}><Icon n="trash" size={15} /></button></div>))}
        {!docs.length && <p className="muted">Nothing here yet.</p>}</div>
      </div>
    </Page>
  );
}
