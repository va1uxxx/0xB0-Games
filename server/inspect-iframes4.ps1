$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(25)

function GetBody($url, $bytes) {
  try {
    $req = New-Object System.Net.Http.HttpRequestMessage('GET', $url)
    $req.Headers.Range = New-Object System.Net.Http.Headers.RangeHeaderValue(0, $bytes)
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    return @{ code = [int]$resp.StatusCode; body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() }
  } catch { return @{ code = -1; body = '' } }
}

foreach ($z in @(
  'https://va1uxxx.github.io/Games6/zombotron',
  'https://va1uxxx.github.io/Games6/zombotron-2/',
  'https://va1uxxx.github.io/Games6/zombotron-2-time-machine/'
)) {
  $p = GetBody $z 262143
  Write-Output ("== " + $z)
  if ($p.body -match '(?s)var game=\{.{0,900}') {
    $frag = $Matches[0] -replace "`r?`n", ' '
    Write-Output ("game config: " + $frag.Substring(0, [Math]::Min(600, $frag.Length)))
  }
  if ($p.body -match '(?is)(?:swf|gameFile|gameUrl|url|file)\s*[:=]\s*["'']([^"'']{3,120})["'']') {
    Write-Output ("file ref: " + $Matches[1])
  }
  Write-Output ''
}
