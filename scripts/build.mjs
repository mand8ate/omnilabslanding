import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { japanesePage } from './localize.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const sitekey = process.env.TURNSTILE_SITE_KEY || '';
if (sitekey && !/^[A-Za-z0-9_-]{10,100}$/.test(sitekey)) throw new Error('Invalid TURNSTILE_SITE_KEY');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const strand = await readFile(path.join(root, 'img/scroll-strand.svg'), 'utf8');
html = html.replace('<!-- scroll-strand -->', strand.replace('id="strand"', 'id="scroll-strand-path"').replace('<svg ', '<svg focusable="false" '));
if (sitekey) {
  html = html.replace('<!-- contact-verification -->', `<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="contact" data-size="flexible"></div>`)
    .replace('<!-- contact-script -->', '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>');
} else {
  // Missing deployment configuration must never remove the contact form.
  console.warn('TURNSTILE_SITE_KEY is not set. The contact form remains visible; configure the public site key and runtime secrets before accepting submissions.');
}
// Version CSS and scripts so a new deployment cannot reuse the previous animation code.
for (const asset of new Set(Array.from(html.matchAll(/(?:src|href)="\/((?:css|js)\/[^"]+)"/g), match => match[1]))) {
  const source = asset === 'js/gsap.min.js' || asset === 'js/ScrollTrigger.min.js'
    ? path.join(root, 'node_modules/gsap/dist', path.basename(asset)) : path.join(root, asset);
  const hash = createHash('sha256').update(await readFile(source)).digest('hex').slice(0, 12);
  html = html.replaceAll(`"/${asset}"`, `"/${asset}?v=${hash}"`);
}
await writeFile(path.join(dist, 'index.html'), html);
await mkdir(path.join(dist, 'ja'), { recursive: true });
await writeFile(path.join(dist, 'ja/index.html'), japanesePage(html));
// Explicit public-file allowlist prevents deployment of secrets, source and vendor code.
for (const name of ['robots.txt', 'llm.txt', 'llms.txt', 'sitemap.xml', '_headers', '_redirects', '_routes.json']) {
  await cp(path.join(root, name), path.join(dist, name));
}
for (const name of ['css/main.css', 'css/enhancements.css', 'js/index.js', 'js/motion.js']) {
  await mkdir(path.dirname(path.join(dist, name)), { recursive: true });
  await cp(path.join(root, name), path.join(dist, name));
}
for (const name of ['gsap.min.js', 'ScrollTrigger.min.js']) {
  await cp(path.join(root, 'node_modules/gsap/dist', name), path.join(dist, 'js', name));
}
await mkdir(path.join(dist, 'img'));
const images = new Set(['img/scroll-strand.svg']);
for (const match of html.matchAll(/(?:src|href)="\/(img\/[^"?#]+)"/g)) images.add(match[1]);
for (const stylesheet of ['css/main.css', 'css/enhancements.css']) {
  const css = await readFile(path.join(root, stylesheet), 'utf8');
  for (const match of css.matchAll(/url\(["']?\.\.\/(img\/[^"')]+)["']?\)/g)) images.add(match[1]);
}
for (const asset of images) await cp(path.join(root, asset), path.join(dist, asset));
await writeFile(path.join(dist, '.assetsignore'), '_routes.json\n');
console.log('Built public website in dist/. Hostinger Node entry: server.js; Cloudflare Worker entry: worker/index.js.');
