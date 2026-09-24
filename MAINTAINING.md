# 🛠 0xB0 Games — Maintainer Guide

Everything you need to run, update and extend **0xB0 Games**. Visitor-facing
info lives in the [README](README.md) — this file is the operator's manual.

**Live at:** `https://va1uxxx.github.io/0xB0-Games/`

The site is 100% static (HTML + CSS + JS, no backend, no build step) with a
dark **sakura** theme, **500+ games** (15 self-hosted + 490+ embedded from
public hosts, sz-games style), three player templates
(`play.html` / `unity.html` / `flash.html`), a built-in **Ultraviolet web
proxy unblocker** with a 3D torii-gate scene and a preconfigured public bare
server, and a **Settings page** (tab disguise / favicon, panic key, accent
colors).

---

## 📁 Site structure

```
├── index.html            Homepage (game grid, search, categories, 3D showcase)
├── play.html             HTML5 game template (?game=<slug> or ?game=<url>)
├── unity.html            Unity WebGL template (?game=<url>) — sz-games style
├── flash.html            Flash template (?game=<url.swf>) — runs on Ruffle
├── unblocker.html        Sakura unblocker page (Ultraviolet proxy + boot loader)
├── settings.html         User settings (tab disguise, panic key, accent color)
├── 404.html              Custom "GAME OVER" 404 page
├── .nojekyll             Tells GitHub Pages to serve files as-is
├── css/
│   └── style.css         All site styling (sakura theme + 3D polish)
├── js/
│   ├── games-data.js     ★ THE GAME REGISTRY — edit this to add games
│   ├── settings.js       Settings engine (runs on every page)
│   ├── settings-page.js  Settings page UI logic
│   ├── main.js           Homepage logic (grid, search, 3D, reveals, cloak, panic)
│   ├── petals.js         Falling sakura petals + parallax
│   ├── play.js           Game player logic
│   └── unblocker.js      Unblocker logic (loader steps, proxy launch, settings)
├── assets/
│   ├── favicon.svg
│   └── thumbs/           One thumbnail per self-hosted game (320×180)
├── games/                ★ Drop new self-hosted game folders here
│   ├── 2048/ ├── snake/ ├── tetris/ ├── connect-four/ … (15 originals)
├── server/
│   └── serve.ps1         Tiny local test server (PowerShell, no installs)
└── uv/                   Ultraviolet proxy runtime (unblocker engine)
    ├── servers.js        ★ Bare server list (public tomp.app preconfigured)
    ├── sw.js             Service worker entry
    ├── uv.config.js      Proxy configuration (auto-detects paths)
    └── uv.bundle.js / uv.sw.js / uv.handler.js / uv.client.js  (runtime — don't touch)
```

★ = the only files you ever need to edit.

---

## 🚀 Deploy to GitHub Pages

The site is already deployed from the `main` branch of
`va1uxxx/0xB0-Games` (Pages → *Deploy from a branch* → `main` → `/ (root)`).

To update it: commit + push to `main`. GitHub Pages rebuilds within
~1–10 minutes and serves with a short CDN cache — visitors may need one
hard refresh (Ctrl+Shift+R) right after a deploy.

---

## ➕ Adding games (three ways)

### Way 0 — request one (zero effort)
Click **“Add your own game”** in the site footer (or the “Request this game on
GitHub” link that appears when a search finds nothing) — it opens a **GitHub
issue pre-labeled `Game Request`** with a ready-made template:

