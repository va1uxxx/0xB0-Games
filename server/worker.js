/**
 * ─────────────────────────────────────────────────────────────
 *  0xB0 BARE SERVER — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────
 *  A minimal, self-contained Bare Protocol v2 server.
 *  Deploy this to Cloudflare Workers (free, no credit card) and
 *  paste the URL into the 0xB0 Unblocker settings. Done.
 *
 *  HOW TO DEPLOY (2 minutes):
 *  1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *  2. Click "Create Worker" → give it any name → click "Deploy"
 *  3. Click "Edit code" → delete everything → paste THIS ENTIRE FILE
 *  4. Click "Deploy" → copy your URL (like https://your-name.your-subdomain.workers.dev)
 *  5. Open the 0xB0 Unblocker → ⚙ Settings → paste your URL → Save
 *
 *  Your worker URL is unique — no school filter has ever blocked it.
 * ─────────────────────────────────────────────────────────────
 */

const VERSIONS = ['v2'];
const MAX_HEADER_VALUE = 3072;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': '*',
  'access-control-max-age': '7200',
  'x-robots-tag': 'noindex',
};

const DEFAULT_FORWARD = [
  'accept-encoding', 'accept-language',
  'sec-websocket-extensions', 'sec-websocket-key', 'sec-websocket-version'
];

const DEFAULT_PASS = ['content-encoding', 'content-length', 'last-modified'];
const CACHE_FORWARD = ['if-modified-since', 'if-none-match', 'cache-control'];
const CACHE_PASS = ['cache-control', 'etag'];
const NO_BODY_STATUS = [204, 205, 304];
const REDIRECT_STATUS = [301, 302, 303, 307, 308];

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

function joinSplitHeaders(headers) {
  const out = new Headers(headers);
  const prefix = 'x-bare-headers';
  if (headers.has(`${prefix}-0`)) {
    const parts = [];
    for (const [name, value] of headers) {
      if (name.startsWith(prefix) && name !== prefix) {
        if (!value.startsWith(';')) {
          return null; /* malformed */
        }
        const id = parseInt(name.slice(prefix.length + 1));
        parts[id] = value.slice(1);
      }
    }
    out.delete(`${prefix}-0`);
    /* rebuild */
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] !== undefined) {
        out.set(prefix, parts.join(''));
        break;
      }
    }
  }
  return out;
}

function readBareRequest(request) {
  const headers = joinSplitHeaders(request.headers) || request.headers;
  const remote = {};
  const sendHeaders = {};
  const passHeaders = [...DEFAULT_PASS];
  const passStatus = [];
  const forwardHeaders = [...DEFAULT_FORWARD];

  /* read the target URL parts */
  for (const prop of ['host', 'port', 'protocol', 'path']) {
    const h = `x-bare-${prop}`;
    if (headers.has(h)) {
      const val = headers.get(h);
      if (prop === 'port') {
        if (isNaN(parseInt(val))) throw new Error(`Invalid port: ${val}`);
      }
      if (prop === 'protocol') {
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(val)) {
          throw new Error(`Invalid protocol: ${val}`);
        }
      }
      remote[prop] = val;
    } else {
      throw new Error(`Missing header: ${h}`);
    }
  }

  /* read the headers to send */
  if (headers.has('x-bare-headers')) {
    const raw = headers.get('x-bare-headers');
    const parsed = JSON.parse(raw);
    for (const key in parsed) {
      const val = parsed[key];
      if (typeof val === 'string') {
        sendHeaders[key] = val;
      } else if (Array.isArray(val)) {
        sendHeaders[key] = val;
      }
    }
  } else {
    throw new Error('Missing header: x-bare-headers');
  }

  /* pass-status */
  if (headers.has('x-bare-pass-status')) {
    for (const s of headers.get('x-bare-pass-status').split(',')) {
      const n = parseInt(s.trim());
      if (!isNaN(n)) passStatus.push(n);
    }
  }

  /* pass-headers */
  if (headers.has('x-bare-pass-headers')) {
    for (const h of headers.get('x-bare-pass-headers').split(',')) {
      passHeaders.push(h.trim().toLowerCase());
    }
  }

  /* forward-headers */
  if (headers.has('x-bare-forward-headers')) {
    for (const h of headers.get('x-bare-forward-headers').split(',')) {
      forwardHeaders.push(h.trim().toLowerCase());
    }
  }

  /* cache mode */
  const isCache = new URL(request.url).searchParams.has('cache');
  if (isCache) {
    passHeaders.push(...CACHE_PASS);
    passStatus.push(304);
    forwardHeaders.push(...CACHE_FORWARD);
  }

  /* forward the allowed headers from the client request */
  for (const h of forwardHeaders) {
    if (request.headers.has(h)) {
      sendHeaders[h] = request.headers.get(h);
    }
  }

  return { remote, sendHeaders, passHeaders, passStatus };
}

