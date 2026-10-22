# Tiny static file server for local smoke tests.
# Serves C:\Users\apple\Downloads\website on http://localhost:8642/
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\apple\Downloads\website'
$port = 8642
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.json' = 'application/json'
  '.webmanifest' = 'application/manifest+json'
  '.xml'  = 'application/xml'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/markdown; charset=utf-8'
  '.swf'  = 'application/x-shockwave-flash'
  '.wasm' = 'application/wasm'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($rel -eq '/') { $rel = '/index.html' }
    $file = Join-Path $root ($rel -replace '/', '\')
    $full = [System.IO.Path]::GetFullPath($file)
    if (-not $full.StartsWith($root)) { throw 'outside root' }
    # directory URLs (/games/2048/) resolve to their index.html
    if ($full.EndsWith('\')) { $full = $full + 'index.html' }
    elseif (Test-Path $full -PathType Container) { $full = Join-Path $full 'index.html' }
    if ([System.IO.File]::Exists($full)) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes('not found')
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  } finally {
    try { $ctx.Response.Close() } catch {}
  }
}
