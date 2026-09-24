/* ============================================================
   0xB0 GAMES — settings engine
   Per-visitor preferences saved in localStorage:
   tab disguise, panic key, THEMES, petals, boss mode,
   grid density, new-tab links, unblocker search engine.
   Runs on EVERY page — include before main.js / play.js /
   unblocker.js / petals.js.

   Pages should set titles via B0Settings.setPageTitle()
   so the disguise keeps working on dynamic titles.
   ============================================================ */

(function () {
  'use strict';

  var KEY = '0xb0-settings-v1';
  var LAST_KEY = '0xb0-last-profile';
  var OLD_CLOAK_KEY = '0xb0-cloak-on'; /* v1 of the cloak feature */

  var DEFAULTS = {
    profile: 'off',        /* off | google | docs | drive | classroom | canvas | khan | desmos | custom */
    customTitle: '',
    customIcon: '',        /* an emoji OR an image URL */
    panic: true,
    panicUrl: 'https://classroom.google.com/h',
    theme: 'sakura',       /* sakura | midnight | matcha | yuzu | synth | kuro */
    petals: true,          /* falling cherry petals */
    petalDensity: 'normal', /* few | normal | lots */
    bossMode: false,       /* blur the page when the window loses focus */
    gridDensity: 'comfortable', /* comfortable | compact */
    newTab: false,         /* open game tiles in a new tab */
    searchEngine: 'google' /* google | duckduckgo | bing | brave (unblocker) */
  };

  /* ---------- themes (full site palettes) ---------- */

  var THEMES = {
    sakura: {
      name: '桜 Sakura',
      'bg': '#0d0714', 'bg-2': '#120a1e',
      'panel': '#170d26', 'panel-2': '#1e1233',
      'border': '#2d1b47', 'border-2': '#3f2464',
      'text': '#f6ecff', 'muted': '#b39ccf',
      'accent': '#ff6ea9', 'accent-2': '#b46bff', 'accent-3': '#ffd166',
      'danger': '#ff4d6d',
      'glow': '0 0 24px rgba(255, 110, 169, 0.28)',
      'bg-glow-1': 'rgba(180, 107, 255, 0.10)',
      'bg-glow-2': 'rgba(255, 110, 169, 0.09)'
    },
    midnight: {
      name: '🌙 Midnight',
      'bg': '#060a14', 'bg-2': '#0a1120',
      'panel': '#0d1526', 'panel-2': '#13203a',
      'border': '#1d2c4d', 'border-2': '#2a3f6e',
      'text': '#e8f2ff', 'muted': '#93a8c8',
      'accent': '#3d9bff', 'accent-2': '#00e0c6', 'accent-3': '#ffd166',
      'danger': '#ff5470',
      'glow': '0 0 24px rgba(61, 155, 255, 0.28)',
      'bg-glow-1': 'rgba(61, 155, 255, 0.10)',
      'bg-glow-2': 'rgba(0, 224, 198, 0.07)'
    },
    matcha: {
      name: '🍵 Matcha',
      'bg': '#0a1408', 'bg-2': '#0f1c0d',
      'panel': '#12240f', 'panel-2': '#1a3020',
      'border': '#24401f', 'border-2': '#33582b',
      'text': '#eeffe8', 'muted': '#a3c8a0',
      'accent': '#6fce62', 'accent-2': '#ffd166', 'accent-3': '#4ea8ff',
      'danger': '#ff5470',
      'glow': '0 0 24px rgba(111, 206, 98, 0.26)',
      'bg-glow-1': 'rgba(111, 206, 98, 0.09)',
      'bg-glow-2': 'rgba(255, 209, 102, 0.07)'
    },
    yuzu: {
      name: '🍊 Yuzu',
      'bg': '#140a06', 'bg-2': '#1e120a',
      'panel': '#241309', 'panel-2': '#331d0e',
      'border': '#4a2a12', 'border-2': '#6b3d1c',
      'text': '#fff3e8', 'muted': '#cfae93',
      'accent': '#ff9f43', 'accent-2': '#ff6257', 'accent-3': '#ffd166',
      'danger': '#ff4d6d',
      'glow': '0 0 24px rgba(255, 159, 67, 0.28)',
      'bg-glow-1': 'rgba(255, 159, 67, 0.10)',
      'bg-glow-2': 'rgba(255, 98, 87, 0.08)'
    },
    synth: {
      name: '🌆 Synthwave',
      'bg': '#12061f', 'bg-2': '#1a0a2e',
      'panel': '#1d0b33', 'panel-2': '#2a1049',
      'border': '#3c1a63', 'border-2': '#54268c',
      'text': '#f0e6ff', 'muted': '#b18fcf',
      'accent': '#ff4ecd', 'accent-2': '#00e5ff', 'accent-3': '#ffd166',
      'danger': '#ff4d6d',
      'glow': '0 0 24px rgba(255, 78, 205, 0.30)',
      'bg-glow-1': 'rgba(255, 78, 205, 0.10)',
      'bg-glow-2': 'rgba(0, 229, 255, 0.07)'
    },
    kuro: {
      name: '⬛ Kuro Mono',
      'bg': '#000000', 'bg-2': '#0a0a0a',
      'panel': '#0f0f0f', 'panel-2': '#161616',
      'border': '#262626', 'border-2': '#3d3d3d',
      'text': '#f2f2f2', 'muted': '#a0a0a0',
      'accent': '#f0f0f0', 'accent-2': '#9a9a9a', 'accent-3': '#ffd166',
      'danger': '#ff4757',
      'glow': '0 0 24px rgba(255, 255, 255, 0.18)',
      'bg-glow-1': 'rgba(255, 255, 255, 0.045)',
      'bg-glow-2': 'rgba(255, 255, 255, 0.03)'
    }
  };

  /* ---------- icon library (inline SVG data URIs, no downloads) ---------- */
  function svg(s) {
    return 'data:image/svg+xml,' + encodeURIComponent(s);
  }

  var ICONS = {
    google: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#fff'/>" +
      "<path fill='#4285F4' d='M53 33c0-1.8-.16-3-.46-4.3H32v9h12c-.24 2-1.6 5-4.6 7l6.9 5.3C49.4 45.2 53 39.8 53 33z'/>" +
      "<path fill='#34A853' d='M32 54c6 0 11-2 14.3-5.7l-6.9-5.3C37.6 44.4 35.2 45 32 45c-5.8 0-10.7-3.8-12.4-9l-7.1 5.5C15.8 49 23.3 54 32 54z'/>" +
      "<path fill='#FBBC05' d='M19.6 36c-.46-1.4-.72-2.9-.72-4.5s.26-3.1.72-4.5l-7.1-5.5C10.9 24.6 10 28.2 10 31.5s.9 6.9 2.5 10l7.1-5.5z'/>" +
      "<path fill='#EA4335' d='M32 18c3.2 0 6.1 1.1 8.3 3.3l6.1-6.1C43 11.6 38 9.5 32 9.5c-8.7 0-16.2 5-19.5 12.4l7.1 5.5C21.3 22 26.2 18 32 18z'/>" +
      '</svg>'
    ),
    docs: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#4285F4'/>" +
      "<path d='M18 10h19l11 11v31a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z' fill='#fff'/>" +
      "<path d='M23 28h15M23 36h15M23 44h9' stroke='#4285F4' stroke-width='3.4' stroke-linecap='round'/>" +
      "<path d='M37 10l11 11H37z' fill='#a1c2fa'/>" +
      '</svg>'
    ),
    drive: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#fff'/>" +
      "<path fill='#00A476' d='M25 12h14L52 36H11z'/>" +
      "<path fill='#FFBC00' d='M8.6 38h18.8l7 12H15.6z'/>" +
      "<path fill='#0066D9' d='M27.4 38h18.8L39.9 14.6 20.4 26z'/>" +
      "<path fill='#00AC32' d='M27.4 38h18.8l7-12H34.4z'/>" +
      "<path fill='#FF7A00' d='M15.6 50h18.8l-7-12H8.6z'/>" +
      '</svg>'
    ),
    classroom: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#1E8E3E'/>" +
      "<rect x='10' y='22' width='44' height='26' rx='4' fill='#fff'/>" +
      "<rect x='26' y='16' width='12' height='10' rx='2.5' fill='#fff'/>" +
      "<circle cx='22' cy='33' r='4.5' fill='#1E8E3E'/>" +
      "<circle cx='42' cy='33' r='4.5' fill='#1E8E3E'/>" +
      "<rect x='16' y='40' width='32' height='3' rx='1.5' fill='#1E8E3E'/>" +
      '</svg>'
    ),
    canvas: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#fff'/>" +
      "<circle cx='32' cy='32' r='24' fill='#E2403D'/>" +
      "<path d='M24 20v24M24 20c10 0 16 4 16 12s-6 12-16 12' stroke='#fff' stroke-width='6' stroke-linecap='round' fill='none'/>" +
      '</svg>'
    ),
    khan: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#fff'/>" +
      "<circle cx='32' cy='32' r='24' fill='#14BF96'/>" +
      "<path d='M25 20l14 12-14 12z' fill='#fff'/>" +
      '</svg>'
    ),
    desmos: svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='13' fill='#fff'/>" +
      "<rect x='8' y='8' width='48' height='48' rx='10' fill='#2D71D8'/>" +
      "<path d='M18 46c8 0 6-14 12-14s4 14 12 14' stroke='#fff' stroke-width='4.5' fill='none' stroke-linecap='round'/>" +
      '</svg>'
    )
  };

  var TITLES = {
    google: 'Google',
    docs: 'Google Docs',
    drive: 'Google Drive',
    classroom: 'Google Classroom',
    canvas: 'Canvas',
    khan: 'Khan Academy',
    desmos: 'Desmos'
  };

  var PROFILES = ['off', 'google', 'docs', 'drive', 'classroom', 'canvas', 'khan', 'desmos', 'custom'];

  /* ---------- storage ---------- */
  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (err) { s = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = typeof s[k] === 'undefined' ? DEFAULTS[k] : s[k];
    });
    return out;
  }

  var settings = load();

  /* migrate the old cloak key so existing users keep their disguise */
  if (settings.profile === 'off' && localStorage.getItem(OLD_CLOAK_KEY) === '1') {
    settings.profile = 'docs';
  }

  /* ---------- state ---------- */
  var originalTitle = document.title;
  var iconLink = document.querySelector("link[rel*='icon']");
  var originalIcon = iconLink ? iconLink.href : 'assets/favicon.svg';

  /* ---------- appliers ---------- */
  function emojiIcon(v) {
    if (/^(https?:|data:)/i.test(v)) return v;
    return svg(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
      "<text y='.9em' font-size='90'>" + v + '</text></svg>'
    );
  }

  function disguisedTitle() {
    if (settings.profile === 'off') return null;
    if (settings.profile === 'custom') return settings.customTitle || 'New Tab';
    return TITLES[settings.profile] || null;
  }

  function applyFavicon() {
    var link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (settings.profile === 'off') link.href = originalIcon;
    else if (settings.profile === 'custom') link.href = settings.customIcon ? emojiIcon(settings.customIcon) : originalIcon;
    else link.href = ICONS[settings.profile] || originalIcon;
  }

  function applyTitle() {
    var t = disguisedTitle();
    if (t) document.title = t;
    else document.title = originalTitle;
  }

  function applyTheme() {
    var t = THEMES[settings.theme] || THEMES.sakura;
    var root = document.documentElement;
    Object.keys(t).forEach(function (k) {
      if (k === 'name') return;
      root.style.setProperty('--' + k, t[k]);
    });
  }

  function applyAll() {
    applyFavicon();
    applyTitle();
    applyTheme();
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }

  /* ---------- panic ---------- */
  function panic() {
    var url = (settings.panicUrl || DEFAULTS.panicUrl).trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    location.replace(url);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === '`' && settings.panic !== false) {
      e.preventDefault();
      panic();
    }
  });

  applyAll();

  /* ---------- public API ---------- */
  window.B0Settings = {
    get: function () {
      return JSON.parse(JSON.stringify(settings));
    },
    set: function (patch) {
      Object.keys(patch).forEach(function (k) {
        if (k in DEFAULTS) settings[k] = patch[k];
      });
      save();
      applyAll();
    },
    /* pages call this instead of `document.title = x` */
    setPageTitle: function (title) {
      if (title) originalTitle = title;
      applyTitle();
    },
    profiles: PROFILES,
    icons: ICONS,
    titles: TITLES,
    themes: THEMES,
    defaults: function () {
      return JSON.parse(JSON.stringify(DEFAULTS));
    },
    panic: panic,
    /* used by the nav cloak button */
    toggleDisguise: function () {
      if (settings.profile === 'off') {
        settings.profile = localStorage.getItem(LAST_KEY) || 'docs';
      } else {
        try { localStorage.setItem(LAST_KEY, settings.profile); } catch (err) {}
        settings.profile = 'off';
      }
      save();
      applyAll();
      return settings.profile;
    }
  };
})();
