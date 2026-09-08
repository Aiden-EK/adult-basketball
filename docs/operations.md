# 운영 가이드

이 문서는 Windows PC에서 어른이농구 서비스를 운영하는 절차입니다. 명령은 프로젝트 루트의 PowerShell에서 실행합니다. 실제 비밀번호, Cookie, DB 자격증명, 백업 파일과 현재 Quick Tunnel URL은 Git이나 공개 로그에 남기지 않습니다.

## 1. 서비스 구조와 데이터 보존

```text
외부 사용자 → Cloudflare Quick Tunnel HTTPS → tunnel → frontend(Nginx)
                                                     └→ /api → backend(Express) → db(PostgreSQL)
```

- Frontend: 호스트 `8080` → 컨테이너 `80`
- Backend: 호스트 `127.0.0.1:3000`에만 바인딩
- PostgreSQL: 호스트 `127.0.0.1:5432`에만 바인딩
- 운영 볼륨: `adult-basketball_postgres_data`
- Compose 서비스명: `frontend`, `backend`, `db`, `tunnel`

`docker compose restart`, Backend/Frontend rebuild, `docker compose up -d` 및 개별 서비스 재시작은 named volume을 삭제하지 않습니다. 다음 명령은 운영 DB를 삭제할 수 있으므로 절대 실행하지 않습니다.

```powershell
docker compose down -v
docker volume rm adult-basketball_postgres_data
```

## 2. 시작, 상태 확인과 안전한 재기동

```powershell
docker compose up -d
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
```

전체 서비스를 안전하게 재기동하려면 다음을 실행합니다. Quick Tunnel URL은 바뀔 수 있습니다.

```powershell
docker compose restart
docker compose ps
powershell -ExecutionPolicy Bypass -File scripts/show-public-url.ps1
```

코드 변경을 이미지에 반영할 때는 볼륨 삭제 없이 다음을 사용합니다.

```powershell
docker compose up -d --build backend frontend
docker compose up -d
```

## 3. 로그 확인

```powershell
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 db
docker compose logs --tail=100 tunnel
```

실시간 확인에는 각 명령 끝에 `-f`를 붙이고, 종료할 때 `Ctrl+C`를 누릅니다. 로그를 공유하기 전에 비밀번호, Cookie, token, DB credential이 없는지 확인합니다.

## 4. Quick Tunnel 주소

현재 공개 HTTPS 주소만 출력합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/show-public-url.ps1
```

스크립트 없이 확인하려면 다음을 사용합니다.

```powershell
docker compose logs --no-color tunnel | Select-String 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
```

Tunnel 프로세스가 계속 유지되면 기존 URL도 유지될 수 있지만, 재생성·재시작 시 새 URL이 발급될 수 있습니다. 재기동 후에는 반드시 주소를 다시 확인해 외부 접속을 시험하고, 변경됐다면 사용자에게 새 HTTPS 주소를 공유합니다. 이번 운영 방식에서는 도메인 구매나 Named Tunnel 전환을 하지 않습니다.

## 5. 관리자 계정 관리

관리자 생성 공개 API는 없습니다. 계정은 운영 PC의 CLI에서만 만듭니다. 비밀번호는 10자 이상이며 영문과 숫자를 포함해야 하고, 흔한 비밀번호 및 관리자 ID가 포함된 비밀번호는 거부됩니다. 평문은 DB에 저장되지 않습니다.

### 최초 관리자 생성

가장 안전하고 간단한 방법은 실행 중인 Backend 컨테이너에서 대화형으로 입력하는 것입니다.

```powershell
docker compose exec backend npm run setup:admin
```

호스트 Node.js 환경을 사용한다면 다음 명령도 가능합니다. 루트 `.env`의 DB 접속 설정을 사용합니다.

```powershell
npm --prefix backend run setup:admin
```

1. 프로젝트 폴더에서 명령을 실행합니다.
2. 관리자 ID와 표시 이름을 입력합니다.
3. 화면에 표시되지 않는 비밀번호를 입력합니다.
4. `관리자 계정이 생성되었습니다.` 메시지를 확인합니다.
5. 아래 목록 명령으로 계정이 표시되는지 확인합니다.
6. 현재 Quick Tunnel HTTPS 주소의 `/login`에서 로그인합니다.
7. 관리자 페이지 접근과 로그아웃을 확인합니다.

동일 ID의 계정은 덮어쓰지 않고 거부됩니다. 실제 비밀번호를 명령줄 인수, 문서, 로그에 적지 않습니다.

### 비밀번호 변경

```powershell
docker compose exec backend npm run change-admin-password
```

또는:

```powershell
npm --prefix backend run change-admin-password
```

관리자 ID와 새 비밀번호를 입력합니다. 변경 성공 시 해당 관리자의 기존 세션이 모두 삭제되므로 모든 기기에서 다시 로그인해야 합니다. 활성 `ADMIN` 계정이 아니면 변경하지 않습니다.

### 관리자 목록

```powershell
docker compose exec backend npm run list-admins
```

ID, 권한, 활성 상태, 생성일만 출력합니다. password hash, session token, Cookie, secret은 출력하지 않습니다. 관리자 삭제 기능은 제공하지 않으며 필요한 경우 별도 검토 후 안전하게 처리합니다.

## 6. 수동 DB 백업

중요한 경기 입력 전, 시즌 종료 전·후, 관리자 대량 수정 전, Docker/DB 구조 변경 전에 백업합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-db.ps1
```