/* ─── HTTP proxy handler ─── */
async function handleTunnel(request) {
  const { remote, sendHeaders, passHeaders, passStatus } = readBareRequest(request);

  const targetUrl = `${remote.protocol}//${remote.host}:${remote.port}${remote.path}`;

  const init = {
    method: request.method,
    headers: sendHeaders,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
  }

  const response = await fetch(targetUrl, init);

  /* build the bare response */
  const outHeaders = new Headers();

  for (const h of passHeaders) {
    if (response.headers.has(h)) {
      outHeaders.set(h, response.headers.get(h));
    }
  }

  const status = passStatus.includes(response.status) ? response.status : 200;

  if (status !== 304) {
    outHeaders.set('x-bare-status', response.status.toString());
    outHeaders.set('x-bare-status-text', response.statusText || '');
    outHeaders.set('x-bare-headers', JSON.stringify(Object.fromEntries(response.headers)));

    /* split x-bare-headers if too large */
    if (outHeaders.get('x-bare-headers').length > MAX_HEADER_VALUE) {
      const value = outHeaders.get('x-bare-headers');
      outHeaders.delete('x-bare-headers');
      let split = 0;
      for (let i = 0; i < value.length; i += MAX_HEADER_VALUE) {
        outHeaders.set(`x-bare-headers-${split++}`, ';' + value.slice(i, i + MAX_HEADER_VALUE));
      }
    }
  }

  for (const [k, v] of Object.entries(CORS)) {
    outHeaders.set(k, v);
  }

  const body = NO_BODY_STATUS.includes(response.status) ? undefined : response.body;
  return new Response(body, { status, headers: outHeaders });
}

/* ─── WebSocket proxy handler ─── */
async function handleWebSocket(request) {
  /* accept the client's WebSocket */
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  /* the target info is in the WebSocket sub-protocol */
  const [bareProtocol, encoded] = (request.headers.get('sec-websocket-protocol') || '').split(', ');
  if (bareProtocol !== 'bare') {
    server.close(1002, 'Missing bare sub-protocol');
    return new Response(null, { status: 101, webSocket: client });
  }

  /* decode the request from the sub-protocol */
  let meta;
  try {
    const decoded = decodeURIComponent(encoded);
    meta = JSON.parse(decoded);
  } catch (e) {
    server.close(1002, 'Invalid bare sub-protocol');
    return new Response(null, { status: 101, webSocket: client });
  }

  const { remote, sendHeaders, forward_headers: forwardHeaders } = meta;

  /* build the target WebSocket URL */
  const wsProtocol = remote.protocol === 'ws:' ? 'http:' : 'https:';
  const wsUrl = `${wsProtocol}//${remote.host}:${remote.port}${remote.path}`;

  /* forward headers */
  for (const h of (forwardHeaders || [])) {
    if (request.headers.has(h)) {
      sendHeaders[h] = request.headers.get(h);
    }
  }

  /* connect to the target WebSocket */
  let targetResponse;
  try {
    targetResponse = await fetch(wsUrl, {
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        ...sendHeaders,
      },
    });
  } catch (e) {
    server.close(1011, 'Failed to connect to target');
    return new Response(null, { status: 101, webSocket: client });
  }

  if (!targetResponse.webSocket) {
    server.close(1011, 'Target did not accept WebSocket');
    return new Response(null, { status: 101, webSocket: client });
  }

  const target = targetResponse.webSocket;
  target.accept();

  /* proxy messages bidirectionally */
  server.addEventListener('message', (event) => {
    try {
      target.send(event.data);
    } catch (e) {
      server.close(1011, 'Send failed');
    }
  });

  target.addEventListener('message', (event) => {
    try {
      server.send(event.data);
    } catch (e) {
      target.close(1011, 'Send failed');
    }
  });

  server.addEventListener('close', (event) => {
    try { target.close(event.code, event.reason); } catch (e) {}
  });

  target.addEventListener('close', (event) => {
    try { server.close(event.code, event.reason); } catch (e) {}
  });

  server.addEventListener('error', () => {
    try { target.close(); } catch (e) {}
  });

  target.addEventListener('error', () => {
    try { server.close(); } catch (e) {}
  });

  return new Response(null, { status: 101, webSocket: client });
}

/* ─── main entry point ─── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* CORS preflight */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS });
    }

    /* manifest — tells the Ultraviolet client what we support */
    if (url.pathname === '/' || url.pathname === '') {
      return json(200, {
        versions: VERSIONS,
        language: 'JavaScript',
        memoryUsage: 0,
        project: {
          name: '0xB0 Bare Server',
          description: 'Minimal bare server for Cloudflare Workers',
          version: '1.0.0',
        },
      });
    }

    /* v2 endpoint */
    if (url.pathname === '/v2/' || url.pathname === '/v2') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS });
      }

      /* WebSocket upgrade */
      if (request.headers.get('upgrade') === 'websocket') {
        return handleWebSocket(request);
      }

      /* HTTP tunnel */
      try {
        return await handleTunnel(request);
      } catch (err) {
        if (err instanceof SyntaxError) {
          return json(400, {
            code: 'INVALID_BARE_HEADER',
            id: 'request.headers.x-bare-headers',
            message: `Invalid JSON: ${err.message}`,
          });
        }
        return json(500, {
          code: 'UNKNOWN',
          message: err.message || 'Internal server error',
        });
      }
    }

    /* not found */
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain', ...CORS },
    });
  },
};
