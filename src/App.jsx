import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PIcon, CIcon, Icon, Logo } from './icons.jsx';
import { makeT } from './i18n.js';
import { loadChats, kvSet, settingsStore } from './lib/db.js';
import { tryCalculate } from './lib/calc.js';
import { isGreeting, isThanks, wantsVideos, wantsImages, wantsLearning, classifyTopic, followUps, needsKnowledge, selfIntro } from './lib/intent.js';
import { research, deepResearch } from './lib/research.js';
import { streamGemini, groundingPaused, pauseGrounding, isQuotaError, rewriteQuery, planSubQuestions, completeOnce, helperChain } from './lib/llm.js';
import { detectWidget, runWidget } from './lib/widgets.js';
import { studyIntent, studyMessages, parseStudy } from './lib/study.js';
import { searchLibrary, addDoc, clearLibrary } from './lib/library.js';
import { extractFile } from './lib/files.js';
import { renderCard, canvasToPdf, shareFile, toBlob } from './lib/share.js';
import { applyAccent } from './lib/theme.js';
import { openInApp, voiceSupport, listenNative, stopNative, sharedText } from './lib/native.js';
import { canReadWeb } from './lib/http.js';
import { readPage, topChunks, hostOf } from './lib/web.js';
import { findLocal } from './lib/localKnowledge.js';
import { LANGS, buildMessages, extractiveAnswer, isModelDownloaded, loadLocalModel, loadedModel, streamLocal, streamOpenAI, providerChain, ONLINE_DEFAULT, LOCAL_MODELS } from './lib/ai.js';
import Sidebar from './components/Sidebar.jsx';
import Composer from './components/Composer.jsx';
import Message from './components/Message.jsx';
import Settings from './components/Settings.jsx';
import ImageViewer from './components/ImageViewer.jsx';
import SearchPage from './components/SearchPage.jsx';
import Page from './components/Page.jsx';
import Preview from './components/Preview.jsx';
import { SavedPanel, LibraryPanel } from './components/Panels.jsx';

const DEFAULTS = {
  theme: 'system', uiLang: 'en', answerLang: 'auto', depth: 'Normal', aiMode: 'auto', onlineConsent: null,
  localModel: LOCAL_MODELS[2].id, providers: {}, liveWeb: true, braveKey: '', tavilyKey: '', name: '', webSearch: true, showImages: true, disabledSources: [], onboarded: false, city: '', autoSpeak: false, googleGrounding: true, useLibrary: true, accent: 'black', searchEngine: 'google', collections: [],
};
const stripHeavy = (c) => ({ ...c, messages: c.messages.map((m) => (m.attachment?.image ? { ...m, attachment: { ...m.attachment, image: undefined, preview: undefined } } : m)) });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const INTERRUPTED = ['searching', 'loading', 'generating'];

