# 0xB0 Roster — one-time setup (~3 minutes)

Turn the optional **shared Members page** on. Until you do, the site
behaves exactly as before: accounts live in each Chromebook's
`localStorage` and nowhere else.

The backend is a free **Google Apps Script** web app backed by a
spreadsheet. Good fit for classrooms — Google domains are almost never
blocked, it costs nothing, and nothing is stored outside Google.

---

## 1. Create the sheet

1. Go to <https://sheets.new> (signed in to the account that should
   own the roster).
2. Name the spreadsheet, e.g. **0xB0 Roster**.
3. Leave the first sheet as-is (the script creates a `roster` sheet).

## 2. Add the script

1. In the sheet: **Extensions → Apps Script**.
2. Delete the default `myFunction` and paste the whole contents of
   `server/roster/Code.gs` in.
3. Pick a long random token (letters/numbers, 24+ chars) and put it in
   the `WRITE_TOKEN = '...'` line.
4. **Save** (`Ctrl+S`).

## 3. Deploy as a web app

1. Click **Deploy → New deployment**.
2. Gear icon → **Web app**.
3. **Execute as:** *Me*.
4. **Who has access:** *Anyone*.
5. **Deploy**, then copy the **Web app URL** (looks like
   `https://script.google.com/macros/s/AKfycb.../exec`).

> ⚠️ Any later edit to `Code.gs` needs **Deploy → Manage deployments →
> Edit → New version → Deploy** for the change to go live.

## 4. Point the site at it

Edit `js/roster-config.js`:

```js
window.B0_ROSTER = {
  url:   'https://script.google.com/macros/s/AKfycb.../exec',
  token: 'your-long-random-token'
};
```

## 5. Deploy the site

Commit + push (same flow as any other change), then open
**Members** in the nav — it now lists everyone who signs up, from any
Chromebook.

---

## How it behaves

- New signups publish `username`, cosmetic **title**, **avatar emoji**
  and a **join date**. **Passwords never leave the device.**
- The Members page refreshes every 45 seconds and caches the list
  locally for 60 seconds.
- If the backend is unreachable (offline, blocked), signups still work
  normally — only the Members list goes stale. It auto-recovers.
- The token is visible to anyone who reads the site's JS, so it stops
  casual spam but is **not** real security. Cleaning up the sheet
  directly is fine, and you can rotate the token in both files.
- The `roster` sheet is capped at 500 rows and rejects duplicate
  usernames (case-insensitive).

## Removing someone

Either delete their row in the spreadsheet directly, or POST with
`{"action":"remove","token":"...","username":"..."}`.