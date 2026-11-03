import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

test('Worker reaches contact handler instead of falling through to static assets', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/contact'), {});
  assert.equal(response.status, 405);
});

test('Worker forwards ordinary requests to assets and rejects unknown API paths', async () => {
  let calls = 0;
  const env = { ASSETS: { fetch: async () => { calls++; return new Response('static'); } } };
  assert.equal(await (await worker.fetch(new Request('https://example.com/'), env)).text(), 'static');
  assert.equal((await worker.fetch(new Request('https://example.com/api/missing'), env)).status, 404);
  assert.equal(calls, 1);
});

test('retired PHP URLs redirect to contact without executing PHP', async () => {
  for (const name of ['email-form.php', 'sendgrid-form.php']) {
    const response = await worker.fetch(new Request(`https://example.com/${name}`), {});
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('Location'), 'https://example.com/#contact');
  }
});


test('actual form POST reaches serverless handler and redirects safely when credentials are absent', async () => {
  const response = await worker.fetch(new Request('https://omnilabs.digital/api/contact?lang=ja', {
    method: 'POST',
    headers: { Origin: 'https://omnilabs.digital', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name: '山田 太郎', email: 'visitor@example.com', message: '制作についてのご相談です。' }),
  }), {});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), 'https://omnilabs.digital/ja/?contact=unavailable#contact');
});
