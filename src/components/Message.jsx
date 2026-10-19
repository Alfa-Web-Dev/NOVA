import React, { useMemo, useState } from 'react';
import { Icon, Logo } from '../icons.jsx';
import { renderMarkdown } from '../lib/markdown.js';
import { TimerCard, PrayerCard, NewsCard, PanchangCard, CricketCard } from './Cards.jsx';
import StudyCard from './Study.jsx';
import Sheet from './Sheet.jsx';
import { sourceCheck, checkLabel } from '../lib/factcheck.js';
import { engineUrl, ENGINES } from '../lib/native.js';

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function WeatherCard({ w }) {
  return (
    <div className="weather">
      <div className="w-now"><strong>{Math.round(w.now.temp)}°C</strong><span>{w.now.text}</span></div>
      <div className="w-meta"><b>{w.place}</b><span>Feels {Math.round(w.now.feels)}° · Humidity {w.now.humidity}% · Wind {w.now.wind} km/h</span></div>
      <div className="w-days">{w.days.map((d) => (
        <div key={d.date}><small>{new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })}</small><b>{Math.round(d.max)}°</b><small>{Math.round(d.min)}°</small></div>
      ))}</div>
      <a className="w-credit" href={w.url} target="_blank" rel="noopener noreferrer">Open-Meteo</a>
    </div>
  );
}

const TOPICS = { science: 'Science & Biology', math: 'Mathematics', history: 'History & Civics', current: 'Current information', compare: 'Comparison', code: 'Code & technology', general: 'General answer' };

function ConceptVisual({ id }) {
  if (id === 'photosynthesis') return (
    <section className="block concept"><h4>Photosynthesis at a glance</h4>
      <div className="flow">
        <div className="node sun">☀️<b>Sunlight</b><small>Energy</small></div><i>+</i>
        <div className="node">💧<b>Water + CO₂</b><small>Roots and air</small></div><i>→</i>
        <div className="node leaf">🌿<b>Glucose</b><small>Plant food</small></div><i>+</i>
        <div className="node">🫧<b>Oxygen</b><small>Released</small></div>
      </div></section>);
  if (id === 'water-cycle') return (
    <section className="block concept"><h4>The water cycle</h4>
      <div className="flow">
        <div className="node">🌊<b>Evaporation</b><small>Water → vapour</small></div><i>→</i>
        <div className="node">☁️<b>Condensation</b><small>Clouds form</small></div><i>→</i>
        <div className="node">🌧️<b>Precipitation</b><small>Rain, snow</small></div><i>→</i>
        <div className="node">🏞️<b>Collection</b><small>Rivers, soil</small></div>
      </div></section>);
  if (id === 'plant') return (
    <section className="block concept"><h4>Parts of a plant</h4>
      <div className="flow">
        <div className="node">🌸<b>Flower</b><small>Reproduction</small></div><i>·</i>
        <div className="node leaf">🍃<b>Leaves</b><small>Make food</small></div><i>·</i>
        <div className="node">🌱<b>Stem</b><small>Support</small></div><i>·</i>
        <div className="node">🪱<b>Roots</b><small>Absorb water</small></div>
      </div></section>);
  return null;
}

