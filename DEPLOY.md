# Cloudflare 배포 (Workers 정적 파일)

주소: https://beyondtheclockwork.ans4572.workers.dev  ·  `main`에 푸시하면 자동 배포.

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
