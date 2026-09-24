/* ============================================================
   0xB0 GAMES — Ultraviolet configuration
   ------------------------------------------------------------
   This file works in TWO contexts at once:
     1. The Unblocker page   (as a classic <script>)
     2. The service worker   (via importScripts in sw.js)

   All paths + the /service/ prefix are computed from THIS
   file's own URL, so the proxy works no matter where the
   site is hosted (repo subfolder, custom domain, localhost).
   ============================================================ */

(function () {
  'use strict';

  /* Figure out where this file lives:
     - In the page:            document.currentScript.src  -> .../uv/uv.config.js
     - In the service worker: self.location.href          -> .../uv/sw.js
     Both resolve to the same uv/ directory. */
  var base;
  if (typeof document !== 'undefined' && document.currentScript) {
    base = new URL(document.currentScript.src);
  } else {
    base = new URL(self.location.href);
  }

  /* Absolute path (from site root) for a file inside uv/ */
  function p(file) {
    return new URL('./' + file, base).pathname;
  }

  var servers =
    typeof UV_BARE_SERVERS !== 'undefined' &&
    Array.isArray(UV_BARE_SERVERS) &&
    UV_BARE_SERVERS.length
      ? UV_BARE_SERVERS
      : '/bare/'; /* fallback — replaced by sw.js / settings panel */

  self.__uv$config = {
    /* Proxy URLs will look like:  <site>/uv/service/<encoded url> */
    prefix: p('service/'),

    /* Bare server(s) — see uv/servers.js to change these */
    bare: servers,

    /* URL scrambling (obfuscates the target from the address bar / filters) */
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,

    /* Runtime files */
    handler: p('uv.handler.js'),
    client: p('uv.client.js'),
    bundle: p('uv.bundle.js'),
    config: p('uv.config.js'),
    sw: p('uv.sw.js'),
  };
})();
