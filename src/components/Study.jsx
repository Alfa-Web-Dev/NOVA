import React, { useState } from 'react';
import { Icon } from '../icons.jsx';

function Quiz({ items }) {
  const [i, setI] = useState(0), [pick, setPick] = useState(null), [score, setScore] = useState(0), [done, setDone] = useState(false);
  const q = items[i];
  if (done) return (
    <div className="study"><div className="score"><b>{score}/{items.length}</b><span>{score === items.length ? 'Perfect!' : score >= items.length / 2 ? 'Nice work.' : 'Keep practising.'}</span></div>
      <button className="btn" onClick={() => { setI(0); setPick(null); setScore(0); setDone(false); }}><Icon n="refresh" size={14} /> Try again</button></div>);
  const answered = pick !== null;
  return (
    <div className="study">
      <small className="muted">Question {i + 1} of {items.length}</small>
      <p className="q" dir="auto">{q.q}</p>
      <div className="opts">{q.options.map((o, k) => (
        <button key={k} disabled={answered} className={answered ? (k === q.answer ? 'right' : k === pick ? 'wrong' : '') : ''} onClick={() => { setPick(k); if (k === q.answer) setScore((s) => s + 1); }} dir="auto"><span>{String.fromCharCode(65 + k)}</span>{o}</button>))}</div>
      {answered && <p className="why" dir="auto"><b>{pick === q.answer ? 'Correct. ' : 'Not quite. '}</b>{q.why}</p>}
      {answered && <button className="btn primary" onClick={() => (i + 1 < items.length ? (setI(i + 1), setPick(null)) : setDone(true))}>{i + 1 < items.length ? 'Next' : 'See score'}</button>}
    </div>
  );
}

function Flashcards({ items }) {
  const [i, setI] = useState(0), [flip, setFlip] = useState(false), [known, setKnown] = useState(0);
  const c = items[i];
  const next = (k) => { if (k) setKnown((x) => x + 1); setFlip(false); setI((x) => (x + 1) % items.length); };
  return (
    <div className="study">
      <small className="muted">Card {i + 1} of {items.length} · {known} known</small>
      <button className={`flash ${flip ? 'flip' : ''}`} onClick={() => setFlip(!flip)} aria-label="Flip card" dir="auto"><span>{flip ? c.back : c.front}</span><small>{flip ? 'Answer' : 'Tap to reveal'}</small></button>
      <div className="row-btns"><button className="btn" onClick={() => next(false)}>Review again</button><button className="btn primary" onClick={() => next(true)}>Got it</button></div>
    </div>
  );
}

export default function StudyCard({ study }) {
  if (!study?.items?.length) return null;
  return (
    <section className="block"><h4>{study.kind === 'quiz' ? 'Quiz' : 'Flashcards'} · {study.topic}</h4>
      {study.kind === 'quiz' ? <Quiz items={study.items} /> : <Flashcards items={study.items} />}</section>
  );
}
