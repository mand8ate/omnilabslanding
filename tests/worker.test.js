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
