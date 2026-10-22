# For each registry URL that contains an <iframe, find what it embeds.
# Prints: slug | iframe target (resolved) | status of target | target has iframe
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Net.Http

$targets = @(
  @{ slug = 'agario';              url = 'https://va1uxxx.github.io/sz-games.github.io/games/agario' },
  @{ slug = 'dungeon-warrior';     url = 'https://va1uxxx.github.io/sz-games.github.io/games/dungeon' },
  @{ slug = 'bloxorz';             url = 'https://va1uxxx.github.io/sz-games.github.io/games/bloxx' },
  @{ slug = 'zelda-3d';            url = 'https://va1uxxx.github.io/Games2/zelda3d' },
  @{ slug = 'zombotron';           url = 'https://va1uxxx.github.io/Games6/zombotron' },
  @{ slug = 'sans-fight';          url = 'https://va1uxxx.github.io/Games6/sansfight' },
  @{ slug = 'cat-tennis';          url = 'https://va1uxxx.github.io/Games11/cat%20tennis' },
  @{ slug = 'assessment-examination'; url = 'https://va1uxxx.github.io/games3/assessment.html' },
  @{ slug = 'cat-trap';            url = 'https://va1uxxx.github.io/games3/cattrap.html' },
  @{ slug = 'cell-to-singularity'; url = 'https://va1uxxx.github.io/games3/cell.html' },
  @{ slug = 'friendly-fire';       url = 'https://va1uxxx.github.io/games3/friendlyfire.html' },
  @{ slug = 'basketball-legends';  url = 'https://va1uxxx.github.io/games3/legends.html' },
  @{ slug = 'lose95';              url = 'https://va1uxxx.github.io/games3/lose95.html' },
  @{ slug = 'papa-louie';          url = 'https://va1uxxx.github.io/games3/louie.html' },
  @{ slug = 'ms-solitaire';        url = 'https://va1uxxx.github.io/games3/ms-solitarie.html' },
  @{ slug = 'portaboy';            url = 'https://va1uxxx.github.io/games3/portaboy.html' },
  @{ slug = 'robogo';              url = 'https://va1uxxx.github.io/games3/robogo.html' },
  @{ slug = 'wounded-summer';      url = 'https://va1uxxx.github.io/games3/wounded-summer.html' },
  @{ slug = 'apple-knight';        url = 'https://va1uxxx.github.io/games3/knight.html' },
  @{ slug = 'open-house';          url = 'https://va1uxxx.github.io/games3/open.html' },
  @{ slug = 'raft-wars-2';         url = 'https://va1uxxx.github.io/games3/raft2.html' },
  @{ slug = 'papas-hot-doggeria';  url = 'https://va1uxxx.github.io/games3/hotdoggeria.html' },
  @{ slug = 'papas-taco-mia';      url = 'https://va1uxxx.github.io/games3/tacomia.html' },
  @{ slug = 'papas-wingeria';      url = 'https://va1uxxx.github.io/games3/wingeria.html' },
  @{ slug = 'zombotron-2';         url = 'https://va1uxxx.github.io/Games6/zombotron-2/' },
  @{ slug = 'zombotron-2-time-machine'; url = 'https://va1uxxx.github.io/Games6/zombotron-2-time-machine/' },
  @{ slug = 'traffic-jam-3d';      url = 'https://va1uxxx.github.io/Games9/trafficjam/' },
  @{ slug = 'minecraft-030';       url = 'https://va1uxxx.github.io/games3/mc.html' }
)

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(25)

function Get-Page($url) {
  try {
    $req = New-Object System.Net.Http.HttpRequestMessage('GET', $url)
    $req.Headers.Range = New-Object System.Net.Http.Headers.RangeHeaderValue(0, 65535)
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    $code = [int]$resp.StatusCode
    $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    return @{ code = $code; body = $body }
  } catch { return @{ code = -1; body = '' } }
}

foreach ($t in $targets) {
  $page = Get-Page $t.url
  $frames = @()
  $ms = [regex]::Matches($page.body, '(?i)<iframe[^>]+src=["'']([^"'']+)["'']')
  foreach ($mm in $ms) { $frames += $mm.Groups[1].Value }
  if ($frames.Count -eq 0) {
    Write-Output ("{0} | NO-IFRAME-FOUND-IN-64K (page code {1})" -f $t.slug, $page.code)
    continue
  }
  foreach ($f in $frames) {
    # resolve relative
    $abs = $f
    if ($f -notmatch '^https?://') {
      $base = $t.url
      if ($base.EndsWith('/')) { $abs = $base + $f }
      else { $abs = ($base -replace '/[^/]*$', '/') + $f }
    }
    $tp = Get-Page $abs
    $inner = ''
    if ($tp.code -eq 200 -or $tp.code -eq 206) {
      if ($tp.body -match '(?i)<iframe') { $inner = 'INNER-IFRAME' }
    }
    Write-Output ("{0} | {1} -> {2} | code {3} {4}" -f $t.slug, $f, $abs, $tp.code, $inner)
  }
}
