/* ============================================================
   0xB0 GAMES — sakura petal system + scene parallax
   Draws soft falling petals on a fixed canvas and gives
   [data-parallax] elements a gentle mouse parallax.

   Settings aware (window.B0Settings):
     petals: false  -> petals disabled
     petalDensity: few | normal | lots
   Petal colors follow the active theme's --accent.
   No dependencies.
   ============================================================ */

(function () {
  'use strict';

  var c = document.getElementById('petalCanvas');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!c) return;

  var S = {};
  try { S = window.B0Settings ? window.B0Settings.get() : {}; } catch (err) {}

  if (S.petals === false || reduce) return;

  /* density multiplier */
  var dens = { few: 0.5, normal: 1, lots: 1.9 }[S.petalDensity] || 1;

  /* petal colors from the theme accent (fallback: sakura pink) */
  function themeColors() {
    try {
      var acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      var m = acc.match(/^#([0-9a-f]{6})$/i);
      if (!m) return ['255,158,199', '255,110,169', '255,214,232'];
      var r = parseInt(m[1].slice(0, 2), 16);
      var g = parseInt(m[1].slice(2, 4), 16);
      var b = parseInt(m[1].slice(4, 6), 16);
      var mix = function (w) {
        return [~~(r + (255 - r) * w), ~~(g + (255 - g) * w), ~~(b + (255 - b) * w)].join(',');
      };
      return [r + ',' + g + ',' + b, mix(0.45), mix(0.75)];
    } catch (err) {
      return ['255,158,199', '255,110,169', '255,214,232'];
    }
  }
  var COLORS = themeColors();

  var ctx = c.getContext('2d');
  var W, H, petals = [], raf = null;

  function resize() {
    W = c.width = window.innerWidth;
    H = c.height = window.innerHeight;
  }

  function make(startBelow) {
    var s = 4 + Math.random() * 7;
    return {
      x: Math.random() * W,
      y: startBelow ? Math.random() * H : -20 - Math.random() * H * 0.5,
      s: s,
      vy: 0.35 + Math.random() * 0.85,
      a: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.02,
      sw: 0.6 + Math.random() * 1.5,
      ph: Math.random() * Math.PI * 2,
      o: 0.25 + Math.random() * 0.4,
      c: COLORS[~~(Math.random() * COLORS.length)]
    };
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a + Math.sin(p.ph) * 0.35);
    var s = p.s;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s, -s * 0.6, s * 1.4, s * 0.5, 0, s * 1.7);
    ctx.bezierCurveTo(-s * 1.4, s * 0.5, -s, -s * 0.6, 0, 0);
    ctx.fillStyle = 'rgba(' + p.c + ',' + p.o + ')';
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      p.y += p.vy;
      p.ph += 0.012;
      p.a += p.va;
      p.x += Math.sin(p.ph) * p.sw * 0.45;
      if (p.y > H + 30 || p.x < -40 || p.x > W + 40) {
        petals[i] = make(false);
        continue;
      }
      drawPetal(p);
    }
    raf = requestAnimationFrame(draw);
  }

  function start() {
    var count = Math.max(14, Math.min(42, Math.round((W * H) / 34000) * dens));
    count = Math.round(count);
    petals = [];
    for (var i = 0; i < count; i++) petals.push(make(true));
    if (!raf) draw();
  }

  window.addEventListener('resize', function () {
    resize();
    petals.forEach(function (p) { if (p.y > H) p.y = -20; });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else if (!raf) {
      draw();
    }
  });

  resize();
  start();

  /* ---------- gentle scene parallax ---------- */
  var px = 0, py = 0;
  document.addEventListener('mousemove', function (e) {
    px = e.clientX / window.innerWidth - 0.5;
    py = e.clientY / window.innerHeight - 0.5;
    var layers = document.querySelectorAll('[data-parallax]');
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      var d = parseFloat(el.getAttribute('data-parallax')) || 0.04;
      el.style.transform =
        'translate(' + (-px * d * 220).toFixed(1) + 'px,' + (-py * d * 130).toFixed(1) + 'px)';
    }
  });
})();
