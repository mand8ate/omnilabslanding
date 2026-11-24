import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleSiteRequest } from '../server/app.js';

test('Hostinger serves built pages and JavaScript, with security headers and conditional caching', async () => {
  const assetRoot = await mkdtemp(path.join(os.tmpdir(), 'omni-assets-'));
  try {
    await mkdir(path.join(assetRoot, 'js'));
    await mkdir(path.join(assetRoot, 'ja'));
    await writeFile(path.join(assetRoot, 'index.html'), '<html>Built English</html>');
    await writeFile(path.join(assetRoot, 'ja/index.html'), '<html lang="ja">日本語</html>');
    await writeFile(path.join(assetRoot, 'js/gsap.min.js'), '/* generated library */');
    const options = { assetRoot };
    const response = await handleSiteRequest(new Request('https://omnilabs.digital/'), options);
    assert.equal(await response.text(), '<html>Built English</html>');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Cache-Control'), 'no-cache');
    assert.ok(response.headers.get('Content-Security-Policy').includes("script-src 'self'"));
    const library = await handleSiteRequest(new Request('https://omnilabs.digital/js/gsap.min.js?v=abc'), options);
    assert.equal(library.status, 200);
    assert.ok(library.headers.get('Content-Type').startsWith('application/javascript'));
    const cached = await handleSiteRequest(new Request('https://omnilabs.digital/js/gsap.min.js?v=abc', { headers: { 'If-None-Match': library.headers.get('ETag') } }), options);
    assert.equal(cached.status, 304);
    assert.equal((await handleSiteRequest(new Request('https://omnilabs.digital/ja/'), options)).status, 200);
    assert.equal((await handleSiteRequest(new Request('https://omnilabs.digital/ja'), options)).status, 308);
    for (const url of ['/server.js', '/package.json', '/.env', '/functions/api/contact.js', '/dist/index.html', '/js/%2e%2e/.env']) {
      assert.equal((await handleSiteRequest(new Request('https://omnilabs.digital' + url), options)).status, 404, url);
    }
  } finally { await rm(assetRoot, { recursive: true, force: true }); }
});

test('Hostinger contact adapter uses the existing verification and mail handler', async () => {
  let count = 0;
  const response = await handleSiteRequest(new Request('https://omnilabs.digital/api/contact?lang=ja', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://omnilabs.digital' },
    body: new URLSearchParams({ name: '山田 太郎', email: 'visitor@example.com', message: 'プロジェクトのご相談です。', 'cf-turnstile-response': 'test-token' }),
  }), { env: { SENDGRID_API_KEY: 'test', TURNSTILE_SECRET_KEY: 'test' }, fetcher: async () => ++count === 1
    ? Response.json({ success: true, hostname: 'omnilabs.digital', action: 'contact' }) : new Response(null, { status: 202 }) });
  assert.equal(count, 2);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), 'https://omnilabs.digital/ja/?contact=sent#contact');
});
