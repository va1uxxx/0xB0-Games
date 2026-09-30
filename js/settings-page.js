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

  /* ---- reset (two-step, no blocking dialog) ---- */
  var resetBtn = document.getElementById('resetAll');
  if (resetBtn) {
    var resetArmed = false;
    var resetTimer = null;
    resetBtn.addEventListener('click', function () {
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = 'Reset everything?';
        resetBtn.classList.add('armed');
        resetBtn.style.color = 'var(--danger)';
        resetBtn.style.borderColor = 'var(--danger)';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          resetArmed = false;
          resetBtn.textContent = 'Reset all settings';
          resetBtn.classList.remove('armed');
          resetBtn.style.color = '';
          resetBtn.style.borderColor = '';
        }, 4000);
        return;
      }
      B0Settings.set(B0Settings.defaults());
      refresh();
      resetArmed = false;
      resetBtn.textContent = 'Reset all settings';
      resetBtn.classList.remove('armed');
      resetBtn.style.color = '';
      resetBtn.style.borderColor = '';
    });
  }

  refresh();
})();

/* ============================================================
   PROFILE SECTION (avatar, name, cosmetic title)
   Runs only on settings.html, only when logged in.
   ============================================================ */

(function () {
  'use strict';
  var section = document.getElementById('profileSection');
  if (!section) return;
  if (!window.B0Auth) return;

  var user = B0Auth.getCurrentUser();
  if (!user) return; /* logged-out note stays visible */

  /* show the editor, hide the note */
  var editor = document.getElementById('profileEditor');
  var note = document.getElementById('profileLoggedOut');
  if (editor) editor.style.display = 'block';
  if (note) note.style.display = 'none';

  var avatarEl = document.getElementById('pfAvatar');
  var nameEl = document.getElementById('pfName');
  var badgeEl = document.getElementById('pfTitleBadge');
  var nameInput = document.getElementById('pfNameInput');
  var nameMsg = document.getElementById('pfNameMsg');
  var avatarGrid = document.getElementById('pfAvatarGrid');
  var customAvatar = document.getElementById('pfCustomAvatar');

  function esc(s) {
    var A = String.fromCharCode(38); /* the ampersand entity prefix */
    var map = {};
    map[A] = A + 'amp;';
    map['<'] = A + 'lt;';
    map['>'] = A + 'gt;';
    map['"'] = A + 'quot;';
    map["'"] = A + '#39;';
    return String(s).replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  function refresh() {
    user = B0Auth.getCurrentUser();
    if (!user) return;
    if (avatarEl) avatarEl.textContent = user.avatar || '👤';
    if (nameEl) nameEl.textContent = user.username;
    if (badgeEl) {
      var t = B0Auth.titleInfo(user.title);
      badgeEl.textContent = t.emoji + ' ' + t.label;
      badgeEl.style.color = t.color;
      badgeEl.style.borderColor = t.color;
    }
    if (nameInput && document.activeElement !== nameInput) nameInput.value = user.username;
    renderAvatarGrid();
  }

  function renderAvatarGrid() {
    if (!avatarGrid) return;
    var opts = B0Auth.getAvatarOptions();
    var html = '';
    opts.forEach(function (a) {
      var active = user.avatar === a ? ' active' : '';
      html += '<button class="avatar-cell' + active + '" data-emoji="' + a + '" title="Set avatar ' + a + '">' + a + '</button>';
    });
    avatarGrid.innerHTML = html;
  }

  /* pick avatar from grid */
  if (avatarGrid) {
    avatarGrid.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.avatar-cell');
      if (!btn) return;
      B0Auth.setAvatar(btn.getAttribute('data-emoji'));
      refresh();
    });
  }

  /* custom emoji avatar */
  var saveAvatarBtn = document.getElementById('pfSaveAvatar');
  if (saveAvatarBtn) {
    saveAvatarBtn.addEventListener('click', function () {
      var res = B0Auth.setAvatar(customAvatar ? customAvatar.value : '');
      if (nameMsg) {
        nameMsg.textContent = res.ok ? 'Avatar updated ✓' : (res.error || '');
        nameMsg.style.color = res.ok ? 'var(--accent)' : 'var(--danger)';
      }
      if (res.ok && customAvatar) customAvatar.value = '';
      refresh();
    });
  }

  /* rename */
  var saveNameBtn = document.getElementById('pfSaveName');
  if (saveNameBtn) {
    saveNameBtn.addEventListener('click', function () {
      var res = B0Auth.rename(nameInput ? nameInput.value : '');
      if (nameMsg) {
        nameMsg.textContent = res.ok ? 'Name saved ✓' : (res.error || '');
        nameMsg.style.color = res.ok ? 'var(--accent)' : 'var(--danger)';
      }
      refresh();
      /* refresh the nav badge too */
      var slot = document.getElementById('loginSlot');
      if (slot && window.B0Auth) {
        var u2 = B0Auth.getCurrentUser();
        if (u2) {
          var t2 = B0Auth.titleInfo(u2.title);
          slot.innerHTML = '<a href="login.html" class="nav-link-user" title="Logged in as ' + esc(u2.username) + '">' +
            '<span class="nav-avatar">' + (u2.avatar || '👤') + '</span>' +
            '<span class="nav-username">' + esc(u2.username) + '</span>' +
            (u2.role === 'admin' ? '<span class="nav-role" title="Site owner">⚡</span>' : '') +
            '<span class="nav-role nav-title" style="color:' + t2.color + '">' + t2.emoji + '</span></a>';
        }
      }
    });
  }

  /* pick cosmetic title — removed: only the owner changes titles, from the admin panel */

  /* ---- account actions in the profile card ---- */

  var adminBtn = document.getElementById('pfAdminBtn');
  if (adminBtn) adminBtn.style.display = user.role === 'admin' ? '' : 'none';

  var acctBtn = document.getElementById('pfSettingsBtn');
  if (acctBtn) acctBtn.addEventListener('click', function () { location.href = 'login.html'; });

  var logoutBtn = document.getElementById('pfLogout');
  if (logoutBtn) {
    /* two-step, no blocking confirm() dialog */
    var armed = false;
    var armTimer = null;
    logoutBtn.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        logoutBtn.textContent = 'Log out for sure?';
        logoutBtn.classList.add('armed');
        clearTimeout(armTimer);
        armTimer = setTimeout(function () {
          armed = false;
          logoutBtn.textContent = 'Log out';
          logoutBtn.classList.remove('armed');
        }, 4000);
        return;
      }
      B0Auth.logout();
      location.href = 'index.html';
    });
  }

  refresh();
})();
