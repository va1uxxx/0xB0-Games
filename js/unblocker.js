/* ============================================================
   0xB0 GAMES — Unblocker (proxy portal + built-in engine)
   Shows a grid of working public proxies as the primary
   experience, with the built-in Ultraviolet engine as one
   option. Search auto-routes to whichever works.
   ============================================================ */
/*global Ultraviolet, __uv$config, UV_BARE_SERVERS, B0Settings*/

(function () {
  'use strict';

  var form = document.getElementById('uvForm');
  var input = document.getElementById('uvAddress');
  var goBtn = document.getElementById('goBtn');
  var luckyBtn = document.getElementById('luckyBtn');
  var cloakOpen = document.getElementById('cloakOpen');
  var quickRow = document.getElementById('quickRow');
  var portalGrid = document.getElementById('portalGrid');
  var toastEl = document.getElementById('toast');
  var settingsPanel = document.getElementById('settingsPanel');
  var gearBtn = document.getElementById('gearBtn');
  var serverInput = document.getElementById('serverInput');
  var settingsMsg = document.getElementById('settingsMsg');
  var LS_KEY = '0xb0-bare-server';
  var SW_URL = 'uv/sw.js';

  var swReady = false;
  var swPromise = null;
  var serverOk = false;
  var toastTimer = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3500);
  }

  /* ---------------- public proxies ------------------------------ */

  var PROXIES = [
    { id: 'builtin', name: '0xB0 Built-in', emoji: '⛩️',
      desc: 'Our own Ultraviolet engine — the fastest option when it works.',
      url: null },
    { id: 'invisiproxy', name: 'InvisiProxy', emoji: '🛡️',
      desc: 'TitaniumNetwork official — dedicated infrastructure, Scramjet + UV engines.',
      url: 'https://invisiproxy.com/browsing' },
    { id: 'lunar', name: 'Lunar', emoji: '🌙',
      desc: 'Tab-based browser disguised as IXL (the math site schools love).',
      url: 'https://lunaron.top/welcome' },
    { id: 'daydreamx', name: 'DayDreamX', emoji: '🌅',
      desc: 'A full browser running inside your browser — tabs, bookmarks, full proxy.',
      url: 'https://daydreamx.pro' }
  ];

  function proxyStatus(id, ok, note) {
    var el = portalGrid && portalGrid.querySelector('[data-proxy="' + id + '"]');
    if (!el) return;
    var dot = el.querySelector('.pp-dot');
    var status = el.querySelector('.pp-status');
    if (dot) dot.className = 'pp-dot ' + (ok ? 'ok' : 'bad');
    if (status) status.textContent = ok ? (note || '✓ Working') : (note || '✗ Blocked');
    el.classList.toggle('pp-blocked', !ok);
  }

  function buildPortal() {
    if (!portalGrid) return;
    portalGrid.innerHTML = PROXIES.map(function (p) {
      return (
        '<div class="pp-card" data-proxy="' + p.id + '">' +
        '<div class="pp-head">' +
        '<span class="pp-emoji">' + p.emoji + '</span>' +
        '<span class="pp-dot checking"></span>' +
        '</div>' +
        '<span class="pp-name">' + p.name + '</span>' +
        '<span class="pp-desc">' + p.desc + '</span>' +
        '<span class="pp-status">Checking…</span>' +
        (p.url
          ? '<a class="pp-launch" href="' + p.url + '" target="_blank" rel="noopener">Launch ↗</a>'
          : '<button class="pp-launch" data-launch="builtin">Launch</button>') +
        '</div>'
      );
    }).join('');
  }

  function checkPublicProxies() {
    PROXIES.forEach(function (p) {
      if (!p.url) return;
      fetch(p.url, { mode: 'no-cors' })
        .then(function () { proxyStatus(p.id, true); })
        .catch(function () { proxyStatus(p.id, false); });
    });
  }

  function launchProxy(id, url) {
    var proxy = PROXIES.find(function (p) { return p.id === id; });
    if (!proxy) return;
    if (!proxy.url) {
      launchBuiltin(url);
      return;
    }
    if (url && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(search(url)).catch(function () {});
    }
    toast('Opening ' + proxy.name + (url ? ' — URL copied to clipboard' : ''));
    setTimeout(function () { window.open(proxy.url, '_blank'); }, 300);
  }

  portalGrid && portalGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-launch]');
    if (btn) launchProxy('builtin', input.value.trim());
  });

  /* ---------------- quick sites ------------------------------------ */

  var QUICK = [
    { name: 'Google',   url: 'https://www.google.com',   color: '#4285F4', icon: 'G' },
    { name: 'YouTube',  url: 'https://www.youtube.com',  color: '#FF0000', icon: '▶' },
    { name: 'Discord',  url: 'https://discord.com/app', color: '#5865F2', icon: '💬' },
    { name: 'Reddit',   url: 'https://www.reddit.com',   color: '#FF4500', icon: '👽' },
    { name: 'Spotify',  url: 'https://open.spotify.com', color: '#1DB954', icon: '🎵' },
    { name: 'Twitch',   url: 'https://www.twitch.tv',    color: '#9146FF', icon: '🟣' },
    { name: 'TikTok',   url: 'https://www.tiktok.com',   color: '#010101', icon: '♪' },
    { name: 'Chess',    url: 'https://www.chess.com',    color: '#769656', icon: '♟' }
  ];

  quickRow.innerHTML = QUICK.map(function (q) {
    return (
      '<button type="button" data-url="' + q.url + '" title="Open ' + q.name + '">' +
      '<span class="orb" style="background:' + q.color + '">' + q.icon + '</span>' +
      '<span>' + q.name + '</span></button>'
    );
  }).join('');

  quickRow.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-url]');
    if (btn) launch(btn.getAttribute('data-url'));
  });

  /* ---------------- URL helpers -------------------------------------- */

  var SEARCH_ENGINES = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q='
  };

  function search(input_) {
    try { return new URL(input_).toString(); } catch (err) {}
    try {
      var url = new URL('https://' + input_);
      if (url.hostname.includes('.')) return url.toString();
    } catch (err) {}
    var engine = 'google';
    try { engine = (window.B0Settings && B0Settings.get().searchEngine) || 'google'; } catch (err) {}
    return (SEARCH_ENGINES[engine] || SEARCH_ENGINES.google) + encodeURIComponent(input_);
  }

  function openCloaked(targetUrl) {
    var w = window.open('about:blank', '_blank');
    if (!w) { toast('Allow pop-ups to use cloaked windows.'); return; }
    w.document.write(
      '<!DOCTYPE html><html><head><title>Home</title>' +
      '<style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}' +
      'iframe{border:0;width:100%;height:100%}</style></head>' +
      '<body><iframe src="' + targetUrl + '"></iframe></body></html>'
    );
    w.document.close();
  }

  /* ---------------- bare servers -------------------------------------- */

  function userServer() {
    try {
      var v = localStorage.getItem(LS_KEY);
      if (v && /^https?:\/\//i.test(v)) return v;
    } catch (err) {}
    return null;
  }

  function repoServers() {
    return (typeof UV_BARE_SERVERS !== 'undefined' && UV_BARE_SERVERS.length ? UV_BARE_SERVERS : []);
  }

  function allServers() {
    var u = userServer();
    var list = repoServers().slice();
    if (u) list.unshift(u);
    return list;
  }

  function testServer(url) {
    return fetch(url, { mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data && Array.isArray(data.versions)) return data.versions;
        throw new Error('not a bare server');
      });
  }

  function checkServers() {
    var list = allServers();
    serverOk = false;
    if (!list.length) {
      proxyStatus('builtin', false, '✗ No server');
      return Promise.resolve();
    }
    return Promise.all(
      list.map(function (s) {
        return testServer(s).then(function () { return { ok: true }; })
          .catch(function () { return { ok: false }; });
      })
    ).then(function (results) {
      serverOk = results.some(function (r) { return r.ok; });
      proxyStatus('builtin', serverOk, serverOk ? '✓ Working' : '✗ Server blocked');
    });
  }

  /* ---------------- service worker -------------------------------------- */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no SW support'));
    if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
      return Promise.reject(new Error('needs https'));
    }
    return navigator.serviceWorker
      .register(SW_URL)
      .then(function (reg) {
        if (reg.active) return reg;
        var worker = reg.installing || reg.waiting;
        if (!worker) return reg;
        return new Promise(function (resolve, reject) {
          var timer = setTimeout(function () { resolve(reg); }, 8000);
          function onChange() {
            if (worker.state === 'activated') { clearTimeout(timer); resolve(reg); }
            else if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('install failed')); }
          }
          worker.addEventListener('statechange', onChange);
          onChange();
        });
      })
      .then(function () { swReady = true; });
  }

  /* ---------------- launch flow ------------------------------------------ */

  function launchBuiltin(rawUrl) {
    if (!swReady || !serverOk) {
      launchThroughPublic(rawUrl);
      return;
    }
    var url = search(rawUrl.trim());
    var target = __uv$config.prefix + Ultraviolet.codec.xor.encode(url);
    if (cloakOpen.checked) openCloaked(target);
    else location.href = target;
  }

  /* The smart approach: open a public proxy in a popup, let their
     service worker register on their domain, then navigate the
     popup to the pre-encoded proxied URL. */
  function launchThroughPublic(rawUrl) {
    var url = search(rawUrl.trim());
    var encoded = Ultraviolet.codec.xor.encode(url);

    /* Open InvisiProxy's UV page to register their SW */
    var w = window.open('https://invisiproxy.com/ultraviolet', '_blank');
    if (!w) {
      /* popup blocked — just go to their search page */
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(function () {});
      }
      toast('Allow pop-ups! Opening InvisiProxy — URL copied to clipboard');
      setTimeout(function () {
        window.location.href = 'https://invisiproxy.com/ultraviolet?q=' + encodeURIComponent(rawUrl.trim());
      }, 400);
      return;
    }

    toast('Connecting through InvisiProxy…');

    /* Wait for their SW to register, then navigate to the proxied URL */
    setTimeout(function () {
      try {
        w.location.href = 'https://invisiproxy.com/uv/service/' + encoded;
      } catch (err) {
        /* cross-origin navigation blocked — fall back to ?q= param */
        w.location.href = 'https://invisiproxy.com/ultraviolet?q=' + encodeURIComponent(rawUrl.trim());
      }
    }, 3500);
  }

  function launch(rawUrl) {
    if (!rawUrl || !rawUrl.trim()) return;
    if (swReady && serverOk) {
      launchBuiltin(rawUrl);
      return;
    }
    launchThroughPublic(rawUrl);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    launch(input.value);
  });
  goBtn.addEventListener('click', function () { launch(input.value); });
  luckyBtn.addEventListener('click', function () {
    launch(QUICK[~~(Math.random() * QUICK.length)].url);
  });

  /* ---------------- settings ---------------------------------------------- */

  function msg(text, ok) {
    settingsMsg.textContent = text;
    settingsMsg.className = 'msg ' + (ok ? 'ok' : 'bad');
  }

  gearBtn.addEventListener('click', function () {
    serverInput.value = userServer() || '';
    settingsPanel.classList.add('show');
  });
  document.getElementById('settingsClose').addEventListener('click', function () {
    settingsPanel.classList.remove('show');
  });
  settingsPanel.addEventListener('click', function (e) {
    if (e.target === settingsPanel) settingsPanel.classList.remove('show');
  });

  document.getElementById('serverSave').addEventListener('click', function () {
    var v = serverInput.value.trim();
    if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      var u = new URL(v);
      if (!u.hostname.includes('.')) throw new Error('bad');
      v = u.toString();
    } catch (err) { msg('Invalid URL.', false); return; }
    localStorage.setItem(LS_KEY, v);
    if ('caches' in window) {
      caches.open('0xb0-uv-config').then(function (cache) {
        cache.put('user-bare-servers', new Response(JSON.stringify([v])));
      });
    }
    msg('Saved! Testing…', true);
    testServer(v).then(
      function (ver) { msg('Working — speaks ' + ver.join(', ') + ' ✓', true); checkServers(); },
      function () { msg('Saved but no answer. Check the URL.', false); checkServers(); }
    );
  });

  document.getElementById('serverTest').addEventListener('click', function () {
    var v = serverInput.value.trim();
    if (!v) { msg('Enter a URL first.', false); return; }
    msg('Testing…', true);
    testServer(v).then(
      function (ver) { msg('Working ✓', true); },
      function () { msg('No answer.', false); }
    );
  });

  document.getElementById('serverReset').addEventListener('click', function () {
    localStorage.removeItem(LS_KEY);
    if ('caches' in window) {
      caches.open('0xb0-uv-config').then(function (cache) { cache.delete('user-bare-servers'); });
    }
    serverInput.value = '';
    msg('Reset.', true);
    checkServers();
  });

  var copyWorkerSettings = document.getElementById('copyWorkerSettings');
  if (copyWorkerSettings) {
    copyWorkerSettings.addEventListener('click', function () {
      fetch('server/worker.js')
        .then(function (r) { return r.text(); })
        .then(function (code) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(function () {
              copyWorkerSettings.textContent = '✓ Copied!';
              setTimeout(function () { copyWorkerSettings.textContent = '📋 Copy server code'; }, 4000);
            });
          }
        })
        .catch(function () {
          window.open('https://github.com/va1uxxx/0xB0-Games/blob/main/server/worker.js', '_blank');
        });
    });
  }

  /* ---------------- cloak + home -------------------------------------------- */

  var cloakToggle = document.getElementById('cloakToggle');
  function refreshCloakLabel() {
    cloakToggle.textContent = 'Tab cloak: ' + (B0Settings.get().profile !== 'off' ? 'on' : 'off');
  }
  cloakToggle.addEventListener('click', function (e) {
    e.preventDefault();
    B0Settings.toggleDisguise();
    refreshCloakLabel();
  });
  refreshCloakLabel();

  document.getElementById('backHome').addEventListener('click', function () {
    location.href = 'index.html';
  });

  /* ---------------- boot ---------------------------------------------------- */

  buildPortal();
  checkPublicProxies();

  var params = new URLSearchParams(location.search);
  if (params.get('q')) input.value = params.get('q');

  swPromise = registerSW();
  swPromise
    .then(function () { return checkServers(); })
    .catch(function () {
      proxyStatus('builtin', false, '✗ Not available');
      return checkServers();
    });

  input.focus();
})();
