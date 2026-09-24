# ============================================================
# 0xB0 GAMES — local test server (Windows, no Python/Node needed)
# Serves the site at http://localhost:8143 so the unblocker's
# service worker can run (browsers only allow SWs on
# http://localhost or https:// — never on file://).
# Launched by "Test Locally.bat". Close the window to stop.
# ============================================================

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8143/')
$listener.Start()

Write-Host ''
Write-Host '  0xB0 GAMES - local server running at http://localhost:8143' -ForegroundColor Magenta
Write-Host '  Keep this window open. Press Ctrl+C (or close it) to stop.' -ForegroundColor DarkGray
Write-Host ''

$mime = @{
  '.html' = 'text/html'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.svg'  = 'image/svg+xml'
  '.json' = 'application/json'
  '.md'   = 'text/plain'
  '.swf'  = 'application/x-shockwave-flash'
  '.wasm' = 'application/wasm'
  '.map'  = 'application/json'
}

while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith('/')) { $path = $path + 'index.html' }
    $rel = $path.TrimStart('/') -replace '/', '\'
    $file = Join-Path $root $rel

    if ((Test-Path -LiteralPath $file -PathType Leaf) -and ($file.StartsWith($root))) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      else { $ctx.Response.ContentType = 'application/octet-stream' }
      $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [Text.Encoding]::UTF8.GetBytes('not found')
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
  } catch {}
  if ($ctx) {
    try { $ctx.Response.OutputStream.Close() } catch {}
  }
}
