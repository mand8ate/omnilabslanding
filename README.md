# Omni Labs Digital

English and Japanese website with GSAP motion, custom SVG illustrations and a JavaScript contact handler. The current deployment target is Hostinger Node.js hosting. The previous Cloudflare Worker adapter remains available.

## Hostinger deployment settings

| Setting | Value |
| --- | --- |
| Framework | Other |
| Root directory | `./` |
| Node version | `24.x` |
| Package manager | npm |
| Build command | `npm run build` |
| Output directory | `dist` |
| Entry file for the Node app | `server.js` |
| Start command, if requested | `npm start` |

Set the entry file to enable the Node application: publishing static files alone cannot run the contact handler. The Node server always serves only the public files in `dist/`. It does not serve the repository root or a nested `/dist/` URL.

The previous live deployment used **Output directory: none / Entry file: none**. That published the source index at `/` and the generated page under `/dist/index.html`. Its GSAP scripts returned 404 and the scroll SVG placeholder was never expanded. A successful build does not correct an incorrect publishing directory.

After changing the Hostinger settings, redeploy the updated GitHub commit. Confirm:

- `/` and `/ja/` show the generated site.
- `/js/gsap.min.js` and `/js/ScrollTrigger.min.js` return JavaScript, not an HTML 404 page.
- The source SVG placeholder `<!-- scroll-strand -->` is absent from the served HTML.
- `/dist/index.html`, `/server.js`, `/package.json` and dotfiles are not publicly served by the Node entry.
- A real contact submission passes verification and reaches the intended inbox.

[Hostinger deployment documentation](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)

## Contact configuration

Set these in Hostinger's environment settings, not in Git:

- `TURNSTILE_SITE_KEY`: public build-time key for the visible verification widget.
- `TURNSTILE_SECRET_KEY`: private runtime key for the matching widget.
- `SENDGRID_API_KEY`: private runtime mail-send key.
- `PUBLIC_ORIGIN`: `https://omnilabs.digital` in production.

Hostinger supplies `PORT` to the Node process. The local default is 3000. Verify `malte@omnilabs.digital` in SendGrid and allow the production hostname in Turnstile.

Both languages retain the form even if configuration is missing. English posts to `/api/contact`; Japanese posts to `/api/contact?lang=ja`. `server/app.js` and the Cloudflare Worker both call the shared handler in `functions/api/contact.js`. The handler verifies the token, hostname and action, then uses SendGrid's HTTP API. Private keys never enter the public build. Messages use plain text and fixed sender/recipient addresses, with the visitor email only as Reply-To.

## Local development and checks

Use Node.js 24 LTS (`.nvmrc` and `package.json` declare this version):

```sh
npm ci
npm test
npm run build
PUBLIC_ORIGIN=http://localhost:3000 npm start
```

For local form testing, copy `.env.example` to `.env` and use `npm run dev`. Use dedicated development keys and a test mailbox. Unit tests mock network calls and do not send email.

The Node server applies security headers and cache rules, caps incoming header/body time, supports ETags and denies non-public paths. The contact handler bounds streamed request bodies at 64 KB, validates fields, rejects duplicate fields and cross-origin browser submissions, uses a honeypot and requires server-verified Turnstile tokens. Add hosting-edge request rate limits where available. Provider acceptance is not an inbox-delivery guarantee.

## Runtime and dependency maintenance

The project targets Node 24 LTS rather than end-of-life Node 20. Select the current patched 24.x runtime in Hostinger; editing `.nvmrc` alone does not change an existing hosted application's selected version.

GSAP is pinned in `package-lock.json`. CI uses SHA-pinned GitHub Actions, Node 24, a clean npm install, an npm vulnerability audit, tests and a production build. A clean npm audit covers known package advisories; it does not audit the hosting runtime or account settings.

## Design and content

The section artwork is custom code-native SVG in `img/*-art.svg`. The real portrait and original company logos are retained. Only images referenced by the page and active CSS enter `dist/`; old raster source assets stay in the repository.

Featured work:

- gruen.jp — past website work.
- Hiveminds LLC — current work.
- GameDesk — product in development; the link is a staging preview.

S-Booster 2023 and Shigeru Umebayashi are earlier projects. Inactive Mieli Sweets is no longer featured as current work.

The original compiled stylesheet is `css/main.css`; current overrides live in `css/enhancements.css`. `js/motion.js` handles GSAP and scroll tracking; `js/index.js` handles the language selector and contact feedback. Public script/style URLs carry content hashes to avoid stale code after a deployment.

## Languages and discovery

English is at `/`, Japanese at `/ja/`. The build applies `locales/ja.json` to the shared source layout, producing full HTML in each language with reciprocal hreflang links, localized metadata and canonical URLs. New visible strings must be translated or explicitly retained as proper names. The native language selector preserves the current section; a noscript fallback provides normal links.

`robots.txt`, `sitemap.xml`, `llms.txt` and `llm.txt` assume the canonical hostname `omnilabs.digital`.

## Cloudflare alternative

`wrangler.toml` and `worker/index.js` still support Cloudflare Workers with static assets. `wrangler.pages.toml` and `functions/api/contact.js` support Pages. These files are not executed by Hostinger. Cloudflare environment secrets are not automatically transferred to Hostinger.
