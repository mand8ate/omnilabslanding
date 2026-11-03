const MAX_BYTES = 64000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const safeHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function redirect(request, result) {
  return new Response(null, {
    status: 303,
    headers: { ...safeHeaders, Location: new URL(`/?contact=${result}#contact`, request.url).href },
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

export async function handleContact({ request, env }, fetcher = fetch) {
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
  if (field('website')) return redirect(request, 'sent');
  const name = field('name');
  const email = field('email');
  const message = field('message');
  const token = field('cf-turnstile-response');
  if (!name || name.length > 120 || /[\r\n\x00-\x1f\x7f]/.test(name) ||
      email.length > 254 || !EMAIL.test(email) || /[\x00-\x1f\x7f]/.test(email) ||
      !message || message.length > 5000 || message.includes('\0')) return redirect(request, 'invalid');
  if (!env.SENDGRID_API_KEY || !env.TURNSTILE_SECRET_KEY) return redirect(request, 'unavailable');
  if (!token || token.length > 2048) return redirect(request, 'verification');
  try {
    const verification = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) verification.set('remoteip', ip);
    const challenge = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: verification, signal: AbortSignal.timeout(8000),
    });
    if (!challenge.ok) return redirect(request, 'unavailable');
    const validation = await challenge.json();
    if (validation.success !== true || validation.hostname !== url.hostname || validation.action !== 'contact') {
      return redirect(request, 'verification');
    }
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
