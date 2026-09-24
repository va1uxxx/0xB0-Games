/* ============================================================
   0xB0 GAMES — Unblocker service worker (Ultraviolet)
   ------------------------------------------------------------
   Based on the stock Ultraviolet sw.js, extended with:
     - An "About:Blank" ...just kidding.
     - User-selected bare server support: the Unblocker page
       can postMessage a server URL here; it is saved in the
       Cache API so it survives service worker restarts.
   ============================================================ */
/*global UVServiceWorker, Ultraviolet, __uv$config, UV_BARE_SERVERS*/

importScripts('servers.js');
importScripts('uv.bundle.js');
importScripts('uv.config.js');
importScripts(__uv$config.sw || 'uv.sw.js');

const SERVERS_CACHE = '0xb0-uv-config';
const SERVERS_KEY = 'user-bare-servers';

async function readUserServers() {
  try {
    const cache = await caches.open(SERVERS_CACHE);
    const resp = await cache.match(SERVERS_KEY);
    if (resp) {
      const list = await resp.json();
      if (Array.isArray(list) && list.length) return list;
    }
  } catch (err) {
    /* Cache API unavailable — ignore, use defaults */
  }
  return null;
}

function applyServers(sw, list) {
  const arr = list || __uv$config.bare;
  const servers = (Array.isArray(arr) ? arr : [arr]).map(function (u) {
    return new URL(u, location).toString();
  });
  sw.address = servers[~~(Math.random() * servers.length)];
  sw.bareClient = new Ultraviolet.BareClient(sw.address);
}

async function saveUserServers(list) {
  try {
    const cache = await caches.open(SERVERS_CACHE);
    if (list) {
      await cache.put(SERVERS_KEY, new Response(JSON.stringify(list)));
    } else {
      await cache.delete(SERVERS_KEY);
    }
  } catch (err) {
    /* ignore */
  }
}

/* --- Boot the Ultraviolet proxy ------------------------------ */
const sw = new UVServiceWorker();
self.__uvSW = sw;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  event.respondWith(sw.fetch(event));
});

/* If the user picked a server in the Unblocker settings,
   swap it in right away (covers the very first page load). */
readUserServers().then(function (list) {
  if (list) applyServers(sw, list);
});

/* --- Messages from the Unblocker page ------------------------ */
self.addEventListener('message', function (event) {
  const data = event.data || {};
  if (data.type === '0xb0-set-bare') {
    const list =
      Array.isArray(data.servers) && data.servers.length ? data.servers : null;
    saveUserServers(list).then(function () {
      applyServers(sw, list);
      try {
        event.source.postMessage({
          type: '0xb0-bare-applied',
          servers: list,
        });
      } catch (err) {
        /* ignore */
      }
    });
  }
});
