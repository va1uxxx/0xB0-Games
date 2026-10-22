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

Write-Output '==== zelda-3d: self-contained game? ===='
$p = GetBody 'https://va1uxxx.github.io/Games2/zelda3d' 262143
Write-Output ("canvas: " + ($p.body -match '(?i)<canvas'))
Write-Output ("script srcs: " + (([regex]::Matches($p.body, '(?i)<script[^>]+src=["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value }) -join ' | '))
Write-Output ("iframe count: " + ([regex]::Matches($p.body, '(?i)<iframe')).Count)

Write-Output '==== sans-fight: anything besides the broken iframe? ===='
$p = GetBody 'https://va1uxxx.github.io/Games6/sansfight' 131071
Write-Output ("canvas: " + ($p.body -match '(?i)<canvas'))
Write-Output ("iframe tags: " + (([regex]::Matches($p.body, '(?is)<iframe.{0,120}') | ForEach-Object { ($_.Value -replace "`r?`n", ' ') }) -join ' || '))

Write-Output '==== gfile fallback probes for cat-trap / ms-solitaire ===='
foreach ($u in @(
  'https://va1uxxx.github.io/gfile/ms-solitaire/',
  'https://va1uxxx.github.io/gfile/cat/',
  'https://va1uxxx.github.io/gfile/cattrap/',
  'https://va1uxxx.github.io/gfile/solitaire/'
)) {
  $p = GetBody $u 2047
  Write-Output ("{0,4}  {1}" -f $p.code, $u)
}
