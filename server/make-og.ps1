# 0xB0 Games - server/make-og.ps1
# ------------------------------------------------------------------
# Draws assets/og.png (1200x630), the social-preview image used by the
# Open Graph / Twitter tags that server\add-meta.ps1 injects.
#
# Pure ASCII (PS 5.1 reads .ps1 as ANSI, so a literal em-dash or emoji
# would be written back as mojibake). Non-ASCII glyphs are built with
# [char] codes.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File server\make-og.ps1
# ------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'assets\og.png'
$W = 1200
$H = 630

# ---- palette (sakura theme) -------------------------------------
$BG_TOP    = [System.Drawing.Color]::FromArgb(255, 13, 7, 20)    # #0d0714
$BG_BOT    = [System.Drawing.Color]::FromArgb(255, 34, 20, 58)    # #22143a
$PINK      = [System.Drawing.Color]::FromArgb(255, 255, 110, 169) # #ff6ea9
$PINK_SOFT = [System.Drawing.Color]::FromArgb(150, 255, 110, 169)
$PURPLE    = [System.Drawing.Color]::FromArgb(255, 180, 107, 255) # #b46bff
$TEXT      = [System.Drawing.Color]::FromArgb(255, 246, 236, 255) # #f6ecff
$MUTED     = [System.Drawing.Color]::FromArgb(255, 179, 156, 207) # #b39ccf
$PANEL     = [System.Drawing.Color]::FromArgb(90, 23, 13, 38)     # panel over bg

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# ---- background gradient ----------------------------------------
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$lin  = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect, $BG_TOP, $BG_BOT, 30.0)
$g.FillRectangle($lin, $rect)
$lin.Dispose()

# ---- soft glows -------------------------------------------------
function Glow([int]$cx, [int]$cy, [int]$r, [System.Drawing.Color]$c) {
    $pts = New-Object 'System.Drawing.Point[]' 4
    $pts[0] = New-Object System.Drawing.Point $cx, ($cy - $r)
    $pts[1] = New-Object System.Drawing.Point ($cx + $r), $cy
    $pts[2] = New-Object System.Drawing.Point $cx, ($cy + $r)
    $pts[3] = New-Object System.Drawing.Point ($cx - $r), $cy
    # -ArgumentList (,$pts): the leading comma keeps PowerShell from
    # splatting the array across the constructor parameters.
    $br = New-Object System.Drawing.Drawing2D.PathGradientBrush -ArgumentList (,$pts)
    $br.CenterColor = $c
    $br.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $c.R, $c.G, $c.B))
    $script:g.FillEllipse($br, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
    $br.Dispose()
}
Glow 250 120 420 $PINK_SOFT
Glow 1010 560 380 ([System.Drawing.Color]::FromArgb(110, 180, 107, 255))

# ---- faint grid, so it reads as a game site ---------------------
$gridPen = New-Object System.Drawing.Pen(
    [System.Drawing.Color]::FromArgb(16, 255, 255, 255), 1)
for ($x = 0; $x -le $W; $x += 60) { $g.DrawLine($gridPen, $x, 0, $x, $H) }
for ($y = 0; $y -le $H; $y += 60) { $g.DrawLine($gridPen, 0, $y, $W, $y) }
$gridPen.Dispose()

# ---- falling petals (fixed positions, deterministic) ------------
$petal = New-Object System.Drawing.SolidBrush(
    [System.Drawing.Color]::FromArgb(46, 255, 138, 176))
$petal2 = New-Object System.Drawing.SolidBrush(
    [System.Drawing.Color]::FromArgb(28, 255, 190, 214))
$rng = New-Object System.Random(20260929)
for ($i = 0; $i -lt 46; $i++) {
    $px = $rng.Next(20, $W - 20)
    $py = $rng.Next(20, $H - 20)
    $pw = $rng.Next(11, 23)
    $ph = [int]($pw * 0.72)
    $a = $rng.Next(0, 360)
    $st = $g.Save()
    $g.TranslateTransform($px, $py)
    $g.RotateTransform($a)
    $b = if ($i % 2 -eq 0) { $petal } else { $petal2 }
    $g.FillEllipse($b, [int](-$pw / 2), [int](-$ph / 2), $pw, $ph)
    $g.Restore($st)
}
$petal.Dispose(); $petal2.Dispose()

