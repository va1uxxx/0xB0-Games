# 1) gfile re-point candidates (root-resolved this time)
# 2) sz-games fork blox.html
# 3) zombotron pages - find the iframe even deep in the page
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(25)

function Probe($url, $bytes) {
  try {
    $req = New-Object System.Net.Http.HttpRequestMessage('GET', $url)
    $req.Headers.Range = New-Object System.Net.Http.Headers.RangeHeaderValue(0, $bytes)
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    $code = [int]$resp.StatusCode
    $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $if = ($body -match '(?i)<iframe')
    return @{ code = $code; iframe = $if; body = $body }
  } catch { return @{ code = -1; iframe = $false; body = '' } }
}

$gfile = @(
  'https://va1uxxx.github.io/gfile/assessment/',
  'https://va1uxxx.github.io/games/cat',
  'https://va1uxxx.github.io/gfile/cell/',
  'https://va1uxxx.github.io/gfile/friendlyfire/',
  'https://va1uxxx.github.io/gfile/basketball-legends/',
  'https://va1uxxx.github.io/gfile/lose95/',
  'https://va1uxxx.github.io/gfile/louie/',
  'https://va1uxxx.github.io/html5-games/games/ms-solitaire/',
  'https://va1uxxx.github.io/gfile/portaboy/',
  'https://va1uxxx.github.io/gfile/robogo/',
  'https://va1uxxx.github.io/gfile/wounded-summer/',
  'https://va1uxxx.github.io/gfile/knight/',
  'https://va1uxxx.github.io/gfile/open/',
  'https://va1uxxx.github.io/gfile/ruffle/',
  'https://va1uxxx.github.io/gfile/hotdoggeria/',
  'https://va1uxxx.github.io/gfile/tacomia/',
  'https://va1uxxx.github.io/gfile/waflash/wingeria',
  'https://va1uxxx.github.io/gfile/mcbeta0.30/',
  'https://va1uxxx.github.io/sz-games.github.io/games/blox.html'
)
Write-Output '==== gfile candidates ===='
foreach ($g in $gfile) {
  $p = Probe $g 16383
  Write-Output ("{0,4} iframe={1,-5} {2}" -f $p.code, $p.iframe, $g)
}

Write-Output '==== zombotron iframe hunt (128KB) ===='
foreach ($z in @(
  'https://va1uxxx.github.io/Games6/zombotron',
  'https://va1uxxx.github.io/Games6/zombotron-2/',
  'https://va1uxxx.github.io/Games6/zombotron-2-time-machine/'
)) {
  $p = Probe $z 131071
  if ($p.body -match '(?is)<iframe.{0,400}') {
    $frag = $Matches[0]
    $frag = $frag -replace "`r`n", ' ' -replace "`n", ' '
    Write-Output ("$z => " + $frag.Substring(0, [Math]::Min(220, $frag.Length)))
  } else {
    Write-Output ("$z => no iframe in 128KB (code " + $p.code + ")")
  }
}
