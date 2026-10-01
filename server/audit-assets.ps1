# 0xB0 Games - asset audit + feed gate generator
# ============================================================
# Reads js/games-data.js and HEAD/GETs every game URL.
# Writes js/assets-status.js:
#     window.B0_ASSETS_MISSING = [ "slug", ... ];
# which main.js consults so a game only appears in the feed while
# its assets are actually reachable. Re-run this after any registry
# change (or just to refresh) and the feed updates on next deploy.
#
# Classification (host answered = game will run in a real browser):
#   OK     2xx/3xx and 401/403/407/426/429 (bot-protection / rate
#          limit - those hosts still serve real browsers fine)
#   MISSING 400/404/410/451, 5xx, DNS / connection / timeout
#
# No build step - output is a tiny static JS file committed with the site.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'js\games-data.js'
$out  = Join-Path $root 'js\assets-status.js'
$src  = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

function Find-ArrayBody([string]$text, [string]$name) {
  $m = [regex]::Match($text, "const\s+$name\s*=\s*\[")
  if (-not $m.Success) { throw "array $name not found" }
  return ($m.Index + $m.Length)
}
function Read-Object([string]$t, [int]$i) {
  $sb = New-Object System.Text.StringBuilder
  $depth = 0
  $n = $t.Length
  while ($i -lt $n) {
    $ch = $t[$i]
    if ($ch -eq '"' -or $ch -eq "'") {
      $q = $ch
      [void]$sb.Append($ch); $i++
      while ($i -lt $n) {
        $c2 = $t[$i]
        [void]$sb.Append($c2)
        if ($c2 -eq '\') { [void]$sb.Append($t[$i + 1]); $i += 2; continue }
        $i++
        if ($c2 -eq $q) { break }
      }
      continue
    }
    if ($ch -eq '{') { $depth++ }
    if ($ch -eq '}') {
      $depth--
      [void]$sb.Append($ch)
      if ($depth -eq 0) { break }
      $i++; continue
    }
    [void]$sb.Append($ch)
    $i++
  }
  return @{ Text = $sb.ToString(); End = $i }
}
function Get-Entries([string]$text, [string]$arrayName) {
  $i = Find-ArrayBody $text $arrayName
  $out = New-Object System.Collections.ArrayList
  $n = $text.Length
  while ($i -lt $n) {
    $ch = $text[$i]
    if ($ch -eq ']') { break }
    if ($ch -eq '{') {
      $o = Read-Object $text $i
      [void]$out.Add($o.Text)
      $i = $o.End + 1
      continue
    }
    $i++
  }
  return $out
}
function Get-Fields([string]$obj) {
  $map = [ordered]@{}
  $i = 1
  $n = $obj.Length - 1
  $key = $null
  $buf = New-Object System.Text.StringBuilder
  $state = 'key'
  $depth = 0
  while ($i -lt $n) {
    $ch = $obj[$i]
    if ($ch -eq '"' -or $ch -eq "'") {
      $q = $ch
      [void]$buf.Append($ch); $i++
      while ($i -lt $n) {
        $c2 = $obj[$i]
        [void]$buf.Append($c2)
        if ($c2 -eq '\') { [void]$buf.Append($obj[$i + 1]); $i += 2; continue }
        $i++
        if ($c2 -eq $q) { break }
      }
      continue
    }
    if ($state -eq 'key') {
      if ($ch -match '[A-Za-z0-9_]') { [void]$buf.Append($ch); $i++; continue }
      if ($ch -eq ':') {
        $key = $buf.ToString().Trim(); $buf.Clear() | Out-Null; $state = 'value'; $i++; continue
      }
      $i++; continue
    }
    if ($ch -eq '{') { $depth++ }
    if ($ch -eq '}') { $depth-- }
    if ($ch -eq ',' -and $depth -eq 0) {
      if ($key) { $map[$key] = $buf.ToString().Trim() }
      $key = $null; $state = 'key'
      [void]$buf.Clear()
      $i++; continue
    }
    [void]$buf.Append($ch)
    $i++
  }
  if ($key) { $map[$key] = $buf.ToString().Trim() }
  return $map
}
function Get-Str([hashtable]$h, [string]$k) {
  if (-not $h.Contains($k)) { return $null }
  $v = $h[$k]
  $m = [regex]::Match($v, '^"((?:[^"\\]|\\.)*)"')
  if ($m.Success) { return $m.Groups[1].Value -replace '\\"', '"' }
  $m2 = [regex]::Match($v, "^'((?:[^'\\]|\\.)*)'")
  if ($m2.Success) { return $m2.Groups[1].Value }
  return $null
}

# current host prefixes (kept in sync with games-data.js constants)
$szBase = [regex]::Match($src, "var\s+SZ\s*=\s*'([^']+)'").Groups[1].Value
$mainBase = [regex]::Match($src, "var\s+SZMAIN\s*=\s*'([^']+)'").Groups[1].Value

function Resolve-Url([string]$raw, [string]$szBase, [string]$mainBase) {
  $v = ($raw -replace '\s+', '')
  if ($v -match '^"(.*)"$') { $v = $Matches[1] }
  if ($v -match '^SZ\+"(.*)"$') { return ($szBase + $Matches[1]) }
  if ($v -match '^SZMAIN\+"(.*)"$') { return ($mainBase + $Matches[1]) }
  if ($v -like 'games/*') { return $v }      # local
  if ($v -match '^https?://') { return $v }  # literal
  return $null                                # unparsed
}

function Test-Url([string]$u) {
  # returns $true (ok) / $false (missing assets)
  $ua = 'Mozilla/5.0 (0xB0-assets-audit)'
  foreach ($method in @('Head', 'Get')) {
    try {
      $r = Invoke-WebRequest -Uri $u -Method $method -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 6 -Headers @{ 'User-Agent' = $ua }
      $c = [int]$r.StatusCode
      if ($c -ge 200 -and $c -lt 400) { return $true }
      if ($c -in @(401, 403, 407, 426, 429)) { return $true } # bot-protection: fine in a browser
      return $false
    } catch {
      $resp = $_.Exception.Response
      if (-not $resp) { return $false }  # DNS / refused / timeout
      $c = [int]$resp.StatusCode
      if ($method -eq 'Head' -and $c -in @(405, 501, 505)) { continue }  # HEAD not supported -> try GET
      if ($c -in @(401, 403, 407, 426, 429)) { return $true }
      return $false
    }
  }
  return $false
}

$rows = New-Object System.Collections.ArrayList
foreach ($arrayName in @('GAMES', 'EXTERNAL_GAMES')) {
  foreach ($e in (Get-Entries $src $arrayName)) {
    $f = Get-Fields $e
    $slug = Get-Str $f 'slug'
    $raw = ''
    if ($f.Contains('src')) { $raw = $f['src'] }
    $ext = ($f.Contains('external') -and $f['external'] -match 'true')
    [void]$rows.Add([pscustomobject]@{ slug = $slug; external = $ext; url = Resolve-Url $raw $szBase $mainBase; raw = $raw })
  }
}

$missing = New-Object System.Collections.ArrayList
$okCount = 0
$skipCount = 0
$unparsed = New-Object System.Collections.ArrayList
$i = 0
foreach ($r in $rows) {
  $i++
  if (-not $r.url) { [void]$unparsed.Add($r.slug); continue }
  if ($r.url -like 'games/*') {
    # local game - assets live in the repo, check the folder exists
    $folder = Join-Path $root ($r.url.TrimEnd('/') -replace '/', '\')
    if (Test-Path $folder) { $okCount++ } else { [void]$missing.Add($r.slug) }
    continue
  }
  $ok = Test-Url $r.url
  if ($ok) { $okCount++ } else { [void]$missing.Add($r.slug) }
}

# write the manifest
$body = '/* AUTO-GENERATED by server/audit-assets.ps1 - do not edit by hand.' + "`n" +
  '   Slugs whose assets were unreachable at audit time. The feed hides' + "`n" +
  '   these until the assets are back (re-run the audit). */' + "`n" +
  'window.B0_ASSETS_MISSING = [' + (($missing | ForEach-Object { '"' + $_ + '"' }) -join ', ') + '];' + "`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($out, $body, $enc)

Write-Output ('TOTAL ENTRIES: ' + $rows.Count + '   checked: ' + ($rows.Count - $unparsed.Count))
Write-Output ('  assets OK:   ' + $okCount)
Write-Output ('  assets GONE: ' + $missing.Count)
Write-Output ('  skipped:     ' + $skipCount)
if ($unparsed.Count) {
  Write-Output ''
  Write-Output '  UNPARSED SRC (needs review):'
  $unparsed | ForEach-Object { Write-Output ('    ' + $_ + '  ->  ' + $rows | Where-Object { $_.slug -eq $_ } | Select-Object raw | ForEach-Object { $_.raw }) }
}
Write-Output ''
if ($missing.Count) {
  Write-Output '  MISSING (hidden from feed until assets return):'
  $missing | ForEach-Object { Write-Output ('    ' + $_) }
} else {
  Write-Output '  No missing assets - feed shows everything.'
}
Write-Output ''
Write-Output ('manifest written: js\assets-status.js')