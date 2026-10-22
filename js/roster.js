/* ============================================================
   0xB0 ROSTER — client for the shared members list

   Reads / writes the optional roster backend (a Google Apps
   Script web app backed by a Sheet — see server/roster/).

   Fail-open by design:
     - Not configured (js/roster-config.js empty) => no network
       calls at all, list() resolves `null`, announce() is a no-op.
     - Configured but the fetch fails / is blocked => signups and
       the rest of the site keep working; the Members page shows a
       friendly offline state and keeps any cached list.

   Only ever sends: username, cosmetic title, avatar emoji, joined
   date. Never the password hash.
   ============================================================ */

(function () {
  'use strict';

  var CFG;
  try { CFG = window.B0_ROSTER || {}; } catch (err) { CFG = {}; }

  var CACHE_KEY = '0xb0-roster-cache';
  var CACHE_TTL = 60000; /* ms before a cached list is considered stale */

  function configured() {
    return !!(
      CFG &&
      typeof CFG.url === 'string' && CFG.url.indexOf('http') === 0 &&
      typeof CFG.token === 'string' && CFG.token.length > 0
    );
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeCache(users) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), users: users }));
    } catch (err) { /* private mode etc. — fine */ }
  }

  /* Crop a string to `n` code points (not UTF-16 units) so emoji /
     surrogate pairs are never split mid-character. */
  function crop(s, n) {
    return Array.from(String(s == null ? '' : s)).slice(0, n).join('');
  }

  /* Site-wide config published by the owner through the sheet:
     { announcement, hidden: [], flagged: [] }. Only present when
     the deployed backend supports it — otherwise null (fail-open). */
  var cfgCache = null;

  /* Fetch the shared member list.
     - not configured  -> resolves null
     - ok              -> resolves array of { username, title, avatar, joined }
     - offline/fail    -> resolves cached array, or null if nothing cached */
  function list(force) {
    if (!configured()) return Promise.resolve(null);
    var cache = readCache();
    if (!force && cache && Date.now() - cache.t < CACHE_TTL) {
      return Promise.resolve(cache.users);
    }
    /* cache-buster on the query string: Apps Script ignores extra
       params and this defeats stale copies from proxies/CDNs */
    var sep = CFG.url.indexOf('?') < 0 ? '?' : '&';
    return fetch(CFG.url + sep + 'ts=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var users = (d && d.ok && d.users) || [];
        cfgCache = (d && d.config) || cfgCache;
        if (d && typeof d.online === 'number') lastOnline = d.online;
        writeCache(users);
        return users;
      })
      .catch(function () {
        return cache ? cache.users : null;
      });
  }

  /* The most recently fetched config, or null. */
  function config() {
    return cfgCache;
  }

  /* Owner-only: replace announcement / hidden / flagged / partners
     in the sheet. Sends the full intended values for each key you
     include. */
  function setConfig(patch) {
    var body = { action: 'setconfig' };
    if (patch && typeof patch.announcement === 'string') {
      body.announcement = patch.announcement.slice(0, 200);
    }
    if (patch && Array.isArray(patch.hidden)) {
      body.hidden = patch.hidden.map(function (s) { return crop(s, 40); }).slice(0, 200);
    }
    if (patch && Array.isArray(patch.flagged)) {
      body.flagged = patch.flagged.map(function (s) { return crop(s, 40); }).slice(0, 200);
    }
    if (patch && Array.isArray(patch.partners)) {
      body.partners = patch.partners.slice(0, 30).map(function (p) {
        p = p || {};
        return {
          name: crop(p.name, 30),
          emoji: crop(p.emoji || '🔗', 8),
          url: /^https?:\/\//i.test(String(p.url || '')) ? String(p.url).slice(0, 140) : '',
          blurb: crop(p.blurb, 140)
        };
      });
    }
    return admin(body).then(function (res) {
      if (res.ok) cfgCache = null; /* next config() call re-reads fresh */
      return res;
    });
  }

  /* Publish a fresh signup to the roster. Fire-and-forget: nothing
     here may ever block or break the local signup. */
  function announce(user) {
    if (!configured() || !user || !user.username) {
      return Promise.resolve(false);
    }
    return fetch(CFG.url, {
      method: 'POST',
      body: JSON.stringify({
        token: CFG.token,
        username: String(user.username),
        title: crop(user.title || 'member', 30),
        avatar: crop(user.avatar || '👤', 4),
        joined: crop(user.createdAt || new Date().toISOString(), 10)
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { return !!(d && d.ok); })
      .catch(function () { return false; });
  }

  /* ---------- owner-only actions (private admin secret) ----------
     The admin secret is NOT in the site's public JS — it lives only
     in the Apps Script (ADMIN_TOKEN) and in this browser's
     localStorage, where the owner types it on the admin page. */

  var ADMIN_KEY = '0xb0-admin-token';

  function adminToken() {
    try { return localStorage.getItem(ADMIN_KEY) || ''; } catch (err) { return ''; }
  }

  function setAdminToken(t) {
    try {
      if (t) { localStorage.setItem(ADMIN_KEY, t); } else { localStorage.removeItem(ADMIN_KEY); }
      return true;
    } catch (err) { return false; }
  }

  /* Reusable admin POST. Resolves { ok, error? } so the admin panel
     can show a real message. Never blocks or breaks anything else. */
  function admin(body) {
    if (!configured()) return Promise.resolve({ ok: false, error: 'roster not configured' });
    var tok = adminToken();
    if (!tok) return Promise.resolve({ ok: false, error: 'no admin secret saved' });
    var payload = { token: tok };
    Object.keys(body).forEach(function (k) { payload[k] = body[k]; });
    return fetch(CFG.url, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return { ok: !!(d && d.ok), error: (d && d.error) || null };
      })
      .catch(function () { return { ok: false, error: 'could not reach roster' }; });
  }

  function remove(username) {
    return admin({ action: 'remove', username: String(username) });
  }

  function update(username, fields) {
    var body = { action: 'update', username: String(username) };
    if (fields && fields.title !== undefined) body.title = crop(fields.title, 30);
    if (fields && fields.avatar !== undefined) body.avatar = crop(fields.avatar, 4);
    return admin(body);
  }

  /* ---------- live presence (anonymous) ----------
     Each device pings the roster once a minute while its tab is
     visible, using a random per-device ID from localStorage — no
     username, no password, nothing identifying. The backend replies
     with the number of devices seen in the last 5 minutes, which
     the homepage shows as "N playing right now". Fail-open: not
     configured / blocked => nothing happens, the badge stays hidden. */

  var PRESENCE_KEY = '0xb0-presence-id';
  var lastOnline = null;
  var hbTimer = null;

  function presenceId() {
    try {
      var id = localStorage.getItem(PRESENCE_KEY);
      if (!id) {
        id = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(PRESENCE_KEY, id);
      }
      return id;
    } catch (err) { return null; }
  }

  function heartbeat() {
    if (!configured() || document.hidden) return;
    var id = presenceId();
    if (!id) return;
    fetch(CFG.url, {
      method: 'POST',
      body: JSON.stringify({ token: CFG.token, action: 'heartbeat', id: id })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && typeof d.online === 'number') lastOnline = d.online;
      })
      .catch(function () { /* offline is fine */ });
  }

  function startHeartbeat() {
    if (hbTimer || !configured()) return;
    heartbeat();
    hbTimer = setInterval(heartbeat, 60000);
    document.addEventListener('visibilitychange', heartbeat);
  }

  /* Most recent online count seen (from list() or a heartbeat), or null. */
  function online() {
    return lastOnline;
  }

  startHeartbeat();

  window.B0Roster = {
    configured: configured,
    list: list,
    config: config,
    setConfig: setConfig,
    announce: announce,
    adminToken: adminToken,
    setAdminToken: setAdminToken,
    remove: remove,
    update: update,
    heartbeat: heartbeat,
    online: online
  };
})();