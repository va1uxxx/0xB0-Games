/**
 * 0xB0 ROSTER — Google Apps Script backend
 * ================================================
 * A tiny web app that stores the shared member list in a Sheet.
 * Deploy it as a Web App (see SETUP.md) — takes ~3 minutes.
 *
 * Endpoints:
 *   GET  <url>            -> { ok:true, users:[{username,title,avatar,joined}] }
 *   POST <url>            -> body { token, username, title?, avatar?, joined? }
 *                             returns { ok:true } or { ok:false, error }
 *                             (also supports action:"remove" with the token)
 *
 * Notes:
 *  - The write token is a casual anti-spam measure only (the site's
 *    JS ships it in plain text). Anyone who really wants to can spam
 *    the sheet — clean it up directly in the spreadsheet or bump the
 *    token in BOTH Code.gs AND js/roster-config.js (then redeploy the
 *    web app).
 *  - Responses are text/plain on purpose: browsers then send a simple
 *    request with no preflight, so this works cross-origin from a
 *    static GitHub Pages site.
 *  - No passwords ever touch this script — roster only ever holds
 *    username, cosmetic title, avatar and a join date.
 */

var SHEET_NAME = 'roster';
var CONFIG_SHEET = 'config';
var PRESENCE_SHEET = 'presence';
var ONLINE_WINDOW_MS = 5 * 60 * 1000; /* "playing right now" = seen in the last 5 min */
var WRITE_TOKEN = 'CHANGE_ME_to_a_long_random_string';
/* Private admin token — used ONLY for destructive/shared-edit actions
   (remove, set title/avatar). Never ship this in the site's JS: the
   owner types it into the admin page, which stores it in localStorage
   on their own devices only. */
var ADMIN_TOKEN = 'CHANGE_ME_to_a_DIFFERENT_long_secret';
var MAX_USERS = 500; /* hard cap so nobody can bloat the sheet */

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['username', 'title', 'avatar', 'joined']);
  }
  return sh;
}

/* Optional key/value "config" sheet — holds the sitewide
   announcement text, the hidden/flagged game lists and the partners
   list. Missing sheet just means "no config", never an error. */
function configSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG_SHEET);
    sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  return sh;
}

/* Anonymous presence sheet: one row per device {id, seen (epoch ms)}.
   Never holds usernames — just "someone is on the site right now". */
function presenceSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PRESENCE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PRESENCE_SHEET);
    sh.getRange(1, 1, 1, 2).setValues([['id', 'seen']]);
  }
  return sh;
}

/* Count devices seen inside the online window (read-only). */
function online_() {
  try {
    var sh = presenceSheet_();
    var now = Date.now();
    var data = sh.getDataRange().getValues();
    var count = 0;
    for (var i = 1; i < data.length; i++) {
      if (now - (Number(data[i][1]) || 0) <= ONLINE_WINDOW_MS) count++;
    }
    return count;
  } catch (err) {
    return 0;
  }
}

/* Keep only sane partner objects: {name, url, emoji, blurb}. */
function sanitizePartners_(arr) {
  var out = [];
  if (!Array.isArray(arr)) return out;
  for (var i = 0; i < arr.length && out.length < 30; i++) {
    var p = arr[i] || {};
    var url = String(p.url || '');
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      name: String(p.name || '').slice(0, 30),
      emoji: String(p.emoji || '🔗').slice(0, 8),
      url: url.slice(0, 140),
      blurb: String(p.blurb || '').slice(0, 140)
    });
  }
  return out;
}

