# Remove every EXTERNAL_GAMES entry whose src is NOT hosted on the
# user's own GitHub Pages (va1uxxx.github.io / mr-funkinguy.github.io).
# Byte-faithful: reads/writes UTF-8 without BOM, splices by index
# (no -replace, no regex substitution), prints a kept/removed summary.
$ErrorActionPreference = 'Stop'
$path = 'C:\Users\apple\Downloads\website\js\games-data.js'
$raw = [System.IO.File]::ReadAllText($path)

$m = [regex]::Match($raw, 'const EXTERNAL_GAMES = \[(.*?)\n\];', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $m.Success) { Write-Output 'NO EXTERNAL BLOCK - aborting'; exit }
$block = $m.Groups[1].Value

$entryMatches = [regex]::Matches($block, '\{\s*slug:[^{}]*?\},', [System.Text.RegularExpressions.RegexOptions]::Singleline)
Write-Output ("entries found: " + $entryMatches.Count)

$keep = New-Object System.Collections.Generic.List[string]
$removed = @()
foreach ($e in $entryMatches) {
  $txt = $e.Value
  $src = $null
  if ($txt -match 'src:\s*"([^"]*)"') { $src = $Matches[1] }
  elseif ($txt -match 'src:\s*SZMAIN\s*\+\s*"([^"]*)"') { $src = 'https://va1uxxx.github.io/sz-games.github.io' + $Matches[1] }
  elseif ($txt -match 'src:\s*SZ\s*\+\s*"([^"]*)"') { $src = 'https://va1uxxx.github.io' + $Matches[1] }
  $h = ''
  try { $h = ([Uri]$src).Host } catch {}
  if ($h -eq 'va1uxxx.github.io' -or $h -eq 'mr-funkinguy.github.io') {
    $keep.Add($txt.TrimEnd())
  } else {
    if ($txt -match 'slug:\s*"([^"]+)"') { $removed += $Matches[1] }
  }
}

$header = @'
/* ------------- EXTERNAL GAMES (your own repos only) ----------
   Policy: every game below is hosted on OUR OWN GitHub Pages
   (va1uxxx.github.io - Games11 + the Games*/games3/FlashGames/
   RetroGames/gfile/swf vaults, and the sz-games forks). Nothing
   here depends on anyone else's server: if a game dies, we can
   fix it ourselves. Third-party hotlinks were removed on purpose.
   engine "html5"  -> play.html   engine "unity" -> unity.html
   engine "flash"  -> flash.html (Ruffle) */
'@

$newBlock = "const EXTERNAL_GAMES = [`n" + ($header -split "`n" | ForEach-Object { '  ' + $_ }) -join "`n"
# build properly line by line (PS -join pitfalls)
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("const EXTERNAL_GAMES = [`n")
foreach ($line in ($header -split "`r?`n")) { [void]$sb.Append('  '); [void]$sb.Append($line); [void]$sb.Append("`n") }
foreach ($k in $keep) { [void]$sb.Append('  '); [void]$sb.Append($k); [void]$sb.Append("`n") }
[void]$sb.Append('];')

$new = $raw.Substring(0, $m.Index) + $sb.ToString() + $raw.Substring($m.Index + $m.Length)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $new, $utf8NoBom)

Write-Output ("kept:   " + $keep.Count)
Write-Output ("removed: " + $removed.Count)
Write-Output ("removed slugs: " + ($removed -join ', '))
