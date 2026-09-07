\# AGENTS.md



\## 프로젝트



어른이농구 리그별 스코어 APP



이 프로젝트는 농구 동호회의 분기별 리그, 경기 결과, 팀 순위, 출석 및 회원 정보를 관리하는 웹/PWA 애플리케이션입니다.



구체적인 기능 요구사항은 반드시 다음 문서를 기준으로 합니다.



\- `docs/requirements-v1.0.md`



\## 기술 스택



\### Frontend



\- React

\- JavaScript

\- Vite



\### Backend



\- Node.js

\- Express

\- JavaScript

\- pg

\- dotenv



\### Database



\- PostgreSQL 17



\### Infrastructure



\- Docker

\- Docker Compose



\## 현재 프로젝트 구조



\- `frontend/`

\- `backend/`

\- `database/`

\- `docs/`

&#x20; - `requirements-v1.0.md`

\- `docker-compose.yml`

\- `.env.example`

\- `.gitignore`

\- `AGENTS.md`



\## 개발 원칙



1\. `docs/requirements-v1.0.md`를 최우선 요구사항 문서로 사용합니다.

2\. 요구사항에 없는 기능을 임의로 추가하지 않습니다.

3\. 확정된 비즈니스 규칙을 임의로 변경하지 않습니다.

4\. 현재 기술 스택을 임의로 다른 프레임워크나 언어로 교체하지 않습니다.

5\. Frontend와 Backend는 JavaScript를 사용합니다.

6\. Backend API는 REST 방식으로 구현합니다.

7\. PostgreSQL 데이터베이스를 사용합니다.

8\. 관리자 전용 데이터는 공개 API에 노출하지 않습니다.

9\. 특히 Member의 `note`는 관리자 전용 정보입니다.

10\. 순위, 승률, 득실차, 연승, 출석률처럼 계산 가능한 데이터는 불필요하게 DB에 중복 저장하지 않습니다.

11\. 모바일 사용성을 우선합니다.

12\. 초기 v1.0에 필요하지 않은 과도한 추상화나 복잡한 구조를 만들지 않습니다.

13\. 기존 동작을 변경할 때는 관련 기능에 미치는 영향을 먼저 확인합니다.

14\. DB 스키마 변경 시 기존 데이터 보존을 고려합니다.

15\. 비밀번호와 비밀값을 코드나 Git 저장소에 기록하지 않습니다.



\## 구현 방식



초기에는 초보 개발자도 이해할 수 있도록 가능한 한 단순하고 명확한 코드를 작성합니다.



Backend 기능이 커질 경우 다음 흐름을 기준으로 역할을 분리할 수 있습니다.



Route → Controller → Service → Database



단순 기능까지 무조건 모든 계층을 만들지는 않습니다.



코드를 작성할 때 다음을 우선합니다.



\- 읽기 쉬운 변수명

\- 작은 함수

\- 중복 최소화

\- 명확한 에러 처리

\- 필요한 부분의 간단한 주석

\- 일관된 API 응답 구조



\## 작업 전 확인



Codex가 새로운 기능을 구현하기 전에 다음 순서로 확인합니다.



1\. `AGENTS.md` 읽기

2\. `docs/requirements-v1.0.md` 읽기

3\. 현재 코드 구조 확인

4\. 관련 기존 코드 확인

5\. 필요한 변경 범위 결정

6\. 구현

7\. 실행 또는 테스트

8\. 변경사항 요약



\## 금지 사항



다음 작업은 명확한 요청이 없는 한 하지 않습니다.



\- 기술 스택 교체

\- TypeScript 전환

\- FastAPI/Python 전환

\- 다른 DB로 변경

\- 기존 요구사항 삭제

\- 대규모 리팩터링

\- 불필요한 라이브러리 추가

\- 실제 `.env` 파일 커밋

\- 관리자 비밀번호 하드코딩

\- Member `note`의 공개 API 노출

