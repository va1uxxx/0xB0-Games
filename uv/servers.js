/* ============================================================
   0xB0 GAMES — BARE SERVER LIST (Unblocker backend)
   ============================================================
   ✨ WORKS OUT OF THE BOX — no setup needed.

   The default below is https://tomp.app/ — the TompHTTP
   project's official public bare server (the same software
   sz-games and most TitaniumNetwork templates use).
   Verified: fast (~40ms), fully CORS-open, speaks bare v1/v2.

   ── WHEN TO ADD YOUR OWN SERVER ─────────────────────────────
   Public servers can be blocked by school filters, get
   rate-limited, or go offline. For a rock-solid unblocker,
   deploy your OWN free bare server (~5 min, no credit card):

     1. Fork  https://github.com/tomphttp/bare-server-worker
     2. Sign up at https://dash.cloudflare.com  (free plan)
     3. Workers & Pages → Create → deploy the worker
        (or follow the repo's wrangler instructions)
     4. You get:  https://bare-server.YOUR-NAME.workers.dev
     5. Paste it below — or put it in ⚙ Settings on the
        Unblocker page (per-device, no code edit needed).

   You can list multiple servers — the proxy picks one at
   random, so only list servers that are actually online.
   ============================================================ */

var UV_BARE_SERVERS = [
  "https://tomp.app/", /* public TompHTTP server — zero setup */
  // "https://bare-server.YOUR-NAME.workers.dev/", /* your own = max reliability */
];
