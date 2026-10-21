/* ============================================================
   0xB0 GAMES — CDN ENTRY-PAGE HOST   (used by game-host.html)
   ============================================================
   WHY THIS EXISTS
   ---------------
   Some CDNs hand out .html with  Content-Type: text/plain  on
   purpose, to stop people using them to host phishing pages.
   Chrome then renders the file as SOURCE CODE instead of
   running it, so an <iframe src="that-cdn/game/index.html">
   shows a wall of HTML text instead of a game.

   cdn.statically.io does exactly this. Its .js, .css, images,
   fonts and audio all come back with the correct types — ONLY
   the .html entry file is wrong.

   THE FIX
   -------
   Don't iframe the entry file. fetch() it (the CDN sends
   access-control-allow-origin: *, so this is allowed), inject a
   <base href> pointing back at the CDN folder, and document.write
   the result into this page. The game's real relative URLs then
   resolve against the CDN and everything loads normally, while
   the page itself is a genuine text/html document.

   SAFETY
   ------
   * Only hosts in WRAPPED_HOSTS may be fetched, and only slugs
     that already exist in the game registry — so this can never
     be abused as an open fetch proxy.
   * play.html puts this page in a sandboxed iframe WITHOUT
     allow-same-origin, so a game runs on an opaque origin and
     cannot touch 0xB0 accounts, settings or high scores.
     The STORAGE_SHIM below stands in for localStorage so games
     that expect it don't crash.
   ============================================================ */
/*global findGame*/

(function () {
  'use strict';

  var WRAPPED_HOSTS = ['cdn.statically.io'];

  var msg = document.getElementById('hostMsg');
  var boot = document.getElementById('hostBoot');
  var slug = new URLSearchParams(location.search).get('g');

  /* Tell play.html what is happening so its "Booting game…" overlay can
     get out of the way at the right moment. play.html only ever listens
     for messages coming from its own iframe. */
  function notify(state) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { b0: 'game-host', state: state, slug: slug || '' }, '*'
        );
      }
    } catch (err) { /* a locked-down parent is fine, just no overlay sync */ }
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fail(text) {
    notify('error');
    if (!boot) return;
    boot.innerHTML =
      '<div class="boot-error">' +
      '<div class="boot-emoji">⚠️</div>' +
      '<h3>This game won’t load</h3>' +
      '<p>' + esc(text) + '</p>' +
      '<div class="boot-actions">' +
      '<button class="btn btn-primary" id="hostRetry">↻ Retry</button>' +
      '<a class="btn btn-ghost" href="index.html">🎮 All games</a>' +
      '<a class="btn btn-ghost" href="proxy-links.html">🔗 Proxy links</a>' +
      '</div></div>';
    var retry = document.getElementById('hostRetry');
    if (retry) retry.addEventListener('click', function () { location.reload(); });
  }

  function allowed(url) {
    for (var i = 0; i < WRAPPED_HOSTS.length; i++) {
      if (url.indexOf('https://' + WRAPPED_HOSTS[i] + '/') === 0) return true;
    }
    return false;
  }

  /* folder the entry file lives in — the game's relative URLs
     are resolved against this via <base href> */
  function dirOf(url) {
    var hash = url.indexOf('#');
    if (hash !== -1) url = url.slice(0, hash);
    var q = url.indexOf('?');
    if (q !== -1) url = url.slice(0, q);
    return url.slice(0, url.lastIndexOf('/') + 1);
  }

  /* an in-memory stand-in for localStorage / sessionStorage.
     A sandboxed (opaque-origin) document throws on access, which
     would take whole games down, so shadow the property instead.
     Saves last for the session only — that is the trade-off for
     keeping games from reaching the real 0xB0 storage. */
  var STORAGE_SHIM =
    '<script>(function(){' +
    'function install(name){' +
    'try{void window[name];return;}catch(e){}' +
    'var s={};' +
    'var a={' +
    'getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null;},' +
    'setItem:function(k,v){s[String(k)]=String(v);},' +
    'removeItem:function(k){delete s[String(k)];},' +
    'clear:function(){s={};},' +
    'key:function(i){var k=Object.keys(s);return i<k.length?k[i]:null;}' +
    '};' +
    'try{Object.defineProperty(a,"length",{get:function(){return Object.keys(s).length;}});}catch(e){}' +
    'try{Object.defineProperty(window,name,{configurable:true,get:function(){return a;}});}catch(e){}' +
    '}' +
    'install("localStorage");install("sessionStorage");' +
    /* cookies are refused outright on an opaque origin, so give games
       a silent in-memory stand-in instead of an exception           */
    'try{var c={};Object.defineProperty(document,"cookie",{configurable:true,' +
    'get:function(){var p=[];for(var k in c)p.push(k+"="+c[k]);return p.join("; ");},' +
    'set:function(v){var kv=String(v).split(";")[0].split("=");if(kv.length>1)c[kv[0].trim()]=kv.slice(1).join("=").trim();}});}catch(e){}' +
    '})();<\/script>';

  function inject(html, base) {
    var head = '<base href="' + base + '">' + STORAGE_SHIM;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, function (m) { return m + head; });
    }
    if (/<html[^>]*>/i.test(html)) {
      return html.replace(/<html[^>]*>/i, function (m) {
        return m + '<head>' + head + '</head>';
      });
    }
    return head + html;
  }

  if (!slug || typeof findGame !== 'function') {
    fail('No game was specified.');
    return;
  }

  var game = findGame(slug);
  var src = game && game.src;

  if (!src) {
    fail('That game isn’t in the catalog.');
    return;
  }
  if (!allowed(src)) {
    fail('That game is served from a host this page isn’t allowed to load.');
    return;
  }

  if (msg) {
    msg.textContent = 'Loading ' + (game.title || 'game') + '…';
  }

  var finished = false;

  /* The first visit to a game pulls its whole folder through the CDN, so
     this is deliberately generous — 30s of "Loading…" beats a false
     error on a slow connection. */
  var giveUp = setTimeout(function () {
    if (finished) return;
    fail('The game’s host didn’t answer in time. It may be blocked on this ' +
      'network or temporarily down.');
  }, 30000);

  fetch(src, { credentials: 'omit', mode: 'cors', redirect: 'follow' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (html) {
      if (!/<html|<!doctype/i.test(html.slice(0, 600))) {
        throw new Error('not an html document');
      }
      finished = true;
      clearTimeout(giveUp);
      /* replace this whole document with the game */
      document.open();
      document.write(inject(html, dirOf(src)));
      document.close();
      notify('ready');
    })
    .catch(function () {
      if (finished) return;
      finished = true;
      clearTimeout(giveUp);
      fail('The game’s files couldn’t be fetched from its host. It may be ' +
        'blocked on this network or temporarily down.');
    });
})();
