# Cloudflare 배포 (Workers 정적 파일)

주소: https://beyondtheclockwork.mungaeng.workers.dev  ·  `main`에 푸시하면 자동 배포.

게임은 빌드 과정이 없는 정적 파일입니다. 저장소 루트를 그대로 올리면 됩니다.

## 방법 1 · GitHub 연결 (추천, 푸시하면 자동 배포)

1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git
2. 저장소 `ans4572/BeyondTheClockwork` 선택, 브랜치 `main`
3. Build settings
   - Framework preset: None
   - Build command: 비워 둠
   - Build output directory: `/`
4. Save and Deploy → `https://beyond-the-clockwork.pages.dev` 같은 주소가 생깁니다.

이후 `main`에 푸시할 때마다 자동으로 다시 배포됩니다.

## 방법 2 · 명령어로 직접 올리기

```
npx wrangler login
npx wrangler deploy
```

## 들어 있는 설정

- `_headers`: 코드·데이터는 매번 새 버전 확인(바로 반영), 그림·소리는 하루 캐시.
- `wrangler.toml`: Worker 이름 `beyondtheclockwork`, 저장소 루트를 정적 파일로 올림.
- `.assetsignore`: 테스트·스크립트·문서 등 게임에 필요 없는 파일은 올리지 않음.
- 파일 수 약 1,300개, 가장 큰 파일 2.6MB — Cloudflare Pages 제한(파일 2만 개, 파일당 25MB) 안입니다.
- 모든 경로가 상대 경로라 GitHub Pages(`/BeyondTheClockwork/`)와 Cloudflare(루트) 양쪽에서 그대로 동작합니다.

## 기기 이동 코드 · 자동 동기화 (Worker + KV)

설정의 "다른 기기로 옮기기"는 `worker/index.js`가 처리합니다. `/api/*`만 Worker가 받고, 나머지 경로는 그대로 정적 파일입니다.

- `POST /api/transfer` 저장을 받아 8글자 코드 발급(5분 보관, 주소당 시간당 10개)
- `GET /api/transfer/:code` 저장 돌려주기 · `DELETE /api/transfer/:code` 불러온 뒤 삭제
- `POST /api/sync` 자동 동기화 시작(16글자 키 발급) · `GET /api/sync/:key` 최신 진행 · `PUT /api/sync/:key` 올리기(`baseRev`가 다르면 409로 거절)
- 동기화 저장은 마지막으로 올린 뒤 180일 보관. 게임은 마을로 돌아올 때만, 진행이 바뀌었을 때만 올립니다(KV 쓰기 절약).
- GitHub Pages·로컬(127.0.0.1:4173)에서 실행한 게임도 Cloudflare 주소의 API를 씁니다(CORS 허용).

처음 한 번 필요한 설정:

1. Cloudflare 대시보드 → Storage & Databases → Workers KV → Create → 이름 `beyondtheclockwork-transfer`
2. 만들어진 Namespace ID를 `wrangler.toml`의 `[[kv_namespaces]] id`에 넣기 (비밀값 아님, 현재 설정 완료)
3. 커밋·푸시 → 자동 배포. Workers Builds의 Deploy command는 `npx wrangler deploy` 그대로.

확인: `https://beyondtheclockwork.mungaeng.workers.dev/api/transfer/AAAA-AAAA` 가 `{"error":"missing"}`을 돌려주면 정상입니다.

## 플레이 통계 · 관리자 페이지 (Worker + D1)

관리자 페이지: `https://beyondtheclockwork.mungaeng.workers.dev/admin.html` (검색엔진 제외, 토큰 없으면 아무것도 안 보임)

유저 탭의 연동 코드: 유저를 고르면 그 기기가 마지막으로 올린 진행으로 24시간짜리 연동 코드를 만들 수 있습니다. 이 업데이트 전 버전만 쓴 기기는 '서버 저장 찾기'로 맞는 저장을 고르고, 서버 저장이 없으면 '진행 복구'로 진행을 직접 정합니다. 기기와 동기화 자리의 연결은 Workers KV(`TRANSFER`)의 `device:<기기 id>`, 기록 이어받기 통행증은 `inherit:<…>`(7일)에 남습니다(추가 설정 없음). 서버 저장 찾기는 KV의 `sync:` 키를 훑어서(list) 한 번에 읽기 수백 번을 씁니다.

- `POST /api/stats` 게임이 보내는 익명 이벤트: 게임 열기(`open`), 원정 출발(`runStart`), 귀환(`runEnd`). 형식이 틀리면 400.
- `GET /api/admin/stats?days=7|30|0&difficulty=easy|normal|hard` 관리자 요약(난이도를 빼면 전체). `Authorization: Bearer <ADMIN_TOKEN>`이 맞아야 열림.
- 게임은 화면에 떠 있는 동안 1분마다 `POST /api/stats`(`ping`)로 접속을 알리고, 답으로 도착 전 선물을 받습니다. 받은 뒤 `POST /api/mail/claim`.
- 유저 탭(관리자 토큰 필요): `GET /api/admin/users?q=` 목록, `GET /api/admin/users/:id` 한 명, `POST /api/admin/users/:id/memo` 이름 메모, `POST /api/admin/gifts` 자유 톱니 보내기(1~100,000개), `DELETE /api/admin/gifts/:id` 도착 전 선물 취소.
- D1 쓰기량: 게임을 켜 둔 기기 하나가 1분에 한 번 씁니다. 무료 한도(하루 10만 행)는 동시에 70명이 하루 종일 켜 둬야 닿는 수준입니다.
- 표는 첫 요청 때 Worker가 직접 만듭니다(마이그레이션 명령 필요 없음).
- 저장하는 것: 기기 무작위 id, 기기 형태·운영체제·브라우저 이름, 원정 id·속성 조합·결과·도달 정거장·걸린 시간, 날짜, 마지막 접속 시각·위치·보유 자유 톱니·플레이 시간, 관리자가 붙인 메모와 보낸 선물. IP와 이름은 저장하지 않습니다.

처음 한 번 필요한 설정:

1. Cloudflare 대시보드 → Storage & Databases → D1 → Create → 이름 `beyondtheclockwork-stats`
2. 만들어진 Database ID를 `wrangler.toml`의 `[[d1_databases]]` 블록에 넣기 (비밀값 아님, 현재 설정 완료)
3. 관리자 토큰 만들기: 내 컴퓨터 터미널에서 `node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"` → 나온 글자를 비밀번호 관리자 등에 보관
4. Workers & Pages → `beyondtheclockwork` → Settings → Variables and Secrets → Add → Type `Secret`, 이름 `ADMIN_TOKEN`, 값은 3번 글자 → Deploy
5. 커밋·푸시 → 자동 배포 → `/admin.html`에서 토큰 입력

확인: `https://beyondtheclockwork.mungaeng.workers.dev/api/admin/stats`가 `{"error":"denied"}`를 돌려주면 정상입니다(`unconfigured`면 D1이나 토큰이 아직 없음).
