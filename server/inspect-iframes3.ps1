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

Write-Output '==== 1. gfile cell page: what does it iframe? ===='
$p = GetBody 'https://va1uxxx.github.io/gfile/cell/' 32767
if ($p.body -match '(?is)<iframe.{0,300}') { ($Matches[0] -replace "`r?`n", ' ').Substring(0, [Math]::Min(280, $Matches[0].Length)) }

Write-Output '==== 2. cat-trap: sz-games fork target? ===='
$p = GetBody 'https://va1uxxx.github.io/sz-games.github.io/games/cat' 4095
Write-Output ("code: " + $p.code)

Write-Output '==== 3. ms-solitaire: sz-games fork target? ===='
$p = GetBody 'https://va1uxxx.github.io/sz-games.github.io/html5-games/games/ms-solitaire/' 4095
Write-Output ("code: " + $p.code)

Write-Output '==== 4. zelda-3d page: how does the game load? ===='
$p = GetBody 'https://va1uxxx.github.io/Games2/zelda3d' 131071
if ($p.body -match '(?is)<iframe.{0,300}') { Write-Output ("iframe tag: " + (($Matches[0] -replace "`r?`n", ' ').Substring(0, [Math]::Min(280, $Matches[0].Length)))) }
if ($p.body -match '(?is)gameBox\.src\s*=\s*["'']([^"'']+)["'']') { Write-Output ("gameBox.src = " + $Matches[1]) }
if ($p.body -match '(?is)(?:src|url|game|file)\s*[:=]\s*["'']([^"'']*\.(?:swf|html|zip|unity3d|json))["'']') { Write-Output ("asset ref: " + $Matches[1]) }

Write-Output '==== 5. zombotron family: what fills gameBox? ===='
foreach ($z in @('https://va1uxxx.github.io/Games6/zombotron', 'https://va1uxxx.github.io/Games6/zombotron-2/')) {
  $p = GetBody $z 262143
  if ($p.body -match '(?is)gameBox\.src\s*=\s*["'']([^"'']+)["'']') { Write-Output ("$z => gameBox.src = " + $Matches[1]) }
  elseif ($p.body -match '(?is)game\s*:\s*\{.{0,600}') { Write-Output ("$z => config: " + (($Matches[0] -replace "`r?`n", ' ').Substring(0, [Math]::Min(400, $Matches[0].Length)))) }
}
