import React, { useEffect, useState } from 'react';
import { Icon, CIcon } from '../icons.jsx';
import { ACCENTS, accentById } from '../lib/theme.js';
import { ENGINES } from '../lib/native.js';
import { PROVIDERS, IMAGE_PROVIDERS } from '../lib/providers.js';
import { LANGS, LOCAL_MODELS, ONLINE_DEFAULT, PRESETS, hasWebGPU, isModelDownloaded, loadLocalModel, removeLocalModel, testProvider } from '../lib/ai.js';
import { isNative, canReadWeb } from '../lib/http.js';
import { useBackClose } from '../lib/backstack.js';
import { initials } from '../lib/initials.js';
import Sheet from './Sheet.jsx';
function SubBack({ fn }) { useBackClose(fn); return null; }

const MODES = [
  ['auto', 'Auto (recommended)', 'Your free keys → on-device → free online → sources, with automatic fallback'],
  ['local', 'On-device', 'Private. Runs a small open model in your browser (WebGPU)'],
  ['online', 'Free online', 'No key needed. Questions are sent to a free third-party service'],
  ['custom', 'My free API keys', 'Gemini / Groq / OpenRouter free keys (best quality) — add them below'],
  ['sources', 'Sources only', 'No AI. Cited summary built from public sources'],
];

