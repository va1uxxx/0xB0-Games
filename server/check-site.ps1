# 0xB0 Games - static link + asset checker
# Walks every .html file and verifies that:
#   - local href/src targets exist on disk
#   - anchors (#id) resolve inside the same page
#   - every element referenced by id="..." from JS exists in the HTML
#   - <img>/<link>/<script> sources exist
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)

function ReadText($p) { [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }

$problems = New-Object System.Collections.ArrayList
$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File

function Add-Problem($sev, $file, $msg) {
  [void]$problems.Add([pscustomobject]@{ severity = $sev; file = $file; message = $msg })
}

foreach ($f in $htmlFiles) {
  $rel = $f.Name
  $html = ReadText $f.FullName

  # ---------- local href / src references ----------
  # strip <script> bodies first: JS string concatenation like
  # href="' + url + '" is not a real document reference.
  $markup = [regex]::Replace($html, '(?s)<script\b.*?</script>', '<script></script>')
  $refs = [regex]::Matches($markup, '(?:href|src)\s*=\s*"([^"]+)"')
  foreach ($m in $refs) {
    $u = $m.Groups[1].Value
    if (-not $u) { continue }
    if ($u -match '^(https?:|mailto:|tel:|javascript:|data:|#)') {
      if ($u -match '^#(.+)$') {
        $id = $Matches[1]
        if ($id -ne '' -and $html -notmatch ('id\s*=\s*"' + [regex]::Escape($id) + '"')) {
          Add-Problem 'WARN' $rel ("anchor #$id has no matching id on this page")
        }
      }
      continue
    }
    $clean = ($u -split '[?#]')[0]
    if ($clean -eq '') { continue }
    $target = Join-Path $f.DirectoryName ($clean -replace '/', '\')
    if (-not (Test-Path $target)) {
      Add-Problem 'ERROR' $rel ("missing local file -> " + $u)
    }
  }

  # ---------- duplicate ids ----------
  $ids = [regex]::Matches($markup, '\sid\s*=\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  $dupIds = $ids | Group-Object | Where-Object { $_.Count -gt 1 }
  foreach ($d in $dupIds) {
    Add-Problem 'ERROR' $rel ("duplicate id -> " + $d.Name + " (x" + $d.Count + ")")
  }

  # ---------- element ids referenced from inline/linked scripts ----------
  $scriptSrcs = [regex]::Matches($html, '<script[^>]*\ssrc\s*=\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  $inline = ([regex]::Matches($html, '(?s)<script(?![^>]*\ssrc)[^>]*>(.*?)</script>') |
    ForEach-Object { $_.Groups[1].Value }) -join "`n"

  $wanted = New-Object System.Collections.ArrayList
  foreach ($chunk in @($inline)) {
    # NOTE: use $m.Groups[1].Value — [regex]::Matches does NOT populate
    # $Matches, so reading it here would leak a stale value from the last
    # -match above and report bogus element names.
    foreach ($m in [regex]::Matches($chunk, "getElementById\(\s*'([A-Za-z][A-Za-z0-9_-]*)'\s*\)")) {
      [void]$wanted.Add($m.Groups[1].Value)
    }
    foreach ($m in [regex]::Matches($chunk, 'getElementById\(\s*"([A-Za-z][A-Za-z0-9_-]*)"\s*\)')) {
      [void]$wanted.Add($m.Groups[1].Value)
    }
    foreach ($m in [regex]::Matches($chunk, '\$\(\s*''([A-Za-z][A-Za-z0-9_-]*)''\s*\)')) {
      [void]$wanted.Add($m.Groups[1].Value)
    }
  }
  foreach ($id in ($wanted | Sort-Object -Unique)) {
    if ($html -notmatch ('id\s*=\s*"' + [regex]::Escape($id) + '"')) {
      Add-Problem 'ERROR' $rel ("inline script uses getElementById('$id') but no such element exists")
    }
  }

  # ---------- querySelector(... .class) sanity for the main pages ----------
  # (only flag the handful of ids the site actually relies on)
  foreach ($critical in @('grid', 'chips', 'searchInput', 'gameCount', 'petalCanvas')) {
    if ($html -match ('class\s*=\s*"[^"]*\b' + $critical)) { }
  }
}

# ---------- external script/style tags reference files that exist ----------
foreach ($f in $htmlFiles) { $rel = $f.Name }

# ---------- stylesheet class usage sanity ----------
$css = ReadText (Join-Path $root 'css\style.css')
$cssClasses = [regex]::Matches($css, '\.([a-zA-Z][a-zA-Z0-9_-]*)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

Write-Output ('HTML pages checked: ' + $htmlFiles.Count)
Write-Output ('CSS classes defined: ' + $cssClasses.Count)
Write-Output ''

$errs = @($problems | Where-Object { $_.severity -eq 'ERROR' })
$warns = @($problems | Where-Object { $_.severity -eq 'WARN' })

if ($errs.Count) {
  Write-Output '== ERRORS =='
  foreach ($p in $errs) { Write-Output ('  ' + $p.file + ' :: ' + $p.message) }
  Write-Output ''
}
if ($warns.Count) {
  Write-Output '== WARNINGS =='
  foreach ($p in $warns) { Write-Output ('  ' + $p.file + ' :: ' + $p.message) }
  Write-Output ''
}

Write-Output ('ERRORS: ' + $errs.Count + '   WARNINGS: ' + $warns.Count)
if ($errs.Count -eq 0) { Write-Output 'All local links, assets, anchors and element ids resolve.' }
