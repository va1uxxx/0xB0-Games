/* ============================================================
   0xB0 GAMES — settings page logic (settings.html only)
   ============================================================ */
/*global B0Settings*/

(function () {
  'use strict';
  if (!document.getElementById('profileGrid')) return; /* not this page */

  var PROFILES = [
    { id: 'off',       name: 'No disguise',            hint: '0xB0 Games (default)' },
    { id: 'google',    name: 'Google',                 hint: 'Search' },
    { id: 'docs',      name: 'Google Docs',            hint: 'Documents' },
    { id: 'drive',     name: 'Google Drive',           hint: 'Files' },
    { id: 'classroom', name: 'Google Classroom',       hint: 'Classes' },
    { id: 'canvas',    name: 'Canvas',                hint: 'LMS' },
    { id: 'khan',      name: 'Khan Academy',           hint: 'Learning' },
    { id: 'desmos',    name: 'Desmos',                 hint: 'Calculator' },
    { id: 'custom',    name: 'Custom…',                hint: 'Your own icon + title' }
  ];

  var grid = document.getElementById('profileGrid');
  var customPanel = document.getElementById('customPanel');
  var customTitle = document.getElementById('customTitle');
  var customIcon = document.getElementById('customIcon');
  var pvIcon = document.getElementById('pvIcon');
  var pvTitle = document.getElementById('pvTitle');
  var panicEnabled = document.getElementById('panicEnabled');
  var panicUrl = document.getElementById('panicUrl');
  var themeGrid = document.getElementById('themeGrid');
  var petalsOn = document.getElementById('petalsOn');
  var petalDensity = document.getElementById('petalDensity');
  var bossMode = document.getElementById('bossMode');
  var newTab = document.getElementById('newTab');
  var gridDensity = document.getElementById('gridDensity');
  var searchEngine = document.getElementById('searchEngine');

  var THEME_IDS = ['sakura', 'midnight', 'matcha', 'yuzu', 'synth', 'kuro'];

  function iconFor(id) {
    if (id === 'off') return 'assets/favicon.svg';
    if (id === 'custom') {
      var s = B0Settings.get();
      var v = s.customIcon;
      if (!v) return 'assets/favicon.svg';
      if (/^(https?:|data:)/i.test(v)) return v;
      return 'data:image/svg+xml,' + encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + v + '</text></svg>'
      );
    }
    return B0Settings.icons[id] || 'assets/favicon.svg';
  }

  function titleFor(id) {
    if (id === 'off') return '0xB0 Games — Unblocked Games';
    if (id === 'custom') {
      var s = B0Settings.get();
      return s.customTitle || 'New Tab';
    }
    return B0Settings.titles[id] || '0xB0 Games';
  }

  function refresh() {
    var s = B0Settings.get();

    /* profile cards */
    PROFILES.forEach(function (p) {
      var card = grid.querySelector('[data-p="' + p.id + '"]');
      if (card) card.classList.toggle('on', s.profile === p.id);
    });
    customPanel.style.display = s.profile === 'custom' ? 'block' : 'none';
    if (document.activeElement !== customTitle) customTitle.value = s.customTitle;
    if (document.activeElement !== customIcon) customIcon.value = s.customIcon;

    /* live preview */
    pvIcon.src = iconFor(s.profile);
    pvTitle.textContent = titleFor(s.profile);

    /* panic */
    panicEnabled.checked = s.panic !== false;
    if (document.activeElement !== panicUrl) panicUrl.value = s.panicUrl;

    /* themes */
    themeGrid.querySelectorAll('.theme-card').forEach(function (el) {
      el.classList.toggle('on', el.dataset.t === s.theme);
    });

    /* effects + site + unblocker */
    petalsOn.checked = s.petals !== false;
    if (document.activeElement !== petalDensity) petalDensity.value = s.petalDensity;
    bossMode.checked = !!s.bossMode;
    newTab.checked = !!s.newTab;
    if (document.activeElement !== gridDensity) gridDensity.value = s.gridDensity;
    if (document.activeElement !== searchEngine) searchEngine.value = s.searchEngine;
  }

  /* ---- profile cards ---- */
  PROFILES.forEach(function (p) {
    var card = document.createElement('button');
    card.className = 'profile-card';
    card.dataset.p = p.id;
    card.innerHTML =
      '<img src="' + iconFor(p.id) + '" alt="" />' +
      '<span class="pc-name">' + p.name + '</span>' +
      '<span class="pc-hint">' + p.hint + '</span>';
    card.addEventListener('click', function () {
      B0Settings.set({ profile: p.id });
      refresh();
    });
    grid.appendChild(card);
  });

  /* ---- theme cards ---- */
  var THEMES = B0Settings.themes;
  THEME_IDS.forEach(function (id) {
    var t = THEMES[id];
    if (!t) return;
    var card = document.createElement('button');
    card.className = 'theme-card';
    card.dataset.t = id;
    card.innerHTML =
      '<span class="tc-preview" style="background:linear-gradient(120deg,' + t['accent'] + ',' + t['accent-2'] + ')"></span>' +
      '<span class="tc-swatch" style="background:' + t['bg'] + ';border:1px solid ' + t['border-2'] + '"></span>' +
      '<span class="tc-name">' + t.name + '</span>';
    card.addEventListener('click', function () {
      B0Settings.set({ theme: id });
      refresh();
    });
    themeGrid.appendChild(card);
  });

  /* ---- custom disguise inputs ---- */
  customTitle.addEventListener('input', function () {
    B0Settings.set({ customTitle: customTitle.value });
    refresh();
  });
  customIcon.addEventListener('input', function () {
    B0Settings.set({ customIcon: customIcon.value });
    refresh();
  });

  /* ---- panic ---- */
  panicEnabled.addEventListener('change', function () {
    B0Settings.set({ panic: panicEnabled.checked });
  });
  panicUrl.addEventListener('input', function () {
    B0Settings.set({ panicUrl: panicUrl.value });
  });
  document.getElementById('panicTest').addEventListener('click', function () {
    var url = (B0Settings.get().panicUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    window.open(url, '_blank');
  });

  /* ---- effects ---- */
  petalsOn.addEventListener('change', function () {
    B0Settings.set({ petals: petalsOn.checked });
  });
  petalDensity.addEventListener('change', function () {
    B0Settings.set({ petalDensity: petalDensity.value });
  });

  /* ---- site ---- */
  bossMode.addEventListener('change', function () {
    B0Settings.set({ bossMode: bossMode.checked });
  });
  newTab.addEventListener('change', function () {
    B0Settings.set({ newTab: newTab.checked });
  });
  gridDensity.addEventListener('change', function () {
    B0Settings.set({ gridDensity: gridDensity.value });
  });

  /* ---- unblocker search engine ---- */
  searchEngine.addEventListener('change', function () {
    B0Settings.set({ searchEngine: searchEngine.value });
  });

  /* ---- reset ---- */
  document.getElementById('resetAll').addEventListener('click', function () {
    if (confirm('Reset ALL 0xB0 settings?')) {
      B0Settings.set(B0Settings.defaults());
      refresh();
    }
  });

  refresh();
})();
