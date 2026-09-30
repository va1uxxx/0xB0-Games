# Revert add-meta.ps1: strip the injected head tags so they can be re-added
# correctly. Pure ASCII on purpose - PowerShell 5.1 reads .ps1 files as ANSI,
# so any non-ASCII literal in a script gets silently corrupted.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$enc = New-Object System.Text.UTF8Encoding($false)

$patterns = @(
  '\r?\n\s*<meta name="theme-color"[^>]*>',
  '\r?\n\s*<link rel="canonical"[^>]*>',
  '\r?\n\s*<meta name="robots"[^>]*>',
  '\r?\n\s*<meta property="og:[^>]*>',
  '\r?\n\s*<meta name="twitter:[^>]*>'
)

foreach ($f in Get-ChildItem -Path $root -Filter *.html -File) {
  $html = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  $before = $html.Length
  foreach ($p in $patterns) { $html = [regex]::Replace($html, $p, '') }
  [System.IO.File]::WriteAllText($f.FullName, $html, $enc)
  Write-Output ('reverted ' + $f.Name.PadRight(18) + ' -' + ($before - $html.Length) + ' bytes')
}
