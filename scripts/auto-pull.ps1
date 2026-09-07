$RepoPath = "D:\dev\adult-basketball"
$LogFile = "$RepoPath\scripts\auto-pull.log"
$DeployStateFile = "$RepoPath\scripts\last-deployed.txt"

Set-Location $RepoPath

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# 1. GitHub 최신 상태 확인
git fetch origin main *> $null

if ($LASTEXITCODE -ne 0) {
    Add-Content $LogFile "$timestamp - Git fetch failed"
    exit 1
}

$local = git rev-parse HEAD
$remote = git rev-parse origin/main

# 2. 로컬이 GitHub보다 뒤에 있으면 Pull
if ($local -ne $remote) {

    git merge-base --is-ancestor HEAD origin/main

    if ($LASTEXITCODE -eq 0) {

        Add-Content $LogFile "$timestamp - New remote commit detected: $local -> $remote"

        git pull --ff-only origin main *> $null

        if ($LASTEXITCODE -ne 0) {
            Add-Content $LogFile "$timestamp - Pull failed"
            exit 1
        }

        Add-Content $LogFile "$timestamp - Pull successful"
    }
}

# Pull 이후 현재 커밋 다시 확인
$currentCommit = git rev-parse HEAD

# 3. 마지막으로 Docker에 배포한 커밋 확인
$lastDeployed = ""

if (Test-Path $DeployStateFile) {
    $lastDeployed = (Get-Content $DeployStateFile -Raw).Trim()
}

# 4. 현재 커밋이 마지막 배포 커밋과 같으면 종료
if ($currentCommit -eq $lastDeployed) {
    Add-Content $LogFile "$timestamp - Already deployed: $currentCommit"
    exit 0
}

Add-Content $LogFile "$timestamp - New deploy target detected: $lastDeployed -> $currentCommit"

# 5. Docker 실행 여부 확인
docker info *> $null

if ($LASTEXITCODE -ne 0) {
    Add-Content $LogFile "$timestamp - Docker is not running. Skipping deploy."
    exit 0
}

# 6. Docker 재배포
Add-Content $LogFile "$timestamp - Docker is running. Starting compose deploy."

docker compose up -d --build *> $null

if ($LASTEXITCODE -eq 0) {

    # 성공한 경우에만 마지막 배포 커밋 저장
    Set-Content $DeployStateFile $currentCommit

    Add-Content $LogFile "$timestamp - Docker deploy successful: $currentCommit"
}
else {
    Add-Content $LogFile "$timestamp - Docker deploy failed"
    exit 1
}