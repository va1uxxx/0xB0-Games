# 0xB0 Games - add the shared <head> meta to every page:
#   theme-color, canonical, robots, Open Graph, Twitter card.
# Idempotent. PURE ASCII ON PURPOSE: PowerShell 5.1 reads .ps1 files as ANSI,
# so a literal em-dash/emoji in a script silently turns into mojibake.
# Non-ASCII is built with [char] codes instead.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)

$SITE  = 'https://va1uxxx.github.io/0xB0-Games'
$THEME = '#0d0714'
$IMG   = $SITE + '/assets/og.png'
$DASH  = [char]0x2014          # em dash
$MID   = [char]0x00B7          # middle dot

# title / description per page.
#
# CAREFUL: do not build these with @('a' + 'b', 'c'). PowerShell does
# NOT treat that as a two-element array - it folds the comma into the +
# and you get a single string with everything glued together, which
# silently ships a concatenated <title> and an empty description.
# Meta() takes ordinary function arguments, so there is nothing to
# misparse.
#
# NOTE: the index description quotes the live game count. Bump it if you
# add or remove games (server\validate-registry.ps1 prints the total).
function Meta([string]$title, [string]$desc) {
    $l = New-Object System.Collections.ArrayList
    [void]$l.Add($title)
    [void]$l.Add($desc)
    return $l.ToArray()
}

$T = @{}
$T['index.html']       = Meta ('0xB0 Games ' + $DASH + ' Unblocked Games') ('Play 544 free unblocked HTML5 games anywhere ' + $DASH + ' school, Chromebook or home. No downloads, no installs, just press play.')
$T['play.html']        = Meta ('Playing a game ' + $DASH + ' 0xB0 Games') ('Play a free unblocked game in your browser. Press R to restart, F for fullscreen.')
$T['login.html']       = Meta ('Log in ' + $DASH + ' 0xB0 Games') ('Sign up or log in to save your high scores and carry your profile across the site.')
$T['settings.html']    = Meta ('Settings ' + $DASH + ' 0xB0 Games') ('Themes, tab disguise, panic key, petals and your profile, all in one place.')
$T['about.html']       = Meta ('About ' + $DASH + ' 0xB0 Games') ('What 0xB0 Games is, how it works, and how to get a game added to the arcade.')
$T['privacy.html']     = Meta ('Privacy Policy ' + $DASH + ' 0xB0 Games') ('Everything 0xB0 Games stores, where it is stored, and why nothing ever leaves your device.')
$T['terms.html']       = Meta ('Terms of Service ' + $DASH + ' 0xB0 Games') ('The rules for using 0xB0 Games.')
$T['proxy-links.html'] = Meta ('Proxy Links ' + $DASH + ' 0xB0 Games') ('Cloaked proxy links that get past school web filters.')
$T['rip.html']         = Meta ('Game Rip ' + $DASH + ' 0xB0 Games') ('Rip any HTML5, Unity or Flash game into a clean 0xB0 Games page that your school filter sees as nothing but GitHub.')
$T['flash.html']       = Meta ('Flash Game ' + $DASH + ' 0xB0 Games') ('Play a classic Flash game, re-emulated right in your browser with Ruffle.')
$T['unity.html']       = Meta ('Unity Game ' + $DASH + ' 0xB0 Games') ('Play a Unity WebGL game, streamed straight into your browser.')
$T['unblocker.html']   = Meta ('Unblocker ' + $DASH + ' 0xB0 Games') ('The 0xB0 unblocker is being rebuilt. Check back soon.')
$T['404.html']         = Meta ('404 ' + $DASH + ' Game Over | 0xB0 Games') ('That page does not exist. Head back to the arcade.')
$T['admin.html']       = Meta ('Admin ' + $DASH + ' 0xB0 Games') ('Owner-only account management.')
$T['game-host.html']   = Meta ('Loading game ' + $DASH + ' 0xB0 Games') ('Loading a game from its CDN host.')

# sanity check: every entry must be exactly 2 non-empty strings, or the
# page ships a broken title/description pair.
foreach ($k in $T.Keys) {
    $v = $T[$k]
    if ($v.Count -ne 2 -or -not $v[0] -or -not $v[1]) {
        throw ('add-meta.ps1: bad metadata for ' + $k + ' (count=' + $v.Count + ')')
    }
}

# never indexed: private / utility / per-game pages
$NOINDEX = @('admin.html', 'settings.html', 'login.html', 'play.html',
             'flash.html', 'unity.html', 'unblocker.html', 'game-host.html')

