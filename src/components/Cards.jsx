import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons.jsx';

const pad = (n) => String(n).padStart(2, '0');
const beep = () => {
  try {
    const A = window.AudioContext || window.webkitAudioContext; const c = new A(); const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.4, c.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2); o.start(); o.stop(c.currentTime + 1.3);
  } catch { /* no audio */ }
  try { navigator.vibrate?.([300, 120, 300, 120, 500]); } catch { /* ignore */ }
};

export function TimerCard({ w }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((w.endsAt - Date.now()) / 1000)));
  const [stopped, setStopped] = useState(false);
  const rang = useRef(false);
  useEffect(() => {
    if (stopped) return undefined;
    const id = setInterval(() => setLeft(Math.max(0, Math.round((w.endsAt - Date.now()) / 1000))), 250);
    return () => clearInterval(id);
  }, [w.endsAt, stopped]);
  useEffect(() => {
    if (left === 0 && !rang.current && !stopped && Date.now() - w.endsAt < 60000) { rang.current = true; beep(); try { if (Notification?.permission === 'granted') new Notification('Nova timer', { body: 'Time is up!' }); } catch { /* ignore */ } }
  }, [left, stopped, w.endsAt]);
  useEffect(() => { try { if (Notification?.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ } }, []);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  const pct = Math.max(0, Math.min(1, left / w.seconds));
  return (
    <div className="wcard timer">
      <div className="ring" style={{ '--p': `${pct * 360}deg` }}><b>{h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}</b></div>
      <div><strong>{left === 0 ? 'Time is up!' : 'Timer running'}</strong><small>{left === 0 ? 'Tap to dismiss' : 'Keep Nova open — timers pause when the app is closed.'}</small></div>
      <button className="btn" onClick={() => { setStopped(true); setLeft(0); }}>{left === 0 ? 'OK' : 'Cancel'}</button>
    </div>
  );
}

export function PrayerCard({ w }) {
  return (
    <div className="wcard">
      <div className="wc-head"><Icon n="spark" size={14} /><b>Prayer times · {w.place}</b><small>{w.date}</small></div>
      <div className="times">{Object.entries(w.times).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
      <a className="w-credit" href={w.url} target="_blank" rel="noopener noreferrer">Aladhan</a>
    </div>
  );
}

export function NewsCard({ w, onOpen }) {
  return (
    <div className="wcard news">
      <div className="wc-head"><Icon n="globe" size={14} /><b>{w.topic ? `News · ${w.topic}` : 'Top headlines'}</b><small>Google News</small></div>
      <ul>{w.items.map((i) => (
        <li key={i.url}><button onClick={() => onOpen({ kind: 'web', source: i.source || 'News', title: i.title, snippet: [i.source, i.date && new Date(i.date).toLocaleString()].filter(Boolean).join(' · '), url: i.url })}>
          <span>{i.title}</span><small>{i.source}{i.date ? ` · ${new Date(i.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}</small></button></li>))}</ul>
    </div>
  );
}

export function PanchangCard({ w }) {
  const p = w.p;
  return (
    <div className="wcard">
      <div className="wc-head"><Icon n="moon" size={14} /><b>Panchang · {p.vara[0]} ({p.vara[1]})</b><small>{p.moonPhase}% moon</small></div>
      <div className="times">
        <div><small>Tithi</small><b>{p.tithiName}</b></div><div><small>Paksha</small><b>{p.paksha.split(' ')[0]}</b></div>
        <div><small>Nakshatra</small><b>{p.nakshatra}</b></div><div><small>Yoga</small><b>{p.yoga}</b></div>
      </div>
      <small className="w-credit">Tithi ends {p.tithiEnds} · Nakshatra ends {p.nakshatraEnds} · approximate, computed on your device</small>
    </div>
  );
}

export function CricketCard({ w, onOpen }) {
  return (
    <div className="wcard news">
      <div className="wc-head"><Icon n="spark" size={14} /><b>Cricket scores</b><small>ESPNcricinfo</small></div>
      {w.items.length ? <ul>{w.items.map((i) => (
        <li key={i.url || i.title}><button onClick={() => onOpen({ kind: 'web', source: 'ESPNcricinfo', title: i.title, snippet: 'Live score', url: i.url || w.url })}><span>{i.title}</span></button></li>))}</ul>
        : <p className="muted" style={{ margin: '6px 0' }}>Scores are not available here.</p>}
      <a className="w-credit" href={w.url} target="_blank" rel="noopener noreferrer">Open ESPNcricinfo</a>
    </div>
  );
}
