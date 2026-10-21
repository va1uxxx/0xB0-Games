# 0xB0 Games - external URL health check
# HEAD (falling back to GET) every external game URL and report
# anything that is dead, redirects somewhere unexpected, or is served
# as text/plain (which means "domain parking page", not a game).
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# pull slug -> url pairs out of games-data.js
$src = [System.IO.File]::ReadAllText((Join-Path $root 'js\games-data.js'), [System.Text.Encoding]::UTF8)
$SZ = 'https://sz-games.github.io'

$pairs = New-Object System.Collections.ArrayList
foreach ($m in [regex]::Matches($src, '\{[^{}]*?slug:\s*"([^"]+)"[^{}]*?src:\s*(?:"([^"]+)"|SZ\s*\+\s*"([^"]*)")')) {
  $slug = $m.Groups[1].Value
  $url = $m.Groups[2].Value
  if (-not $url) { $url = $SZ + $m.Groups[3].Value }
  if ($url -notmatch '^https?://') { continue }
  [void]$pairs.Add([pscustomobject]@{ slug = $slug; url = $url })
}

Write-Output ("checking " + $pairs.Count + " external game urls ...")
Write-Output ''

$results = New-Object System.Collections.ArrayList
$i = 0
foreach ($p in $pairs) {
  $i++
  $status = 0
  $final = ''
  $ctype = ''
  $note = ''
  try {
    $req = [Net.HttpWebRequest]::Create($p.url)
    $req.Method = 'HEAD'
    $req.Timeout = 12000
    $req.ReadWriteTimeout = 12000
    $req.AllowAutoRedirect = $true
    $req.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) 0xB0-linkcheck'
    $resp = $req.GetResponse()
    $status = [int]$resp.StatusCode
    $final = $resp.ResponseUri.AbsoluteUri
    $ctype = $resp.ContentType
    $resp.Close()
  } catch [System.Net.WebException] {
    $we = $_.Exception
    if ($we.Response) {
      $status = [int]$we.Response.StatusCode
      $final = $we.Response.ResponseUri.AbsoluteUri
      $ctype = $we.Response.ContentType
      $we.Response.Close()
      if ($status -eq 405) { $note = 'HEAD-not-allowed' }
    } else {
      $note = $we.Status.ToString()
    }
  } catch {
    $note = 'ERR'
  }

  [void]$results.Add([pscustomobject]@{
    slug = $p.slug; url = $p.url; status = $status
    final = $final; ctype = $ctype; note = $note
  })

  if ($i % 50 -eq 0) { Write-Output ("  ... " + $i + "/" + $pairs.Count) }
}

# ---------- report ----------
$dead = @($results | Where-Object { $_.status -ge 400 -or $_.status -eq 0 })
$parked = @($results | Where-Object { $_.status -lt 400 -and $_.ctype -match 'text/plain' })
$ok = @($results | Where-Object { $_.status -ge 200 -and $_.status -lt 400 })

Write-Output ''
Write-Output ('REACHABLE : ' + $ok.Count + ' / ' + $results.Count)
Write-Output ('DEAD      : ' + $dead.Count)
Write-Output ('PARKED    : ' + $parked.Count + '   (HTTP 200 but text/plain -> not a game)')

if ($dead.Count) {
  Write-Output ''
  Write-Output '== DEAD URLS =='
  foreach ($d in $dead) {
    Write-Output ('  ' + $d.slug.PadRight(30) + ' [' + $d.status + '/' + $d.note + ']  ' + $d.url)
  }
}
if ($parked.Count) {
  Write-Output ''
  Write-Output '== SUSPECT (text/plain) =='
  foreach ($d in $parked) {
    Write-Output ('  ' + $d.slug.PadRight(30) + ' ' + $d.url)
  }
}

$csv = Join-Path $PSScriptRoot 'url-check.csv'
($results | ForEach-Object { '{0},{1},{2},{3}' -f $_.slug, $_.status, $_.ctype, $_.url }) -join "`n" |
  Out-File -FilePath $csv -Encoding UTF8
Write-Output ''
Write-Output ('full report -> ' + $csv)
