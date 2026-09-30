/* ============================================================
   0xB0 GAMES - the Game Rip
   ------------------------------------------------------------
   The same idea as every "game.html?game=..." unblocked site,
   built our way:

     rip.html?g=<the game's own url>

   The page stays on our github.io address, so a web filter only
   ever sees github.io, and the game runs inside a sandboxed
   frame.  Nothing about the rip is stored on a server - the
   address bar *is* the save file, so a rip can be shared by
   copying the link.

   ENGINES
   -------
   auto   guess from the URL, then let the player override
   html5  plain <iframe> of the page
   flash  the Ruffle emulator, hosted on flash.html
   unity  a Unity WebGL build, which is just a page - same as
          html5, but we keep the label so the address bar says
          what you are playing

   SECURITY
   --------
   Cross-origin rips (which is all of them - see cleanUrl) run in a
   frame that is sandboxed with allow-same-origin but WITHOUT any
   allow-top-navigation flag.  That combination is deliberate:

     * allow-same-origin lets the frame keep its OWN real origin, so
       modern Unity WebGL builds (which use the Cache Storage API)
       and incremental games that save to localStorage work.  On an
       opaque origin those APIs throw SecurityError and the game
       simply never starts.
     * an iframe's src is cross-origin, so the same-origin policy
       still applies: a ripped game cannot read this site's
       accounts, settings or saved scores out of localStorage.  Only
       localStorage this site owns - nothing it does is readable.
     * without allow-top-navigation the game cannot do
       window.top.location = 'https://phishing.example', so a hostile
       rip cannot tabnab the address bar.

   Flash is the exception.  Its Ruffle host (flash.html) is one of
   OUR pages, so giving that frame allow-same-origin would hand the
   .swf our origin and its ActionScript bridge our localStorage.
   The Flash frame therefore drops allow-same-origin and runs opaque;
   .swf hosts send permissive CORS headers, so Ruffle can still
   fetch the file, and old Flash games do not need Cache Storage.
   ============================================================ */

