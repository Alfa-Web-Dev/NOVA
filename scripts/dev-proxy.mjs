// DEVELOPMENT-ONLY helper so you can test live web search on http://localhost:5173 without building the APK.
// `npm run dev` mounts it at /__nova_fetch; it is NOT part of the production build or the APK
// (in the APK the phone's native HTTP client does this job).
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const PRIVATE = /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;
const ALLOWED_HEADERS = new Set(['accept', 'accept-language', 'x-subscription-token']);

export async function handle(req, res, { allowPrivate = false } = {}) {
  const fail = (code, msg) => { res.statusCode = code; res.setHeader('content-type', 'text/plain'); res.end(msg); };
  try {
    const q = new URL(req.url, 'http://localhost');
    const target = new URL(q.searchParams.get('url') || '');
    if (!/^https?:$/.test(target.protocol)) return fail(400, 'only http(s) allowed');
    if (!allowPrivate && PRIVATE.test(target.hostname)) return fail(403, 'private addresses are blocked');
    const extra = {};
    try { for (const [k, v] of Object.entries(JSON.parse(q.searchParams.get('h') || '{}'))) if (ALLOWED_HEADERS.has(k.toLowerCase())) extra[k] = String(v); } catch { /* ignore */ }
    const r = await fetch(target, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...extra }, redirect: 'follow', signal: AbortSignal.timeout(9000) });
    const buf = Buffer.from(await r.arrayBuffer()).subarray(0, 3_000_000);
    res.statusCode = r.status;
    res.setHeader('content-type', r.headers.get('content-type') || 'text/plain');
    res.setHeader('x-final-url', r.url);
    res.end(buf);
  } catch (e) { fail(502, String(e?.message || e)); }
}

export const devProxy = () => ({
  name: 'nova-dev-proxy',
  apply: 'serve',
  configureServer(server) { server.middlewares.use('/__nova_fetch', (req, res) => handle(req, res)); },
});