export default function Settings({ s, set, t, onClose, onExport, onImport, onClear, onWipe }) {
  useBackClose(onClose);
  const [editing, setEditing] = useState(false);
  const [dName, setDName] = useState(''), [dAvatar, setDAvatar] = useState('');
  const openEdit = () => { setDName(s.name || ''); setDAvatar(s.avatar || ''); setEditing(true); };
  const pickPhoto = (e) => { // gallery photo, shrunk to 256px; kept on this device
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      const k = Math.max(256 / img.width, 256 / img.height), w = img.width * k, h = img.height * k;
      g.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h); URL.revokeObjectURL(url); setDAvatar(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => URL.revokeObjectURL(url); img.src = url;
  };
  const [tab, setTab] = useState(null); // null = the settings menu; otherwise the open page
  const [dl, setDl] = useState({}); // id -> {state:'idle'|'busy'|'done', p:0}
  const gpu = hasWebGPU();

  useEffect(() => { const h = (e) => e.key === 'Escape' && (tab ? setTab(null) : onClose()); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose, tab]);
  useEffect(() => {
    let live = true;
    (async () => {
      const out = {};
      for (const m of LOCAL_MODELS) out[m.id] = { state: (await isModelDownloaded(m.id)) ? 'done' : 'idle', p: 0 };
      if (live) setDl(out);
    })();
    return () => { live = false; };
  }, []);

  async function download(id) {
    setDl((d) => ({ ...d, [id]: { state: 'busy', p: 0 } }));
    try {
      await loadLocalModel(id, (p) => setDl((d) => ({ ...d, [id]: { state: 'busy', p } })));
      setDl((d) => ({ ...d, [id]: { state: 'done', p: 1 } }));
      set({ localModel: id, aiMode: s.aiMode === 'sources' ? 'auto' : s.aiMode });
    } catch (e) {
      setDl((d) => ({ ...d, [id]: { state: 'idle', p: 0, err: String(e?.message || e).slice(0, 140) } }));
    }
  }
  async function remove(id) { try { await removeLocalModel(id); } catch { /* ignore */ } setDl((d) => ({ ...d, [id]: { state: 'idle', p: 0 } })); }

  const all = [...PROVIDERS, ...IMAGE_PROVIDERS];
  const groups = [...new Set(all.map((p) => p.group))];
  const toggleSrc = (id) => set({ disabledSources: s.disabledSources.includes(id) ? s.disabledSources.filter((x) => x !== id) : [...s.disabledSources, id] });
  const acc = accentById(s.accent);
  const HUB = [
    [null, [['appearance', 'moon', 'Appearance', `${acc.name} · ${s.theme === 'system' ? 'Auto' : s.theme === 'dark' ? 'Dark' : 'Light'}`], ['general', 'profile', 'General', (s.name || 'Profile').slice(0, 18)]]],
    ['Intelligence', [['ai', 'sparkle', 'AI engine', s.aiMode === 'auto' ? 'Auto' : s.aiMode], ['sources', 'globe', 'Sources', `${all.length} databases`], ['search', 'search', 'Search engine', (ENGINES[s.searchEngine] || ENGINES.google).label]]],
    ['Your data', [['data', 'file', 'Data & privacy', 'Backup & erase'], ['about', 'info', 'About Nova', 'v1.5']]],
  ];
  const titleOf = Object.fromEntries(HUB.flatMap(([, items]) => items.map(([k, , l]) => [k, l])));
  const initial = initials(s.name);
  return (
    <div className="spage" role="dialog" aria-modal="true" aria-label={t('settings')}>
        {editing && (
        <Sheet top title="Edit profile" onClose={() => setEditing(false)}>
          <div className="pe">
            <label className="avatar-edit big" title="Change photo"><span className="avatar-lg">{dAvatar ? <img src={dAvatar} alt="" /> : initials(dName)}</span><i><Icon n="camera" size={18} /></i><input type="file" accept="image/*" hidden onChange={pickPhoto} /></label>
            {dAvatar && <button className="link" onClick={() => setDAvatar('')}>Remove photo</button>}
            <label className="pe-field"><span>Name</span><input value={dName} maxLength={40} onChange={(e) => setDName(e.target.value)} placeholder="Your name" /></label>
            <button className="btn primary pe-save" onClick={() => { set({ name: dName.trim(), avatar: dAvatar }); setEditing(false); }}>Save profile</button>
            <button className="btn pe-cancel" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </Sheet>
      )}

      <div className="spage-in">
        <header className="sp-head">
          <button className="round-btn" onClick={() => (tab ? setTab(null) : onClose())} aria-label="Back"><Icon n="back" size={20} /></button>
          {tab && <h2>{titleOf[tab]}</h2>}
        </header>
        {!tab && (
          <div className="hub">
            <div className="sp-profile"><button className="avatar-edit" onClick={openEdit} aria-label="Edit profile"><span className="avatar-lg">{s.avatar ? <img src={s.avatar} alt="" /> : initial}</span><i><Icon n="pencil" size={16} /></i></button><b>{s.name || 'Nova user'}</b><small>Everything is stored only on this device</small></div>
            {HUB.map(([title, items], gi) => (
              <section key={gi}>
                {title && <h3 className="hub-title">{title}</h3>}
                <div className="hub-card">{items.map(([k, ic, label, val]) => (
                  <button key={k} className="hub-row" onClick={() => setTab(k)}>
                    <CIcon n={ic} size={40} className="hub-ic" />
                    <span className="hub-l">{label}</span>
                    <small className="hub-v">{k === 'appearance' && <i className="dot" style={{ background: s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? acc.dark : acc.light }} />}{val}</small>
                    <Icon n="chevronr" size={16} className="hub-chev" />
                  </button>))}</div>
              </section>))}
          </div>
        )}
        {tab && <SubBack key={tab} fn={() => setTab(null)} />}
        {tab && <div className="pane">
          {tab === 'appearance' && (<>
            <Row label="Theme"><Seg value={s.theme} onChange={(v) => set({ theme: v })} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} /></Row>
            <div className="srow col"><div><b>Accent colour</b><small>Changes the whole app — buttons, menus, highlights and the Nova logo.</small></div>
              <div className="swatches" role="radiogroup" aria-label="Accent colour">{ACCENTS.map((a) => (
                <button key={a.id} role="radio" aria-checked={s.accent === a.id} aria-label={a.name} title={a.name} className={`sw ${s.accent === a.id ? 'on' : ''}`} style={{ '--c': a.dark, '--c2': a.light }} onClick={() => set({ accent: a.id })}>
                  <i />{s.accent === a.id && <Icon n="check" size={14} />}<small>{a.name}</small>
                </button>))}</div></div>
            <Row label="App language"><Seg value={s.uiLang} onChange={(v) => set({ uiLang: v })} options={[['en', 'English'], ['hi', 'हिन्दी']]} /></Row>
          </>)}

          {tab === 'search' && (<>
            <div className="callout"><Icon n="globe" size={16} /> The globe button in the chat bar opens real search results from the engine you choose here.</div>
            <div className="srow col"><div><b>Preferred search engine</b><small>Used by the globe button and the “Search on …” button under answers.</small></div>
              <div className="eng-row big" role="radiogroup">{Object.entries(ENGINES).map(([k, e]) => <button key={k} role="radio" aria-checked={s.searchEngine === k} className={s.searchEngine === k ? 'on' : ''} onClick={() => set({ searchEngine: k })}>{e.label}</button>)}</div></div>
            <p className="muted">In the Android app these pages open in a built-in browser window inside Nova (with a close button back to the app). In a normal web browser they open in a new tab, because Google, DuckDuckGo and Bing do not allow themselves to be embedded in other pages.</p>
            <Row label="Search the live web for answers" hint="Nova's own answers use DuckDuckGo and Bing results it reads itself (Android app)."><Toggle on={s.liveWeb} onChange={(v) => set({ liveWeb: v })} /></Row>
          </>)}

          {tab === 'general' && (<>
            <Row label="Your name" hint="Optional. Stored only on this device.">
              <input className="field" value={s.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Aisha" />
            </Row>
            <Row label="Answer language" hint="Nova replies in this language (AI modes) and prefers its Wikipedia.">
              <select className="field" value={s.answerLang} onChange={(e) => set({ answerLang: e.target.value })}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Row>
            <Row label="Your city" hint="Used for the daily briefing weather and prayer times. Stays on this device."><input className="field" value={s.city} maxLength={60} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Delhi" /></Row>
            <Row label="Read answers aloud automatically" hint="Uses your phone's text-to-speech (Hindi supported if the voice is installed)."><Toggle on={!!s.autoSpeak} onChange={(v) => set({ autoSpeak: v })} /></Row>
            <Row label="Default answer depth"><Seg value={s.depth} onChange={(v) => set({ depth: v })} options={[['Quick', t('quick')], ['Normal', t('normal')], ['Deep Dive', t('deep')]]} /></Row>
          </>)}

          {tab === 'ai' && (<>
            <div className="callout"><Icon n="shield" size={16} /> Everything here is free. No account, no subscription, no paid API.</div>
            <div className="modes">{MODES.map(([k, l, d]) => (
              <label key={k} className={`mode ${s.aiMode === k ? 'on' : ''}`}>
                <input type="radio" name="mode" checked={s.aiMode === k} onChange={() => set({ aiMode: k, ...(k === 'online' || k === 'auto' ? {} : {}) })} />
                <span><b>{l}</b><small>{d}</small></span>
              </label>))}
            </div>

            <h3>On-device model {gpu ? <span className="pill ok">WebGPU ready</span> : <span className="pill warn">WebGPU not available</span>}</h3>
            {!gpu && <p className="muted">This browser/device doesn't expose WebGPU (common in some Android WebViews and older browsers). Use Chrome/Edge 113+ on a recent device, or choose Free online / Sources only.</p>}
            <div className="models">{LOCAL_MODELS.map((m) => {
              const d = dl[m.id] || { state: 'idle', p: 0 };
              return (
                <div key={m.id} className={`model ${s.localModel === m.id ? 'sel' : ''}`}>
                  <div><b>{m.label}</b> <small>{m.size}</small><small className="muted">{m.note}</small>{d.err && <small className="err">Failed: {d.err}</small>}</div>
                  {d.state === 'busy' ? <div className="bar sm"><i style={{ width: `${Math.round(d.p * 100)}%` }} /></div>
                    : d.state === 'done' ? <div className="row-btns"><button className="btn" onClick={() => set({ localModel: m.id })} disabled={s.localModel === m.id}>{s.localModel === m.id ? 'In use' : 'Use'}</button><button className="icon-btn" onClick={() => remove(m.id)} aria-label="Remove model"><Icon n="trash" size={15} /></button></div>
                      : <button className="btn" onClick={() => download(m.id)} disabled={!gpu}><Icon n="download" size={14} /> Download</button>}
                </div>);
            })}</div>
            <p className="muted">Models are downloaded once from the open MLC/Hugging Face hosting and cached in your browser. After that they run fully offline.</p>

            <h3>Free online AI</h3>
            <Row label="Allow free online AI" hint="Sends your question and a few source snippets to the provider below. Don't enter private information.">
              <Toggle on={!!s.onlineConsent} onChange={(v) => set({ onlineConsent: v })} />
            </Row>
            <Row label="Provider"><input className="field" value={ONLINE_DEFAULT.endpoint} readOnly /></Row>
            <p className="muted">Pollinations is a free community service; availability and policies can change. If it is down, Nova falls back to a source summary automatically.</p>

            <h3>Free API keys — best answers (1 minute each)</h3>
            <Row label="Use Google Search with my Gemini key" hint="Gemini searches Google itself and returns the sources it used. Uses your free Gemini quota; if the quota is used up Nova continues without it."><Toggle on={!!s.googleGrounding} onChange={(v) => set({ googleGrounding: v })} /></Row>
            <p className="muted">Create a free key, paste it here. It is stored only on this device and sent only to that provider. Each person uses their own free quota, so Nova never runs out for everyone at once. Add more than one: if a provider is busy, Nova automatically tries the next.</p>
            {Object.entries(PRESETS).map(([id, pr]) => <ProviderCard key={id} id={id} pr={pr} cfg={s.providers?.[id] || {}} onChange={(cfg) => set({ providers: { ...(s.providers || {}), [id]: cfg } })} />)}
          </>)}

          {tab === 'sources' && (<>
            <div className="callout"><Icon n="globe" size={16} /> {all.length} free, key-less databases. Nova picks the relevant ones for each question; switch any off here.</div>
            <h3>Live web {canReadWeb() ? <span className="pill ok">{isNative() ? 'Android app: on' : 'Dev proxy: on'}</span> : <span className="pill warn">needs the Android app</span>}</h3>
            <Row label="Search the live web & read pages" hint={canReadWeb() ? 'DuckDuckGo + Bing results; Nova opens the top pages and reads them to answer. Videos from YouTube search.' : 'In a normal browser, sites block direct reading (CORS). Install the Nova Android app for full live web search.'}><Toggle on={s.liveWeb} onChange={(v) => set({ liveWeb: v })} /></Row>
            <Row label="Brave Search key (optional)" hint="Free tier at brave.com/search/api — adds a 3rd search engine."><input className="field" type="password" autoComplete="off" value={s.braveKey} onChange={(e) => set({ braveKey: e.target.value.trim() })} placeholder="optional" /></Row>
            <Row label="Tavily key (optional)" hint="Free monthly credits at tavily.com — AI-oriented search + images."><input className="field" type="password" autoComplete="off" value={s.tavilyKey} onChange={(e) => set({ tavilyKey: e.target.value.trim() })} placeholder="optional" /></Row>
            <h3>Knowledge databases</h3>
            <Row label="Show related images" hint="Wikimedia Commons, Openverse and NASA pictures next to answers."><Toggle on={s.showImages} onChange={(v) => set({ showImages: v })} /></Row>
            {groups.map((g) => (
              <div key={g}><div className="srcs-group">{g}</div>
                <div className="src-toggles">{all.filter((p) => p.group === g).map((p) => (
                  <label key={p.id}><input type="checkbox" checked={!s.disabledSources.includes(p.id)} onChange={() => toggleSrc(p.id)} />{p.label}</label>))}</div></div>))}
            <p className="muted">Quick uses the core sources, Normal adds topic-specific ones, Deep Dive queries everything relevant. Each database has its own rate limits; failures are skipped silently.</p>
          </>)}

          {tab === 'data' && (<>
            <Row label="Use public web sources" hint="Wikipedia and sister projects, DuckDuckGo, OpenAlex, PubMed, Crossref, arXiv, Stack Overflow, Open Library, GDELT news, NASA, Open-Meteo and more (see Sources tab). Your question is sent to these free APIs."><Toggle on={s.webSearch} onChange={(v) => set({ webSearch: v })} /></Row>
            <Row label="Backup & restore" hint="Chats are stored only on this device.">
              <div className="row-btns"><button className="btn" onClick={onExport}>Export</button><label className="btn file">Import<input type="file" accept="application/json,.json" onChange={onImport} /></label></div>
            </Row>
            <Row label="Search My library in answers" hint="Your notes, PDFs and photos (Library) are used as private sources."><Toggle on={!!s.useLibrary} onChange={(v) => set({ useLibrary: v })} /></Row>
            <Row label="Delete all chats"><button className="btn danger" onClick={onClear}>Delete…</button></Row>
            <Row label="Erase everything" hint="Chats, library, saved answers, settings and API keys on this device."><button className="btn danger" onClick={onWipe}>Erase…</button></Row>
            <p className="muted">Nova has no accounts, analytics or tracking. Avoid saving sensitive information on shared devices.</p>
          </>)}

          {tab === 'about' && (<>
            <p><b>Nova</b> v1.5 — free & open source (MIT). Built with React, Vite and WebLLM.</p>
            <p className="muted">Answers can be wrong. Small on-device models are less capable than large cloud models; always check the cited sources for important decisions.</p>
          </>)}
        </div>}
      </div>
    </div>
  );
}

const Row = ({ label, hint, children }) => (<div className="srow"><div><b>{label}</b>{hint && <small>{hint}</small>}</div><div className="ctl">{children}</div></div>);
const Seg = ({ value, onChange, options }) => (<div className="seg" role="radiogroup">{options.map(([k, l]) => <button key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>);
const Toggle = ({ on, onChange }) => (<button role="switch" aria-checked={on} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><i /></button>);

function ProviderCard({ id, pr, cfg, onChange }) {
  const [st, setSt] = useState(null);
  const custom = id === 'custom';
  const test = async () => {
    setSt({ busy: true });
    try { const r = await testProvider({ endpoint: cfg.endpoint || pr.endpoint, model: cfg.model || pr.model, key: cfg.key }); setSt({ ok: true, msg: `Working — replied “${r}”` }); }
    catch (e) { setSt({ ok: false, msg: String(e?.message || e).slice(0, 100) }); }
  };
  return (
    <div className="pcard">
      <div className="ph"><b>{pr.label}</b>{pr.url && <a href={pr.url} target="_blank" rel="noopener noreferrer">Get free key ↗</a>}</div>
      <small className="muted">{pr.note}</small>
      {custom && <input className="field" placeholder="Base URL, e.g. http://192.168.1.5:11434/v1" value={cfg.endpoint || ''} onChange={(e) => onChange({ ...cfg, endpoint: e.target.value.trim() })} />}
      <input className="field" type="password" autoComplete="off" placeholder={custom ? 'API key (optional)' : 'Paste API key'} value={cfg.key || ''} onChange={(e) => onChange({ ...cfg, key: e.target.value.trim() })} />
      <input className="field" placeholder={`Model${pr.model ? ` (default ${pr.model})` : ''}`} value={cfg.model || ''} onChange={(e) => onChange({ ...cfg, model: e.target.value.trim() })} />
      <div className="row-btns"><button className="btn" onClick={test} disabled={st?.busy || (!cfg.key && !(custom && cfg.endpoint))}>{st?.busy ? 'Testing…' : 'Test'}</button>{st?.msg && <small className={st.ok ? 'ok-t' : 'err'}>{st.msg}</small>}</div>
    </div>
  );
}
