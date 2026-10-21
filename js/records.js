/* ============================================================
   0xB0 GAMES — favorites, recently played & personal records
   ------------------------------------------------------------
   Everything here is per-device localStorage. No network calls,
   and it can never break the page (every read is try/catch).

   Favorites   -> 0xb0-favs      (array of slugs)
   Recently    -> 0xb0-recent    (array of slugs, newest first)
   Records     -> the games themselves already save their bests
                  (0xb0-<game>-best ...). This just knows where
                  each one lives and how to display it.
   ============================================================ */

(function () {
  'use strict';

  var FAV_KEY = '0xb0-favs';
  var RECENT_KEY = '0xb0-recent';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) {}
  }

  /* ---------------- favorites ---------------- */

  function favs() {
    var f = read(FAV_KEY, []);
    return Array.isArray(f) ? f : [];
  }

  function isFav(slug) {
    return favs().indexOf(slug) !== -1;
  }

  function toggleFav(slug) {
    if (!slug) return false;
    var f = favs();
    var i = f.indexOf(slug);
    if (i === -1) { f.push(slug); } else { f.splice(i, 1); }
    write(FAV_KEY, f.slice(0, 100));
    return i === -1;
  }

  /* ---------------- recently played ---------------- */

  function trackPlay(slug) {
    if (!slug) return;
    var r = read(RECENT_KEY, []);
    if (!Array.isArray(r)) r = [];
    r = r.filter(function (s) { return s !== slug; });
    r.unshift(slug);
    write(RECENT_KEY, r.slice(0, 10));
  }

  function recent() {
    var r = read(RECENT_KEY, []);
    return Array.isArray(r) ? r : [];
  }

  /* ---------------- personal records ---------------- */

  var META = {
    '2048':         { key: '0xb0-2048-best',    unit: 'score' },
    'snake':        { key: '0xb0-snake-best',   unit: 'score' },
    'flappy-hex':   { key: '0xb0-flappy-best',  unit: 'score' },
    'breakout':     { key: '0xb0-breakout-best',unit: 'score' },
    'tetris':       { key: '0xb0-tetris-best',  unit: 'score' },
    'astro-hex':    { key: '0xb0-astro-best',   unit: 'score' },
    'cross-it':     { key: '0xb0-cross-best',   unit: 'score' },
    'hex-runner':   { key: '0xb0-runner-best',  unit: 'score' },
    'hex-jump':     { key: '0xb0-hexjump-best', unit: 'score' },
    'whack-a-mole': { key: '0xb0-mole-best',    unit: 'score' },
    'word-guess':   { key: '0xb0-word-streak',  unit: 'streak' },
    'simon':        { key: '0xb0-simon-best',   unit: 'level' },
    'memory-match': { key: '0xb0-memory-best',  unit: 'moves' },
    'minesweeper':  { key: '0xb0-sweeper-best', unit: 'time' },
    'sudoku':       { key: '0xb0-sudoku-best',  unit: 'time' },
    'pong':         { key: '0xb0-pong-wins',    unit: 'wins' },
    'connect-four': { key: '0xb0-c4-scores',    unit: 'wins',  field: 'y' },
    'tic-tac-toe':  { key: '0xb0-ttt-scores',   unit: 'wins',  field: 'x' }
  };

  /* Raw stored value for a game's record, or null. */
  function valueOf(slug) {
    var m = META[slug];
    if (!m) return null;
    try {
      var raw = localStorage.getItem(m.key);
      if (raw === null || raw === '') return null;
      if (m.field) {
        var obj = JSON.parse(raw);
        return (+obj[m.field]) || 0;
      }
      return +raw || 0;
    } catch (err) {
      return null;
    }
  }

  function mss(v) {
    var mm = Math.floor(v / 60);
    var ss = v % 60;
    return mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /* Human sentence for the settings page. */
  function display(slug) {
    var m = META[slug];
    var v = valueOf(slug);
    if (!m || v === null || v <= 0) return null;
    if (m.unit === 'time') return mss(v);
    if (m.unit === 'wins') return v + (v === 1 ? ' win' : ' wins');
    if (m.unit === 'level') return 'Level ' + v;
    if (m.unit === 'streak') return v + ' streak';
    if (m.unit === 'moves') return v + (v === 1 ? ' move' : ' moves');
    return v.toLocaleString('en-US');
  }

  /* Compact badge value for a game tile ("2:41", "12,480", "7"). */
  function short(slug) {
    var m = META[slug];
    var v = valueOf(slug);
    if (!m || v === null || v <= 0) return null;
    if (m.unit === 'time') return mss(v);
    if (m.unit === 'level') return 'Lv ' + v;
    if (m.unit === 'streak') return v + '\u00d7';
    if (m.unit === 'wins') return String(v);
    if (m.unit === 'moves') return String(v);
    return v.toLocaleString('en-US');
  }

  function has(slug) {
    var v = valueOf(slug);
    return v !== null && v > 0;
  }

  /* Every recordable original game (settings page lists them all). */
  function all() {
    return Object.keys(META);
  }

  /* Slugs that actually have a record. */
  function list() {
    var out = [];
    var keys = Object.keys(META);
    for (var i = 0; i < keys.length; i++) {
      if (has(keys[i])) out.push(keys[i]);
    }
    return out;
  }

  window.B0Records = {
    favs: favs,
    isFav: isFav,
    toggleFav: toggleFav,
    trackPlay: trackPlay,
    recent: recent,
    valueOf: valueOf,
    has: has,
    display: display,
    short: short,
    all: all,
    list: list
  };
})();