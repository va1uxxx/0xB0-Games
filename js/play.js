/* ============================================================
   0xB0 GAMES — game player logic (sz-games style)
   Loads a game into the template. All URL patterns supported:
     play.html?game=<slug>          -> looked up in the registry
     play.html?game=<full URL>      -> embedded directly  ★
     play.html?url=<full URL>       -> same, legacy param

   The address bar only ever contains the slug — the real host a
   game is streamed from is resolved here, in JS, and never shown.
   ============================================================ */
/*global ALL_GAMES, findGame, gameHref, tileInnerHTML, B0Settings*/

(function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(id) { return document.getElementById(id); }

  var params = new URLSearchParams(location.search);

  var slug = params.get('game');
  var directUrl = params.get('url');

  /* ?game=<https://…> — full URL, just like sz-games' game.html */
  if (slug && /^https?:\/\//i.test(slug)) {
    directUrl = slug;
    slug = null;
  }

  var game = slug ? findGame(slug) : null;

  /* external URL that's in the registry -> use its nice title/description */
  if (!game && directUrl) {
    game = ALL_GAMES.find(function (g) { return g.src === directUrl; }) || null;
  }

  /* ---- not found -> show error screen ------------------------ */
  if (!game && !directUrl) {
    var pm = $('playMain');
    var nf = $('notFound');
    if (pm) pm.style.display = 'none';
    if (nf) nf.style.display = 'block';
    return;
  }

  var src = (game ? game.src : directUrl) || '';
  var title = game
    ? game.title
    : decodeURIComponent(directUrl || '').replace(/^https?:\/\//, '').split('/')[0];

  /* ---- fill the page ----------------------------------------- */
  try { B0Settings.setPageTitle(title + ' — 0xB0 Games'); } catch (err) {}

  var playMain = $('playMain');
  if (playMain) playMain.style.display = 'block';

  var gameTitle = $('gameTitle');
  if (gameTitle) {
    gameTitle.innerHTML = esc(title) +
      (game ? '<span class="cat">' + esc(game.category) + '</span>' : '');
  }

  var gameDesc = $('gameDesc');
  if (gameDesc) {
    gameDesc.textContent = game
      ? game.description
      : 'External game — loaded from another site. If the screen stays blank, that site refuses to be embedded — use “Cloaked tab” instead.';
  }

  var gameControls = $('gameControls');
  if (gameControls) {
    gameControls.textContent = (game && game.controls) ||
      'Depends on the game — try mouse, touch and the arrow keys.';
  }

  var frame = $('gameFrame');
  var loading = $('loading');
  var stageWrap = $('stageWrap');

  if (!frame || !loading) return;

  /* ---- CDN hosts that must not be iframed directly -----------
     cdn.statically.io (and jsDelivr, GitHub raw, GitLab raw…) hand
     out .html with `Content-Type: text/plain` on purpose, so a
     direct <iframe> shows the game's source code as text instead of
     running it. game-host.html fetches the entry page, re-emits it
     as real HTML and lets the assets load from the CDN normally.

     Those games are loaded through a sandboxed iframe WITHOUT
     allow-same-origin, so they run on an opaque origin and can never
     read 0xB0 accounts, settings or high scores out of localStorage.
     See js/game-host.js for the full story.                     */
  var HOSTED_HOSTS = ['cdn.statically.io'];
  var SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups ' +
    'allow-pointer-lock allow-downloads allow-orientation-lock ' +
    'allow-presentation';

  function needsHostPage(url) {
    if (!/^https?:\/\//i.test(url || '')) return false;
    for (var i = 0; i < HOSTED_HOSTS.length; i++) {
      if (url.indexOf('https://' + HOSTED_HOSTS[i] + '/') === 0) return true;
    }
    return false;
  }

  /* Flash games in the registry are raw .swf files — a browser can't
     run one by itself. Route them through flash.html, which loads
     Ruffle (the rip page uses the same trick). */
  var viaFlash = !!(
    game && game.engine === 'flash' && src && /\.swf(\?|#|$)/i.test(src)
  );

  /* Only registry slugs can be hosted — a raw ?url= link is left
     alone, and game-host.html itself refuses unknown hosts. */
  var viaHost = !!(game && game.slug && needsHostPage(src));
  var frameSrc = viaHost
    ? 'game-host.html?g=' + encodeURIComponent(game.slug)
    : viaFlash
      ? 'flash.html?game=' + encodeURIComponent(src)
      : src;

  /* ---- boot watchdog -----------------------------------------
     If the iframe never fires "load" (blocked host, dead server,
     very slow CDN) the old code spun "Booting game…" forever.
     Now: a reachability probe + a 15s timeout + an error panel
     with retry / open-direct / proxy-links escape hatches.    */

  var LOADING_HTML = loading.innerHTML;
  var booted = false;
  var errored = false;
  var slowTimer = null;
  var bootTimer = null;

  function bootGame() {
    booted = false;
    errored = false;
    loading.classList.remove('hide');
    loading.classList.remove('boot-fail');
    loading.innerHTML = LOADING_HTML;
    /* the sandbox flag has to be set (or cleared) before the frame
       navigates, otherwise the previous game's rules linger */
    if (viaHost) frame.setAttribute('sandbox', SANDBOX);
    else frame.removeAttribute('sandbox');
    /* about:blank first: re-assigning an identical src does not
       always restart a stuck iframe in every browser. */
    frame.src = 'about:blank';
    clearTimeout(slowTimer);
    clearTimeout(bootTimer);
    if (src) setTimeout(function () { frame.src = frameSrc; }, 30);
    slowTimer = setTimeout(function () {
      if (booted) return;
      var s = loading.querySelector('span');
      if (s) {
        s.textContent = viaHost
          ? 'Still fetching the game… (first load can be slow)'
          : 'Still booting… (this game’s host can be slow)';
      }
    }, 6000);
    /* game-host.html has its own 30s timeout and error panel, so this is
       only a last resort for when that page's script never runs at all. */
    bootTimer = setTimeout(function () {
      if (!booted) {
        showBootError(viaHost
          ? 'The game host didn’t load in time. It may be blocked on this network, or temporarily down.'
          : '');
      }
    }, viaHost ? 40000 : 15000);
  }

  function showBootError(reason) {
    clearTimeout(slowTimer);
    clearTimeout(bootTimer);
    errored = true;
    loading.classList.remove('hide');
    loading.classList.add('boot-fail');
    /* "Open direct" only helps when something is refusing to be
       embedded. A game served through game-host.html can't be — the
       page is ours — so drop the dead end there. */
    var directBtn = (src && !viaHost)
      ? '<a class="btn btn-ghost" href="' + esc(src) + '" target="_blank" rel="noopener">↗ Open direct</a>'
      : '';
    loading.innerHTML =
      '<div class="boot-error">' +
      '<div class="boot-emoji">⚠️</div>' +
      '<h3>This game won’t load</h3>' +
      '<p>' + esc(reason || 'The game host didn’t respond. It’s probably blocked on this network, or temporarily down.') + '</p>' +
      '<div class="boot-actions">' +
      '<button class="btn btn-primary" id="bootRetry">↻ Retry</button>' +
      directBtn +
      '<a class="btn btn-ghost" href="proxy-links.html">🔗 Proxy links</a>' +
      '</div></div>';
    var retry = $('bootRetry');
    if (retry) retry.addEventListener('click', bootGame);
  }

  /* game-host.html fetches the entry page before the game exists, so its
     own "load" means nothing. Wait for the message it posts instead. */
  if (viaHost) {
    window.addEventListener('message', function (e) {
      if (e.source !== frame.contentWindow) return;
      var d = e.data;
      if (!d || d.b0 !== 'game-host' || (d.slug && d.slug !== (game && game.slug))) return;
      booted = true;
      clearTimeout(slowTimer);
      clearTimeout(bootTimer);
      /* the wrapper draws its own error panel, so just get out of the way */
      loading.classList.remove('boot-fail');
      loading.classList.add('hide');
    });
  }

  frame.addEventListener('load', function () {
    /* A dead host still fires "load" (for the browser's error page).
       Never let that wipe the error panel we just showed the user. */
    if (errored) return;
    if (viaHost) return; /* handled by the message listener above */
    /* bootGame() parks the iframe on about:blank for 30ms before the real
       src goes in. That first load event must NOT be read as success, or
       the overlay would vanish over an empty frame and the 15s timeout
       would never fire either. Comparing frame.src to the string we set
       does not work (frame.src is always the *resolved* absolute URL),
       so read the document's own location and fall back to frame.src
       when the game is cross-origin. */
    var here = '';
    try { here = frame.contentWindow.location.href; } catch (err) { here = frame.src; }
    if (!here || here === 'about:blank') return;
    booted = true;
    clearTimeout(slowTimer);
    clearTimeout(bootTimer);
    loading.classList.remove('boot-fail');
    loading.classList.add('hide');
  });

  if (!src) {
    /* registry entry with no playable url — fail loudly, not blankly */
    showBootError('This game is listed in the catalog but has no playable link yet. Try another one from the games below.');
  } else {
    /* instant reachability check — blocked networks fail in ~1s
       instead of the user staring at a spinner for a minute.
       Skipped when game-host.html is doing the fetching: it already
       downloads the same file, and this probe would double the cost. */
    if (/^https?:\/\//i.test(src) && !viaHost) {
      fetch(src, { mode: 'no-cors', redirect: 'follow' }).catch(function () {
        if (!booted) {
          showBootError('This game’s host can’t be reached from this network — it looks blocked here. Try “Open direct”, or one of the proxy links.');
        }
      });
    }
    bootGame();
  }

  /* ---- buttons ----------------------------------------------- */

  var reloadBtn = $('reloadBtn');
  if (reloadBtn) reloadBtn.addEventListener('click', bootGame);

  function toggleFullscreen() {
    if (!stageWrap) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      return;
    }
    var el = stageWrap;
    var req = el.requestFullscreen || el.webkitRequestFullscreen ||
      el.msRequestFullscreen || el.webkitEnterFullscreen;
    if (req) { try { req.call(el); } catch (err) {} }
  }

  var fullBtn = $('fullBtn');
  if (fullBtn) fullBtn.addEventListener('click', toggleFullscreen);

  /* Open in a hidden about:blank tab (classic unblocked-sites trick) */
  var cloakTabBtn = $('cloakTabBtn');
  if (cloakTabBtn) cloakTabBtn.addEventListener('click', function () {
    var w = window.open('about:blank', '_blank');
    if (!w) {
      alert('Allow pop-ups to use cloaked tabs.');
      return;
    }
    w.document.write(
      '<!DOCTYPE html><html><head><title>Home</title>' +
      '<link rel="icon" href="data:image/svg+xml,' +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='#4285F4'/></svg>"
      ) +
      '"><style>html,body{margin:0;height:100%;overflow:hidden;background:#05080f}' +
      'iframe{border:0;width:100%;height:100%}</style></head>' +
      '<body><iframe src="' + esc(location.href) + '"></iframe></body></html>'
    );
    w.document.close();
  });

  /* ---- keyboard shortcuts (page chrome only, never the game) -- */

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ''))) return;
    /* the game itself has focus -> leave every key alone */
    if (document.activeElement === frame) return;
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); bootGame(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
  });

  /* ---- more games row ---------------------------------------- */
  /* Same category first (so it feels related), then anything else. */
  var others = ALL_GAMES.filter(function (g) { return !game || g.slug !== game.slug; });
  var related = game ? others.filter(function (g) { return g.category === game.category; }) : [];
  var rest = others.filter(function (g) { return !game || g.category !== game.category; });

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = ~~(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  shuffle(related); shuffle(rest);

  var picks = related.slice(0, 3).concat(rest.slice(0, Math.max(1, 4 - Math.min(3, related.length))));

  var moreGrid = $('moreGrid');
  if (moreGrid) {
    moreGrid.innerHTML = picks
      .map(function (g) {
        return (
          '<a class="card" href="' + gameHref(g) + '">' +
          '<div class="thumb">' +
          (g.badge ? '<span class="flag">' + esc(g.badge) + '</span>' : '') +
          tileInnerHTML(g) +
          '<div class="play-badge"><div class="circle">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</div></div></div>' +
          '<div class="meta"><span class="t">' + esc(g.title) + '</span><span class="cat">' + esc(g.category) + '</span></div>' +
          '</a>'
        );
      })
      .join('');
  }
})();
