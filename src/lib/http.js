// Network layer.
//  - In the Android app (Capacitor) requests go through the NATIVE HTTP client, which has no CORS restrictions,
//    so Nova can read any public web page directly from the phone — no backend, no proxy.
//  - In a normal browser (PWA) it falls back to fetch(), which is limited by CORS.
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

export const isNative = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

// `npm run dev` only: a tiny local proxy (scripts/dev-proxy.mjs) lets you test live web search on localhost.
const DEV = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
export const canReadWeb = () => isNative() || DEV;

let httpPlugin = null;
async function nativeHttp() {
  if (httpPlugin) return httpPlugin;
  httpPlugin = window.Capacitor?.Plugins?.CapacitorHttp || (await import('@capacitor/core')).CapacitorHttp;
  return httpPlugin;
}

const abortError = () => new DOMException('aborted', 'AbortError');

function race(promise, signal, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    const onAbort = () => { clearTimeout(t); reject(abortError()); };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then((v) => { clearTimeout(t); signal?.removeEventListener('abort', onAbort); resolve(v); }, (e) => { clearTimeout(t); signal?.removeEventListener('abort', onAbort); reject(e); });
  });
}

/**
 * fetch-like helper.  opts: { method, headers, json, signal, timeout }
 * Resolves { ok, status, url, text(), json() }. Throws on network failure/timeout/abort.
 */
export async function netFetch(url, { method = 'GET', headers = {}, json, signal, timeout = 8000, maxChars = 1_500_000 } = {}) {
  if (signal?.aborted) throw abortError();
  if (isNative()) {
    const h = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers };
    if (json !== undefined) h['Content-Type'] = 'application/json';
    const res = await race((await nativeHttp()).request({ url, method, headers: h, data: json, responseType: 'text', connectTimeout: timeout, readTimeout: timeout }), signal, timeout + 500);
    const text = (typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')).slice(0, maxChars);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, url: res.url || url, text: async () => text, json: async () => JSON.parse(text) };
  }
  if (DEV && method === 'GET' && /^https?:/.test(url)) { // dev proxy (no CORS in Node)
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout + 1000); const onAbort = () => ctl.abort(); signal?.addEventListener('abort', onAbort);
    try {
      const r = await fetch(`/__nova_fetch?url=${encodeURIComponent(url)}&h=${encodeURIComponent(JSON.stringify(headers))}`, { signal: ctl.signal });
      const text = (await r.text()).slice(0, maxChars);
      return { ok: r.ok, status: r.status, url: r.headers.get('x-final-url') || url, text: async () => text, json: async () => JSON.parse(text) };
    } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort); }
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const r = await fetch(url, { method, headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers, body: json !== undefined ? JSON.stringify(json) : undefined, signal: ctl.signal });
    const text = (await r.text()).slice(0, maxChars);
    return { ok: r.ok, status: r.status, url: r.url || url, text: async () => text, json: async () => JSON.parse(text) };
  } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort); }
}
