# 일반·정예 몹 13종 · PixelLab

[전체 안내](/art/animations/README.md)

모든 몹이 PixelLab 캐릭터입니다. 게임이 읽는 목록은 `game-clips.json`(몹마다 대기·이동·공격 × 8방향)입니다.

- 목각 경비·정예 목각 경비·나팔 사수·스프링 토끼(2026-11-04): `pixellab/characters.json`에 캐릭터와 동작 ID가 있고, `node scripts/import-mob-characters.mjs`로 받아 시트를 만듭니다. 공격 동작에 PixelLab이 그려 넣는 타격 섬광은 몸과 떨어진 조각을 자동으로 지우고, 몸에 붙은 섬광이 있는 프레임은 `drop`에 적은 번호대로 뺍니다.
- 나머지 9종은 `scripts/import-mob-pixellab.mjs`로 만든 기존 시트입니다.
