/* ============================================================
   0xB0 GAMES — homepage + shared site logic
   (grid rendering, search, category filters, random game,
    3D tilt, 3D hero showcase, scroll reveals,
    tab disguise + panic via the settings engine)
   ============================================================ */
/*global ALL_GAMES, findGame, gameCategories, gameHref, tileInnerHTML, B0Settings*/

(function () {
  'use strict';

  /* ---------------- Tab disguise button ------------------------ */

  var cloakBtn = document.getElementById('cloakBtn');

  function refreshCloakBtn() {
    if (!cloakBtn) return;
    var disguised = B0Settings.get().profile !== 'off';
    cloakBtn.classList.toggle('on', disguised);
    cloakBtn.title = disguised
      ? 'Disguise is ON — click to show 0xB0 again'
      : 'Disguise this tab as something boring (Google Docs, Canvas…)';
  }

  if (cloakBtn) {
    cloakBtn.addEventListener('click', function () {
      B0Settings.toggleDisguise();
      refreshCloakBtn();
    });
    refreshCloakBtn();
  }

  /* ---------------- Panic button (key is handled by settings.js) */

  var panicBtn = document.getElementById('panicBtn');
  if (panicBtn) {
    panicBtn.addEventListener('click', function () {
      B0Settings.panic();
    });
  }

  /* ---------------- Mobile nav -------------------------------- */

  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
  }

  /* ---------------- Random game ------------------------------- */

  var randomBtn = document.getElementById('randomBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', function () {
      var g = ALL_GAMES[~~(Math.random() * ALL_GAMES.length)];
      location.href = gameHref(g);
    });
  }

  /* ---------------- 3D tilt on cards (desktop, all pages) ----- */

  if (window.matchMedia('(hover: hover)').matches) {
    var tiltCard = null;
    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest && e.target.closest('.card, .profile-card');
      if (tiltCard && tiltCard !== card) {
        tiltCard.style.transform = '';
        tiltCard = null;
      }
      if (!card) return;
      tiltCard = card;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform =
        'perspective(700px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' +
        (x * 8).toFixed(2) + 'deg) translateY(-4px) scale(1.02)';
    });
  }

  /* ---------------- 3D hero showcase (homepage) ---------------- */

  var heroStage = document.getElementById('heroStage');
  var scInner = document.getElementById('scInner');
  if (heroStage && scInner && typeof ALL_GAMES !== 'undefined') {
    var seenS = {};
    var showcase = [];
    ALL_GAMES.forEach(function (g) {
      if (g.thumb && g.badge === 'Hot' && !seenS[g.slug] && showcase.length < 5) {
        seenS[g.slug] = 1;
        showcase.push(g);
      }
    });
    ALL_GAMES.forEach(function (g) {
      if (g.thumb && !seenS[g.slug] && showcase.length < 5) {
        seenS[g.slug] = 1;
        showcase.push(g);
      }
    });

    if (showcase.length >= 3) {
      scInner.innerHTML = showcase.map(function (g, i) {
        return (
          '<div class="sc-slot" style="--i:' + i + '">' +
          '<a class="sc-card" href="' + gameHref(g) + '" title="Play ' + g.title + '">' +
          '<img src="' + g.thumb + '" alt="' + g.title + '" loading="lazy"/>' +
          '<span>' + g.title + '</span>' +
          '</a></div>'
        );
      }).join('');

      /* the whole stage subtly rotates toward the cursor */
      if (window.matchMedia('(hover: hover)').matches) {
        document.addEventListener('mousemove', function (e) {
          var rx = (e.clientY / window.innerHeight - 0.5) * -7;
          var ry = (e.clientX / window.innerWidth - 0.5) * 9;
          scInner.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        });
      }
    } else {
      heroStage.style.display = 'none';
    }
  }

  /* ---------------- scroll reveal ------------------------------- */
  /* Reveal SMALL elements only. Never tag giant containers like the
     games .section (it can be ~28,000px tall — a 6% visibility
     threshold can never be met inside a normal viewport, which once
     left the whole grid invisible). threshold: 0 reveals the moment
     any pixel enters the viewport. */

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('revealed');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0 });

    var revealTargets = document.querySelectorAll(
      '.unbanner, .section-head, .chips, .feature, .play-info, .info-card'
    );
    for (var ri = 0; ri < revealTargets.length; ri++) {
      revealTargets[ri].classList.add('reveal');
      io.observe(revealTargets[ri]);
    }

    /* safety net — nothing may ever stay invisible:
       after 2s, force-reveal anything still hidden that is in
       (or near) the viewport. Deep content still animates on scroll. */
    setTimeout(function () {
      var hidden = document.querySelectorAll('.reveal:not(.revealed)');
      for (var hi = 0; hi < hidden.length; hi++) {
        var r = hidden[hi].getBoundingClientRect();
        if (r.top < window.innerHeight * 2) {
          hidden[hi].classList.add('revealed');
        }
      }
    }, 2000);
  }

  /* ---------------- boss mode + grid density ------------------- */
  try {
    var sitePrefs = B0Settings.get();
    if (sitePrefs.gridDensity === 'compact') {
      document.body.classList.add('grid-compact');
    }
    if (sitePrefs.bossMode) {
      var bossOverlay = document.createElement('div');
      bossOverlay.className = 'boss-overlay';
      bossOverlay.innerHTML =
        '<div class="boss-inner"><div class="boss-eye">👁️</div>' +
        '<p>Paused.</p><p class="boss-sub">Move your mouse or click to continue</p></div>';
      document.body.appendChild(bossOverlay);
      var bossHide = function () { bossOverlay.classList.remove('show'); };
      bossOverlay.addEventListener('mousemove', bossHide);
      bossOverlay.addEventListener('click', bossHide);
      window.addEventListener('focus', bossHide);
      document.addEventListener('keydown', bossHide);
      window.addEventListener('blur', function () { bossOverlay.classList.add('show'); });
    }
  } catch (err) {}

  /* ---------------- Homepage grid ----------------------------- */

  var grid = document.getElementById('grid');
  if (!grid) return; /* not the homepage */

  var chipsEl = document.getElementById('chips');
  var searchInput = document.getElementById('searchInput');
  var countEl = document.getElementById('gameCount');

  var activeCat = 'All';
  var query = '';

  function cardHTML(g) {
    var badge = g.badge ? '<span class="flag">' + g.badge + '</span>' : '';
    var newTab = '';
    try { if (B0Settings.get().newTab) newTab = ' target="_blank" rel="noopener"'; } catch (err) {}
    return (
      '<a class="card" href="' + gameHref(g) + '"' + newTab +
      ' title="Play ' + g.title + '">' +
      '<div class="thumb">' +
      badge +
      tileInnerHTML(g) +
      '<div class="play-badge"><div class="circle">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
      '</div></div>' +
      '</div>' +
      '<div class="meta"><span class="t">' + g.title + '</span>' +
      '<span class="cat">' + g.category + '</span></div>' +
      '</a>'
    );
  }

  function render() {
    var shown = ALL_GAMES.filter(function (g) {
      var catOk = activeCat === 'All' || g.category === activeCat;
      var q = query.trim().toLowerCase();
      var hay = (g.title + ' ' + g.category + ' ' + g.description).toLowerCase();
      return catOk && (!q || hay.indexOf(q) !== -1);
    });

    grid.innerHTML = shown.length
      ? shown.map(cardHTML).join('')
      : '<div class="empty-note">No games match — try another search 👀' +
        '<br><a class="empty-request" href="https://github.com/va1uxxx/0xB0-Games/issues/new?labels=Game%20Request&title=Game%20Request%3A%20&body=**Game%20name%3A**%0A**Link%20to%20the%20game%3A**%0A**Category%3A**%0A**Why%20should%200xB0%20add%20it%3F**" target="_blank" rel="noopener">Request this game on GitHub →</a>' +
        '</div>';

    if (countEl) {
      countEl.textContent = shown.length + (shown.length === 1 ? ' game' : ' games');
    }
  }

  /* category chips */
  var cats = ['All'].concat(gameCategories());
  chipsEl.innerHTML = cats
    .map(function (c) {
      return '<button class="chip' + (c === 'All' ? ' on' : '') + '" data-cat="' + c + '">' + c + '</button>';
    })
    .join('');

  chipsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    activeCat = btn.getAttribute('data-cat');
    chipsEl.querySelectorAll('.chip').forEach(function (c) {
      c.classList.toggle('on', c === btn);
    });
    render();
  });

  /* search */
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      query = searchInput.value;
      render();
    });
  }

  var statGames = document.getElementById('statGames');
  if (statGames) statGames.textContent = ALL_GAMES.length;

  render();
})();