(function () {
  'use strict';

  var RIPS_KEY = '0xb0-rips-v1';
  var HISTORY_MAX = 12;

  /* Fullscreen is granted through the Permissions Policy in the
     iframe's `allow` attribute; `allowfullscreen` is the older
     equivalent and Chrome warns if both are present. */
  var BASE_FLAGS = 'allow-scripts allow-forms allow-modals allow-popups ' +
    'allow-pointer-lock allow-downloads allow-orientation-lock ' +
    'allow-presentation';

  var SANDBOX_CROSS = BASE_FLAGS + ' allow-same-origin';
  var SANDBOX_OPAQUE = BASE_FLAGS;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- tiny helpers ---------------------------------- */

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* A rip only makes sense for http(s).  javascript:, data:, blob:
     and file: either cannot be framed or would turn this page into
     an XSS hole, so they are refused outright.  Our own pages are
     refused too - framing ourselves would put this site's accounts
     inside the game's reach, and it is never what anyone wants. */
  function cleanUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return null;
    /* people paste URLs that lost their scheme */
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v.replace(/^\/+/, '');
    /* and ones that got wrapped in quotes or angle brackets */
    v = v.replace(/^["'<]+/, '').replace(/["'>]+$/, '');
    var u;
    try { u = new URL(v); } catch (err) { return null; }
    if (u.origin === location.origin) return 'self';
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    /* a bare word like "games" is a search term, not a host. localhost
       is a real host too - it is what the preview server runs on. */
    if (u.hostname !== 'localhost' && u.hostname.indexOf('.') === -1) return null;
    return u.href;
  }

  function guessEngine(url) {
    if (/\.swf(?:$|\?)/i.test(url)) return 'flash';
    if (/\.wasm(?:$|\?)/i.test(url) ||
        /\/Build\//i.test(url) ||
        /\/Release\//i.test(url) ||
        /UnityLoader/i.test(url)) return 'unity';
    return 'html5';
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (err) { return String(url || '').slice(0, 40); }
  }

  function prettyName(url, engine) {
    var host = hostOf(url);
    if (engine === 'flash') return host + ' (Flash)';
    if (engine === 'unity') return host + ' (Unity)';
    return host;
  }

  /* ---------- recently ripped ------------------------------- */

  function loadHistory() {
    try {
      var raw = localStorage.getItem(RIPS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) { return []; }
  }

  function remember(url, engine) {
    try {
      var list = loadHistory().filter(function (r) { return r.url !== url; });
      list.unshift({ url: url, engine: engine, at: Date.now() });
      if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
      localStorage.setItem(RIPS_KEY, JSON.stringify(list));
    } catch (err) { /* private mode - history is a nicety, not a feature */ }
  }

  function forget(url) {
    try {
      localStorage.setItem(RIPS_KEY, JSON.stringify(
        loadHistory().filter(function (r) { return r.url !== url; })));
    } catch (err) {}
  }

  function renderHistory() {
    var box = $('ripHistory');
    var list = loadHistory();
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<p class="rip-empty">Nothing ripped yet on this device. ' +
        'Paste a link above and it shows up here.</p>';
      return;
    }
    box.innerHTML = list.map(function (r) {
      return '<div class="rip-item">' +
        '<button type="button" class="rip-open" data-url="' + esc(r.url) + '" data-engine="' + esc(r.engine) + '">' +
          '<span class="rip-host">' + esc(prettyName(r.url, r.engine)) + '</span>' +
          '<span class="rip-url">' + esc(r.url) + '</span>' +
        '</button>' +
        '<button type="button" class="rip-del" data-url="' + esc(r.url) + '" title="Remove from this list" aria-label="Remove ' + esc(r.url) + '">&times;</button>' +
        '</div>';
    }).join('');
  }

  /* ---------- the player ------------------------------------- */

  var stage = $('ripStage');
  var frame = $('ripFrame');
  var msg = $('ripMsg');
  var current = null;   /* { url, engine } */
  var bootTimer = 0;
  var slowTimer = 0;
  var probeTimer = 0;
  var booted = false;
  var errored = false;
  var frameLoaded = false;   /* the frame document finished loading */
  var probeOk = false;       /* the game's host answered us          */

  function frameSrcFor(url, engine) {
    /* Flash is emulated by Ruffle on flash.html; putting that page
       inside the sandbox keeps the .swf on an opaque origin too. */
    if (engine === 'flash') return 'flash.html?game=' + encodeURIComponent(url);
    return url;
  }

  function showIdle() {
    stage.classList.remove('is-playing', 'is-error');
    frame.setAttribute('aria-hidden', 'true');
  }

  function showError(title, text) {
    errored = true;
    clearTimeout(bootTimer);
    clearTimeout(slowTimer);
    clearTimeout(probeTimer);
    stage.classList.add('is-error');
    stage.classList.remove('is-playing');
    frame.setAttribute('aria-hidden', 'true');
    if (!msg) return;
    msg.innerHTML =
      '<div class="boot-error">' +
      '<div class="boot-emoji">🚧</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(text) + '</p>' +
      '<div class="boot-actions">' +
      '<button class="btn btn-primary" id="ripRetry">↻ Try again</button>' +
      (current ? '<a class="btn btn-ghost" href="' + esc(current.url) +
        '" target="_blank" rel="noopener noreferrer">↗ Open direct</a>' : '') +
      '<a class="btn btn-ghost" href="proxy-links.html">🔗 Proxy links</a>' +
      '</div></div>';
    var retry = $('ripRetry');
    if (retry) retry.addEventListener('click', function () { play(current.url, current.engine); });
  }

  /* Both signals are needed before we call the game alive:
       * the host answering a request, and
       * the frame document finishing.
     A frame on its own proves nothing - when DNS is blocked or the
     server is gone the browser still fires "load" for its own error
     page, and that error page is indistinguishable from a game
     cross-origin. A fetch on its own proves the host is up but not
     that the game renders. Waiting for both means "Loading..." only
     disappears when something really is on screen. */
  function settle() {
    if (errored || !current) return;
    if (!frameLoaded || !probeOk) return;
    booted = true;
    clearTimeout(bootTimer);
    clearTimeout(slowTimer);
    stage.classList.add('is-playing');
    if (msg) msg.innerHTML = '';
  }

  /* A no-cors GET tells us whether the host is reachable at all: it
     resolves with an opaque response for anything the server sends
     back (even a 404) and rejects for DNS failures, refused
     connections and blocked networks. 12 seconds is the ceiling. */
  function probe(url) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var opts = { mode: 'no-cors', credentials: 'omit', cache: 'no-store' };
    if (ctrl) opts.signal = ctrl.signal;
    probeTimer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    fetch(url, opts).then(function () {
      clearTimeout(probeTimer);
      probeOk = true;
      settle();
    }, function (err) {
      clearTimeout(probeTimer);
      if (errored || (current && current.url !== url)) return;
      if (err && err.name === 'AbortError') { probeOk = true; settle(); return; }
      showError('That host cannot be reached',
        'Nothing answered at ' + hostOf(url) + '. Either the site is down, ' +
        'or your school network blocks that domain. Try "Open direct" to see ' +
        'which it is, then use one of the proxy links if the network is the problem.');
    });
  }

  function load(url, engine) {
    current = { url: url, engine: engine };
    booted = false;
    errored = false;
    frameLoaded = false;
    probeOk = false;
    clearTimeout(bootTimer);
    clearTimeout(slowTimer);
    clearTimeout(probeTimer);

    remember(url, engine);
    renderHistory();

    /* the sandbox has to be in place before the frame navigates */
    frame.setAttribute('sandbox',
      engine === 'flash' ? SANDBOX_OPAQUE : SANDBOX_CROSS);

    if (msg) {
      msg.innerHTML = '<div class="spinner" aria-hidden="true"></div>' +
        '<span>Loading ' + esc(prettyName(url, engine)) + '…</span>';
    }
    stage.classList.remove('is-error');
    stage.classList.add('is-playing');
    frame.setAttribute('aria-hidden', 'false');

    /* park on about:blank first: re-assigning an identical src does
       not reliably restart a frame that is already wedged */
    frame.src = 'about:blank';
    setTimeout(function () { frame.src = frameSrcFor(url, engine); }, 30);
    probe(url);

    slowTimer = setTimeout(function () {
      if (booted || errored || !msg) return;
      var s = msg.querySelector('span');
      if (s) s.textContent = 'Still loading… this host may be slow, or it may refuse to be embedded.';
    }, 7000);

    bootTimer = setTimeout(function () {
      if (booted || errored) return;
      showError('That game will not run here',
        'The host answered but nothing rendered. It is either still loading, ' +
        'or it sends a "do not embed me" header that stops any iframe from ' +
        'showing it. Try "Open direct" — if the game works there, a proxy ' +
        'link is your next move.');
    }, 20000);
  }

  frame.addEventListener('load', function () {
    if (errored || !current) return;
    var here = '';
    try { here = frame.contentWindow.location.href; } catch (err) { here = frame.src; }
    if (!here || here === 'about:blank') return;
    frameLoaded = true;
    settle();
  });

  function play(rawUrl, engineHint) {
    var url = cleanUrl(rawUrl);
    if (url === 'self') {
      showError('That is a 0xB0 Games page',
        'The rip only takes other people’s games. Open the arcade from the link above instead.');
      return;
    }
    if (!url) {
      showError('That does not look like a game link',
        'Paste the full address of the game page, starting with http:// or https:// ' +
        '(for example https://example.com/games/thing/index.html).');
      return;
    }
    var engine = engineHint;
    if (engine !== 'html5' && engine !== 'flash' && engine !== 'unity') {
      engine = guessEngine(url);
    }
    var sel = $('ripEngine');
    if (sel) sel.value = engine;

    var share = $('ripShare');
    if (share) share.value = location.origin + location.pathname.replace(/\/[^/]*$/, '/') + 'rip.html?g=' + encodeURIComponent(url);
    try {
      B0Settings.setPageTitle(prettyName(url, engine) + ' — 0xB0 Games');
    } catch (err) {}

    /* keep the address bar in sync so Reload / bookmark / share all work */
    var want = 'rip.html?g=' + encodeURIComponent(url) + (engine === guessEngine(url) ? '' : '&e=' + engine);
    if (location.search.slice(1) !== want) {
      try { history.replaceState(null, '', want); } catch (err) {}
    }
    load(url, engine);
  }

  /* ---------- wiring ---------------------------------------- */

  var form = $('ripForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      play($('ripUrl').value, $('ripEngine').value);
    });
  }

  var shareBox = $('ripHistory');
  if (shareBox) {
    shareBox.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.classList.contains('rip-open')) {
        $('ripUrl').value = t.getAttribute('data-url');
        play(t.getAttribute('data-url'), t.getAttribute('data-engine'));
      } else if (t.classList.contains('rip-del')) {
        forget(t.getAttribute('data-url'));
        renderHistory();
      }
    });
  }

  var copyBtn = $('ripCopy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var input = $('ripShare');
      if (!input || !input.value) return;
      var done = function () {
        copyBtn.textContent = '✓ Copied';
        setTimeout(function () { copyBtn.textContent = '📋 Copy link'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); });
      } else {
        input.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
      }
    });
  }

  var reloadBtn = $('ripReload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', function () {
      if (current) load(current.url, current.engine);
    });
  }

  var fullBtn = $('ripFull');
  if (fullBtn) {
    fullBtn.addEventListener('click', function () {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
      } else if (stage.requestFullscreen) {
        stage.requestFullscreen();
      }
    });
  }

  var cloakBtn2 = $('ripCloak');
  if (cloakBtn2) {
    cloakBtn2.addEventListener('click', function () {
      var w = window.open('about:blank', '_blank');
      if (!w) { showError('Pop-ups are blocked', 'Allow pop-ups for this site, then try the cloaked tab again.'); return; }
      w.document.write(
        '<!DOCTYPE html><html><head><title>Course materials</title><style>' +
        'html,body{margin:0;height:100%;overflow:hidden;background:#fff}' +
        'iframe{border:0;width:100%;height:100%}</style></head>' +
        '<body><iframe src="' + esc(location.href) + '" allow="autoplay; fullscreen; gamepad"></iframe></body></html>'
      );
      w.document.close();
    });
  }

  /* keyboard: R reload, F fullscreen - the same keys play.html uses */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.key === 'r' || e.key === 'R') { if (current) load(current.url, current.engine); }
    if (e.key === 'f' || e.key === 'F') { if (fullBtn) fullBtn.click(); }
  });

  /* ---------- start ----------------------------------------- */

  renderHistory();
  showIdle();

  var params = new URLSearchParams(location.search);
  var wanted = params.get('g') || params.get('game') || params.get('url') || '';
  if (wanted) {
    $('ripUrl').value = wanted;
    play(wanted, params.get('e'));
  }
})();
