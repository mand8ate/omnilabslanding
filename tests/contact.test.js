import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContact } from '../functions/api/contact.js';

const env = { SENDGRID_API_KEY: 'test-mail-secret', TURNSTILE_SECRET_KEY: 'test-challenge-secret' };
const fields = { name: 'Test Person', email: 'visitor@example.com', message: 'A project inquiry\nwith multiple lines.', 'cf-turnstile-response': 'test-token', website: '' };
function context(overrides = {}, values = fields) {
  return { env, request: new Request('https://omnilabs.digital/api/contact', {
    method: 'POST', headers: { Origin: 'https://omnilabs.digital', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values), ...overrides,
  }) };
}
const unexpectedFetch = () => { throw new Error('Unexpected network call'); };
const outcome = (response) => new URL(response.headers.get('Location')).searchParams.get('contact');

test('valid request verifies action and hostname, then sends plain text to fixed recipient', async () => {
  const calls = [];
  const result = await handleContact(context(), async (url, init) => {
    calls.push({ url, init });
    return calls.length === 1 ? Response.json({ success: true, hostname: 'omnilabs.digital', action: 'contact' }) : new Response(null, { status: 202 });
  });
  assert.equal(result.status, 303);
  assert.equal(outcome(result), 'sent');
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  const mail = JSON.parse(calls[1].init.body);
  assert.equal(mail.reply_to.email, fields.email);
  assert.equal(mail.from.email, 'malte@omnilabs.digital');
  assert.equal(mail.personalizations[0].to[0].email, 'malte@omnilabs.digital');
  assert.equal(mail.content[0].type, 'text/plain');
  assert.ok(mail.content[0].value.includes(fields.message));
  assert.equal(calls[0].init.body.get('secret'), env.TURNSTILE_SECRET_KEY);
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

test('missing tokens and failed or mismatched challenge results cannot send mail', async () => {
  assert.equal(outcome(await handleContact(context({}, { ...fields, 'cf-turnstile-response': '' }), unexpectedFetch)), 'verification');
  for (const validation of [
    { success: false },
    { success: true, hostname: 'attacker.example', action: 'contact' },
    { success: true, hostname: 'omnilabs.digital', action: 'login' },
  ]) {
    let calls = 0;
    const result = await handleContact(context(), async () => { calls++; return Response.json(validation); });
    assert.equal(outcome(result), 'verification');
    assert.equal(calls, 1);
  }
});

test('provider rejection and network failures produce safe unavailable responses', async () => {
  let calls = 0;
  const failed = await handleContact(context(), async () => ++calls === 1
    ? Response.json({ success: true, hostname: 'omnilabs.digital', action: 'contact' })
    : new Response('private-provider-diagnostic', { status: 403 }));
  assert.equal(outcome(failed), 'unavailable');
  assert.equal(await failed.text(), '');
  const thrown = await handleContact(context(), async () => { throw new Error('private diagnostic'); });
  assert.equal(outcome(thrown), 'unavailable');
});
