# Omni Labs Digital

Static HTML/CSS/JavaScript with a JavaScript Cloudflare Pages Function at `/api/contact`. No PHP, Composer, database or runtime SDK dependencies. SendGrid remains the email provider, accessed through its HTTP API.

## Local checks

Use Node.js 20 or newer:

```sh
npm test
npm run build
```

`dist/` contains only public assets. Without `TURNSTILE_SITE_KEY`, the build shows the direct email contact instead of an unusable form. To preview the full form, set your public sitekey before building:

```sh
TURNSTILE_SITE_KEY=your_public_sitekey npm run build
cp .dev.vars.example .dev.vars
npm run dev
```

Fill `.dev.vars` locally with the private SendGrid API key and Turnstile secret. `npm run dev` uses Cloudflare's Wrangler CLI via npx; the first run may prompt to install it. Never put private keys into HTML or the public build environment. Use a dedicated Turnstile development widget with localhost allowed and a separate SendGrid sandbox account for delivery testing. Unit tests mock network calls and never send email.

A plain static server can preview `dist/`, but cannot execute the function.

## Deploy to Cloudflare Pages

1. Create a Pages project connected to this repository. Set the production branch to `main`, build command to `npm run build`, and output directory to `dist`. Use Node.js 22. Cloudflare discovers `functions/` at the repository root; do not upload only `dist/` through the dashboard's static drag-and-drop flow.
2. Create a Turnstile widget for the production hostnames. Add `TURNSTILE_SITE_KEY` as a public build variable. Configure a separate widget and allowed hostname for previews if the form should work there.
3. Add encrypted runtime secrets `TURNSTILE_SECRET_KEY` and `SENDGRID_API_KEY` under Pages Settings → Variables and Secrets. Set them separately for production and previews. Redeploy after configuration changes. The sender `malte@omnilabs.digital` must be verified in SendGrid; give the API key only the mail-send permission it needs.
4. Test the Pages deployment before changing DNS: valid submission, failed verification and provider failure. The function checks the Turnstile action `contact` and requires the verified hostname to match the incoming request hostname. A provider acceptance response is not an inbox-delivery guarantee.
5. Add `omnilabs.digital` as a Pages custom domain using Cloudflare's guided DNS setup. Preserve existing MX, SPF, DKIM and DMARC records. Keep the existing site online until staging checks pass. No account, DNS or production deployment changes were made by this implementation.
6. Enable an edge rate-limit rule for POST requests to `/api/contact` if available on your Cloudflare plan. Turnstile, origin checks, a honeypot, bounded input and fixed recipients are included; the function does not pretend an in-memory counter is a reliable distributed rate limiter.

The old automatic FTP/cPanel workflow was replaced by validation-only CI. Cloudflare Git integration owns deployment after it is connected. The GitHub `TURNSTILE_SITE_KEY` repository variable is optional for CI; the Cloudflare build variable controls the actual deployment.

If using the CLI instead of Git integration, build first and run `npx wrangler pages deploy dist` from the repository root so Wrangler includes `functions/`.

## Security and behavior

- Only `/api/contact` invokes a function; other assets remain static through `_routes.json`.
- Browser submissions use a standard URL-encoded POST and redirect back to the contact section with a status message. JavaScript is required for Turnstile, with a visible email alternative.
- Secrets stay in function bindings. Visitor email is used only as Reply-To; sender and recipient are fixed. Messages are plain text.
- Actual streamed bodies are capped at 64 KB, with field limits, duplicate-field rejection, same-origin checks, verification timeouts and generic delivery errors.
- `_headers` supplies static response security and cache rules. Function responses set their own headers. Cloudflare manages static compression. Verify response headers and real-world Core Web Vitals after deployment.
- `_redirects` keeps old PHP URLs pointing to contact. PHP and vendor files are excluded from builds and removed from the source tree. Retire those files on the old host when decommissioning it; a new Pages deployment does not delete files on cPanel.

## Site maintenance

The original stylesheet is `css/main.css`; current overrides are `css/enhancements.css`. SCSS and maps are legacy artifacts, not an active build pipeline. Original large PNGs are retained locally but excluded from deployment in favor of compressed JPGs.

`img/scroll-strand.svg` is drawn using requestAnimationFrame as the visitor scrolls. Reduced-motion preferences show a static path.

`robots.txt`, `sitemap.xml`, `llms.txt` and `llm.txt` assume the canonical URL https://omnilabs.digital/. These improve machine readability without guaranteeing search or AI placement. Review historical portfolio status text before describing it as current work.

References: [Pages Functions](https://developers.cloudflare.com/pages/functions/), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [SendGrid Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).