export default function App() {
  const [s, setS] = useState(() => {
    const st = settingsStore.load(DEFAULTS);
    if (st.customEndpoint && !st.providers?.custom) st.providers = { ...(st.providers || {}), custom: { endpoint: st.customEndpoint, key: st.customKey || '', model: st.customModel || '' } }; // migrate v1.1 setting
    if (!st.themeV2) { if (st.accent === 'lavender') st.accent = 'black'; st.themeV2 = true; } // v1.5.2: default theme is black
    return st;
  });
  const set = useCallback((p) => setS((o) => { const n = { ...o, ...p }; settingsStore.save(n); return n; }), []);
  const t = useMemo(() => makeT(s.uiLang), [s.uiLang]);

  const [chats, setChats] = useState([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [priv, setPriv] = useState(false); // the next/current chat is private: kept in memory only, gone when you leave it
  const [query, setQuery] = useState('');
  const [depthOpen, setDepthOpen] = useState(false);
  const [sidebarCollapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [searchPg, setSearchPg] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const [updateReady, setUpdateReady] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [panel, setPanel] = useState(null); // 'saved' | 'library'
  const [att, setAtt] = useState(null);
  const [deep, setDeep] = useState(false);
  const [style, setStyle] = useState('default');

  const abortRef = useRef(null), inputRef = useRef(null), scrollRef = useRef(null), recRef = useRef(null), stickRef = useRef(true);

  /* ---------- boot ---------- */
  useEffect(() => {
    loadChats().then((list) => {
      setChats(list.map((c) => ({ ...c, messages: c.messages.map((m) => (INTERRUPTED.includes(m.status) ? { ...m, status: 'stopped' } : m)) })));
      setReady(true);
    });
  }, []);
  useEffect(() => { if (ready && !s.onboarded) setShowOnboard(true); }, [ready, s.onboarded]);

  // debounced persistence
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => kvSet('chats', chats.filter((c) => !c.private).map(stripHeavy)), 500);
    return () => clearTimeout(id);
  }, [chats, ready]);

  // theme
  useEffect(() => {
    const apply = () => {
      const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      applyAccent(s.accent, dark);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#212121' : '#ffffff'));
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [s.theme, s.accent]);
  useEffect(() => { document.documentElement.lang = s.uiLang; }, [s.uiLang]);

  // PWA: install prompt, connectivity, SW updates
  useEffect(() => {
    const bip = (e) => { e.preventDefault(); setInstallEvt(e); };
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('beforeinstallprompt', bip); window.addEventListener('online', on); window.addEventListener('offline', off);
    window.addEventListener('appinstalled', () => setInstallEvt(null));
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(w); });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
    return () => { window.removeEventListener('beforeinstallprompt', bip); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const notify = useCallback((m) => { setToast(m); clearTimeout(notify.id); notify.id = setTimeout(() => setToast(''), 2600); }, []);

  const active = chats.find((c) => c.id === activeId) || null;
  const isHome = !active || active.messages.length === 0;

  // auto-scroll while streaming (only if the user hasn't scrolled up)
  useEffect(() => {
    const el = scrollRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [active?.messages]);

  /* ---------- core: answer a question ---------- */
  /** Ordered list of AI engines to try (first that works wins). */
  const buildChain = async ({ grounded = false, vision = false } = {}) => {
    const keyedP = providerChain(s.providers);
    const keyed = keyedP.map((p) => ({ kind: 'custom', key: `custom:${p.id}`, label: p.label, cfg: p }));
    const gem = keyedP.find((p) => p.id === 'gemini');
    if (vision) return { chain: gem ? [{ kind: 'gemini', key: 'gemini:vision', label: 'Gemini (vision)', grounded: false, cfg: gem }] : [], notice: gem ? undefined : 'Photo questions need a free Gemini key (Settings → AI).' };
    const front = grounded && s.googleGrounding && gem && !groundingPaused() ? [{ kind: 'gemini', key: 'gemini:search', label: 'Gemini + Google Search', grounded: true, cfg: gem }] : [];
    const localReady = typeof navigator !== 'undefined' && !!navigator.gpu && (loadedModel() === s.localModel || (await isModelDownloaded(s.localModel)));
    const local = localReady ? [{ kind: 'local', key: 'local', label: LOCAL_MODELS.find((m) => m.id === s.localModel)?.label || 'On-device' }] : [];
    const online = s.onlineConsent ? [{ kind: 'online', key: 'online', label: 'Free online AI' }] : [];
    switch (s.aiMode) {
      case 'sources': return { chain: [] };
      case 'local': return { chain: local, notice: local.length ? undefined : 'On-device model is not downloaded (Settings → AI). Showing a source summary.' };
      case 'custom': return { chain: [...front, ...keyed], notice: keyed.length ? undefined : 'No API key added yet (Settings → AI). Showing a source summary.' };
      case 'online': return { chain: online, notice: online.length ? undefined : 'Free online AI is off (Settings → AI). Showing a source summary.' };
      default: return { chain: [...front, ...keyed, ...local, ...online] }; // auto: best quality first
    }
  };
  const [engines, setEngines] = useState([]);
  useEffect(() => { let live = true; buildChain({ grounded: true }).then(({ chain }) => live && setEngines(chain.map(({ key, label }) => ({ key, label })))); return () => { live = false; }; }, [s.providers, s.aiMode, s.onlineConsent, s.localModel, s.googleGrounding]); // eslint-disable-line react-hooks/exhaustive-deps

  const researchCache = useRef(new Map());
  const speakRef = useRef(null);

  const run = useCallback(async (chatId, question, history, asstId, depth, o = {}) => {
    const { deep = false, style = 'default', attachment = null, engine = null } = o;
    const ctl = new AbortController(); abortRef.current = ctl; setBusy(true);
    const patch = (p) => setChats((cs) => cs.map((c) => (c.id !== chatId ? c : { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === asstId ? { ...m, ...(typeof p === 'function' ? p(m) : p) } : m)) })));
    let latest = null, raf = 0;
    const flush = () => { raf = 0; patch({ text: latest }); };
    const onToken = (txt) => { latest = txt; if (!raf) raf = requestAnimationFrame(flush); };
    const done = (p) => { patch({ status: 'done', ...p }); if (s.autoSpeak && p.text) speakRef.current?.({ id: asstId, text: p.text }); };
    try {
      if (!attachment && isGreeting(question)) return done({ text: `${s.name ? `${t('hello')} ${s.name}! ` : ''}${t('greet')}` });
      if (!attachment && isThanks(question)) return done({ text: t('thanks') });
      const calc = !attachment && tryCalculate(question);
      if (calc) return done({ engine: 'calculator', text: `**${calc.expr} = ${calc.result}**` });
      const intro = !attachment && selfIntro(question);
      if (intro) return done({ engine: 'Nova', text: intro });

      /* instant tools: timer, units, currency, crypto, stocks, prayer times, news, daily briefing */
      const study = !attachment ? studyIntent(question) : null;
      const widget = !attachment && !study ? detectWidget(question, { city: s.city }) : null;
      if (widget) {
        patch({ status: 'searching', step: 'Working on it…', engine: undefined, notice: undefined, error: undefined });
        const r = await runWidget(widget, { signal: ctl.signal, city: s.city });
        if (r) return done({ engine: 'Nova tools', text: r.text, widgets: r.widgets || [], sources: r.sources || [], topic: ['news', 'briefing', 'crypto', 'stock', 'currency', 'cricket', 'panchang'].includes(widget.type) ? 'current' : undefined });
      }

      /* the question as the AI and the search engines will see it */
      let q = question, searchTopic = null, forceStyle = style;
      if (study?.kind === 'notes') { q = `Make clear, well-organised study notes on: ${study.topic}. Use headings, key terms with definitions, formulas or examples where useful, and finish with 5 quick revision questions.`; searchTopic = study.topic; forceStyle = style === 'default' ? 'detailed' : style; }
      const urlM = !attachment ? /https?:\/\/[^\s<>"')]+/i.exec(question) : null;
      const extra = [];
      if (attachment?.text) {
        const body = attachment.text.length > 7000 ? topChunks(attachment.text, question, { max: 8, size: 850 }).join('\n') : attachment.text;
        extra.push({ source: 'Your file', kind: 'file', title: attachment.name, snippet: body.slice(0, 600), context: body.slice(0, 7000), url: 'nova-file:attachment', read: true, full: true });
      }
      if (urlM && canReadWeb()) {
        patch({ status: 'searching', step: 'Reading the page…', engine: undefined, notice: undefined, error: undefined });
        const page = await readPage(urlM[0], { signal: ctl.signal }).catch(() => null);
        if (page?.text) { const body = page.text.length > 7000 ? topChunks(page.text, question.replace(urlM[0], ' '), { max: 8, size: 850 }).join('\n') : page.text; extra.push({ source: hostOf(page.url || urlM[0]), kind: 'web', title: page.title || urlM[0], snippet: body.slice(0, 600), context: body.slice(0, 7000), url: page.url || urlM[0], image: page.image, read: true, full: true }); }
      }
      const queryText = (urlM ? question.replace(urlM[0], ' ').trim() : question) || 'Summarize this page.';
      if (urlM && !extra.length && !canReadWeb()) patch({ notice: 'Opening links needs the Nova Android app (live web access); answering from the question text.' });
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      const lookup = s.webSearch && online && !attachment && !(urlM && extra.length) && (study ? true : needsKnowledge(question));
      const topic = classifyTopic(study ? study.topic : question);
      patch({ status: lookup ? 'searching' : 'generating', step: undefined, engine: undefined, notice: undefined, error: undefined, runOpts: { deep, style } });

      let g = { sources: [], images: [], widgets: [], videos: [], related: [] };
      let plan, googleQueries, grounded = false;
      const lib = s.useLibrary && !attachment ? await searchLibrary(searchTopic || queryText).catch(() => []) : [];
      const pre = lookup || study ? await buildChain({ grounded: false }) : { chain: [] };
      if (lookup) {
        const worthImages = s.showImages && !deep && (wantsImages(question) || ['science', 'history', 'general'].includes(topic));
        const sq = searchTopic || (await rewriteQuery(queryText, history, pre.chain, ctl.signal).catch((e) => { if (e?.name === 'AbortError') throw e; return null; }));
        const dbLang = sq ? 'en' : s.answerLang !== 'auto' ? s.answerLang : /[ऀ-ॿ]/.test(question) ? 'hi' : 'en';
        const ropts = { searchQuery: sq || undefined, extra: [...extra, ...lib], history, lang: dbLang, depth, signal: ctl.signal, disabled: s.disabledSources, showImages: worthImages, keys: { brave: s.braveKey, tavily: s.tavilyKey }, liveWeb: s.liveWeb, wantVideos: wantsVideos(question) || wantsLearning(question) || topic === 'math', onStep: (step) => patch({ step }) };
        const ck = JSON.stringify([sq || queryText, depth, deep, dbLang, lib.map((x) => x.title)]); const hit = researchCache.current.get(ck);
        if (hit && Date.now() - hit.at < 5 * 60e3) g = hit.g;
        else {
          if (deep) {
            patch({ step: 'Planning the research…' });
            plan = await planSubQuestions(sq || queryText, pre.chain, ctl.signal);
            g = await deepResearch(queryText, plan, ropts);
          } else g = await research(queryText, ropts);
          researchCache.current.set(ck, { g: { ...g, plan }, at: Date.now() });
        }
        plan = g.plan || plan;
      } else {
        g.sources = [...extra, ...lib].map((x, i) => ({ ...x, n: i + 1 }));
      }
      if (ctl.signal.aborted) throw new DOMException('aborted', 'AbortError');
      const video = !g.videos?.length && (wantsVideos(question) || topic === 'math') ? `https://www.youtube.com/results?search_query=${encodeURIComponent(question)}` : undefined;
      patch({ sources: g.sources, images: g.images, widgets: g.widgets, videos: g.videos, related: g.related, stats: g.stats, video, plan, visual: findLocal(question)?.visual, status: 'generating', step: undefined, text: '' });

      /* quiz & flashcards: need an AI engine that can return JSON */
      if (study && study.kind !== 'notes') {
        if (!helperChain(pre.chain).length) return done({ engine: 'Nova', text: `Quizzes and flashcards need an AI engine. Open **Settings → AI** and add a free Gemini or Groq key (one minute), or turn on *Free online AI*.` });
        patch({ status: 'searching', step: `Writing your ${study.kind}…` });
        const ctx = g.sources.slice(0, 6).map((x) => `[${x.n}] ${x.title}: ${(x.context || x.snippet || '').slice(0, 500)}`).join('\n');
        const out = await completeOnce(pre.chain, studyMessages({ ...study, context: ctx, lang: s.answerLang === 'auto' ? 'the language of the topic' : LANGS[s.answerLang] }), { signal: ctl.signal, timeout: 45000 });
        const items = parseStudy(out, study.kind);
        if (!items.length) return done({ engine: 'Nova', text: 'I could not build that just now (the AI engine did not return a usable set). Please try again.' });
        return done({ engine: 'Nova study', topic, study: { kind: study.kind, topic: study.topic, items }, text: `Here ${study.kind === 'quiz' ? 'is a' : 'are your'} **${study.kind === 'quiz' ? `${items.length}-question quiz` : `${items.length} flashcards`}** on **${study.topic}**. Good luck!` });
      }

      const { chain, notice: chainNotice } = await buildChain({ grounded: lookup && !attachment, vision: !!attachment?.image });
      if (engine) { const i = chain.findIndex((e) => e.key === engine); if (i > 0) chain.unshift(...chain.splice(i, 1)); }
      const local = findLocal(question);
      let text = '', engineName = 'Sources', notice = chainNotice, groundNote = ''; const failed = [];
      const common = { question: study?.kind === 'notes' ? q : queryText, history, sources: g.sources, lang: s.answerLang, depth, name: s.name, style: forceStyle, deep, images: attachment?.image ? [attachment.image] : [] };
      for (const e of chain) {
        try {
          if (e.kind === 'local') {
            if (loadedModel() !== s.localModel) {
              patch({ status: 'loading', progress: 0, progressText: '' });
              await loadLocalModel(s.localModel, (p, txt) => patch({ progress: p, progressText: txt }));
              patch({ status: 'generating' });
            }
            text = await streamLocal(buildMessages({ ...common, small: true }), { signal: ctl.signal, onToken });
          } else if (e.kind === 'online') {
            text = await streamOpenAI({ endpoint: ONLINE_DEFAULT.endpoint, model: ONLINE_DEFAULT.model }, buildMessages(common), { signal: ctl.signal, onToken });
          } else if (e.kind === 'gemini') {
            const r = await streamGemini({ apiKey: e.cfg.apiKey, model: e.cfg.model, grounding: e.grounded }, buildMessages(common), { signal: ctl.signal, onToken });
            text = r.text;
            if (r.grounding.sources.length) {
              grounded = true; googleQueries = r.grounding.queries;
              const base = g.sources.length;
              g = { ...g, sources: [...g.sources, ...r.grounding.sources.slice(0, 8).map((x, i) => ({ n: base + i + 1, source: 'Google Search', kind: 'web', via: 'google', title: x.title, snippet: 'Found by Google Search through Gemini.', url: x.url }))] };
            } else if (e.grounded && r.grounding.queries.length) googleQueries = r.grounding.queries;
          } else {
            text = await streamOpenAI({ endpoint: e.cfg.endpoint, apiKey: e.cfg.apiKey, model: e.cfg.model }, buildMessages(common), { signal: ctl.signal, onToken });
          }
          engineName = e.label; if (text) break;
        } catch (err) {
          if (ctl.signal.aborted) throw err;
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          if (e.grounded && isQuotaError(err)) { pauseGrounding(); groundNote = 'Google Search quota reached on your free Gemini key, so Nova paused it for an hour and used its own web search.'; }
          latest = null; text = ''; failed.push(e.label); patch({ text: '', status: 'generating' });
        }
      }
      if (!text) {
        if (!chain.length && !needsKnowledge(question) && !attachment) text = 'That looks like a writing or conversation request, which needs an AI engine to answer well. Open **Settings → AI** and add a free API key (Gemini or Groq take one minute), download an *on-device model*, or turn on *Free online AI*. I can still answer factual questions, maths, weather, currency and definitions right now.';
        else if (attachment?.text && !chain.length) text = `I read **${attachment.name}**, but summarising or answering questions about it needs an AI engine. Add a free Gemini or Groq key in **Settings → AI**.\n\nHere is what I found in it:\n\n> ${attachment.text.slice(0, 600).replace(/\n+/g, ' ')}…`;
        else text = extractiveAnswer({ question, sources: g.sources, depth, local });
        engineName = 'Sources';
        if (failed.length) notice = `${failed.join(', ')} didn't respond, so this is a summary taken from the sources.${providerChain(s.providers).length ? '' : ' For reliable AI answers add a free Gemini or Groq key: Settings → AI (takes 1 minute).'}`;
      } else if (failed.length) notice = `${failed.join(', ')} didn't respond — answered by ${engineName} instead.`;
      if (groundNote) notice = groundNote;
      if (raf) cancelAnimationFrame(raf);
      patch({ sources: g.sources });
      done({ text, engine: engineName, notice, topic, grounded, googleQueries });
    } catch (e) {
      if (raf) cancelAnimationFrame(raf);
      if (ctl.signal.aborted || e?.name === 'AbortError') patch((m) => ({ status: 'stopped', text: latest ?? m.text }));
      else patch({ status: 'error', error: 'Something went wrong. Please try again.' });
    } finally { if (abortRef.current === ctl) { abortRef.current = null; setBusy(false); } }
  }, [s, t]);

  const send = useCallback((text = query) => {
    const q = text.trim(); if (busy || att?.busy) return;
    if (!q && !att?.text && !att?.image) return;
    const ask = q || (att?.image ? 'Describe this photo and read out any text in it.' : 'Summarize this document.');
    const chatId = activeId || uid();
    const attachment = att && !att.busy ? { name: att.name, kind: att.kind, text: att.text?.slice(0, 60000), image: att.image, preview: att.preview } : null;
    const userMsg = { id: uid(), role: 'user', text: ask, ts: Date.now(), ...(attachment ? { attachment } : {}) };
    const asst = { id: uid(), role: 'assistant', text: '', status: 'searching', query: ask, ts: Date.now() };
    const prev = chats.find((c) => c.id === chatId);
    const history = prev ? prev.messages : [];
    setChats((cs) => prev
      ? cs.map((c) => (c.id === chatId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg, asst] } : c))
      : [{ id: chatId, title: ask.length > 40 ? ask.slice(0, 40).trim() + '…' : ask, updatedAt: Date.now(), private: priv, messages: [userMsg, asst] }, ...cs]);
    setActiveId(chatId); setQuery(''); setAtt(null); setMobileNav(false); stickRef.current = true;
    run(chatId, ask, history, asst.id, s.depth, { deep, style, attachment });
    setDeep(false);
  }, [query, busy, activeId, chats, run, s.depth, priv, att, deep, style]);
  const sendRef = useRef(send); sendRef.current = send;

  const stop = () => abortRef.current?.abort();

  const regenerate = (engine) => {
    if (!active || busy) return;
    const msgs = active.messages; const last = msgs[msgs.length - 1];
    if (last?.role !== 'assistant') return;
    const userMsg = msgs[msgs.length - 2]; if (!userMsg) return;
    const history = msgs.slice(0, -2);
    const fresh = { ...last, text: '', sources: [], images: [], videos: [], related: [], widgets: [], stats: undefined, visual: undefined, study: undefined, plan: undefined, grounded: undefined, googleQueries: undefined, step: undefined, status: 'searching' };
    setChats((cs) => cs.map((c) => (c.id === active.id ? { ...c, messages: [...history, userMsg, fresh] } : c)));
    run(active.id, userMsg.text, history, fresh.id, s.depth, { ...(last.runOpts || {}), attachment: userMsg.attachment || null, engine: typeof engine === 'string' ? engine : null });
  };

  const newChat = useCallback(() => { setActiveId(null); setPriv(false); setChats((cs) => (cs.some((c) => c.private) ? cs.filter((c) => !c.private) : cs)); setQuery(''); setMobileNav(false); setTimeout(() => inputRef.current?.focus(), 30); }, []);
  const newPrivateChat = () => { setActiveId(null); setPriv(true); setChats((cs) => (cs.some((c) => c.private) ? cs.filter((c) => !c.private) : cs)); setQuery(''); setMobileNav(false); notify('Private chat — nothing from it is saved'); setTimeout(() => inputRef.current?.focus(), 30); };
  const selectChat = (id) => { setActiveId(id); setPriv(false); setChats((cs) => (cs.some((c) => c.private && c.id !== id) ? cs.filter((c) => !c.private || c.id === id) : cs)); setMobileNav(false); stickRef.current = true; };
  const renameChat = (c) => { const n = window.prompt('Rename chat', c.title); if (n && n.trim()) setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, title: n.trim().slice(0, 80) } : x))); };
  const pinChat = (c) => setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, pinned: !x.pinned } : x)));
  const libraryChat = async (c) => {
    const text = c.messages.filter((m) => m.text).map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.text}`).join('\n\n');
    try { await addDoc({ name: c.title, kind: 'chat', text }); notify('Added to My library'); } catch { notify('Nothing to add yet.'); }
  };
  const deleteChat = (id) => { setChats((cs) => cs.filter((c) => c.id !== id)); if (activeId === id) setActiveId(null); };

  /* ---------- actions ---------- */
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); notify(t('copiedMsg')); } catch { notify('Copy failed'); } };
  const share = async (m, mode = 'text') => {
    if (mode === 'text') {
      const body = `${m.text}\n\n— Nova`;
      if (navigator.share) { try { await navigator.share({ title: 'Nova', text: body }); return; } catch { /* cancelled */ } }
      return copy(body);
    }
    try {
      notify('Preparing…');
      const idx = active?.messages.findIndex((x) => x.id === m.id) ?? -1;
      const card = await renderCard({ question: active?.messages[idx - 1]?.text || m.query || 'Nova', answer: m.text, sources: m.sources, logoUrl: `${import.meta.env.BASE_URL}icons/icon-192.png` });
      const r = mode === 'pdf' ? await shareFile(canvasToPdf(card), 'nova-answer.pdf', 'Nova answer') : await shareFile(await toBlob(card), 'nova-answer.png', 'Nova answer');
      if (r === 'downloaded') notify(mode === 'pdf' ? 'PDF saved to downloads' : 'Picture saved to downloads');
    } catch { notify('Could not create the file.'); }
  };
  const pin = (m) => setChats((cs) => cs.map((c) => (c.id !== active?.id ? c : { ...c, messages: c.messages.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x)) })));
  const moveSaved = (chatId, msgId, col) => setChats((cs) => cs.map((c) => (c.id !== chatId ? c : { ...c, messages: c.messages.map((x) => (x.id === msgId ? { ...x, collection: col || undefined } : x)) })));
  const unpin = (chatId, msgId) => setChats((cs) => cs.map((c) => (c.id !== chatId ? c : { ...c, messages: c.messages.map((x) => (x.id === msgId ? { ...x, pinned: false } : x)) })));
  const speak = (m) => {
    const text = m.text.replace(/```[\s\S]*?```/g, ' ').replace(/\[\d{1,2}\]/g, '').replace(/[#*_`>[\]]/g, '');
    const hindi = s.answerLang === 'hi' || /[\u0900-\u097F]/.test(text);
    const lang = hindi ? 'hi-IN' : s.answerLang === 'auto' || s.answerLang === 'en' ? 'en-IN' : s.answerLang;
    const nat = window.NovaTTS; // Android: native text-to-speech bridge (MainActivity)
    if (nat) {
      if (speakingId === m.id) { nat.stop(); setSpeakingId(null); return; }
      nat.speak(text, lang); setSpeakingId(m.id);
      const iv = setInterval(() => { if (!nat.isSpeaking()) { clearInterval(iv); setSpeakingId((cur) => (cur === m.id ? null : cur)); } }, 700);
      return;
    }
    const synth = window.speechSynthesis; if (!synth) return notify('Read aloud is not supported here.');
    if (speakingId === m.id) { synth.cancel(); setSpeakingId(null); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = lang;
    const v = synth.getVoices().find((x) => x.lang?.replace('_', '-').startsWith(u.lang)); if (v) u.voice = v;
    u.onend = u.onerror = () => setSpeakingId(null); setSpeakingId(m.id); synth.speak(u);
  };
  speakRef.current = speak;
  const voiceLang = () => (s.answerLang === 'hi' ? 'hi-IN' : s.answerLang === 'auto' ? (s.uiLang === 'hi' ? 'hi-IN' : 'en-IN') : s.answerLang === 'en' ? 'en-IN' : s.answerLang);
  const voice = async () => {
    const mode = voiceSupport();
    if (!mode) return notify(t('voiceNo'));
    if (listening) { if (mode === 'native') await stopNative(); else recRef.current?.stop(); setListening(false); notify('Mic off'); return; }
    if (mode === 'native') {
      try { setListening(true); notify('Mic on — listening…'); await listenNative(voiceLang(), (txt) => setQuery(txt)); } catch { notify(t('voiceFail')); }
      setListening(false); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); recRef.current = r; r.lang = voiceLang(); r.interimResults = true;
    r.onresult = (e) => setQuery(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onerror = () => { setListening(false); notify(t('voiceFail')); }; r.onend = () => setListening(false);
    try { r.start(); setListening(true); notify('Mic on — listening…'); } catch { notify(t('voiceFail')); }
  };

  const attach = async (file) => {
    setAtt({ name: file.name || 'photo', busy: true, status: 'Reading…' });
    try {
      const x = await extractFile(file, { vision: !!s.providers?.gemini?.key, langs: s.answerLang === 'hi' || s.uiLang === 'hi' ? 'eng+hin' : 'eng', onStatus: (st) => setAtt((a) => (a ? { ...a, status: st } : a)) });
      if (!x.text && !x.image) { setAtt(null); return notify('No readable text found in that file.'); }
      setAtt({ ...x, busy: false });
    } catch (e) { setAtt(null); notify(/tesseract|worker/i.test(String(e?.message)) ? 'Text recognition is not available offline yet.' : 'Could not read that file.'); }
  };
  const saveAttachment = async () => { try { await addDoc({ name: att.name, text: att.text, kind: att.kind }); notify('Saved to My library'); } catch { notify('Nothing to save'); } };
  const openLink = (url) => openInApp(url);

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ app: 'Nova', version: 2, exportedAt: new Date().toISOString(), chats: chats.filter((c) => !c.private).map(stripHeavy) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nova-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); notify(t('exported'));
  };
  const importAll = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(String(r.result)); if (!Array.isArray(p.chats)) throw new Error('bad');
        const ok = p.chats.filter((c) => c?.id && Array.isArray(c.messages)).map((c) => ({ ...c, title: String(c.title || 'Chat'), updatedAt: +c.updatedAt || Date.now(), messages: c.messages.filter((m) => m && typeof m.text === 'string').map((m, i) => ({ id: m.id || `${c.id}-${i}`, role: m.role === 'user' ? 'user' : 'assistant', text: m.text, status: 'done', sources: Array.isArray(m.sources) ? m.sources : [], images: Array.isArray(m.images) ? m.images : [] })) }));
        setChats((cs) => [...ok.filter((c) => !cs.some((x) => x.id === c.id)), ...cs]); notify(t('imported'));
      } catch { notify(t('badBackup')); }
      e.target.value = '';
    };
    r.readAsText(f);
  };
  const clearAll = () => { if (confirm(t('confirmClear'))) { setChats([]); setActiveId(null); notify(t('cleared')); } };
  const wipeAll = async () => {
    if (!confirm('Erase EVERYTHING on this device — chats, library, saved answers, settings and keys? This cannot be undone.')) return;
    try { await clearLibrary(); await kvSet('chats', []); localStorage.clear(); const ks = await caches?.keys?.(); await Promise.all((ks || []).map((k) => caches.delete(k))); } catch { /* best effort */ }
    location.reload();
  };
  const install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); setInstallEvt(null); };

  // text shared from another app / PWA share target / shortcuts (?q=...)
  useEffect(() => {
    if (!ready) return undefined;
    const go = () => { const x = sharedText(); if (!x) return; const v = x.trim(); sendRef.current(/^https?:\/\/\S+$/i.test(v) ? `Summarize this page: ${v}` : v); };
    go(); window.addEventListener('nova-share', go);
    return () => window.removeEventListener('nova-share', go);
  }, [ready]);

  // the Android home-screen widget's microphone button opens Nova and starts voice input
  const voiceRef = useRef(null); voiceRef.current = voice;
  useEffect(() => {
    if (!ready) return undefined;
    const go = () => { if (!window.__novaVoice) return; window.__novaVoice = false; voiceRef.current?.(); };
    go(); window.addEventListener('nova-voice', go);
    return () => window.removeEventListener('nova-voice', go);
  }, [ready]);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
      if (e.key === '/' && document.activeElement === document.body) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [newChat]);

  const lastAsst = active?.messages[active.messages.length - 1];
  const follow = useMemo(() => (lastAsst?.role === 'assistant' && lastAsst.status === 'done' && lastAsst.query && lastAsst.engine !== 'calculator' && lastAsst.sources?.length ? [...new Set([...(lastAsst.related || []).slice(0, 3), ...followUps(lastAsst.query, lastAsst.topic || classifyTopic(lastAsst.query), s.uiLang)])].slice(0, 5) : []), [lastAsst, s.uiLang]);

  const composer = (
    <Composer {...{ t, query, setQuery, busy, inputRef, depthOpen, setDepthOpen }} onSend={() => send()} onStop={stop} depth={s.depth} setDepth={(d) => set({ depth: d })} onVoice={voice} listening={listening} webSearch={s.webSearch} onToggleWeb={() => set({ webSearch: !s.webSearch })}
      deep={deep} setDeep={setDeep} style={style} setStyle={setStyle} attachment={att} onAttach={attach} onClearAttachment={() => setAtt(null)} onSaveAttachment={saveAttachment}
      searchEngine={s.searchEngine} setSearchEngine={(e) => set({ searchEngine: e })} onOpenSearch={(url) => openInApp(url)} onOpenSearchPage={() => setSearchPg(true)} />
  );

  return (
    <div className="app">
      <Sidebar {...{ t, chats, activeId, offline, canInstall: !!installEvt }} collapsed={sidebarCollapsed} open={mobileNav}
        onSelect={selectChat} onNew={newChat} onDelete={deleteChat} name={s.name} onQuick={(k) => { setMobileNav(false); if (k === 'briefing') send('daily briefing'); else { newChat(); setQuery('Quiz me on '); setTimeout(() => inputRef.current?.focus(), 60); } }}
        onSettings={() => { setSettingsOpen(true); setMobileNav(false); }} onSaved={() => { setPanel('saved'); setMobileNav(false); }} onTools={() => { setToolsOpen(true); setMobileNav(false); }} avatar={s.avatar} onRename={renameChat} onPin={pinChat} onLibrary2={libraryChat} onLibrary={() => { setPanel('library'); setMobileNav(false); }} onCollapse={() => setCollapsed(!sidebarCollapsed)} onClose={() => setMobileNav(false)} onInstall={install} />
      <main className="main">
        <header className="topbar">
          <button className="float-btn show-mobile" onClick={() => setMobileNav(true)} aria-label="Open menu"><Icon n="menu" size={20} /></button>
          <span className="grow" />
          <div className="float-pill">
            <button className={`icon-btn pill-btn ${active?.private || (isHome && priv) ? 'active' : ''}`} onClick={newPrivateChat} aria-pressed={!!(active?.private || (isHome && priv))} aria-label="New private chat" title="New private chat — nothing is saved"><Icon n="ghost" size={19} /></button>
            <button className="icon-btn pill-btn" onClick={newChat} aria-label={t('newChat')} title={t('newChat')}><Icon n="plus" size={19} /></button>
          </div>
        </header>
        {(offline || updateReady) && (
          <div className="banner">
            {offline && <span><Icon n="wifioff" size={14} /> {t('offline')} — saved chats and sources-free answers still work.</span>}
            {updateReady && <button onClick={() => updateReady.postMessage('SKIP_WAITING')}>{t('update')}</button>}
          </div>
        )}
        {isHome ? (
          <section className="home">
            <span className="hero-logo"><Logo size={76} /></span>
            <h1>{s.name ? `${t('hello')}, ${s.name}` : t('tagline')}</h1>
            {composer}
            <div className="cards">{[['explore', 'cardExplore', 'cardExploreD', 'suggest1'], ['lightbulb', 'cardUnderstand', 'cardUnderstandD', 'suggest3'], ['book', 'cardStudy', 'cardStudyD', 'suggest4'], ['code', 'cardBuild', 'cardBuildD', 'suggest5']].map(([ic, a, b, q]) => (
              <button key={a} className="card" onClick={() => send(t(q))}><CIcon n={ic} size={44} className="ico" /><b>{t(a)}</b><small>{t(b)}</small></button>))}</div>
            <div className="quick">
              <button onClick={() => send('daily briefing')}><Icon n="sun" size={14} /> Daily briefing</button>
              <button onClick={() => { setQuery('Quiz me on '); inputRef.current?.focus(); }}><PIcon n="lightbulb" size={14} /> Quiz me</button>
              <button onClick={() => { setDeep(true); inputRef.current?.focus(); }}><Icon n="flask" size={14} /> Deep Research</button>
              <button onClick={() => setPanel('library')}><Icon n="folder" size={14} /> My library</button>
            </div>
            {priv && <p className="muted center"><Icon n="ghost" size={13} /> Private chat: nothing from it is saved, and it disappears when you leave.</p>}
          </section>
        ) : (
          <>
            <section className="thread" ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} aria-live="polite">
              <div className="thread-inner">
                {active.private && <p className="muted center priv-note"><Icon n="ghost" size={13} /> Private chat — not saved, and gone when you leave it.</p>}
                {active.messages.map((m, i) => (
                  <Message key={m.id || i} m={m} t={t} isLast={i === active.messages.length - 1} followups={follow}
                    onPreview={setPreview} onImage={(images, index) => setViewer({ images, index })} onFollowup={(f) => send(f)} onRegenerate={() => regenerate()} onRetryWith={regenerate} engines={engines} onPin={pin} onGoogle={openLink} searchEngine={s.searchEngine} onCopy={copy} onShare={share} onSpeak={speak} speaking={speakingId === m.id} />
                ))}
              </div>
            </section>
            <div className="dock">{composer}</div>
          </>
        )}
      </main>

      {settingsOpen && <Settings {...{ s, set, t }} onClose={() => setSettingsOpen(false)} onExport={exportAll} onImport={importAll} onClear={clearAll} onWipe={wipeAll} />}
      {panel === 'saved' && <SavedPanel chats={chats} collections={s.collections || []} onAddCollection={(n) => set({ collections: [...new Set([...(s.collections || []), n])] })} onMove={moveSaved} onClose={() => setPanel(null)} onUnpin={unpin} onOpen={(id) => { setActiveId(id); setPanel(null); stickRef.current = true; }} />}
      {panel === 'library' && <LibraryPanel onClose={() => setPanel(null)} langs={s.answerLang === 'hi' || s.uiLang === 'hi' ? 'eng+hin' : 'eng'} notify={notify} />}
      {toolsOpen && (
        <Page title="Tools" onClose={() => setToolsOpen(false)}>
          <div className="page-pad">
            <div className="tool-grid">
              {[['flask', 'Deep Research', 'Many searches → one sourced report', () => { setDeep(true); newChat(); setTimeout(() => inputRef.current?.focus(), 80); }],
                ['sun', 'Daily briefing', 'News, weather and prayer times', () => send('daily briefing')],
                ['lightbulb', 'Study mode', 'Notes, examples and quizzes', () => { newChat(); setQuery('Quiz me on '); setTimeout(() => inputRef.current?.focus(), 80); }],
                ['book', 'My library', 'Your notes and files', () => setPanel('library')],
                ['globe', 'Web search', 'Google, DuckDuckGo, Bing, Brave', () => setSearchPg(true)],
                ['bookmark', 'Saved answers', 'Answers you pinned', () => setPanel('saved')]].map(([ic, a, b, fn]) => (
                <button key={a} className="tool-card" onClick={() => { setToolsOpen(false); setTimeout(fn, 60); }}><CIcon n={ic} size={40} /><b>{a}</b><small>{b}</small></button>))}
            </div>
            <p className="muted center">More tools are coming soon.</p>
          </div>
        </Page>
      )}
      {preview && <Preview item={preview} t={t} onClose={() => setPreview(null)} onImage={(images, index) => setViewer({ images, index })} />}
      {searchPg && <SearchPage initial={query} engine={s.searchEngine} setEngine={(e) => set({ searchEngine: e })} onSearch={(url) => openInApp(url)} onClose={() => setSearchPg(false)} />}
      {viewer && <ImageViewer images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} onOpenSource={(im) => { setViewer(null); openInApp(im.page); }} />}
      {showOnboard && <Onboarding s={s} set={set} t={t} onDone={() => { set({ onboarded: true }); setShowOnboard(false); }} onMore={() => { set({ onboarded: true }); setShowOnboard(false); setSettingsOpen(true); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Onboarding({ s, set, t, onDone, onMore }) {
  const [online, setOnline] = useState(s.onlineConsent ?? true);
  return (
    <div className="page onboard-page" role="dialog" aria-modal="true" aria-label="Welcome">
      <section className="onboard">
        <Logo size={48} />
        <h2>Welcome to Nova</h2>
        <p className="muted">A free, open-source AI assistant with cited answers. No account. No paid services.</p>
        <label className="srow"><div><b>Your name</b><small>Optional — stays on this device</small></div><input className="field" value={s.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="srow"><div><b>Language</b></div>
          <select className="field" value={s.answerLang} onChange={(e) => set({ answerLang: e.target.value, uiLang: e.target.value === 'hi' ? 'hi' : 'en' })}><option value="auto">Auto (match my language)</option><option value="en">English</option><option value="hi">हिन्दी</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="pt">Português</option><option value="ar">العربية</option><option value="bn">বাংলা</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option><option value="ur">اردو</option><option value="zh">中文</option><option value="ja">日本語</option><option value="ru">Русский</option></select></label>
        <div className="srow"><div><b>Answer length</b></div><div className="seg" role="radiogroup">{[['Quick', t('quick')], ['Normal', t('normal')], ['Deep Dive', t('deep')]].map(([k, l]) => <button key={k} role="radio" aria-checked={s.depth === k} className={s.depth === k ? 'on' : ''} onClick={() => set({ depth: k })}>{l}</button>)}</div></div>
        <div className="srow"><div><b>Free online AI</b><small>Gives full AI answers right away. Your question and a few source snippets are sent to a free community service (Pollinations). Turn off to stay fully local — you can add a private on-device model later in Settings.</small></div>
          <button role="switch" aria-checked={online} className={`toggle ${online ? 'on' : ''}`} onClick={() => setOnline(!online)}><i /></button></div>
        <div className="row-btns end"><button className="btn" onClick={() => { set({ onlineConsent: online }); onMore(); }}>More options</button><button className="btn primary" onClick={() => { set({ onlineConsent: online }); onDone(); }}>Get started</button></div>
      </section>
    </div>
  );
}
