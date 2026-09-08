# 외부 HTTPS 운영 가이드

## 네트워크 구조

현재 외부 공개 경로는 다음과 같습니다.

```text
일반 사용자
  → Cloudflare HTTPS 임시 주소
  → Cloudflare Quick Tunnel (outbound 연결)
  → Docker Frontend Nginx:80
  → /api 요청만 Docker Backend:3000
  → Docker PostgreSQL:5432
```

Tunnel은 Frontend 컨테이너만 대상으로 합니다. Backend와 PostgreSQL의 호스트 포트는 `127.0.0.1`에만 바인딩되어 있으며 Tunnel 대상으로 사용하지 않습니다. 공유기 포트포워딩은 필요하지 않습니다.

## 현재 공개 방식의 성격

Cloudflare Quick Tunnel은 계정이나 도메인 없이 임시 `https://...trycloudflare.com` 주소를 발급합니다. 무료로 실제 외부 접속을 확인할 수 있지만 테스트·개발 용도이며 SLA가 없습니다. Tunnel 컨테이너를 새로 만들거나 재시작하면 주소가 바뀔 수 있습니다.

사용자에게는 반드시 `https://` 주소만 공유합니다. Quick Tunnel은 별도의 Edge 정책을 설정할 수 없어 같은 임시 호스트의 HTTP 요청도 공개 콘텐츠에 도달할 수 있습니다. 관리자 Cookie에는 `Secure`가 적용되어 HTTP로 전송되지 않으며 HTTPS 응답에는 HSTS가 포함됩니다. 고정 Tunnel 전환 시 Cloudflare Edge에서 HTTP→HTTPS 강제를 설정합니다.

고정 주소와 장기 운영이 필요하면 Cloudflare 계정과 소유 도메인을 준비한 뒤 remotely-managed Tunnel로 전환해야 합니다. 계정 생성, 도메인 구매, DNS 변경은 이 프로젝트가 자동으로 수행하지 않습니다.

공유기 포트포워딩 방식은 공인 IP 또는 DDNS, 443 inbound 규칙, Windows Firewall 규칙, Reverse Proxy와 인증서 갱신 관리가 필요하며 CGNAT 환경에서는 사용할 수 없습니다. 현재의 outbound Tunnel 방식은 공인 IP와 inbound 규칙이 필요 없고 TLS를 Tunnel 제공자가 처리하므로 이 프로젝트에 더 단순하고 안전합니다.

## 서비스 시작과 상태 확인

프로젝트 루트에서 실행합니다.

```powershell
docker compose up -d
docker compose ps
```

모든 컨테이너가 `running` 또는 `healthy`인지 확인합니다. Quick Tunnel의 현재 공개 주소는 다음 명령으로 찾습니다.

```powershell
docker compose logs --no-color tunnel | Select-String 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
```

로컬 서비스는 `http://localhost:8080`, 상태 API는 `http://localhost:8080/api/health`에서 확인합니다.

## 로그 확인

```powershell
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 tunnel
docker compose logs --tail=100 db
```

로그를 공유하기 전에 Cookie, 비밀번호, 토큰 같은 민감정보가 포함되지 않았는지 확인합니다.

## 안전한 재기동

전체 서비스 재기동:

```powershell
docker compose restart
docker compose ps
```

Tunnel만 재기동:

```powershell
docker compose restart tunnel
docker compose logs --no-color tunnel | Select-String 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
```

Quick Tunnel은 재기동 후 공개 주소가 달라질 수 있습니다. PostgreSQL named volume은 유지되므로 일반적인 restart나 recreate로 데이터가 삭제되지 않습니다.

## HTTPS Cookie

운영 기본값은 다음과 같습니다.

```dotenv
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=strict
TRUST_PROXY=true
```

Tunnel과 Nginx가 전달한 HTTPS 정보를 Express가 한 단계의 신뢰 프록시로 처리합니다. 비밀번호와 세션 Cookie 값은 로그나 문서에 남기지 않습니다.

## 최초 관리자 생성

관리자 생성은 공개 API가 아니라 기존 로컬 CLI만 사용합니다.

1. Git에서 제외된 루트 `.env`에 `ADMIN_LOGIN_ID`, `ADMIN_NAME`, `ADMIN_PASSWORD`를 임시로 입력합니다.
2. 비밀번호는 10자 이상으로 만들고 다른 서비스에서 사용한 비밀번호를 재사용하지 않습니다.
3. 프로젝트 루트에서 `npm --prefix backend run setup:admin`을 실행합니다.
4. 성공을 확인한 직후 `.env`의 세 `ADMIN_` 항목을 삭제합니다. DB에는 scrypt hash만 저장됩니다.
5. `.env`를 Git에 추가하거나 화면·로그로 공유하지 않습니다.

이 명령은 같은 로그인 ID가 있으면 비밀번호를 갱신하므로 운영 PC에서만 신중하게 실행합니다.

## 장애 시 확인 순서

1. `docker compose ps`로 DB, Backend, Frontend, Tunnel 상태를 확인합니다.
2. `http://localhost:8080/api/health`가 `status: UP`, `database: UP`인지 확인합니다.
3. 로컬은 정상인데 외부만 실패하면 Tunnel 로그와 현재 임시 URL을 확인합니다.
4. Backend가 비정상이면 Backend 로그와 DB health를 확인합니다.
5. DB가 비정상이면 디스크 여유 공간과 volume 연결 상태를 먼저 확인합니다.

## 절대 실행하면 안 되는 작업

- `docker compose down -v`
- PostgreSQL volume 삭제
- 3000 또는 5432 포트의 공유기 포트포워딩
- Tunnel 대상을 Backend나 PostgreSQL로 변경
- `.env`, Tunnel token, 인증서 private key의 Git 커밋
- 인증서 검증 비활성화

## DB 백업 권장사항

외부 공개 후에는 정기적으로 `pg_dump` 백업을 암호화된 별도 저장소에 보관하는 것을 권장합니다. 백업 파일에는 회원 정보가 포함될 수 있으므로 Git 저장소나 공개 클라우드 폴더에 그대로 올리지 않습니다. 복구 절차도 운영 데이터가 아닌 별도 환경에서 주기적으로 확인합니다.
