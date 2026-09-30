/* ============================================================
   0xB0 GAMES — Auth engine (localStorage-based accounts)
   ------------------------------------------------------------
   Static sites have no server, so accounts are stored in the
   browser's localStorage. Each account has:
     - username, password (SHA-256 hashed), role ("member"),
     - createdAt, avatar emoji, cosmetic title badge, gameData

   Game data is saved to the user's account on logout and
   restored on login — different users on the same Chromebook
   can have different high scores.

   Permissions:
     - "va1uxxx" is the site owner (role: admin). The account is
       re-promoted on every page load and can never be demoted
       or deleted, so the owner can never lose their own panel.
     - Cosmetic titles are assigned by the OWNER only, from the
       hidden admin panel. Users pick their own avatar + name.
     - Passwords are stored only as SHA-256 hashes and are never
       rendered anywhere in the site, admin panel included.

   NOTE: This is per-device only. Clearing browser data or
   switching devices loses the account. A real backend would
   be needed for cross-device sync.
   ============================================================ */

(function () {
  'use strict';

  var USERS_KEY = '0xb0-users';
  var CURRENT_KEY = '0xb0-current-user';
  var OWNER = 'va1uxxx';

  /* Keys that are NOT per-user game data (device-wide, not profile-wide).
     Everything else under the 0xb0- prefix is treated as a game's save
     file and gets saved to / restored from the account. That way a new
     game never silently loses its high scores — no list to maintain. */
  var NON_GAME_KEYS = [
    USERS_KEY,
    CURRENT_KEY,
    '0xb0-settings-v1',
    '0xb0-last-profile',
    '0xb0-cloak-on',
    '0xb0-rips-v1'
  ];

  function isOwner(user) {
    return !!user && user.username.toLowerCase() === OWNER;
  }

  /* ---------- password hashing (SHA-256 via Web Crypto) ---------- */

  async function hashPassword(password) {
    if (window.crypto && crypto.subtle) {
      try {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        return Array.from(new Uint8Array(buf)).map(function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      } catch (err) { /* fall through to simple hash */ }
    }
    /* fallback for older browsers */
    var hash = 0;
    for (var i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash + password.charCodeAt(i)) | 0;
    }
    return 'h' + Math.abs(hash).toString(36);
  }

  /* ---------- avatar generation (emoji based on username hash) ---------- */

  var AVATARS = ['🎮', '🌸', '🚀', '⚡', '🎨', '🦊', '🐼', '🐧', '🦄', '👾', '🎯', '🍕',
    '🌊', '🌙', '⭐', '🔥', '💎', '🎧', '🛸', '🧩', '🦖', '🐬', '🍀', '🪐'];

  function avatarFor(username) {
    var hash = 0;
    for (var i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
    }
    return AVATARS[Math.abs(hash) % AVATARS.length];
  }

  /* ---------- cosmetic titles (badges, assigned by the owner) ----------
     These are 100% cosmetic — the functional "role" field
     (member/admin) stays separate and only the owner can
     change it from the hidden admin panel.                        */

  var TITLES = {
    member:  { label: 'Member',      emoji: '👤', color: '#9aa4b2' },
    vip:     { label: 'VIP',         emoji: '⭐', color: '#ffd166' },
    legend:  { label: 'Legend',      emoji: '🏆', color: '#ff9f43' },
    pro:     { label: 'Pro Gamer',   emoji: '🎮', color: '#5eead4' },
    noob:    { label: 'Noob',        emoji: '🐌', color: '#94a3b8' },
    tryhard: { label: 'Tryhard',     emoji: '💀', color: '#f87171' },
    speed:   { label: 'Speedrunner', emoji: '⚡', color: '#60a5fa' },
    sakura:  { label: 'Sakura',      emoji: '🌸', color: '#ff6ea9' },
    og:      { label: 'OG',          emoji: '🧊', color: '#a78bfa' },
    ghost:   { label: 'Ghost',       emoji: '👻', color: '#cbd5e1' },
    founder: { label: 'Founder',     emoji: '👑', color: '#ff6ea9', locked: true }
  };

  /* ---------- storage helpers ---------- */

  function loadUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function currentUser() {
    var username = localStorage.getItem(CURRENT_KEY);
    if (!username) return null;
    var users = loadUsers();
    var user = users.find(function (u) { return u.username === username; }) || null;
    /* backfill cosmetic title for accounts made before titles existed,
       and make sure the owner account ALWAYS has admin + founder      */
    if (user) {
      var owner = isOwner(user);
      var changed = false;
      if (!user.title) {
        user.title = owner ? 'founder' : 'member';
        changed = true;
      }
      if (owner && (user.role !== 'admin' || user.title !== 'founder')) {
        user.role = 'admin';
        user.title = 'founder';
        changed = true;
      }
      if (changed) saveUsers(users);
    }
    return user;
  }

  /* ---------- profile helpers ---------- */

  function updateCurrentUser(mutate) {
    var username = localStorage.getItem(CURRENT_KEY);
    if (!username) return { ok: false, error: 'Not logged in' };
    var users = loadUsers();
    var user = users.find(function (u) { return u.username === username; });
    if (!user) return { ok: false, error: 'Not logged in' };
    mutate(user);
    saveUsers(users);
    return { ok: true, user: user };
  }

  /* ---------- game data (save/restore) ---------- */

  /* every localStorage entry a game has written (prefix 0xb0-) */
  function gameDataKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('0xb0-') !== 0) continue;
        if (NON_GAME_KEYS.indexOf(k) !== -1) continue;
        keys.push(k);
      }
    } catch (err) { /* storage blocked */ }
    return keys;
  }

  function snapshotGameData() {
    var data = {};
    gameDataKeys().forEach(function (key) {
      var val = localStorage.getItem(key);
      if (val !== null) data[key] = val;
    });
    return data;
  }

  function restoreGameData(userData) {
    if (!userData || !userData.gameData) return;
    Object.keys(userData.gameData).forEach(function (key) {
      try { localStorage.setItem(key, userData.gameData[key]); } catch (err) {}
    });
  }

  function saveGameDataToUser() {
    var username = localStorage.getItem(CURRENT_KEY);
    if (!username) return;
    var users = loadUsers();
    var user = users.find(function (u) { return u.username === username; });
    if (user) {
      user.gameData = snapshotGameData();
      saveUsers(users);
    }
  }

  /* ---------- public API ---------- */

  var Auth = {
    /* sign up — everyone gets "member" role */
    signup: async function (username, password) {
      username = (username || '').trim();
      if (username.length < 2) return { ok: false, error: 'Username must be at least 2 characters' };
      if (username.length > 20) return { ok: false, error: 'Username too long (max 20)' };
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) return { ok: false, error: 'Only letters, numbers, _ and - allowed' };
      if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };

      var users = loadUsers();
      if (users.find(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
        return { ok: false, error: 'That username is already taken' };
      }

      var hash = await hashPassword(password);
      var owner = username.toLowerCase() === OWNER;
      var user = {
        username: username,
        passwordHash: hash,
        role: owner ? 'admin' : 'member',
        title: owner ? 'founder' : 'member',
        createdAt: new Date().toISOString(),
        avatar: avatarFor(username),
        gameData: {}
      };

      users.push(user);
      saveUsers(users);
      localStorage.setItem(CURRENT_KEY, username);
      return { ok: true, user: user };
    },

    /* login */
    login: async function (username, password) {
      username = (username || '').trim();
      var users = loadUsers();
      var user = users.find(function (u) { return u.username.toLowerCase() === username.toLowerCase(); });
      if (!user) return { ok: false, error: 'Account not found — sign up first' };

      var hash = await hashPassword(password);
      if (user.passwordHash !== hash) return { ok: false, error: 'Wrong password' };

      /* save current game data to whoever was logged in before */
      saveGameDataToUser();

      /* switch to this user */
      localStorage.setItem(CURRENT_KEY, user.username);

      /* restore this user's game data */
      restoreGameData(user);

      return { ok: true, user: user };
    },

    /* logout — save game data to this user first */
    logout: function () {
      saveGameDataToUser();
      localStorage.removeItem(CURRENT_KEY);
    },

    /* get current logged-in user (or null) */
    getCurrentUser: function () {
      return currentUser();
    },

    isLoggedIn: function () {
      return !!currentUser();
    },

    /* save game data now (called on page unload) */
    save: function () {
      saveGameDataToUser();
    },

    /* list all users (for admin) — passwords are NEVER included */
    getAllUsers: function () {
      return loadUsers().map(function (u) {
        return { username: u.username, role: u.role, title: u.title || 'member', createdAt: u.createdAt, avatar: u.avatar };
      });
    },

    /* ---------- cosmetic titles ---------- */

    /* catalog of cosmetic titles (used by the owner in admin.html) */
    getTitles: function () {
      var owner = isOwner(currentUser());
      return Object.keys(TITLES).map(function (key) {
        return {
          key: key,
          label: TITLES[key].label,
          emoji: TITLES[key].emoji,
          color: TITLES[key].color,
          locked: !!TITLES[key].locked && !owner
        };
      });
    },

    /* look up one title's style (used by nav/admin rendering) */
    titleInfo: function (key) {
      return TITLES[key || 'member'] || TITLES.member;
    },

    /* pick a cosmetic title — OWNER ONLY. Users cannot change their own
       title; the owner assigns them from the hidden admin panel.       */
    setTitle: function (key) {
      if (!isOwner(currentUser())) {
        return { ok: false, error: 'Only the site owner can change titles' };
      }
      if (!TITLES[key]) return { ok: false, error: 'Unknown title' };
      return updateCurrentUser(function (u) { u.title = key; });
    },

    /* ---------- profile customization ---------- */

    /* change avatar emoji (any emoji, max 8 chars to fit multi-codepoint) */
    setAvatar: function (emoji) {
      emoji = (emoji || '').trim();
      if (!emoji) return { ok: false, error: 'Pick an emoji' };
      if (emoji.length > 8) return { ok: false, error: 'That is too long for an avatar' };
      return updateCurrentUser(function (u) { u.avatar = emoji; });
    },

    /* the list of suggested avatars (for the picker grid) */
    getAvatarOptions: function () { return AVATARS.slice(); },

    /* rename the current account (keeps role, avatar, scores) */
    rename: function (newName) {
      newName = (newName || '').trim();
      if (newName.length < 2) return { ok: false, error: 'Username must be at least 2 characters' };
      if (newName.length > 20) return { ok: false, error: 'Username too long (max 20)' };
      if (!/^[a-zA-Z0-9_-]+$/.test(newName)) return { ok: false, error: 'Only letters, numbers, _ and - allowed' };

      var users = loadUsers();
      var oldName = localStorage.getItem(CURRENT_KEY);
      if (!oldName) return { ok: false, error: 'Not logged in' };
      var taken = users.some(function (u) {
        return u.username.toLowerCase() === newName.toLowerCase() && u.username !== oldName;
      });
      if (taken) return { ok: false, error: 'That username is already taken' };

      var user = users.find(function (u) { return u.username === oldName; });
      if (!user) return { ok: false, error: 'Not logged in' };
      user.username = newName;
      saveUsers(users);
      localStorage.setItem(CURRENT_KEY, newName);
      return { ok: true, user: user };
    },

    /* change another user's title (owner only, used by admin panel) */
    setUserTitle: function (username, key) {
      if (!isOwner(currentUser())) {
        return { ok: false, error: 'Owner only' };
      }
      if (!TITLES[key]) return { ok: false, error: 'Unknown title' };
      if (key === 'founder') return { ok: false, error: 'The Founder badge belongs to the owner' };
      var users = loadUsers();
      var user = users.find(function (u) { return u.username === username; });
      if (!user) return { ok: false, error: 'User not found' };
      user.title = key;
      saveUsers(users);
      return { ok: true, user: user };
    },

    /* change another user's FUNCTIONAL role (owner only).
       The owner account can never be demoted — that would lock the
       site owner out of their own admin panel.                 */
    setUserRole: function (username, role) {
      if (!isOwner(currentUser())) {
        return { ok: false, error: 'Owner only' };
      }
      if (role !== 'admin' && role !== 'member') {
        return { ok: false, error: 'Unknown role' };
      }
      var users = loadUsers();
      var user = users.find(function (u) { return u.username === username; });
      if (!user) return { ok: false, error: 'User not found' };
      if (user.username.toLowerCase() === OWNER) {
        return { ok: false, error: 'The owner account always stays admin' };
      }
      user.role = role;
      saveUsers(users);
      return { ok: true };
    },

    /* delete an account — owner only. (Anyone can delete their OWN
       account; nobody can delete anyone else's without the owner.)
       The owner account itself is undeletable: it is the only key to
       the admin panel, so losing it would be unrecoverable.        */
    deleteAccount: function (username) {
      var me = currentUser();
      var target = loadUsers().find(function (u) { return u.username === username; });
      if (!target) return { ok: false, error: 'User not found' };
      var self = me && me.username === username;
      if (!self && !isOwner(me)) return { ok: false, error: 'Owner only' };
      if (target.username.toLowerCase() === OWNER) {
        return { ok: false, error: 'The owner account cannot be deleted' };
      }
      var users = loadUsers().filter(function (u) { return u.username !== username; });
      saveUsers(users);
      if (localStorage.getItem(CURRENT_KEY) === username) {
        localStorage.removeItem(CURRENT_KEY);
      }
      return { ok: true };
    },

    /* true when the given username is the site owner */
    isOwnerName: function (username) {
      return String(username || '').toLowerCase() === OWNER;
    }
  };

  /* auto-save game data when leaving the page */
  window.addEventListener('beforeunload', function () {
    saveGameDataToUser();
  });

  window.B0Auth = Auth;
})();
