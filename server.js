import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { handleSiteRequest } from './server/app.js';

const publicOrigin = new URL(process.env.PUBLIC_ORIGIN || 'https://omnilabs.digital').origin;
const port = Number(process.env.PORT || 3000);
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const target = new URL(incoming.url, publicOrigin);
    const url = new URL(target.pathname + target.search, publicOrigin);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined && name !== 'cf-connecting-ip') headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const method = incoming.method || 'GET';
    const request = new Request(url, { method, headers, ...(!['GET', 'HEAD'].includes(method)
      ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
    const response = await handleSiteRequest(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    outgoing.end('Unable to process the request');
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 50;
server.listen(port, '0.0.0.0', () => console.log(`Omni Labs Digital listening on port ${port}`));
