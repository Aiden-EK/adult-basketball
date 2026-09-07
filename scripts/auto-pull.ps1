$RepoPath = "D:\dev\adult-basketball"
$LogFile = "$RepoPath\scripts\auto-pull.log"

Set-Location $RepoPath

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

git fetch origin main

$local = git rev-parse HEAD
$remote = git rev-parse origin/main

if ($local -ne $remote) {

    Add-Content $LogFile "$timestamp - New commit detected: $local -> $remote"

    git pull --ff-only origin main

    if ($LASTEXITCODE -ne 0) {
        Add-Content $LogFile "$timestamp - Pull failed"
        exit 1
    }

    Add-Content $LogFile "$timestamp - Pull successful"

    # Docker가 실행 중인지 확인
    docker info *> $null

    if ($LASTEXITCODE -ne 0) {
        Add-Content $LogFile "$timestamp - Docker is not running. Skipping deploy."
        exit 0
    }

    Add-Content $LogFile "$timestamp - Docker is running. Starting compose deploy."

    docker compose up -d --build

    if ($LASTEXITCODE -eq 0) {
        Add-Content $LogFile "$timestamp - Docker deploy successful"
    }
    else {
        Add-Content $LogFile "$timestamp - Docker deploy failed"
    }

}
else {
    Add-Content $LogFile "$timestamp - Already up to date"
}