스크립트는 DB health를 확인하고 컨테이너의 `pg_dump`로 PostgreSQL custom-format 백업을 만든 뒤 `backups/`에 저장합니다. 파일명은 `adult-basketball-yyyyMMdd-HHmmss.dump`입니다. 파일 크기와 `pg_restore --list` 검증이 성공해야 완료 메시지가 표시됩니다.

보관 원칙:

- 최신 정상 백업을 최소 3~5개 유지합니다.
- 백업 파일에는 회원 데이터가 포함되므로 Git에 올리지 않습니다.
- PC 고장에 대비해 암호화된 외장 저장장치나 접근이 제한된 클라우드에 별도 복사합니다.
- 복사한 백업도 정기적으로 복구 시험을 합니다.

현재 규모에서는 수동 백업을 기본으로 권장합니다. Windows 작업 스케줄러는 재부팅 후에도 예약 실행과 호스트 폴더 저장이 쉽지만 Docker Desktop이 실행 중이어야 하며 작업 기록을 확인해야 합니다. 별도 Docker cron 컨테이너는 Docker와 함께 재시작하기 쉽지만 Windows 외부 보관, 로그, 권한과 보존 정책이 복잡합니다. 운영 습관이 자리 잡은 뒤 `backup-db.ps1`을 작업 스케줄러에 연결하는 방식이 다음 단계로 적합합니다.

## 7. DB 복구

복구는 대상 DB를 덮어쓸 수 있는 위험 작업입니다. 먼저 현재 상태를 새로 백업하고 Backend를 중지한 뒤 수행합니다. 백업 경로와 대상 DB 이름은 반드시 명시해야 합니다.

테스트 DB 복구 예시:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 `
  -BackupFile .\backups\adult-basketball-yyyyMMdd-HHmmss.dump `
  -TargetDatabase adult_basketball_restore_test
```

운영 DB 복구는 추가 옵션과 더 강한 확인 문자열이 필요합니다.

```powershell
docker compose stop backend
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 `
  -BackupFile .\backups\adult-basketball-yyyyMMdd-HHmmss.dump `
  -TargetDatabase adult_basketball `
  -AllowProductionRestore
docker compose start backend
```

스크립트는 파일 존재, 안전한 DB 이름, 실행 중인 DB, custom format 여부를 검사합니다. 운영 DB 이름이면 `-AllowProductionRestore` 없이는 거부하고, 복구 직전 화면에 나온 정확한 확인 문자열을 직접 입력해야 합니다. 자동으로 실행되지 않습니다.

