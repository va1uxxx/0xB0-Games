# Audit every EXTERNAL_GAMES entry that survived the prune:
# - HTTP status (ranged GET, first 16KB)
# - does the page contain an <iframe (nested-frame games: out per policy)
# - .swf files: status only (they are not HTML)
# Output: JSON report of every entry + a summary of problems.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Net.Http

$path = 'C:\Users\apple\Downloads\website\js\games-data.js'
$raw = [System.IO.File]::ReadAllText($path)
$m = [regex]::Match($raw, 'const EXTERNAL_GAMES = \[(.*?)\n\];', [System.Text.RegularExpressions.RegexOptions]::Singleline)
$block = $m.Groups[1].Value
$entryMatches = [regex]::Matches($block, '\{\s*slug:[^{}]*?\},', [System.Text.RegularExpressions.RegexOptions]::Singleline)

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(25)

$out = @()
$n = 0
foreach ($e in $entryMatches) {
  $txt = $e.Value
  $n++
  $slug = ''
  if ($txt -match 'slug:\s*"([^"]+)"') { $slug = $Matches[1] }
  $engine = ''
  if ($txt -match 'engine:\s*"([^"]+)"') { $engine = $Matches[1] }
  $src = ''
  if ($txt -match 'src:\s*"([^"]*)"') { $src = $Matches[1] }
  elseif ($txt -match 'src:\s*SZMAIN\s*\+\s*"([^"]*)"') { $src = 'https://va1uxxx.github.io/sz-games.github.io' + $Matches[1] }
  elseif ($txt -match 'src:\s*SZ\s*\+\s*"([^"]*)"') { $src = 'https://va1uxxx.github.io' + $Matches[1] }

  $status = 0
  $hasIframe = $false
  $isSwf = $src -match '\.swf(\?|#|$)'
  try {
    $req = New-Object System.Net.Http.HttpRequestMessage('GET', $src)
    $req.Headers.Range = New-Object System.Net.Http.Headers.RangeHeaderValue(0, 131071)
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    $status = [int]$resp.StatusCode
    if ($status -eq 200 -or $status -eq 206) {
      if (-not $isSwf) {
        $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ($body -match '(?i)<iframe') { $hasIframe = $true }
      }
    }
  } catch {
    $status = -1
  }
  $out += [pscustomobject]@{ slug = $slug; engine = $engine; status = $status; iframe = $hasIframe; src = $src }
  Write-Output ("{0,3}/{1}  {2,4}  iframe={3,-5}  {4}" -f $n, $entryMatches.Count, $status, $hasIframe, $slug)
}

$out | ConvertTo-Json -Compress | Set-Content 'C:\Users\apple\.local\share\opencode\registry-audit.json' -Encoding UTF8
Write-Output '---- SUMMARY ----'
Write-Output ("total: " + $out.Count)
Write-Output ("non-200/206: " + (($out | Where-Object { $_.status -ne 200 -and $_.status -ne 206 }).Count))
Write-Output ("with iframes: " + (($out | Where-Object { $_.iframe }).Count))
