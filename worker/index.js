import { handleContact } from '../functions/api/contact.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') return handleContact({ request, env });
    if (pathname.startsWith('/api/')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      });
    }
    if (pathname === '/email-form.php' || pathname === '/sendgrid-form.php') {
      return Response.redirect(new URL('/#contact', request.url).href, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
