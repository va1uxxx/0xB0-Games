# ============================================================
#  0xB0 GAMES - verify the va1uxxx.github.io URLs the registry
#  points at (Games11 sources). Prints STATUS | URL | note.
#  Usage: powershell -File server\check-games11.ps1
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Net.Http

$base = 'https://va1uxxx.github.io/Games11/'

# every URL the registry will reference after the sweep
$paths = @(
  'retro-bowl/game.html',
  'bottle-flip/game.html',
  'crazy-cars/game.html',
  'blumgi-rocket/game.html',
  '3d-bowling/game.html',
  'drift-boss/game.html',
  'geometry-dash-lite/index.html',
  'google-snake/index.html',
  'idle-breakout/index.html',
  'motox3m/index.html',
  'motox3m-pool/index.html',
  'motox3m-spooky/index.html',
  'motox3m-winter/index.html',
  'ducklife1/index.html',
  'ducklife2/index.html',
  'ducklife3/index.html',
  'ducklife4/index.html',
  'btd1/index.html',
  'btd2/index.html',
  'btd3/index.html',
  'btd4/index.html',
  'btd5/index.html',
  'papaspizzeria/index.html',
  'papasburgeria/index.html',
  'papasfreezeria/index.html',
  'papasscooperia/index.html',
  'papassushiria/index.html',
  'papasbakeria/index.html',
  'papaspastaria/index.html',
  'papascupcakeria/index.html',
  'papasdonuteria/index.html',
  'papascheeseria/index.html',
  'Learn-To-Fly-3.swf',
  'The_Impossible_Quiz.swf',
  'pvz.swf',
  'awesometanks2/index.html',
  'basketbros/index.html',
  'basketrandom/index.html',
  'boxingrandom/index.html',
  'bigredbutton/index.html',
  'cluster%20truck/index.html',
  'cookieclicker-master/index.html',
  'scrapmetal/index.html',
  'stickman-boost/game.html',
  'tube-jumpers/index.html',
  'wallsmash/game.html',
  'run2/index.html',
  'run1/index.html',
  'slide/index.html',
  'pizzatower/index.html',
  'polytrack/index.html',
  'madalin-stunt-cars-2/index.html',
  'stickman-golf/game.html',
  'Gobble/Gobble.html',
  'dashcraft/index.html',
  'magictiles/index.html',
  'rocketp/index.html',
  'slime/Blumgi%20Slime.html',
  'blockblast/game.html',
  'StumbleGuysIG.html',
  'super-smash-flash-2.swf',
  'the_binding_of_isaac.swf',
  'worldshardestgame3.swf',
  'madness.swf',
  'madness2.swf',
  'madnessgameult.swf',
  'endlesswar4.swf',
  'hobo3_wanted.swf',
  'run1/game.swf',
  'cat%20tennis/index.html'
)

# also re-verify the other va1uxxx-hosted URLs already in the registry
$extra = @(
  'https://va1uxxx.github.io/Games9/uno/index.html',
  'https://va1uxxx.github.io/swf/QWOP.swf',
  'https://va1uxxx.github.io/gfile/wbwwb/index.html',
  'https://va1uxxx.github.io/gfile/court/',
  'https://va1uxxx.github.io/gfile/drift/',
  'https://va1uxxx.github.io/sandboxels',
  'https://va1uxxx.github.io/wasmStuff/doom/',
  'https://va1uxxx.github.io/Cube-engine/play.html',
  'https://mr-funkinguy.github.io/MENU'
)

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)
$bad = 0

function Check($url) {
  try {
    $req = New-Object System.Net.Http.HttpRequestMessage('GET', $url)
    # small range so giant games don't get downloaded
    $req.Headers.Range = New-Object System.Net.Http.Headers.RangeHeaderValue(0, 1023)
    $resp = $script:client.SendAsync($req).GetAwaiter().GetResult()
    $code = [int]$resp.StatusCode
    $note = ''
    if ($code -ne 200 -and $code -ne 206) { $note = 'BAD' }
    if ($code -eq 200 -or $code -eq 206) {
      $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      if ($body -match '(?i)<iframe[^>]+src=') { $note = 'HAS-IFRAME(check wrapper)' }
    }
    Write-Output ("$code | $url | $note")
    if ($code -ne 200 -and $code -ne 206) { $script:bad++ }
  } catch {
    Write-Output ("ERR | $url")
    $script:bad++
  }
}

foreach ($p in $paths)  { Check ($base + $p) }
foreach ($e in $extra)  { Check $e }

Write-Output ("---- BAD COUNT: $bad")
