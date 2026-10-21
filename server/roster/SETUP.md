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
3. Pick a long random string (letters/numbers, 24+ chars) and put it in
   the `WRITE_TOKEN = '...'` line — this one goes in the site's public JS.
4. Pick a **second, different** long random string for `ADMIN_TOKEN` —
   this one is the *private admin secret*. It must **never** go in the
   site or any committed file; only you know it (and the Apps Script).
5. **Save** (`Ctrl+S`).

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

## 6. Tell the admin panel your secret (once, per device)

`admin.html → > shared_members` (only visible when logged in as the
owner) collects the **admin secret** in a password field and saves it to
that device's `localStorage`. Do this on each device you use as owner.

> The public page token lives in `js/roster-config.js`; the **admin
> secret never does** — it only exists in the Apps Script and in your
> own browser's localStorage.

---

## How it behaves

- New signups publish `username`, cosmetic **title**, **avatar emoji**
  and a **join date**. **Passwords never leave the device.**
- The Members page refreshes every 45 seconds and caches the list
  locally for 60 seconds.
- If the backend is unreachable (offline, blocked), signups still work
  normally — only the Members list goes stale. It auto-recovers.
- The public `WRITE_TOKEN` is visible to anyone who reads the site's JS,
  so it stops casual spam but is **not** real security. Cleaning up the
  sheet directly is fine, and you can rotate both tokens (see below).
- The **`ADMIN_TOKEN`** (remove / set title / set avatar) is **not** in
  the site JS — you type it once into `admin.html`. Anyone with access
  to your signed-in Chromebook could still read it from that device's
  localStorage; that's the practical limit for a static site.
- Rotating tokens: change the value(s) in `Code.gs` → **re-deploy a new
  version** of the web app → update `js/roster-config.js` for the public
  token → re-enter the secret in `admin.html` where the admin one changed.
- The `roster` sheet is capped at 500 rows and rejects duplicate
  usernames (case-insensitive).

## Managing shared members (owner)

`admin.html → > shared_members` shows everyone from all devices and lets
you:

- **Change their cosmetic title or avatar** — updates the shared sheet
  (the *local* account on their device keeps its own values; the
  published roster reflects what you set).
- **Remove a member** — two-step confirm, then the row is deleted from
  the sheet.

Both actions POST with the admin secret. You can always fall back to
editing the spreadsheet directly. Removing a local account stays a
local-only action (roles/passwords are per-device by design).