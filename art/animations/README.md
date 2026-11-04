# 애니메이션 모음

[전체 재생 화면](index.html) · [목록 JSON](catalog.json)

- `player/movement/locomotion`: PixelLab 대기·걷기·달리기 8방향 24클립
- `player/movement/attacks`: PixelLab 렌치 3타 8방향 24클립, 왼팔 보정 포함
- `player/movement/reactions`: 피격·사망·회피 8방향 24클립
- `player/skills/basic/pixellab`: 기본 기술 1번째 4종(불·얼음·전기·바람 각 1개) × 8방향, 실제 PixelLab 32클립
- `player/skills/basic`: 기본 기술 2번째 4종(불·얼음·전기·바람 각 1개) × 8방향, 로컬 리그 32클립
- `player/skills/fusion/pixellab`: 융합 6종의 8방향 48클립 · 기존 남동 6 + 신규 분리 합성 42
- `player/skills/fusion/eight-direction-prototype`: 융합 6종의 8방향 리그 초안
- `npc`: 볼트 N2B 고정 인사·대기 및 주민 24종 걷기·대기. 게임의 주민, 모루, 볼트는 `npc/pixellab/`의 PixelLab 스프라이트를 씁니다
- `mobs/normal-elite`: 일반·정예 몹 13종 움직임·공격 (모두 PixelLab)
- `mobs/bosses`: 로코 수거함형·브라스 지휘관형 공격·스킬, 음파 투사체

게임이 읽는 클립 목록은 `player/game-clips.json`, `mobs/normal-elite/game-clips.json`, `npc/game-clips.json`입니다. 대기·걷기·달리기·3타·기본 기술 1번째 4종·융합 6종은 PixelLab, 피격·사망·회피와 기본 기술 2번째 4종은 로컬 리그를 사용합니다. 융합은 몸체와 효과를 분리해 재생하며, 효과는 실제 판정 위치에 그립니다. 일반·정예 몹 13종은 모두 PixelLab입니다. 클립을 교체할 때는 `scripts/build-game-clips.mjs`의 `SETS`를 바꿔 다시 실행하면 되고, 게임 코드는 바꾸지 않아도 됩니다. 몹의 `{몹}-hit`, `{몹}-death` 클립을 추가하면 자동으로 재생됩니다.

주인공 공용 리그·동작 정의는 `player/*.json`에 있습니다. 전투·성장 수치는 기존 `src/data` JSON을 계속 사용합니다. PixelLab과 로컬 리그 결과는 목록의 provider로 구분합니다.

승인된 정지 시안과 맵 방 후보는 기존 참고 자료 폴더에 보존합니다. 폐기 외형, 이전 이동·공격 리그 출력, 미선택 PixelLab 재생성, 폐기 융합 시안은 제거했습니다. 상세 이동·삭제 내역과 이미지 무변경 해시는 [정리 기록](../../docs/art-cleanup-report.json)을 참조하세요.
