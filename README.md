# Omni Labs Digital

Static HTML/CSS/JavaScript with a JavaScript Cloudflare Worker at `/api/contact`. No PHP, Composer, database or runtime SDK dependencies. SendGrid remains the email provider, accessed through its HTTP API.

## Local checks

Use Node.js 20 or newer:

```sh
npm ci
npm test
npm run build
```

`dist/` contains only public assets. The contact form is always included and posts to `/api/contact` (or `/api/contact?lang=ja`). Set `TURNSTILE_SITE_KEY` before building to enable its spam-verification widget:

```sh
TURNSTILE_SITE_KEY=your_public_sitekey npm run build
cp .dev.vars.example .dev.vars
npm run dev
```

Fill `.dev.vars` locally with the private SendGrid API key and Turnstile secret. `npm run dev` uses Cloudflare's Wrangler CLI via npx; the first run may prompt to install it. Never put private keys into HTML or the public build environment. Use a dedicated Turnstile development widget with localhost allowed and a separate SendGrid sandbox account for delivery testing. Unit tests mock network calls and never send email.

A plain static server can preview `dist/`, but cannot execute the function.

## Deploy to Cloudflare Workers (recommended for the current setup)

The default `wrangler.toml` defines `worker/index.js` as the entry point and `dist/` as static assets. This supports the standard `npx wrangler deploy` command used by Workers Builds. The Worker routes `/api/contact` to the shared contact handler; static assets are served directly.

In the Worker’s Git build settings use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root
- Node.js: 22

The existing Cloudflare Worker name must match `name` in `wrangler.toml` (`omnilabs-digital`), or change the config to the name you selected in Cloudflare.

1. Create a Turnstile widget for the production hostname. Add its public `TURNSTILE_SITE_KEY` to the Worker’s **build variables**. The form stays visible even if this variable is missing; submissions cannot pass verification until the widget and matching runtime secret are configured.
2. Add `TURNSTILE_SECRET_KEY` and `SENDGRID_API_KEY` as **runtime secrets** in the Worker settings. Configure preview environments separately if needed. Never add private keys to the public HTML or repository. Verify `malte@omnilabs.digital` as a SendGrid sender.
3. Deploy and test the generated workers.dev address before attaching the domain. Allow that hostname in the Turnstile widget if testing the form there. The function requires verified hostname and action `contact` to match.
4. Add `omnilabs.digital` as a custom domain only after staging checks pass. Preserve MX, SPF, DKIM and DMARC records. Retain the old site until cutover is verified. The agent does not access Cloudflare automatically; login, deployment, secrets and DNS setup remain user-managed.
5. Consider an edge rate-limit rule for POST `/api/contact` if available on your plan. Turnstile, origin checks, a honeypot and bounded input are included; there is no in-memory distributed rate-limit counter.

For a manual CLI deployment, run `npm run deploy` after you authenticate Wrangler yourself. This builds and deploys the site. GitHub CI only validates the repository; Cloudflare Git integration deploys it once configured.

### Alternative: Cloudflare Pages

Pages support remains available through `wrangler.pages.toml` and `functions/api/contact.js`. Create a Pages project with build command `npm run build` and output `dist`; explicitly select `wrangler.pages.toml` for CLI commands:

```sh
npx wrangler pages deploy dist --config wrangler.pages.toml
```

Do not use `wrangler deploy` with the Pages config. Do not upload only `dist/` with the dashboard’s static drag-and-drop flow: that does not include Pages Functions. Set the same public build variable and runtime secrets described above.

## Security and behavior

- Worker-first routing covers `/api/*` and retired PHP URLs. Other assets are served directly. Pages uses `_routes.json`; Workers excludes that Pages-only file from public assets.
- Browser submissions use a standard URL-encoded POST and redirect back to the contact section with a status message. JavaScript is required for Turnstile, with a visible email alternative.
- Secrets stay in function bindings. Visitor email is used only as Reply-To; sender and recipient are fixed. Messages are plain text.
- Actual streamed bodies are capped at 64 KB, with field limits, duplicate-field rejection, same-origin checks, verification timeouts and generic delivery errors.
- `_headers` supplies static response security and cache rules. Function responses set their own headers. Cloudflare manages static compression. Verify response headers and real-world Core Web Vitals after deployment.
- `_redirects` keeps old PHP URLs pointing to contact. PHP and vendor files are excluded from builds and removed from the source tree. Retire those files on the old host when decommissioning it; a new Pages deployment does not delete files on cPanel.

## Site maintenance

The original stylesheet is `css/main.css`; current overrides are `css/enhancements.css`. SCSS and maps are legacy artifacts, not an active build pipeline. Original large PNGs are retained locally but excluded from deployment in favor of compressed JPGs.

`img/scroll-strand.svg` is embedded by the build and adapted to measured section positions. Its visible leading point is solved from the SVG path’s actual Y coordinate and stays at 72% of viewport height while scrolling, with no scrub or easing delay. The canvas’s actual bounding box supplies the coordinate origin; viewport width and path arc length cannot change tracking speed.

Greensock (GSAP and ScrollTrigger) is pinned in `package-lock.json` and copied into the public build from npm, with no CDN requests. `js/motion.js` handles the hero assembly/ambient motion, pause control and scroll-scrubbed section/footer blocks. `js/index.js` independently handles language selection and contact feedback. Reduced-motion preferences show static graphics. CSS/script URLs carry content hashes to prevent stale animation code after deployment.

`robots.txt`, `sitemap.xml`, `llms.txt` and `llm.txt` assume the canonical URL https://omnilabs.digital/. These improve machine readability without guaranteeing search or AI placement. Review historical portfolio status text before describing it as current work.

References: [Pages Functions](https://developers.cloudflare.com/pages/functions/), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [SendGrid Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).

## English and Japanese

The build emits English at `/` and Japanese at `/ja/`. The native language dropdown retains the current section anchor when navigating. A noscript fallback provides ordinary language links. No automatic language redirect is imposed. Both pages include reciprocal hreflang links, their own canonical URL and localized metadata.

English content and shared layout live in `index.html`. Japanese copy is in `locales/ja.json`, applied at build time by `scripts/localize.mjs`, so visitors and search crawlers receive complete HTML. New visible English strings must have Japanese translations or be explicitly retained as brand names. Contact feedback, motion controls, input labels and spam verification are localized. Japanese form submissions return to `/ja/#contact`.
