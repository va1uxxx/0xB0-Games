/* ============================================================
   0xB0 ROSTER — shared members list (OPTIONAL)

   Leave `url` and `token` empty and nothing changes: accounts
   stay on each device (localStorage) exactly as before.

   To switch it on:
     1. Deploy the Apps Script in server/roster/Code.gs
        (follow server/roster/SETUP.md — takes ~3 minutes).
     2. Paste the Web App URL + the token you chose below.
   Then every new signup also publishes the username (NEVER the
   password) to the roster backend, and members.html shows
   everyone who has joined, on any Chromebook.

   Passwords never leave the device, in either mode.
   ============================================================ */
window.B0_ROSTER = {
  /* Web App URL from Google Apps Script, e.g.
     'https://script.google.com/macros/s/AKfycb.../exec' */
  url: 'https://script.google.com/macros/s/AKfycbxA2OzFIHXIqCRNGuf_dTNi732F1IPZgmoYz_3BI1VXegDpMsnW8yZ48g1GvKJLRAKU/exec',

  /* Write token — must match WRITE_TOKEN in server/roster/Code.gs.
     It's a casual anti-spam measure (anyone reading the site's JS
     can see it), not real security. */
  token: 'Xdp4jFip5sRzRuEO1JNyAtMdq'
};
