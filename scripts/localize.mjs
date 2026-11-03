import { readFile } from 'node:fs/promises';
const translations = JSON.parse(await readFile(new URL('../locales/ja.json', import.meta.url), 'utf8'));
const retained = new Set(['omni', '.', 'LABS DIGITAL', 'EN', 'JP', '↗', 'Ⅱ', 'S-Booster 2023', 'mielisweets.com', 'shigeru-umebayashi.com', 'malte@omnilabs.digital', 'Omni', 'Labs Digital']);
const normalize = text => text.replace(/&amp;/g, '&').replace(/&copy;/g, '©').replace(/\s+/g, ' ').trim();
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function japanesePage(html) {
  let localized = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<[^>]+>|[^<]+/g, token => {
    if (token.startsWith('<script')) return token;
    if (token.startsWith('<')) return token.replace(/\b(alt|aria-label|placeholder|value|title|content)="([^"]*)"/g, (match, attr, value) => {
      const translation = translations[normalize(value)];
      return translation === undefined ? match : `${attr}="${escape(translation)}"`;
    });
    const text = normalize(token);
    if (!text) return token;
    if (translations[text] !== undefined) return token.replace(/\S[\s\S]*\S|\S/, escape(translations[text]));
    if (!retained.has(text)) throw new Error(`Missing Japanese translation: ${text}`);
    return token;
  });
  localized = localized.replace('<html lang="en">', '<html lang="ja">')
    .replace('rel="canonical" href="https://omnilabs.digital/"', 'rel="canonical" href="https://omnilabs.digital/ja/"')
    .replace('property="og:url" content="https://omnilabs.digital/"', 'property="og:url" content="https://omnilabs.digital/ja/"')
    .replace('property="og:locale" content="en_US"', 'property="og:locale" content="ja_JP"')
    .replace('property="og:locale:alternate" content="ja_JP"', 'property="og:locale:alternate" content="en_US"')
    .replace('data-language="en" aria-label="English" aria-current="page"', 'data-language="en" aria-label="English"')
    .replace('data-language="ja" aria-label="日本語"', 'data-language="ja" aria-label="日本語" aria-current="page"')
    .replace(/href="\/" class="(brand|logo-header-left|logo-footer)"/g, 'href="/ja/" class="$1"')
    .replace('action="/api/contact"', 'action="/api/contact?lang=ja"')
    .replace('data-action="contact"', 'data-action="contact" data-language="ja"');
  return localized;
}
