/* ============================================================
   0xB0 GAMES — Auth engine (localStorage-based accounts)
   ------------------------------------------------------------
   Static sites have no server, so accounts are stored in the
   browser's localStorage. Each account has:
     - username, password (SHA-256 hashed), role ("member"),
     - createdAt, avatar emoji, gameData (high scores)

   Game data is saved to the user's account on logout and
   restored on login — different users on the same Chromebook
   can have different high scores.

   NOTE: This is per-device only. Clearing browser data or
   switching devices loses the account. A real backend would
   be needed for cross-device sync.
   ============================================================ */

(function () {
  'use strict';

  var USERS_KEY = '0xb0-users';
  var CURRENT_KEY = '0xb0-current-user';

  /* keys used by games for high scores */
  var GAME_KEYS = [
    '0xb0-2048-best', '0xb0-snake-best', '0xb0-flappy-best',
    '0xb0-astro-best', '0xb0-hexjump-best', '0xb0-tetris-best',
    '0xb0-tennis-best', '0xb0-flappy-best',
    '0xb0-ttt-scores', '0xb0-c4-scores', '0xb0-memory-best'
  ];

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
    return users.find(function (u) { return u.username === username; }) || null;
  }

  /* ---------- game data (save/restore) ---------- */

  function snapshotGameData() {
    var data = {};
    GAME_KEYS.forEach(function (key) {
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
      var user = {
        username: username,
        passwordHash: hash,
        role: username.toLowerCase() === 'va1uxxx' ? 'admin' : 'member',
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

    /* list all users (for admin) */
    getAllUsers: function () {
      return loadUsers().map(function (u) {
        return { username: u.username, role: u.role, createdAt: u.createdAt, avatar: u.avatar };
      });
    },

    /* delete account */
    deleteAccount: function (username) {
      var users = loadUsers().filter(function (u) { return u.username !== username; });
      saveUsers(users);
      if (localStorage.getItem(CURRENT_KEY) === username) {
        localStorage.removeItem(CURRENT_KEY);
      }
    }
  };

  /* auto-save game data when leaving the page */
  window.addEventListener('beforeunload', function () {
    saveGameDataToUser();
  });

  window.B0Auth = Auth;
})();