# ---- wordmark ---------------------------------------------------
$fontBig = New-Object System.Drawing.Font('Segoe UI Black', 132,
          [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fontSub = New-Object System.Drawing.Font('Segoe UI Semibold', 34,
          [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fontTag = New-Object System.Drawing.Font('Segoe UI', 27,
          [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$shadow = New-Object System.Drawing.SolidBrush(
    [System.Drawing.Color]::FromArgb(120, 0, 0, 0))

$zeroB = '0x' + [char]0x0042 + [char]0x0030
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

$bPink  = New-Object System.Drawing.SolidBrush $PINK
$bText  = New-Object System.Drawing.SolidBrush $TEXT
$bMuted = New-Object System.Drawing.SolidBrush $MUTED

# "0xB0" in pink, "GAMES" in white
$rectB0 = New-Object System.Drawing.RectangleF(0, 96, $W, 165)
$rectGm = New-Object System.Drawing.RectangleF(0, 236, $W, 150)
$g.DrawString($zeroB, $fontBig, $bPink, $rectB0, $fmt)
$g.DrawString('GAMES', $fontBig, $bText, $rectGm, $fmt)

# tagline
$tag = 'Unblocked games that just work.'
$fmt2 = New-Object System.Drawing.StringFormat
$fmt2.Alignment = [System.Drawing.StringAlignment]::Center
$fmt2.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString($tag, $fontSub, $bMuted,
    (New-Object System.Drawing.RectangleF(0, 392, $W, 48)), $fmt2)

# pill: 544 games, no downloads
$pillText = '544 games  ' + [char]0x00B7 + '  no downloads  ' + [char]0x00B7 + '  no sign-up'
$sz = $g.MeasureString($pillText, $fontTag)
$pw2 = [int]($sz.Width + 56)
$ph2 = [int]($sz.Height + 26)
$px2 = [int](($W - $pw2) / 2)
$py2 = 474
$bPanel = New-Object System.Drawing.SolidBrush $PANEL
$g.FillEllipse($bPanel, $px2, $py2, $pw2, $ph2)
$pen = New-Object System.Drawing.Pen(
    [System.Drawing.Color]::FromArgb(120, 255, 110, 169), 2)
$g.DrawEllipse($pen, $px2, $py2, $pw2, $ph2)
$g.DrawString($pillText, $fontTag, $bText,
    (New-Object System.Drawing.RectangleF(0, $py2, $W, $ph2)), $fmt2)
$pen.Dispose()

# thin accent bar under the title
$barPen = New-Object System.Drawing.Pen($PURPLE, 5)
$g.DrawLine($barPen, 470, 462, 730, 462)
$barPen.Dispose()

# ---- save -------------------------------------------------------
$dir = Split-Path -Parent $out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$g.Flush()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

$fontBig.Dispose(); $fontSub.Dispose(); $fontTag.Dispose()
$bPink.Dispose(); $bText.Dispose(); $bMuted.Dispose(); $bPanel.Dispose()
$shadow.Dispose(); $fmt.Dispose(); $fmt2.Dispose()
$g.Dispose()
$bmp.Dispose()

$fi = Get-Item $out
Write-Host ('wrote ' + $fi.FullName + '  (' + $fi.Length + ' bytes)')

# ------------------------------------------------------------------
# Icons. Chrome only treats a web app as installable if the manifest
# carries a 192px and a 512px PNG, so draw the mark at both sizes.
# "purpose": "any maskable" needs 20% padding so Android can crop
# the icon to whatever shape the launcher wants.
# ------------------------------------------------------------------
function Write-Icon([int]$size, [string]$path, [bool]$pad) {
    $b = New-Object System.Drawing.Bitmap($size, $size)
    $gr = [System.Drawing.Graphics]::FromImage($b)
    $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gr.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $r = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $r, [System.Drawing.Color]::FromArgb(255, 20, 10, 32),
        [System.Drawing.Color]::FromArgb(255, 62, 24, 74), 55.0)
    $gr.FillRectangle($br, $r)
    $br.Dispose()

    # corner petals
    $pet = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(50, 255, 138, 176))
    $r2 = New-Object System.Random(20260929)
    for ($i = 0; $i -lt 14; $i++) {
        $px = $r2.Next(0, $size)
        $py = $r2.Next(0, $size)
        $pw = [int]($size * 0.10)
        $st = $gr.Save()
        $gr.TranslateTransform($px, $py)
        $gr.RotateTransform($r2.Next(0, 360))
        $gr.FillEllipse($pet, [int](-$pw / 2), [int](-$pw / 3), $pw, [int]($pw * 0.66))
        $gr.Restore($st)
    }
    $pet.Dispose()

    $inset = if ($pad) { [int]($size * 0.16) } else { [int]($size * 0.06) }
    $box = $size - (2 * $inset)
    $fnt = New-Object System.Drawing.Font('Segoe UI Black', [float]($box * 0.46),
              [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bPink = New-Object System.Drawing.SolidBrush $PINK
    $bText = New-Object System.Drawing.SolidBrush $TEXT
    $fA = New-Object System.Drawing.StringFormat
    $fA.Alignment = [System.Drawing.StringAlignment]::Center
    $fA.LineAlignment = [System.Drawing.StringAlignment]::Center

    $mark = '0x' + [char]0x0042 + [char]0x0030
    $gr.DrawString($mark, $fnt, $bPink, (New-Object System.Drawing.RectangleF(0, ($inset - ($box * 0.10)), $size, ($box * 0.56))), $fA)
    $fnt2 = New-Object System.Drawing.Font('Segoe UI Black', [float]($box * 0.30),
              [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $gr.DrawString('GAMES', $fnt2, $bText, (New-Object System.Drawing.RectangleF(0, ($inset + ($box * 0.42)), $size, ($box * 0.40))), $fA)

    $gr.Flush()
    $b.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $fA.Dispose(); $fnt.Dispose(); $fnt2.Dispose()
    $bPink.Dispose(); $bText.Dispose(); $gr.Dispose(); $b.Dispose()
    $fi2 = Get-Item $path
    Write-Host ('wrote ' + $fi2.FullName + '  (' + $fi2.Length + ' bytes)')
}

Write-Icon 192 (Join-Path $dir 'icon-192.png') $true
Write-Icon 512 (Join-Path $dir 'icon-512.png') $true