function ReadText($p) { [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }

foreach ($f in Get-ChildItem -Path $root -Filter *.html -File) {
  $name = $f.Name
  if (-not $T.ContainsKey($name)) { Write-Output ('SKIP (no metadata) ' + $name); continue }

  $html = ReadText $f.FullName
  $title = $T[$name][0]
  $desc  = $T[$name][1]
  # index.html is served at the repo root, so its canonical must be "/"
  $canonical = $SITE + '/'
  if ($name -ne 'index.html') { $canonical = $SITE + '/' + $name }
  $flag = 'index'
  if ($NOINDEX -contains $name) { $flag = 'noindex' }
  $robotsLine = '<meta name="robots" content="index, follow" />'
  if ($flag -eq 'noindex') { $robotsLine = '<meta name="robots" content="noindex, nofollow" />' }

  # build the whole block in one go, then drop it in before <link rel="icon">
  $block = @(
    '<meta name="theme-color" content="' + $THEME + '" />'
    '<link rel="canonical" href="' + $canonical + '" />'
    $robotsLine
    '<link rel="manifest" href="manifest.webmanifest" />'
    '<meta name="mobile-web-app-capable" content="yes" />'
    '<meta name="apple-mobile-web-app-capable" content="yes" />'
    '<meta name="apple-mobile-web-app-title" content="0xB0" />'
    '<link rel="apple-touch-icon" href="assets/icon-192.png" />'
    '<meta property="og:type" content="website" />'
    '<meta property="og:site_name" content="0xB0 Games" />'
    '<meta property="og:locale" content="en_US" />'
    '<meta property="og:title" content="' + $title + '" />'
    '<meta property="og:description" content="' + $desc + '" />'
    '<meta property="og:url" content="' + $canonical + '" />'
    '<meta property="og:image" content="' + $IMG + '" />'
    '<meta property="og:image:width" content="1200" />'
    '<meta property="og:image:height" content="630" />'
    '<meta property="og:image:alt" content="0xB0 Games" />'
    '<meta name="twitter:card" content="summary_large_image" />'
    '<meta name="twitter:title" content="' + $title + '" />'
    '<meta name="twitter:description" content="' + $desc + '" />'
    '<meta name="twitter:image" content="' + $IMG + '" />'
  ) -join "`r`n  "

  # remove any previous version of these tags, then insert fresh
  foreach ($p in @('\r?\n\s*<meta name="theme-color"[^>]*>',
                   '\r?\n\s*<link rel="canonical"[^>]*>',
                   '\r?\n\s*<meta name="robots"[^>]*>',
                   '\r?\n\s*<link rel="manifest"[^>]*>',
                   '\r?\n\s*<meta name="mobile-web-app-capable"[^>]*>',
                   '\r?\n\s*<meta name="apple-mobile-web-app[^>]*>',
                   '\r?\n\s*<link rel="apple-touch-icon"[^>]*>',
                   '\r?\n\s*<meta property="og:[^>]*>',
                   '\r?\n\s*<meta name="twitter:[^>]*>')) {
    $html = [regex]::Replace($html, $p, '')
  }

  # keep the plain <title> and <meta name="description"> in sync with the
  # Open Graph / Twitter copies, so search results and link previews can
  # never disagree. ($ is the only metacharacter in a replacement string.)
  #
  # BOTH replacements are limited to the first match on purpose. A couple
  # of pages build a second HTML document as a string in their inline
  # script (the "cloaked tab" opener); rewriting the <title> inside that
  # string corrupts the cloaked page.
  function Esc-Rep([string]$s) { $s -replace '\$', '$$$$' }
  $head = $html.Substring(0, $html.IndexOf('</head>'))
  $head = [regex]::Replace($head, '\s*<meta name="description"[^>]*>\s*', "`r`n  ")
  $head = [regex]::Replace($head, '(?s)<title>.*?</title>',
                           ('<title>' + (Esc-Rep $title) + '</title>' + "`r`n  " +
                            '<meta name="description" content="' + (Esc-Rep $desc) + '" />'), 1)
  $html = $head + $html.Substring($html.IndexOf('</head>'))
  $html = $html -replace '(\r?\n\s*)(<link rel="icon")', ("`r`n  " + $block + "`r`n  " + '$2')

  [System.IO.File]::WriteAllText($f.FullName, $html, $enc)
  Write-Output ('OK   ' + $name.PadRight(18) + $flag + '  ' + $title)
}
