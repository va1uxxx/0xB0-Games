/* ============================================================
   0xB0 GAMES — game player logic (sz-games style)
   Loads a game into the template. All URL patterns supported:
     play.html?game=<slug>          -> looked up in the registry
     play.html?game=<full URL>      -> embedded directly  ★
     play.html?url=<full URL>       -> same, legacy param
   ============================================================ */
/*global ALL_GAMES, findGame, gameHref, tileInnerHTML, B0Settings*/

(function () {
  'use strict';

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
    document.getElementById('playMain').style.display = 'none';
    document.getElementById('notFound').style.display = 'block';
    return;
  }

  var src = game ? game.src : directUrl;
  var title = game
    ? game.title
    : decodeURIComponent(directUrl).replace(/^https?:\/\//, '').split('/')[0];

  /* ---- fill the page ----------------------------------------- */
  B0Settings.setPageTitle(title + ' — 0xB0 Games');
  document.getElementById('playMain').style.display = 'block';
  document.getElementById('gameTitle').innerHTML = title + (game ? '<span class="cat">' + game.category + '</span>' : '');
  document.getElementById('gameDesc').textContent = game
    ? game.description
    : 'External game — loaded from another site. If the screen stays blank, that site refuses to be embedded — use “Cloaked tab” instead.';
  document.getElementById('gameControls').textContent = game
    ? game.controls || 'Depends on the game — try mouse, touch and arrow keys.'
    : 'Depends on the game — try mouse, touch and arrow keys.';

  var frame = document.getElementById('gameFrame');
  var loading = document.getElementById('loading');
  var stage = document.getElementById('stage');
  var stageWrap = document.getElementById('stageWrap');

  frame.addEventListener('load', function () {
    loading.classList.add('hide');
  });
  frame.src = src;

  /* ---- buttons ----------------------------------------------- */

  document.getElementById('reloadBtn').addEventListener('click', function () {
    loading.classList.remove('hide');
    frame.src = src;
  });

  document.getElementById('fullBtn').addEventListener('click', function () {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      (stageWrap.requestFullscreen || stageWrap.webkitRequestFullscreen || function(){}).call(stageWrap);
    }
  });

  /* Open in a hidden about:blank tab (classic unblocked-sites trick) */
  document.getElementById('cloakTabBtn').addEventListener('click', function () {
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
      '<body><iframe src="' + location.href + '"></iframe></body></html>'
    );
    w.document.close();
  });

  /* ---- more games row ---------------------------------------- */
  var others = ALL_GAMES.filter(function (g) { return !game || g.slug !== game.slug; });
  /* shuffle */
  for (var i = others.length - 1; i > 0; i--) {
    var j = ~~(Math.random() * (i + 1));
    var tmp = others[i]; others[i] = others[j]; others[j] = tmp;
  }
  var picks = others.slice(0, 4);

  document.getElementById('moreGrid').innerHTML = picks
    .map(function (g) {
      return (
        '<a class="card" href="' + gameHref(g) + '">' +
        '<div class="thumb">' +
        (g.badge ? '<span class="flag">' + g.badge + '</span>' : '') +
        tileInnerHTML(g) +
        '<div class="play-badge"><div class="circle">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
        '</div></div></div>' +
        '<div class="meta"><span class="t">' + g.title + '</span><span class="cat">' + g.category + '</span></div>' +
        '</a>'
      );
    })
    .join('');
})();
