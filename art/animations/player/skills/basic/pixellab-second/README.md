# 기본 기술 2번째 4종 · PixelLab

- `effects/<스킬>/concept.png`: 이펙트 시안
- `effects/<스킬>/sheet.png`: 시안을 움직인 지면 이펙트
- `clips/<스킬>-<방향>/sheet.png`: 8방향 몸 동작 (렌치를 든 F2)
- `jobs.json`: PixelLab 작업 번호, `overview.png`: 한눈에 보기

다시 만들려면 `jobs.json`을 고치고 해당 `clips` 폴더를 지운 뒤 `node scripts/import-second-skill-pixellab.mjs`, `node scripts/build-game-clips.mjs` 순서로 실행합니다.
