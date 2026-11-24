const MAX_BYTES = 64000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const safeHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Best-effort, per-process limits. No email addresses are retained in limiter keys.
// Multiple instances have independent limits; restarts clear this bounded memory.
export function createContactGuard(now = Date.now) {
  const buckets = new Map();
  return async (email) => {
    const time = now();
    for (const [key, value] of buckets) if (value.until <= time) buckets.delete(key);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase()));
    const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const total = buckets.get('total') || { count: 0, until: time + 900000 };
    const sender = buckets.get(key) || { count: 0, until: time + 900000 };
    if (total.count >= 30 || sender.count >= 3 || (!buckets.has(key) && buckets.size >= 1000)) return false;
    total.count++; sender.count++;
    buckets.set('total', total); buckets.set(key, sender);
    return true;
  };
}
const allowContact = createContactGuard();

function redirect(request, result) {
  const home = new URL(request.url).searchParams.get('lang') === 'ja' ? '/ja/' : '/';
  return new Response(null, {
    status: 303,
    headers: { ...safeHeaders, Location: new URL(`${home}?contact=${result}#contact`, request.url).href },
  });
}

// Bound the actual streamed body, even when Content-Length is absent or false.
async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new Error('oversize');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error('oversize');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function handleContact({ request, env }, fetcher = fetch, guard = allowContact) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { ...safeHeaders, Allow: 'POST' } });
  }
  const url = new URL(request.url);
  // Same-origin only: works on production, preview deployments and local Wrangler.
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return new Response('Forbidden', { status: 403, headers: safeHeaders });
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') {
    return new Response('Unsupported media type', { status: 415, headers: safeHeaders });
  }
  let form;
  try { form = new URLSearchParams(await readBody(request)); }
  catch { return redirect(request, 'invalid'); }
  const field = (key) => form.getAll(key).length === 1 ? form.get(key).trim() : '';
  if (form.getAll('website').some(value => value.trim())) return redirect(request, 'sent');
  const name = field('name');
  const email = field('email');
  const message = field('message');

  if (!name || name.length > 120 || /[\r\n\x00-\x1f\x7f]/.test(name) ||
      email.length > 254 || !EMAIL.test(email) || /[\x00-\x1f\x7f]/.test(email) ||
      !message || message.length > 5000 || message.includes('\0')) return redirect(request, 'invalid');
  if (!env.SENDGRID_API_KEY) return redirect(request, 'unavailable');
  const started = Number(field('form_started'));
  const elapsed = Date.now() - started;
  if (!Number.isSafeInteger(started) || started <= 0 || elapsed < 3000 || elapsed > 86400000) {
    return redirect(request, 'verification');
  }
  if (!await guard(email)) return redirect(request, 'limited');
  try {
    const result = await fetcher('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'malte@omnilabs.digital', name: 'Malte' }] }],
        from: { email: 'malte@omnilabs.digital', name: 'Omni Labs Digital' },
        reply_to: { email, name },
        subject: 'Omni Labs Digital project inquiry',
        content: [{ type: 'text/plain', value: `Name: ${name}\nEmail: ${email}\n\n${message}` }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    // Acceptance by the provider is not a guarantee of inbox delivery.
    return redirect(request, result.ok ? 'sent' : 'unavailable');
  } catch {
    // Never expose provider responses, credentials or submitted personal data.
    return redirect(request, 'unavailable');
  }
}

export const onRequest = (context) => handleContact(context);
