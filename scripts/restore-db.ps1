[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$TargetDatabase,

    [switch]$AllowProductionRestore
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile -ErrorAction Stop).Path
$containerPath = "/tmp/adult-basketball-restore-$([Guid]::NewGuid().ToString('N')).dump"

Push-Location $projectRoot
try {
    $dbContainerId = & docker compose ps -q db
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$dbContainerId)) { throw 'The DB container is not running.' }
    $dbContainerId = ([string]$dbContainerId).Trim()

    $productionDatabase = & docker compose exec -T db printenv POSTGRES_DB
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$productionDatabase)) { throw 'Could not determine the production database name.' }
    $productionDatabase = ([string]$productionDatabase).Trim()
    $databaseUser = & docker compose exec -T db printenv POSTGRES_USER
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$databaseUser)) { throw 'Could not determine the database user.' }
    $databaseUser = ([string]$databaseUser).Trim()

    $isProduction = $TargetDatabase -eq $productionDatabase
    if ($isProduction -and -not $AllowProductionRestore) {
        throw 'Production restore requires -AllowProductionRestore. Create a fresh backup first.'
    }

    Write-Warning "Restore target database: $TargetDatabase"
    Write-Warning 'Restore can overwrite existing objects and data in the target database.'
    $requiredConfirmation = if ($isProduction) { "RESTORE PRODUCTION $TargetDatabase" } else { "RESTORE $TargetDatabase" }
    $confirmation = Read-Host "Type '$requiredConfirmation' to continue"
    if ($confirmation -cne $requiredConfirmation) { throw 'Confirmation did not match. Restore cancelled.' }

    $savedErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose cp $resolvedBackup "db:$containerPath" 2>&1 | Out-Null
    $copyExitCode = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorPreference
    if ($copyExitCode -ne 0) { throw 'Could not copy the backup file to the DB container.' }
    & docker compose exec -T db pg_restore --list $containerPath *> $null
    if ($LASTEXITCODE -ne 0) { throw 'The file is not a valid PostgreSQL custom-format backup.' }

    $databaseNames = & docker compose exec -T db psql -U $databaseUser -d $productionDatabase -Atc 'SELECT datname FROM pg_database'
    if ($LASTEXITCODE -ne 0) { throw 'Could not check whether the target database exists.' }
    if ($TargetDatabase -notin @($databaseNames)) {
        & docker compose exec -T db createdb -U $databaseUser $TargetDatabase
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the target database.' }
    }

    & docker compose exec -T db pg_restore --exit-on-error --clean --if-exists --no-owner --no-privileges -U $databaseUser -d $TargetDatabase $containerPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
    Write-Host "DB restore succeeded: $TargetDatabase"
}
catch {
    Write-Error "DB restore failed: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($dbContainerId) { & docker compose exec -T db rm -f -- $containerPath *> $null }
    Pop-Location
}
