# 0xB0 GAMES - server/audit-3kh0.ps1
# ------------------------------------------------------------------
# Deep-checks the games served through game-host.html (the 3kh0
# assets on cdn.statically.io).
#
# For every entry it
#   1. downloads the entry page,
#   2. pulls the first few relative src/href references out of it,
#   3. HEADs each one against the CDN,
# and reports anything that 404s, so a half-finished upstream build
# (missing Unity .wasm, missing ruffle.js, ...) shows up as a dead
# tile instead of a black screen.
#
# Writes server/audit-3kh0.csv. Pure ASCII on purpose (PS 5.1 reads
# .ps1 as ANSI).
# ------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::DefaultConnectionLimit = 16

$root    = Split-Path -Parent $PSScriptRoot
$dataJs  = Join-Path $root 'js\games-data.js'
$outCsv  = Join-Path $PSScriptRoot 'audit-3kh0.csv'

$src = [System.IO.File]::ReadAllText($dataJs, [System.Text.Encoding]::UTF8)
$entries = [regex]::Matches(
    $src,
    'slug:\s*"([^"]+)"[^{}]*?src:\s*"(https://cdn\.statically\.io[^"]+)"'
)

$rows = New-Object System.Collections.Generic.List[object]

function Probe([string]$url, [int]$timeoutMs) {
    for ($try = 1; $try -le 3; $try++) {
        try {
            $req = [Net.HttpWebRequest]::Create($url)
            $req.Method = 'HEAD'
            $req.Timeout = $timeoutMs
            $req.ReadWriteTimeout = $timeoutMs
            $req.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            $req.AllowAutoRedirect = $true
            $resp = $req.GetResponse()
            $code = [int]$resp.StatusCode
            $resp.Close()
            return @($code, '')
        } catch {
            $code = 0
            try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = 0 }
            # 0 = transport hiccup / throttling -> back off and try again
            if ($code -eq 0 -and $try -lt 3) {
                Start-Sleep -Milliseconds (900 * $try)
                continue
            }
            return @($code, '')
        }
    }
    return @(0, '')
}

# No Range header: Cloudflare answers range requests on this CDN with an
# error, and a plain GET is small enough for these entry pages anyway.
function FetchText([string]$url, [int]$timeoutMs) {
    for ($try = 1; $try -le 3; $try++) {
        try {
            $req = [Net.HttpWebRequest]::Create($url)
            $req.Method = 'GET'
            $req.Timeout = $timeoutMs
            $req.ReadWriteTimeout = $timeoutMs
            $req.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            $req.AllowAutoRedirect = $true
            $resp = $req.GetResponse()
            $sr = New-Object IO.StreamReader($resp.GetResponseStream())
            $t = $sr.ReadToEnd()
            $sr.Close()
            $resp.Close()
            return $t
        } catch {
            $code = 0
            try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = 0 }
            if ($code -eq 0 -and $try -lt 3) {
                Start-Sleep -Milliseconds (1500 * $try)
                continue
            }
            return $null
        }
    }
    return $null
}

$n = 0
foreach ($m in $entries) {
    $n++
    $slug = $m.Groups[1].Value
    $url  = $m.Groups[2].Value
    $dir  = $url.Substring(0, $url.LastIndexOf('/') + 1)

    Write-Host ("[{0}/{1}] {2}" -f $n, $entries.Count, $slug)
    Start-Sleep -Milliseconds 250

    $html = FetchText $url 25000
    if ($null -eq $html -or $html.Length -lt 40) {
        $rows.Add([pscustomobject]@{
            slug = $slug; entry = 'FETCH-FAIL'; refs = 0; missing = 0
            missingList = '(entry page unreachable)'; note = ''
        })
        continue
    }

    $refs = New-Object System.Collections.Generic.List[string]
    foreach ($mm in [regex]::Matches($html, '(?:src|href)\s*=\s*"([^"]+)"')) {
        $v = $mm.Groups[1].Value.Trim()
        if (-not $v) { continue }
        if ($v -match '^(https?:)?//|^data:|^#|^mailto:|^javascript:') { continue }
        $v = $v.Split('?')[0].Split('#')[0]
        if (-not $v) { continue }
        $refs.Add($v)
    }

    $missing = New-Object System.Collections.Generic.List[string]
    $checked = 0
    foreach ($v in $refs) {
        if ($checked -ge 4) { break }
        # /js/main.js is 3kh0's own shared site script; it lives at the root
        # of their site and is not part of any game folder, so skip it.
        if ($v -like '/js/*') { continue }
        $checked++
        $abs = [uri]::new([uri]$dir, $v).AbsoluteUri
        $r = Probe $abs 15000
        if ($r[0] -ne 200) { $missing.Add($v + ' [' + $r[0] + ']') }
        Start-Sleep -Milliseconds 120
    }

    $rows.Add([pscustomobject]@{
        slug = $slug; entry = 'OK'; refs = $refs.Count; missing = $missing.Count
        missingList = ($missing -join ' ; '); note = ''
    })
}

$rows | Export-Csv -Path $outCsv -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host ("checked: " + $rows.Count)
$bad = @($rows | Where-Object { $_.entry -ne 'OK' -or $_.missing -gt 0 })
Write-Host ("with problems: " + $bad.Count)
foreach ($b in $bad) {
    Write-Host ("  " + $b.slug.PadRight(26) + $b.entry + "  missing=" + $b.missing + "  " + $b.missingList)
}
Write-Host ""
Write-Host ("report: " + $outCsv)
