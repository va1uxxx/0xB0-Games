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
    return fetch(CFG.url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var users = (d && d.ok && d.users) || [];
        writeCache(users);
        return users;
      })
      .catch(function () {
        return cache ? cache.users : null;
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
        title: String(user.title || 'member').slice(0, 30),
        avatar: String(user.avatar || '👤').slice(0, 8),
        joined: String(user.createdAt || new Date().toISOString()).slice(0, 10)
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { return !!(d && d.ok); })
      .catch(function () { return false; });
  }

  window.B0Roster = {
    configured: configured,
    list: list,
    announce: announce
  };
})();