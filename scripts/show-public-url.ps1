$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $status = & docker compose ps tunnel --format '{{.State}} {{.Health}}' 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the cloudflared container status.' }
    if (($status -join ' ') -notmatch '^running healthy$') { throw "Named Tunnel is not healthy: $status" }
    $url = 'https://kidultbasket.kr'
    $health = Invoke-RestMethod "$url/api/health"
    if ($health.status -ne 'UP' -or $health.database -ne 'UP') { throw 'The public health endpoint is not ready.' }
    Write-Output $url
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
finally { Pop-Location }