[➕ Request a game](https://github.com/va1uxxx/0xB0-Games/issues/new?labels=Game%20Request&title=Game%20Request%3A%20&body=**Game%20name%3A**%0A**Link%20to%20the%20game%3A**%0A**Category%3A**%0A**Why%20should%200xB0%20add%20it%3F**)

Requests land in the [`Game Request` label queue](https://github.com/va1uxxx/0xB0-Games/issues?q=state%3Aopen%20label%3A%22Game%20Request%22) — check there before submitting a duplicate.

### Way 1 — Host the game yourself (permanent, always works)
1. Put the game in `games/my-game/index.html` (any self-contained HTML5 game)
2. Optional thumbnail at `assets/thumbs/my-game.svg` (320×180; if you skip it,
   the tile renders a stylish emoji/gradient automatically)
3. Add one entry to `js/games-data.js`:

```js
{ slug: "my-game", title: "My Game", category: "Arcade",
  description: "…", controls: "…",
  thumb: "assets/thumbs/my-game.svg", src: "games/my-game/" },
```

### Way 2 — Plug in an externally hosted game (sz-games style, one line)
No files needed — the player templates iframe any public URL:

```js
/* HTML5 game hosted anywhere */
{ slug: "some-game", title: "Some Game", category: "Arcade", emoji: "🎮",
  description: "…", src: "https://wherever.com/game/",
  external: true, engine: "html5" },

/* Unity WebGL game  -> opens in unity.html?game=<url> */
{ slug: "some-unity-game", title: "Some Unity Game", category: "Action", emoji: "🚀",
  description: "…", src: "https://wherever.com/unity-build/",
  external: true, engine: "unity" },

/* Flash game (.swf) -> opens in flash.html?game=<url> (runs on Ruffle) */
{ slug: "some-flash-game", title: "Some Flash Game", category: "Casual", emoji: "🍕",
  description: "…", src: "https://wherever.com/game.swf",
  external: true, engine: "flash" },
```

The three player templates accept URLs directly too, even without registering:
`…/play.html?game=https://example.com/game/`

### The catalog today
15 built by/for this site (hosted in `/games`, always work) + 490+ external
entries — Retro Bowl, Slope, Tunnel Rush, the Papa's series, Bloons TD 1–5,
Henry Stickmin, FNAF 1–4, Moto X3M, Doom, Superhot, Super Mario 64, Pacman,
Pizza Tower, Duck Life, Vex 3–7, Run 1–3, Friday Night Funkin', Shell Shockers,
Fort Craft, Incredibox, emulated classics (Pokemon, Zelda OoT, Mario Kart 64,
Tekken 3…) and hundreds more. **Every external URL was liveness-tested
(HTTP 200 + real page title) before being added** — anything dead at check
time was skipped.

⚠️ **Honest notes about external games:**
- They belong to their creators. This site only *links/embeds* public URLs —
  no game files are copied into the repo. That keeps it DMCA-resistant and
  the repo tiny, but it also means:
- **If a host takes a game down, that tile dies.** Fix = remove/replace the
  entry (or self-host an open-source alternative).
- Don't rehost commercial games (Poki/Coolmath rips) in `/games` — that's the
  fast lane to a DMCA takedown. Use open-source games (MIT/Apache) or
  officially embeddable ones (itch.io, GameDistribution).

---

## 🔓 Unblocker setup

**It works out of the box** — `uv/servers.js` ships with the public TompHTTP
server (`https://tomp.app/`, verified fast, CORS-open, speaks bare v1/v2).
The Unblocker page also has **backup launchers** — one-tap links to the big
public TitaniumNetwork proxies (**InvisiProxy**, **Lunar** — cloaked as IXL —
and **DayDreamX**) for networks where the built-in proxy is blocked.

**When to deploy your own** bare server (recommended for reliability — public
servers can be blocked, rate-limited, or go offline). Free, ~5 minutes, no
credit card, on **Cloudflare Workers**:

1. **Fork** [`github.com/tomphttp/bare-server-worker`](https://github.com/tomphttp/bare-server-worker)
2. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com)
3. **Workers & Pages → Create** → deploy the worker (or follow the repo's
   `wrangler` instructions)
4. You get `https://bare-server.your-name.workers.dev`
5. Paste it into `uv/servers.js` (default for everyone) or into **⚙ Settings**
   on the Unblocker page (per device, no code edit needed).

You can list multiple servers — the proxy picks one at random, so only list
servers that are actually online.

### How the unblocker works
- `unblocker.html` — the sakura scene. Type any URL (or search terms) and it
  opens through the proxy: `<site>/uv/service/<encoded-url>`
- A **boot loader** shows three live steps (page → service worker → proxy
  server) before revealing the page, with a Skip button and a 10s cap
- The service worker (`uv/sw.js`) intercepts those URLs, fetches the real
  site through the bare server, and rewrites every link so browsing stays
  inside the proxy
- ⚠️ Service workers require `http://localhost` or `https://` — the proxy
  can never run from a double-clicked file (`file://`)

---

## 🧪 Testing locally

Run the tiny local server (PowerShell is built into Windows — no installs):

```powershell
git clone https://github.com/va1uxxx/0xB0-Games.git
cd 0xB0-Games
powershell -ExecutionPolicy Bypass -File server\serve.ps1
# -> http://localhost:8143
```

Why not just double-click `index.html`? Because `file://` blocks service
workers by browser design — the unblocker silently can't start there.
`http://localhost` is exempt, which is exactly what `serve.ps1` provides.
(Mac/Linux: `python3 -m http.server 8080` works too.)

---

## 🛡️ Built-in stealth features

| Feature | What it does | Where |
|---|---|---|
| **Tab disguise** 🕶️ | Renames the tab + swaps the favicon to look like Google Docs, Drive, Classroom, Canvas, Khan, Desmos or anything custom | Nav button on every page |
| **Panic key** <code>`</code> | Press the backtick key to instantly teleport to any URL (default: Google Classroom) | Every page + 🛡️ button |
| **Cloaked tab** | Opens the game in a hidden `about:blank` window | Button on the game pages |
| **Unblocker cloak** | Disguises the unblocker tab too | Unblocker page |

## ⚙️ Settings page (`settings.html`)

Per-visitor settings stored in **localStorage** (a static site can't store
user accounts):

- **Tab disguise** — favicon + title presets or fully custom (emoji / icon
  URL + any title), with a live fake-tab preview
- **Panic key** — enable/disable + custom destination
- **Accent color** — re-tint the site's neon
- **Reset** — one click

To change defaults for **everyone**, edit `DEFAULTS` at the top of
`js/settings.js`.

---

## 🧰 Tech notes

- **Zero dependencies.** No frameworks, no build step, no CDNs in the core
  site (so it works even when schools block common CDNs).
- **Relative paths everywhere** — works from the repo subfolder
  (`/0xB0-Games/`), a custom domain, or local testing.
- **Games are standalone** — each `games/<slug>/index.html` also works when
  opened directly, so games never break if the template changes.
- Ultraviolet is open-source software by
  [TitaniumNetwork](https://github.com/titaniumnetwork-dev/ultraviolet);
  Flash games run on [Ruffle](https://ruffle.rs) loaded from unpkg.

---

## ❓ Troubleshooting

| Problem | Fix |
|---|---|
| **Unblocker does nothing when opening files by double-clicking** | That's `file://` — browsers refuse service workers there (by design). Run `server\serve.ps1` or use the deployed GitHub Pages URL |
| Pages site 404 | Settings → Pages → Source must be **main / root** |
| Games load but styles don't | Make sure `css/` and `js/` folders were pushed too |
| Unblocker says "no server" | Public server blocked on that network — use a backup launcher or deploy your own (guide above) |
| Unblocker 404 on `/uv/service/...` | Hard-refresh once (Ctrl+Shift+R) — the service worker is installing |
| GitHub Pages ignores `uv/` files | Make sure `.nojekyll` exists in the repo root |
| Proxy stopped working | Bare server died — deploy a fresh one & update `uv/servers.js` |
| Games grid invisible after deploy | Fixed in current code — pull latest `js/main.js` (scroll-reveal now targets small elements only, with a 2s safety net) |
