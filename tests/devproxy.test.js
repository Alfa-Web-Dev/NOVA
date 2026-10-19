import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handle } from '../scripts/dev-proxy.mjs';
import { wikiQuery } from '../src/lib/providers.js';

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

test('wikiQuery turns a full question into content words (MediaWiki ANDs every term)', () => {
  assert.equal(wikiQuery('What were the main causes of french revolution?'), 'main causes french revolution');
  assert.equal(wikiQuery('black hole'), 'black hole');
  assert.equal(wikiQuery('photosynthesis'), 'photosynthesis');
  assert.ok(wikiQuery('how does the immune system fight a virus infection in the human body').split(' ').length <= 7);
});

test('dev proxy fetches a page server-side, forwards allowed headers, blocks private hosts and bad schemes', async () => {
  let seenAccept = '', seenSecret = 'none';
  const target = http.createServer((req, res) => { seenAccept = req.headers.accept; seenSecret = req.headers['x-secret'] || 'none'; res.setHeader('content-type', 'text/html'); res.end('<html>hello</html>'); });
  const tp = await listen(target);
  const proxy = http.createServer((req, res) => handle(req, res, { allowPrivate: true }));
  const pp = await listen(proxy);
  const strict = http.createServer((req, res) => handle(req, res));
  const sp = await listen(strict);
  try {
    const u = `http://127.0.0.1:${tp}/x`;
    const r = await fetch(`http://127.0.0.1:${pp}/__nova_fetch?url=${encodeURIComponent(u)}&h=${encodeURIComponent(JSON.stringify({ Accept: 'text/html', 'X-Secret': 'nope' }))}`);
    assert.equal(r.status, 200); assert.equal(await r.text(), '<html>hello</html>');
    assert.equal(seenAccept, 'text/html'); assert.equal(seenSecret, 'none', 'non-allowlisted headers are not forwarded');
    assert.equal((await fetch(`http://127.0.0.1:${sp}/__nova_fetch?url=${encodeURIComponent(u)}`)).status, 403, 'private address blocked by default');
    assert.equal((await fetch(`http://127.0.0.1:${sp}/__nova_fetch?url=${encodeURIComponent('file:///etc/passwd')}`)).status, 400, 'non-http scheme rejected');
  } finally { target.close(); proxy.close(); strict.close(); }
});
