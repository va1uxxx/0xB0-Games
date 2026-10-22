# Inventory the registry: slug, engine, resolved src URL, host.
# Read-only report - prints a compact table + host counts.
$ErrorActionPreference = 'Stop'
$path = 'C:\Users\apple\Downloads\website\js\games-data.js'
$raw = [System.IO.File]::ReadAllText($path)

$bytes = [System.IO.File]::ReadAllBytes($path)
$bom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
Write-Output ("BOM: " + $bom)
Write-Output ("bytes: " + $bytes.Length)

# extract the EXTERNAL_GAMES block
$m = [regex]::Match($raw, 'const EXTERNAL_GAMES = \[(.*?)\n\];', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $m.Success) { Write-Output 'NO EXTERNAL BLOCK'; exit }
$block = $m.Groups[1].Value

# split into entries: each starts with "{ slug:"
$entryMatches = [regex]::Matches($block, '\{\s*slug:[^{}]*?\},', [System.Text.RegularExpressions.RegexOptions]::Singleline)
Write-Output ("entries found: " + $entryMatches.Count)

$report = @()
foreach ($e in $entryMatches) {
  $txt = $e.Value
  $slug = ''
  if ($txt -match 'slug:\s*"([^"]+)"') { $slug = $Matches[1] }
  $engine = ''
  if ($txt -match 'engine:\s*"([^"]+)"') { $engine = $Matches[1] }
  $src = ''
  if ($txt -match 'src:\s*"([^"]*)"') { $src = $Matches[1] }
  elseif ($txt -match 'src:\s*SZMAIN\s*\+\s*"([^"]*)"') { $src = 'https://va1uxxx.github.io/sz-games.github.io' + $Matches[1] }
  elseif ($txt -match 'src:\s*SZ\s*\+\s*"([^"]*)"') { $src = 'https://va1uxxx.github.io' + $Matches[1] }
  $h = ''
  try { $h = ([Uri]$src).Host } catch { $h = '(relative)' }
  $report += [pscustomobject]@{ slug = $slug; engine = $engine; host = $h; src = $src }
}

$report | Group-Object host | Sort-Object Count -Descending | ForEach-Object {
  Write-Output ("{0,4}  {1}" -f $_.Count, $_.Name)
}
$report | ConvertTo-Json -Compress | Set-Content 'C:\Users\apple\.local\share\opencode\registry-inventory.json' -Encoding UTF8
Write-Output ("saved inventory: " + $report.Count + " entries")