function getConfig_() {
  var out = { announcement: '', hidden: [], flagged: [], partners: [] };
  try {
    var sh = configSheet_();
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var k = String(data[i][0] || '');
      var v = data[i][1];
      if (k === 'announcement') {
        out.announcement = String(v || '');
      } else if (k === 'hidden' || k === 'flagged') {
        if (typeof v === 'string' && v.charAt(0) === '[') {
          try { out[k] = JSON.parse(v); } catch (err) { out[k] = []; }
        } else if (Array.isArray(v)) {
          out[k] = v;
        }
      } else if (k === 'partners') {
        if (typeof v === 'string' && v.charAt(0) === '[') {
          try { out.partners = sanitizePartners_(JSON.parse(v)); } catch (err) { out.partners = []; }
        }
      }
    }
  } catch (err) {
    return { announcement: '', hidden: [], flagged: [], partners: [] };
  }
  return out;
}

function doGet(e) {
  try {
    var sh = sheet_();
    var data = sh.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      users.push({
        username: String(data[i][0]),
        title: String(data[i][1] || 'member'),
        avatar: String(data[i][2] || '\uD83D\uDC49'),
        joined: String(data[i][3] || '')
      });
    }
    return json_({ ok: true, users: users, config: getConfig_(), online: online_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body;
    try {
      body = JSON.parse(e.postData.contents || '{}');
    } catch (err) {
      return json_({ ok: false, error: 'bad body' });
    }

    if (!body.token) {
      return json_({ ok: false, error: 'bad token' });
    }

    var sh = sheet_();
    var action = String(body.action || 'add');

    /* anonymous presence heartbeat — write-token level, no username */
    if (action === 'heartbeat') {
      if (body.token !== WRITE_TOKEN) {
        return json_({ ok: false, error: 'bad token' });
      }
      return heartbeat_(body);
    }

    /* owner-only actions: require the private admin token, which is
       never shipped in the site's public JS */
    if (action === 'remove' || action === 'update' || action === 'setconfig') {
      if (body.token !== ADMIN_TOKEN) {
        return json_({ ok: false, error: 'forbidden' });
      }
      if (action === 'remove') return remove_(sh, body);
      if (action === 'update') return update_(sh, body);
      return setConfig_(body);
    }

    /* public actions (signup announce) use the write token */
    if (body.token !== WRITE_TOKEN) {
      return json_({ ok: false, error: 'bad token' });
    }
    return add_(sh, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function add_(sh, body) {
  var username = String(body.username || '').trim();
  if (username.length < 2 || username.length > 20) {
    return json_({ ok: false, error: 'invalid username' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return json_({ ok: false, error: 'invalid username' });
  }

  var data = sh.getDataRange().getValues();
  if (data.length - 1 >= MAX_USERS) {
    return json_({ ok: false, error: 'roster full' });
  }
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).toLowerCase() === username.toLowerCase()) {
      return json_({ ok: false, error: 'taken' });
    }
  }

  sh.appendRow([
    username,
    String(body.title || 'member').slice(0, 30),
    String(body.avatar || '\uD83D\uDC49').slice(0, 8),
    String(body.joined || new Date().toISOString()).slice(0, 10)
  ]);
  return json_({ ok: true, username: username });
}

/* Anonymous presence heartbeat: upsert {id -> now} and reply with
   the current online count. Rows older than 15 minutes are pruned
   whenever the sheet grows past 800 rows (so it can never bloat). */
function heartbeat_(body) {
  var id = String(body.id || '').replace(/[^\w-]/g, '').slice(0, 20);
  if (!id) return json_({ ok: false, error: 'bad id' });
  var sh = presenceSheet_();
  var now = Date.now();
  var data = sh.getDataRange().getValues();

  if (data.length - 1 > 800) {
    var keep = [['id', 'seen']];
    for (var i = 1; i < data.length; i++) {
      if (now - (Number(data[i][1]) || 0) <= 15 * 60 * 1000) {
        keep.push([String(data[i][0]), Number(data[i][1]) || 0]);
      }
    }
    sh.clearContents();
    sh.getRange(1, 1, keep.length, 2).setValues(keep);
    data = sh.getDataRange().getValues();
  }

  for (var j = 1; j < data.length; j++) {
    if (String(data[j][0]) === id) {
      sh.getRange(j + 1, 2).setValue(now);
      return json_({ ok: true, online: online_() });
    }
  }
  if (data.length - 1 < 1000) {
    sh.appendRow([id, now]);
  }
  return json_({ ok: true, online: online_() });
}

function remove_(sh, body) {
  var username = String(body.username || '').trim();
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] && String(data[i][0]).toLowerCase() === username.toLowerCase()) {
      sh.deleteRow(i + 1);
      return json_({ ok: true, username: username });
    }
  }
  return json_({ ok: false, error: 'not found' });
}

