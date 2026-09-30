# 0xB0 Games - registry validator (static analysis, no build step)
# Parses js/games-data.js object literals properly (string-aware) and
# reports duplicate slugs, duplicate URLs, missing fields, bad emoji.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'js\games-data.js'
$src = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

if ($src[0] -eq [char]0xFEFF) { Write-Output '!! BOM at start of games-data.js' }

function Find-ArrayBody([string]$text, [string]$name) {
  $m = [regex]::Match($text, "const\s+$name\s*=\s*\[").Success
  $m = [regex]::Match($text, "const\s+$name\s*=\s*\[")
  if (-not $m.Success) { throw "array $name not found" }
  return ($m.Index + $m.Length)
}

# Read a balanced { } starting at $i, string-aware. Returns [hashtable]@{Text=..;End=..}
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
        if ($c2 -eq '\\') { [void]$sb.Append($t[$i + 1]); $i += 2; continue }
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

# split an object literal body into key -> raw value (string aware, depth 1)
function Get-Fields([string]$obj) {
  $map = [ordered]@{}
  $i = 1
  $n = $obj.Length - 1
  $key = $null
  $buf = New-Object System.Text.StringBuilder
  $state = 'key'   # key | colon | value
  $depth = 0
  while ($i -lt $n) {
    $ch = $obj[$i]
    if ($ch -eq '"' -or $ch -eq "'") {
      $q = $ch
      [void]$buf.Append($ch); $i++
      while ($i -lt $n) {
        $c2 = $obj[$i]
        [void]$buf.Append($c2)
        if ($c2 -eq '\\') { [void]$buf.Append($obj[$i + 1]); $i += 2; continue }
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
    # state = value
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

$rows = New-Object System.Collections.ArrayList
foreach ($arrayName in @('GAMES', 'EXTERNAL_GAMES')) {
  foreach ($e in (Get-Entries $src $arrayName)) {
    $f = Get-Fields $e
    $srcRaw = $null
    if ($f.Contains('src')) {
      $srcRaw = ($f['src'] -replace '\s+', '')
      if ($srcRaw -match '^"(.*)"$') { $srcRaw = $Matches[1] }
    }
    $obj = [pscustomobject]@{
      array      = $arrayName
      slug       = Get-Str $f 'slug'
      title      = Get-Str $f 'title'
      category   = Get-Str $f 'category'
      emoji      = Get-Str $f 'emoji'
      description = Get-Str $f 'description'
      controls   = Get-Str $f 'controls'
      thumb      = Get-Str $f 'thumb'
      src        = $srcRaw
      badge      = Get-Str $f 'badge'
      external   = ($f.Contains('external') -and $f['external'] -match 'true')
      engine     = Get-Str $f 'engine'
    }
    [void]$rows.Add($obj)
  }
}

# resolve SZ + "..." into a full url for host accounting
foreach ($r in $rows) {
  $full = $r.src
  if ($full -match '^SZ\+"([^"]*)"$') { $full = 'https://sz-games.github.io' + $Matches[1] }
  $r | Add-Member -NotePropertyName url -NotePropertyValue $full -Force
}

Write-Output ('TOTAL ENTRIES: ' + $rows.Count + '   (local ' + ($rows | Where-Object { -not $_.external }).Count + ' / external ' + ($rows | Where-Object { $_.external }).Count + ')')
$errs = 0
$warns = 0

Write-Output ''
Write-Output '== DUPLICATE SLUGS =='
$dupSlug = $rows | Group-Object slug | Where-Object { $_.Count -gt 1 }
if ($dupSlug) { foreach ($d in $dupSlug) { Write-Output ('  DUP SLUG  ' + $d.Name + '  x' + $d.Count); $errs++ } } else { Write-Output '  none' }

Write-Output ''
Write-Output '== MISSING FIELDS =='
Write-Output '   (required: slug, title, category, description, src)'
foreach ($r in $rows) {
  $bad = New-Object System.Collections.ArrayList
  foreach ($k in @('slug', 'title', 'category', 'description', 'src')) {
    if (-not $r.$k) { [void]$bad.Add($k) }
  }
  if ($r.external -and -not $r.emoji) { [void]$bad.Add('emoji') }
  if ($bad.Count) { Write-Output ('  ' + $r.slug + ' -> missing ' + ($bad -join ', ')); $errs++ }
}

# `controls` and `badge` are OPTIONAL: play.js falls back to
# "Depends on the game - try mouse, touch and the arrow keys." and
# main.js simply omits the flag chip. Report coverage, do not fail.
Write-Output ''
Write-Output '== OPTIONAL FIELDS (coverage only, not an error) =='
$noControls = @($rows | Where-Object { -not $_.controls })
$badges = $rows | Where-Object { $_.badge } | Group-Object badge | Sort-Object Count -Descending
Write-Output ('  controls : ' + ($rows.Count - $noControls.Count) + '/' + $rows.Count + ' games have real control hints')
Write-Output ('  badge    : ' + (($rows | Where-Object { $_.badge }).Count) + '/' + $rows.Count + ' games are badged  (' + (($badges | ForEach-Object { $_.Name + '=' + $_.Count }) -join ', ') + ')')

Write-Output ''
Write-Output '== DUPLICATE GAME URL (different slugs, same page) =='
$dup = $rows | Group-Object url | Where-Object { $_.Count -gt 1 -and $_.Name }
if ($dup) {
  foreach ($d in $dup) {
    $slugs = ($d.Group | ForEach-Object { $_.slug }) -join ', '
    $titles = ($d.Group | ForEach-Object { $_.title }) -join ' / '
    Write-Output ('  ' + $d.Name)
    Write-Output ('      slugs: ' + $slugs)
    Write-Output ('      titles: ' + $titles)
  }
  Write-Output ('  TOTAL COLLISIONS: ' + ($dup | Measure-Object -Property Count -Sum).Sum)
} else { Write-Output '  none' }

Write-Output ''
Write-Output '== LOCAL FOLDERS / THUMBS =='
$missF = 0
foreach ($r in ($rows | Where-Object { -not $_.external -and $_.url -like 'games/*' })) {
  $p = Join-Path $root ($r.url.TrimEnd('/') -replace '/', '\')
  if (-not (Test-Path $p)) { Write-Output ('  MISSING FOLDER ' + $r.slug + ' -> ' + $r.url); $errs++; $missF++ }
}
foreach ($r in ($rows | Where-Object { $_.thumb })) {
  $p = Join-Path $root ($r.thumb -replace '/', '\')
  if (-not (Test-Path $p)) { Write-Output ('  MISSING THUMB  ' + $r.slug + ' -> ' + $r.thumb); $errs++ }
}
if (-not $errs) { Write-Output '  all present' }

Write-Output ''
Write-Output '== ENGINES =='
$rows | Group-Object engine | Sort-Object Count -Descending | ForEach-Object { Write-Output ('  ' + ($_.Name -replace '^$', '(none/play.html)').PadRight(20) + $_.Count) }

Write-Output ''
Write-Output '== CATEGORIES =='
$rows | Group-Object category | Sort-Object Name | ForEach-Object { Write-Output ('  ' + $_.Name.PadRight(12) + $_.Count) }

Write-Output ''
Write-Output '== SOURCE HOSTS =='
$rows | ForEach-Object {
  $h = '???'
  if ($_.url -match '^https://([^/]+)') { $h = $Matches[1] }
  elseif ($_.url -match '^games/') { $h = '(local /games)' }
  elseif ($_.url -match '^assets/') { $h = '(local /assets)' }
  [pscustomobject]@{ host = $h }
} | Group-Object host | Sort-Object Count -Descending | ForEach-Object { Write-Output ('  ' + $_.Name.PadRight(40) + $_.Count) }

Write-Output ''
Write-Output '== BAD SLUGS (non [a-z0-9-]) =='
foreach ($r in $rows) {
  if ($r.slug -notmatch '^[a-z0-9-]+$') { Write-Output ('  ' + $r.slug); $warns++ }
}
if (-not $warns) { Write-Output '  none' }

Write-Output ''
Write-Output ('ERRORS: ' + $errs + '   WARNINGS: ' + $warns)
