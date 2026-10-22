$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Net.Http
$base = 'https://va1uxxx.github.io/Games11/'
$paths = @(
  '3d-bowling/game.html',
  'bottle-flip/game.html',
  'blumgi-rocket/game.html',
  'crazy-cars/game.html',
  'drift-boss/game.html',
  'stickman-boost/game.html',
  'wallsmash/game.html',
  'blockblast/game.html'
)
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)
foreach ($p in $paths) {
  $url = $base + $p
  $body = $client.GetStringAsync($url).GetAwaiter().GetResult()
  $iframe = ($body -match '(?i)<iframe')
  $script = ''
  if ($body -match '(?i)src="([^"]*\.(js|wasm))') { $script = $Matches[1] }
  $title = ''
  if ($body -match '(?i)<title[^>]*>\s*([^<]{0,50})') { $title = $Matches[1].Trim() }
  Write-Output ("$p | iframe=$iframe | first-script=$script | title=$title")
}