복구 후 다음을 확인합니다.

```powershell
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM league; SELECT COUNT(*) FROM team; SELECT COUNT(*) FROM game;"'
Invoke-RestMethod http://localhost:8080/api/health
```

## 8. 장애 상황별 체크리스트

### A. 외부 주소가 열리지 않음

1. `http://localhost:8080`을 확인합니다.
2. 로컬이 정상이면 `docker compose ps tunnel`과 Tunnel 로그를 확인합니다.
3. `scripts/show-public-url.ps1`로 현재 URL을 다시 확인합니다.
4. 새 URL이면 외부 네트워크에서 시험한 후 사용자에게 다시 공유합니다.

### B. localhost:8080도 열리지 않음

1. `docker compose ps`에서 Frontend 상태를 확인합니다.
2. Frontend 로그를 확인합니다.
3. `docker compose restart frontend` 후 다시 확인합니다.
4. 여전히 실패하면 `docker compose up -d --build frontend`를 실행합니다.

### C. Frontend는 뜨지만 데이터가 나오지 않음

1. `http://localhost:8080/api/health`를 확인합니다.
2. Backend와 DB 상태를 확인합니다.
3. Backend 로그에서 요청 오류를 확인합니다.
4. DB가 정상화된 후 `docker compose restart backend`를 실행합니다.

### D. `/api/health`가 DOWN 또는 응답하지 않음

1. `docker compose ps backend db`를 확인합니다.
2. Backend 로그와 DB 로그를 차례로 확인합니다.
3. DB가 healthy인데 Backend만 비정상이면 Backend만 재시작합니다.
4. 비밀값을 출력하지 말고 `.env`의 필수 항목 존재 여부만 확인합니다.

### E. database가 DOWN

1. `docker compose ps db`와 DB 로그를 확인합니다.
2. Windows 디스크 여유 공간과 Docker Desktop 상태를 확인합니다.
3. 볼륨 `adult-basketball_postgres_data`가 연결되어 있는지 확인합니다.
4. 볼륨 삭제나 `down -v`를 실행하지 않습니다.
5. 복구가 필요하면 검증된 백업과 7장의 절차를 사용합니다.

### F. 관리자 로그인이 안 됨

1. `npm --prefix backend run list-admins` 또는 컨테이너 목록 명령으로 계정의 활성 상태와 권한을 확인합니다.
2. HTTPS 주소를 사용 중인지 확인합니다. Secure Cookie는 HTTP에서 전송되지 않습니다.
3. 브라우저의 오래된 사이트 Cookie를 지우고 다시 시도합니다.
4. 필요하면 CLI로 비밀번호를 변경합니다. 변경하면 기존 세션은 모두 만료됩니다.
5. Backend 로그에는 비밀번호나 Cookie를 남기지 않습니다.

### G. Quick Tunnel 주소가 변경됨

1. `docker compose ps tunnel`이 healthy인지 확인합니다.
2. `scripts/show-public-url.ps1`로 새 주소를 확인합니다.
3. 새 주소에서 `/`와 `/api/health`를 시험합니다.
4. 사용자에게 새 HTTPS 주소를 공유합니다.

## 9. 자주 발생하는 문제와 주의사항

- Docker Desktop이 시작되지 않으면 모든 Compose 명령이 실패합니다.
- Backend/DB 포트는 인터넷에 공개하거나 공유기 포트포워딩하지 않습니다.
- Quick Tunnel은 임시 주소이므로 재기동 후 URL 확인을 생략하지 않습니다.
- 자동 Pull은 활성화하지 않습니다. 배포 전 현재 branch와 commit을 직접 확인합니다.
- 백업 성공 메시지만 믿지 말고 파일 크기와 주기적인 복구 시험 결과를 확인합니다.
- `.env`, `backups/`, 실제 URL, 관리자 정보는 Git에 추가하지 않습니다.