/** A website's own icon (Google's free favicon service); falls back to its first letter. */
function Favicon({ host: h }) {
  const [bad, setBad] = useState(false);
  return <i className="fav" title={h}>{bad ? h[0] : <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`} alt="" width="20" height="20" referrerPolicy="no-referrer" onError={() => setBad(true)} />}</i>;
}

export default function Message({ m, t, isLast, onPreview, onImage, onFollowup, onRegenerate, onCopy, onShare, onSpeak, speaking, followups, onPin, onRetryWith, engines = [], onGoogle, searchEngine = 'google' }) {
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState(null); // 'share' | 'engine'
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const html = useMemo(() => (m.role === 'assistant' ? renderMarkdown(m.text, m.sources?.length || 0) : ''), [m.text, m.sources, m.role]);
  if (m.role === 'user') return (
    <div className="msg user"><div className="bubble" dir="auto">
      {m.attachment && <span className="achip inbubble">{m.attachment.preview ? <img src={m.attachment.preview} alt="" /> : <Icon n="file" size={13} />}<b>{m.attachment.name}</b></span>}
      {m.text}</div></div>);

  const busy = ['searching', 'loading', 'generating'].includes(m.status);
  const srcs = (m.sources || []).filter((s) => s.kind !== 'weather');
  const shown = showAll ? srcs : srcs.slice(0, 4);
  const onClick = (e) => {
    const c = e.target.closest?.('.cite'); if (!c) return;
    const s = m.sources?.find((x) => x.n === +c.dataset.cite); if (s) onPreview(s);
  };
  return (
    <div className="msg assistant">
      <div className="avatar"><Logo size={26} /></div>
      <div className="body">
        {m.status === 'done' && m.topic && m.engine !== 'calculator' && <div className="topic"><Icon n="spark" size={12} /> NOVA · {TOPICS[m.topic] || 'Answer'}</div>}
        {m.plan?.length > 0 && <details className="plan"><summary>Researched {m.plan.length} angles</summary><ul>{m.plan.map((x) => <li key={x}>{x}</li>)}</ul></details>}
        {m.status === 'searching' && <div className="status"><span className="dots" />{m.step || t('searching')}</div>}
        {m.status === 'loading' && (
          <div className="status col"><span><span className="dots" />{t('loadingModel')}</span>
            <div className="bar"><i style={{ width: `${Math.round((m.progress || 0) * 100)}%` }} /></div>
            <small>{m.progressText}</small></div>
        )}
        {m.widgets?.map((w, i) => w.type === 'weather' ? <WeatherCard key={i} w={w} /> : w.type === 'timer' ? <TimerCard key={i} w={w} /> : w.type === 'prayer' ? <PrayerCard key={i} w={w} /> : w.type === 'news' ? <NewsCard key={i} w={w} onOpen={onPreview} /> : w.type === 'panchang' ? <PanchangCard key={i} w={w} /> : w.type === 'cricket' ? <CricketCard key={i} w={w} onOpen={onPreview} /> : null)}
        {m.text ? <div className="md" dir="auto" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} /> : m.status === 'generating' && <div className="status"><span className="dots" />{t('thinking')}</div>}
        {m.status === 'generating' && m.text && <span className="caret" />}
        {m.status === 'stopped' && <div className="note">{t('stopped')}</div>}
        {m.status === 'error' && <div className="note err">{m.error}</div>}
        {m.notice && <div className="note">{m.notice}</div>}

        {m.study && !busy && <StudyCard study={m.study} />}
        {m.visual && !busy && <ConceptVisual id={m.visual} />}
        {m.images?.length > 0 && (
          <section className="block"><h4>{t('images')}</h4>
            <div className="img-grid">{m.images.slice(0, 6).map((x, i) => (
              <button key={x.url + i} className="img-tile" onClick={() => (onImage ? onImage(m.images.slice(0, 6).map((y) => ({ src: y.image, title: y.title, page: y.url })), i) : onPreview(x))} title={x.title}><img src={x.image} alt={x.title} loading="lazy" referrerPolicy="no-referrer" /></button>
            ))}</div>
          </section>
        )}
        {m.videos?.length > 0 && (
          <section className="block"><h4>{t('videosH')}</h4>
            <div className="vid-strip">{m.videos.map((v) => (
              <button key={v.id} className="vid" onClick={() => onPreview({ kind: 'video', source: 'YouTube', ...v, snippet: [v.channel, v.views, v.published].filter(Boolean).join(' · ') })} title={v.title}>
                <span className="thumb"><img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /><em>{v.duration}</em><i><Icon n="play" size={16} fill /></i></span>
                <strong>{v.title}</strong><small>{v.channel}</small>
              </button>))}</div>
          </section>
        )}
        {m.video && (
          <a className="video-link" href={m.video} target="_blank" rel="noopener noreferrer"><Icon n="play" size={16} /> {t('videos')} <Icon n="external" size={13} /></a>
        )}
        {srcs.length > 0 && (() => {
          if (m.engine !== 'Sources') return null; // other engines: sources show as a favicon row under the actions
          const expanded = open || m.engine === 'Sources'; // when no AI wrote the answer, the sources are the answer
          const names = [...new Set(srcs.map((x) => x.source))];
          return (
            <section className="block">
              {m.engine === 'Sources' ? (
                <button className="src-toggle" disabled aria-expanded={expanded}>
                  <span>{t('sourcesUsed')} · {srcs.length}</span>
                </button>
              ) : (
                <button className="src-chip" onClick={() => setSheet(true)} aria-label={`${t('sourcesUsed')} ${srcs.length}`} title={`${t('sourcesUsed')} · ${srcs.length}`}>
                  <span className="stack">{names.slice(0, 3).map((n) => <i key={n}>{n[0]}</i>)}</span>
                  <b>{srcs.length}</b>
                </button>
              )}
              {sheet && m.engine !== 'Sources' && (
                <Sheet title={`${t('sourcesUsed')} · ${srcs.length}`} onClose={() => setSheet(false)}>
                  <div className="src-list sheet-list">{srcs.map((s) => (
                    <button key={s.url} className="src" onClick={() => onPreview(s)}>
                      <span className="n">{s.n}</span>
                      <span className="txt"><strong>{s.title}</strong><small>{s.source} · {s.via === 'google' ? s.title : host(s.url)}</small>{s.snippet && <em>{s.snippet.slice(0, 140)}</em>}</span>
                    </button>
                  ))}</div>
                  {m.stats && <p className="muted tiny">{m.stats.pagesRead > 0 ? `Read ${m.stats.pagesRead} web page${m.stats.pagesRead > 1 ? 's' : ''} (${m.stats.web.join(' + ')}) · ` : ''}{m.stats.answered} of {m.stats.queried} knowledge databases responded.</p>}
                </Sheet>
              )}
              {m.engine === 'Sources' && expanded && (<>
                <div className="src-list">{shown.map((s) => (
                  <button key={s.url} className="src" onClick={() => onPreview(s)}>
                    <span className="n">{s.n}</span>
                    <span className="txt"><strong>{s.title}</strong><small>{s.source} · {s.via === 'google' ? s.title : host(s.url)}</small></span>
                  </button>
                ))}</div>
                {srcs.length > 4 && <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? '−' : `+${srcs.length - 4}`}</button>}
                {m.stats && <p className="muted tiny">{m.stats.pagesRead > 0 ? `Read ${m.stats.pagesRead} web page${m.stats.pagesRead > 1 ? 's' : ''} (${m.stats.web.join(' + ')}) · ` : ''}{m.stats.answered} of {m.stats.queried} knowledge databases responded.</p>}
              </>)}
            </section>
          );
        })()}
        {!busy && m.text && m.status === 'done' && m.engine && !['calculator', 'Nova', 'Nova tools', 'Sources'].includes(m.engine) && (() => {
          const c = sourceCheck(m.text, m.sources || [], !!m.grounded);
          return <div className={`check ${c.level}`} title="Counts the independent websites whose sources this answer cites"><Icon n={c.level === 'none' ? 'info' : 'shield'} size={13} /> {checkLabel(c)}</div>;
        })()}
        {!busy && m.text && m.status === 'done' && m.query && m.engine !== 'calculator' && m.engine !== 'Nova' && (
          <div className="gsearch">
            {(m.googleQueries?.length ? m.googleQueries.slice(0, 3) : [m.query]).map((q) => (
              <button key={q} onClick={() => onGoogle(engineUrl(m.googleQueries?.length ? 'google' : searchEngine, q))}><span className={`g g-${m.googleQueries?.length ? 'google' : searchEngine}`}>{(m.googleQueries?.length ? 'Google' : (ENGINES[searchEngine] || ENGINES.google).label)[0]}</span> {m.googleQueries?.length ? q : `Search on ${(ENGINES[searchEngine] || ENGINES.google).label}`} <Icon n="external" size={12} /></button>))}
          </div>
        )}
        {!busy && m.text && (
          <div className="actions">
            <button onClick={() => onCopy(m.text)} title={t('copy')} aria-label={t('copy')}><Icon n="copy" size={17} /></button>
            <button onClick={() => onSpeak(m)} title={t('listen')} aria-label={t('listen')} className={speaking ? 'active' : ''}><Icon n="speaker" size={17} /></button>
            <button onClick={() => onPin(m)} title={m.pinned ? 'Saved' : 'Save answer'} aria-label="Save answer" className={m.pinned ? 'active' : ''}><Icon n="bookmark" size={17} fill={!!m.pinned} /></button>
            <span className="pop"><button onClick={() => setMenu(menu === 'share' ? null : 'share')} title={t('share')} aria-label={t('share')}><Icon n="share" size={17} /></button>
              {menu === 'share' && <div className="menu up" role="menu" onClick={() => setMenu(null)}><button onClick={() => onShare(m, 'text')}><span>Share as text</span></button><button onClick={() => onShare(m, 'card')}><span>Share as picture card</span></button><button onClick={() => onShare(m, 'pdf')}><span>Save as PDF</span></button></div>}</span>
            {isLast && <span className="pop"><button onClick={() => (engines.length > 1 ? setMenu(menu === 'engine' ? null : 'engine') : onRegenerate())} title={t('regenerate')} aria-label={t('regenerate')}><Icon n="refresh" size={15} /></button>
              {menu === 'engine' && <div className="menu up" role="menu" onClick={() => setMenu(null)}><button onClick={onRegenerate}><span>Regenerate</span><small>Same engine order</small></button><div className="menu-label">Try another engine</div>{engines.map((e) => <button key={e.key} onClick={() => onRetryWith(e.key)}><span>{e.label}</span></button>)}</div>}</span>}
          </div>
        )}
        {!busy && srcs.length > 0 && m.engine !== 'Sources' && (
          <>
            <button className="src-row" onClick={() => setSheet(true)} aria-label={`${t('sourcesUsed')} ${srcs.length}`}>
              <span className="favs">{[...new Set(srcs.map((x) => host(x.url)).filter(Boolean))].slice(0, 4).map((h) => <Favicon key={h} host={h} />)}</span>
              <span>Sources</span>
            </button>
            {sheet && (
              <Sheet title={`${t('sourcesUsed')} · ${srcs.length}`} onClose={() => setSheet(false)}>
                <div className="src-list sheet-list">{srcs.map((x) => (
                  <button key={x.url} className="src" onClick={() => onPreview(x)}>
                    <span className="n">{x.n}</span>
                    <span className="txt"><strong>{x.title}</strong><small>{x.source} · {x.via === 'google' ? x.title : host(x.url)}</small>{x.snippet && <em>{x.snippet.slice(0, 140)}</em>}</span>
                  </button>
                ))}</div>
                {m.stats && <p className="muted tiny">{m.stats.pagesRead > 0 ? `Read ${m.stats.pagesRead} web page${m.stats.pagesRead > 1 ? 's' : ''} (${m.stats.web.join(' + ')}) · ` : ''}{m.stats.answered} of {m.stats.queried} knowledge databases responded.</p>}
              </Sheet>
            )}
          </>
        )}
        
      </div>
    </div>
  );
}
