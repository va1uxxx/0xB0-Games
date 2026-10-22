/* ============================================================
   0xB0 GAMES — fun & easter eggs
   ------------------------------------------------------------
   Zero dependencies, works offline. Everything here is optional
   decoration: reduced-motion and Lite mode turn the animated
   pieces off (the secrets still answer, just without fireworks).

   Secrets:
     idkfa        -> the classic Doom cheat launches DOOM (wasm port)
     party        -> toggles party mode (animated hue + confetti)
     logo x10     -> click the 0xB0 logo ten times for confetti
     random x5    -> click 🎲 five times fast for a confetti blast
   ============================================================ */
/*global ALL_GAMES, findGame, gameHref, B0Settings*/

(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lite() {
    return document.documentElement.classList.contains('b0-lite');
  }

  /* ---------- tiny toast (no dependencies) ---------- */

  var toastTimer = null;

  function toast(msg, ms) {
    var el = document.getElementById('b0-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'b0-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, ms || 2600);
  }

  /* ---------- confetti (one shared canvas) ---------- */

  var canvas = null, ctx = null, parts = [], raf = null;

  function ensureCanvas() {
    if (canvas) return true;
    canvas = document.createElement('canvas');
    canvas.id = 'b0-confetti';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    if (!ctx) return false;
    var fit = function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    fit();
    window.addEventListener('resize', fit);
    return true;
  }

  function confetti(x, y, n) {
    if (reduce || lite() || !ensureCanvas()) return;
    var colors = ['#ff6ea9', '#b46bff', '#ffd166', '#00e5a0', '#00b3ff', '#ff5470'];
    for (var i = 0; i < (n || 70); i++) {
      parts.push({
        x: x || window.innerWidth / 2,
        y: y || window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 9 - 3,
        g: 0.22 + Math.random() * 0.12,
        s: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[~~(Math.random() * colors.length)],
        life: 90 + ~~(Math.random() * 50)
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }

  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.rot += p.vr;
      p.life--;
      if (p.life <= 0 || p.y > canvas.height + 20) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.66);
      ctx.restore();
    }
    if (parts.length) {
      raf = requestAnimationFrame(step);
    } else {
      raf = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ---------- cursor sparkle trail (hover devices only) ---------- */

  var lastSpark = 0;
  var SPARK_EMOJI = ['✨', '⭐', '💫', '🌸', '💜', '🔥'];

  document.addEventListener('mousemove', function (e) {
    if (reduce || lite()) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    var now = Date.now();
    if (now - lastSpark < 90) return;
    lastSpark = now;
    var s = document.createElement('span');
    s.className = 'b0-spark';
    s.textContent = SPARK_EMOJI[~~(Math.random() * SPARK_EMOJI.length)];
    s.style.left = e.clientX + (Math.random() - 0.5) * 18 + 'px';
    s.style.top = e.clientY + (Math.random() - 0.5) * 18 + 'px';
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 720);
  }, { passive: true });

  /* ---------- typed secrets (never while typing in inputs) ---------- */

  function isTyping(e) {
    var t = e.target;
    if (!t) return false;
    if (t.isContentEditable) return true;
    return /^(input|textarea|select)$/i.test(t.tagName || '');
  }

  var typed = '';

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) { typed = ''; return; }
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-8);

    if (typed.slice(-5) === 'idkfa') {
      typed = '';
      var g = (typeof findGame === 'function') ? findGame('doom-wasm') : null;
      if (g) {
        toast('DOOM cheat accepted… 👾');
        setTimeout(function () { location.href = gameHref(g); }, 550);
      }
    } else if (typed.slice(-5) === 'party') {
      typed = '';
      toggleParty();
    }
  });

  function toggleParty() {
    var root = document.documentElement;
    var on = !root.classList.contains('b0-party');
    if (on && (reduce || lite())) {
      toast('🪩 Party mode is sleeping — turn off Lite mode to let it loose!');
      return;
    }
    root.classList.toggle('b0-party', on);
    if (on) {
      confetti();
      toast('🪩 PARTY MODE ON — type “party” again to stop');
      try { B0Settings.setPageTitle('🪩 PARTY — 0xB0 Games'); } catch (err) {}
    } else {
      toast('Party’s over. It was fun while it lasted 🫡');
      try { B0Settings.setPageTitle(document.title.replace(/^🪩 PARTY — /, '')); } catch (err) {}
    }
  }

  /* ---------- logo + random-button click secrets ----------
     Both of these are links/buttons that NAVIGATE, so the counter
     lives in sessionStorage (per tab) and survives the trip: the
     prize fires on the page that loads after the qualifying click. */

  function tabCount(key) {
    try { return +(sessionStorage.getItem(key) || 0) || 0; } catch (err) { return 0; }
  }
  function setTabCount(key, n) {
    try { sessionStorage.setItem(key, String(n)); } catch (err) {}
  }
  function armEgg(key) {
    try { sessionStorage.setItem(key + '-go', '1'); } catch (err) {}
  }
  function eatEgg(key) {
    try {
      if (sessionStorage.getItem(key + '-go') === '1') {
        sessionStorage.removeItem(key + '-go');
        return true;
      }
    } catch (err) {}
    return false;
  }

  var logo = document.querySelector('.brand .hex');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', function () {
      var n = tabCount('0xb0-logo-clicks') + 1;
      if (n >= 10) {
        setTabCount('0xb0-logo-clicks', 0);
        armEgg('0xb0-logo-clicks');
      } else {
        setTabCount('0xb0-logo-clicks', n);
      }
    });
  }

  var rb = document.getElementById('randomBtn');
  if (rb) {
    rb.addEventListener('click', function () {
      var n = tabCount('0xb0-rb-clicks') + 1;
      if (n >= 5) {
        setTabCount('0xb0-rb-clicks', 0);
        armEgg('0xb0-rb-clicks');
      } else {
        setTabCount('0xb0-rb-clicks', n);
      }
    });
  }

  /* if a click-egg qualified on the previous page, celebrate here */
  if (eatEgg('0xb0-logo-clicks')) {
    confetti();
    toast('You found the logo secret! 🎉 Now try the Konami code…');
  } else if (eatEgg('0xb0-rb-clicks')) {
    confetti();
    toast('Whoa, easy! Okay okay, here comes confetti 🎊');
  }

  /* ---------- console hello (for the curious) ---------- */

  try {
    var art =
      '%c  0xB0 GAMES \n' +
      '  ┌─────────────────────────────┐\n' +
      '  │  nothing to see here… or is │\n' +
      '  │  there? try: ↑↑↓↓←→←→BA     │\n' +
      '  │  …and a certain Doom cheat. │\n' +
      '  └─────────────────────────────┘';
    console.log(art, 'color:#ff6ea9;font-family:monospace;font-size:12px');
  } catch (err) {}

  /* expose for other scripts / debugging */
  window.B0Fun = { confetti: confetti, toast: toast };
})();
