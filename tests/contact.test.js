import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContact, createContactGuard } from '../functions/api/contact.js';

const env = { SENDGRID_API_KEY: 'test-mail-secret',  };
const fields = { name: 'Test Person', email: 'visitor@example.com', message: 'A project inquiry\nwith multiple lines.', form_started: String(Date.now() - 10000), website: '' };
function context(overrides = {}, values = fields) {
  return { env, request: new Request('https://omnilabs.digital/api/contact', {
    method: 'POST', headers: { Origin: 'https://omnilabs.digital', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values), ...overrides,
  }) };
}
const unexpectedFetch = () => { throw new Error('Unexpected network call'); };
const outcome = (response) => new URL(response.headers.get('Location')).searchParams.get('contact');

test('valid request sends directly to SendGrid with only the mail key', async () => {
  const calls = [];
  const result = await handleContact(context(), async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 202 });
  });
  assert.equal(result.status, 303);
  assert.equal(outcome(result), 'sent');
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  const mail = JSON.parse(calls[0].init.body);
  assert.equal(mail.reply_to.email, fields.email);
  assert.equal(mail.from.email, 'malte@omnilabs.digital');
  assert.equal(mail.personalizations[0].to[0].email, 'malte@omnilabs.digital');
  assert.equal(mail.content[0].type, 'text/plain');
  assert.ok(mail.content[0].value.includes(fields.message));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.sendgrid.com/v3/mail/send');
});

test('GET and cross-origin requests are rejected without network access', async () => {
  const get = await handleContact(context({ method: 'GET', body: undefined }), unexpectedFetch);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('Allow'), 'POST');
  const cross = await handleContact(context({ headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/x-www-form-urlencoded' } }), unexpectedFetch);
  assert.equal(cross.status, 403);
});

test('invalid fields, duplicate fields, oversized body and unsupported formats cannot send mail', async () => {
  for (const values of [{ ...fields, name: 'Injected\r\nName' }, { ...fields, email: 'bad-email' }, { ...fields, message: 'x'.repeat(5001) }]) {
    assert.equal(outcome(await handleContact(context({}, values), unexpectedFetch)), 'invalid');
  }
  const duplicates = new URLSearchParams(fields);
  duplicates.append('email', 'second@example.com');
  assert.equal(outcome(await handleContact(context({ body: duplicates }), unexpectedFetch)), 'invalid');
  assert.equal(outcome(await handleContact(context({ body: 'x'.repeat(64001) }), unexpectedFetch)), 'invalid');
  assert.equal((await handleContact(context({ headers: { 'Content-Type': 'application/json' }, body: '{}' }), unexpectedFetch)).status, 415);
});

test('honeypot returns quietly; missing configuration never sends', async () => {
  assert.equal(outcome(await handleContact(context({}, { ...fields, website: 'spam' }), unexpectedFetch)), 'sent');
  const ctx = context(); ctx.env = {};
  assert.equal(outcome(await handleContact(ctx, unexpectedFetch)), 'unavailable');
});

test('missing, duplicate, too-fast, future and expired timestamps cannot send mail', async () => {
  for (const form_started of ['', String(Date.now()), String(Date.now() + 60000), String(Date.now() - 86401000)]) {
    assert.equal(outcome(await handleContact(context({}, { ...fields, form_started }), unexpectedFetch)), 'verification');
  }
  const body = new URLSearchParams(fields); body.append('form_started', fields.form_started);
  assert.equal(outcome(await handleContact(context({ body }), unexpectedFetch)), 'verification');
});

test('rate limiter bounds send attempts per email and across rotating emails, and expires', async () => {
  let now = 1000;
  const guard = createContactGuard(() => now);
  for (let i = 0; i < 3; i++) assert.equal(await guard('same@example.com'), true);
  assert.equal(await guard('SAME@example.com'), false);
  for (let i = 0; i < 27; i++) assert.equal(await guard(`sender${i}@example.com`), true);
  assert.equal(await guard('next@example.com'), false);
  now += 900000;
  assert.equal(await guard('same@example.com'), true);
  assert.equal(outcome(await handleContact(context(), unexpectedFetch, async () => false)), 'limited');
});

test('provider rejection and network failures produce safe unavailable responses', async () => {
  const failed = await handleContact(context(), async () => new Response('private-provider-diagnostic', { status: 403 }), createContactGuard());
  assert.equal(outcome(failed), 'unavailable');
  assert.equal(await failed.text(), '');
  const thrown = await handleContact(context(), async () => { throw new Error('private diagnostic'); }, createContactGuard());
  assert.equal(outcome(thrown), 'unavailable');
});

test('Japanese contact redirects stay localized and arbitrary redirect targets are ignored', async () => {
  for (const [lang, expectedPath] of [['ja', '/ja/'], ['https://attacker.example/', '/']]) {
    const ctx = context({}, { ...fields, name: '山田 太郎', message: 'Webサイト制作について相談したいです。', website: 'bot' });
    ctx.request = new Request(`https://omnilabs.digital/api/contact?lang=${encodeURIComponent(lang)}`, ctx.request);
    const response = await handleContact(ctx, unexpectedFetch);
    const location = new URL(response.headers.get('Location'));
    assert.equal(location.origin, 'https://omnilabs.digital');
    assert.equal(location.pathname, expectedPath);
    assert.equal(location.hash, '#contact');
  }
});
