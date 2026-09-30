# Normalize the navbar on every content page: same buttons, same order.
# Emoji are lifted from files that already contain them so nothing gets mangled.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)

function ReadText($p) { [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }
function WriteText($p, $t) { [System.IO.File]::WriteAllText($p, $t, $enc) }

# --- harvest the exact button markup from play.html -------------------
$play = ReadText (Join-Path $root 'play.html')

$cloakLine = ([regex]::Match($play, '(?m)^\s*<button class="icon-btn" id="cloakBtn".*$')).Value.Trim()
if (-not $cloakLine) { throw 'could not find cloakBtn in play.html' }

$panicLine = ([regex]::Match($play, '(?m)^\s*<button class="icon-btn danger" id="panicBtn".*$')).Value.Trim()
if (-not $panicLine) { throw 'could not find panicBtn in play.html' }

$toggleLine = ([regex]::Match($play, '(?m)^\s*<button class="icon-btn nav-toggle" id="navToggle".*$')).Value.Trim()
if (-not $toggleLine) { throw 'could not find navToggle in play.html' }

$loginLine = ([regex]::Match($play, '(?m)^\s*<span id="loginSlot" class="nav-login"></span>$')).Value.Trim()
if (-not $loginLine) { throw 'could not find loginSlot in play.html' }

$newBlock = @(
  $loginLine
  '      <div class="nav-actions">'
  ('        ' + $cloakLine)
  ('        ' + $panicLine)
  ('        ' + $toggleLine)
  '      </div>'
) -join "`r`n"

Write-Output '--- normalized block ---'
Write-Output $newBlock
Write-Output ''

$pages = @('about.html', 'privacy.html', 'settings.html', 'terms.html', 'proxy-links.html')

foreach ($name in $pages) {
  $path = Join-Path $root $name
  $html = ReadText $path

  # everything from the old loginSlot (or nav-actions) up to its </div>
  $start = $html.IndexOf('<span id="loginSlot" class="nav-login"></span>')
  if ($start -lt 0) { $start = $html.IndexOf('<div class="nav-actions">') }
  if ($start -lt 0) { Write-Output ("SKIP  " + $name + " (no nav-actions found)"); continue }

  $openIdx = $html.IndexOf('<div class="nav-actions">', $start)
  $endIdx = $html.IndexOf('</div>', $openIdx) + '</div>'.Length

  $html = $html.Substring(0, $start) + $newBlock + $html.Substring($endIdx)
  WriteText $path $html
  Write-Output ("fixed " + $name)
}
