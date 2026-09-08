[CmdletBinding()]
param(
    [string]$BackupDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $BackupDirectory) { $BackupDirectory = Join-Path $projectRoot 'backups' }
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fileName = "adult-basketball-$timestamp.dump"
$containerPath = "/tmp/$fileName"
$backupPath = Join-Path $BackupDirectory $fileName

Push-Location $projectRoot
try {
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is not available.' }

    $dbContainerId = (& docker compose ps -q db).Trim()
    if (-not $dbContainerId) { throw 'The DB container is not running. Check docker compose ps.' }

    $readyCommand = 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    & docker compose exec -T db sh -lc $readyCommand *> $null
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL is not ready for backup.' }

    New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
    $dumpCommand = 'pg_dump --format=custom --file="{0}" -U "$POSTGRES_USER" "$POSTGRES_DB"' -f $containerPath
    & docker compose exec -T db sh -lc $dumpCommand
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }

    $savedErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose cp "db:$containerPath" $backupPath 2>&1 | Out-Null
    $copyExitCode = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorPreference
    if ($copyExitCode -ne 0) { throw 'Could not copy the backup file to Windows.' }

    $backupFile = Get-Item -LiteralPath $backupPath
    if ($backupFile.Length -le 0) { throw 'The backup file is empty.' }

    & docker compose exec -T db pg_restore --list $containerPath *> $null
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore could not validate the backup format.' }

    Write-Host "DB backup succeeded: $($backupFile.FullName)"
    Write-Host "File size: $($backupFile.Length) bytes"
}
catch {
    if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force }
    Write-Error "DB backup failed: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($dbContainerId) {
        & docker compose exec -T db rm -f -- $containerPath *> $null
    }
    Pop-Location
}