/* Owner-only: change a member's cosmetic title and/or avatar in the
   sheet. Fields that are absent are left untouched. */
function update_(sh, body) {
  var username = String(body.username || '').trim();
  if (!username) return json_({ ok: false, error: 'invalid username' });
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).toLowerCase() === username.toLowerCase()) {
      var vals = [
        data[i][0],
        body.title !== undefined ? String(body.title).slice(0, 30) : data[i][1],
        body.avatar !== undefined ? String(body.avatar).slice(0, 8) : data[i][2],
        data[i][3]
      ];
      sh.getRange(i + 1, 1, 1, 4).setValues([vals]);
      return json_({ ok: true, username: username });
    }
  }
  return json_({ ok: false, error: 'not found' });
}

/* CORS-friendly: text/plain means no preflight, so a static GitHub
   Pages page can call this cross-origin without extra headers. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.TEXT);
}

/* Owner-only: replace the announcement text and/or the hidden /
   flagged game slug lists in the config sheet. Each key present in
   the body is stored (others are left untouched). */
function setConfig_(body) {
  var sh = configSheet_();
  var locks = { announcement: 'text', hidden: 'list', flagged: 'list', partners: 'json' };
  var keys = Object.keys(locks);
  var deleteRows = [];
  var data = sh.getDataRange().getValues();
  var seen = {};

  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '');
    if (locks[k]) {
      if (body[k] !== undefined) {
        if (locks[k] === 'list') {
          var arr = Array.isArray(body[k]) ? body[k] : [];
          var clean = [];
          for (var j = 0; j < arr.length && j < 200; j++) {
            var s = String(arr[j]).replace(/[^\w-]/g, '').slice(0, 40);
            if (s && clean.indexOf(s) === -1) clean.push(s);
          }
          sh.getRange(i + 1, 2).setValue(JSON.stringify(clean));
        } else if (locks[k] === 'json') {
          sh.getRange(i + 1, 2).setValue(JSON.stringify(sanitizePartners_(body[k])));
        } else {
          sh.getRange(i + 1, 2).setValue(String(body[k]).slice(0, 200));
        }
        seen[k] = true;
      } else {
        seen[k] = true;
      }
    } else {
      deleteRows.push(i + 1);
    }
  }
  for (var r = deleteRows.length - 1; r >= 0; r--) {
    sh.deleteRow(deleteRows[r]);
  }

  /* keys we should have but the sheet didn't -> append below the header */
  var rows = [];
  for (var n = 0; n < keys.length; n++) {
    if (seen[keys[n]]) continue;
    var val;
    if (locks[keys[n]] === 'list') {
      var a = Array.isArray(body[keys[n]]) ? body[keys[n]] : [];
      var cl = [];
      for (var m = 0; m < a.length && m < 200; m++) {
        var s2 = String(a[m]).replace(/[^\w-]/g, '').slice(0, 40);
        if (s2 && cl.indexOf(s2) === -1) cl.push(s2);
      }
      val = JSON.stringify(cl);
    } else if (locks[keys[n]] === 'json') {
      val = JSON.stringify(sanitizePartners_(body[keys[n]]));
    } else {
      val = String(body[keys[n]] === undefined ? '' : body[keys[n]]).slice(0, 200);
    }
    rows.push([keys[n], val]);
  }
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  }

  return json_({ ok: true });
}