$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $logs = & docker compose logs --no-color tunnel 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Could not read cloudflared logs.' }
    $matches = [regex]::Matches(($logs -join "`n"), 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($matches.Count -eq 0) { throw 'Could not find the current Quick Tunnel URL. Check the tunnel status and logs.' }
    Write-Output $matches[$matches.Count - 1].Value
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
finally { Pop-Location }
