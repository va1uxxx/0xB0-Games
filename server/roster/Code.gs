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
    return json_({ ok: true, users: users });
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

    /* owner-only actions: require the private admin token, which is
       never shipped in the site's public JS */
    if (action === 'remove' || action === 'update') {
      if (body.token !== ADMIN_TOKEN) {
        return json_({ ok: false, error: 'forbidden' });
      }
      return action === 'remove' ? remove_(sh, body) : update_(sh, body);
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