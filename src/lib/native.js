// Small bridge to Android features that have no good web equivalent. Everything degrades gracefully in a browser.
import { isNative } from './http.js';

const plugin = (name) => (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.[name] : null) || null;

/** Open a page inside the app (Chrome Custom Tab on Android) or a new tab on the web. */
export async function openInApp(url) {
  const B = isNative() && plugin('Browser');
  if (B) {
    const toolbarColor = (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()) || '#000000';
    try { await B.open({ url, toolbarColor: /^#[0-9a-f]{6}$/i.test(toolbarColor) ? toolbarColor : '#000000', presentationStyle: 'popover' }); return; } catch { /* fall through */ }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
/** Search engines the user can switch between. Their own result pages open in the in-app browser (Android) or a new tab. */
export const ENGINES = {
  google: { label: 'Google', url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  duckduckgo: { label: 'DuckDuckGo', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  bing: { label: 'Bing', url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  brave: { label: 'Brave', url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
};
export const engineUrl = (id, q) => (ENGINES[id] || ENGINES.google).url(q);
export const engineHome = (id) => ({ google: 'https://www.google.com/', duckduckgo: 'https://duckduckgo.com/', bing: 'https://www.bing.com/', brave: 'https://search.brave.com/' }[id] || 'https://www.google.com/');
export const googleUrl = (q) => engineUrl('google', q);

/** Voice input. Android WebView has no Web Speech API, so the app uses the native speech-recognition plugin. */
export function voiceSupport() {
  if (isNative() && plugin('SpeechRecognition')) return 'native';
  if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) return 'web';
  return null;
}
export async function listenNative(lang, onText) {
  const S = plugin('SpeechRecognition');
  const perm = await S.requestPermissions().catch(() => null);
  if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') throw new Error('permission');
  await S.removeAllListeners?.();
  await S.addListener('partialResults', (d) => onText((d.matches || d.value || [])[0] || ''));
  const r = await S.start({ language: lang, maxResults: 1, partialResults: true, popup: false });
  const m = r?.matches?.[0]; if (m) onText(m);
}
export const stopNative = async () => { try { await plugin('SpeechRecognition')?.stop(); } catch { /* ignore */ } };

/** Text shared into the app from another Android app (see scripts/android-patch.mjs) or via the PWA share target. */
export function sharedText() {
  const w = typeof window !== 'undefined' ? window : {};
  const t = w.__novaShared; if (t) { delete w.__novaShared; return String(t); }
  try {
    const u = new URL(location.href); const v = u.searchParams.get('q') || u.searchParams.get('text') || u.searchParams.get('url');
    if (v) { u.searchParams.delete('q'); u.searchParams.delete('text'); u.searchParams.delete('url'); history.replaceState(null, '', u.pathname + u.search + u.hash); return v; }
  } catch { /* ignore */ }
  return null;
}
