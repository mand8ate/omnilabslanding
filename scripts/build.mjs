import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const sitekey = process.env.TURNSTILE_SITE_KEY || '';
if (sitekey && !/^[A-Za-z0-9_-]{10,100}$/.test(sitekey)) throw new Error('Invalid TURNSTILE_SITE_KEY');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
let html = await readFile(path.join(root, 'index.html'), 'utf8');
if (sitekey) {
  html = html.replace('<!-- contact-verification -->', `<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="contact" data-size="flexible"></div>`)
    .replace('<!-- contact-script -->', '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>');
} else {
  // A static preview remains useful without credentials. Do not show a broken form.
  html = html.replace(/<form\b[\s\S]*?<\/form>/, '<p class="contact-note">Please email Malte to discuss your project.</p>');
  console.warn('TURNSTILE_SITE_KEY is not set: the build shows email contact instead of the form.');
}
await writeFile(path.join(dist, 'index.html'), html);
// Explicit public-file allowlist prevents deployment of secrets, source and vendor code.
for (const name of ['robots.txt', 'llm.txt', 'llms.txt', 'sitemap.xml', '_headers', '_redirects', '_routes.json']) {
  await cp(path.join(root, name), path.join(dist, name));
}
for (const name of ['css/main.css', 'css/enhancements.css', 'js/index.js']) {
  await mkdir(path.dirname(path.join(dist, name)), { recursive: true });
  await cp(path.join(root, name), path.join(dist, name));
}
await mkdir(path.join(dist, 'img'));
const originals = new Set(['team_img.png', 'contact_img.png', 'blockchain_img.png', 'services_img.png', 'form_img.png', 'malte_img.png', 'surya.png']);
for (const name of await readdir(path.join(root, 'img'))) {
  if (!originals.has(name) && /\.(svg|png|jpe?g|webp|ico)$/.test(name)) {
    await cp(path.join(root, 'img', name), path.join(dist, 'img', name));
  }
}
await writeFile(path.join(dist, '.assetsignore'), '_routes.json\n');
console.log('Static site built in dist/. Worker entry point: worker/index.js.');
