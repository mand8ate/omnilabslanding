import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { handleContact } from '../functions/api/contact.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
// Hostinger's LiteSpeed loader uses require(); keep the startup module graph synchronous.
const policy = readFileSync(new URL('../_headers', import.meta.url), 'utf8').match(/Content-Security-Policy: (.+)/)[1];
const security = {
  'Content-Security-Policy': policy,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
const notFound = () => new Response('Not found', { status: 404, headers: security });

export async function handleSiteRequest(request, { env = process.env, fetcher = fetch, assetRoot = root } = {}) {
  const url = new URL(request.url);
  if (url.pathname === '/api/contact') return handleContact({ request, env }, fetcher);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...security, Allow: 'GET, HEAD' } });
  if (['/email-form.php', '/sendgrid-form.php'].includes(url.pathname)) return Response.redirect(new URL('/#contact', url).href, 301);
  if (url.pathname === '/ja') return Response.redirect(new URL('/ja/' + url.search + url.hash, url).href, 308);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return notFound(); }
  // Serve only public output paths. The repository, dist prefix and server source stay private.
  const page = pathname === '/' ? 'index.html' : pathname === '/ja/' ? 'ja/index.html' : pathname.slice(1);
  const publicFile = ['index.html', 'ja/index.html', 'robots.txt', 'llm.txt', 'llms.txt', 'sitemap.xml'].includes(page)
    || /^(css|js|img)\/[A-Za-z0-9][A-Za-z0-9_.-]*\.(css|js|svg|png|jpg|webp|ico)$/.test(page);
  if (!publicFile) return notFound();
  try {
    const bytes = await readFile(path.join(assetRoot, page));
    const type = types[path.extname(page)];
    const etag = '"' + createHash('sha256').update(bytes).digest('hex').slice(0, 24) + '"';
    const headers = { ...security, 'Content-Type': type, ETag: etag,
      'Cache-Control': page.endsWith('.html') ? 'no-cache' : url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' };
    if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : bytes, { headers });
  } catch { return notFound(); }
}
