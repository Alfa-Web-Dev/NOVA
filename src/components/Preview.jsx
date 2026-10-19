import React, { useState } from 'react';
import { Icon } from '../icons.jsx';
import Page from './Page.jsx';

export default function Preview({ item, t, onClose, onImage }) {
  const [reader, setReader] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isVideo = item.kind === 'video';
  const canEmbed = !isVideo && item.kind !== 'image' && /^https:/.test(item.url || '');
  return (
    <Page title={item.source || 'Source'} onClose={onClose} className={reader ? 'reader' : ''}
      footer={<>
          {reader && <span className="muted">Blank? This site blocks embedding.</span>}
          {canEmbed && <button className="btn" onClick={() => { setReader(!reader); setLoaded(false); }}>{reader ? 'Back to summary' : 'Read in Nova'}</button>}
          {/^https?:/.test(item.url || '') && <a className="btn primary" href={item.url} target="_blank" rel="noopener noreferrer">{t('openOriginal')} <Icon n="external" size={14} /></a>}
      </>}>
      <div className="page-pad prev">
        <h2 className="prev-title">{item.title}</h2>
        {isVideo && (
          <div className="vid-frame"><iframe title={item.title} src={`https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" /></div>
        )}
        {!reader && !isVideo && (item.image || item.thumb) && <img className="prev-img" src={item.image || item.thumb} alt={item.title} referrerPolicy="no-referrer" onClick={() => onImage?.([{ src: item.image || item.thumb, title: item.title, page: item.url }], 0)} />}
        {!reader && item.snippet && <p className="prev-text" dir="auto">{item.snippet}</p>}
        {reader && (
          <div className="frame-wrap">
            {!loaded && <p className="muted center"><span className="dots" /> Loading source…</p>}
            {/* Sandboxed without same-origin: the page cannot read Nova's data. Many sites forbid embedding; use the button below if blank. */}
            <iframe title={item.title} src={item.url} referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms allow-popups" onLoad={() => setLoaded(true)} />
          </div>
        )}
      </div>
    </Page>
  );
}
