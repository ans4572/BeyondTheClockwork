# 웃음거리 게임 맵 · 12구간

월드맵 웃음거리 길의 순서대로 게임에 연결한 맵입니다. 방 순서와 적 구성은 `src/data/slice.json`, 맵 데이터는 `src/data/maps.json`에 있습니다.

| 구간 | 방 | 종류 | 배경 폴더 |
| --- | --- | --- | --- |
| 튜토리얼 | 작은 폐기장 | 첫 전투, 구간에 세지 않음 | `scrapyard` |
| 출발 | 웃음 마을 | 거점, 구간에 세지 않음 | `village-court` |
| 01 | 첫 걸음 광장 A | 전투, 확장 맵 | `first-step-a` |
| 02 | 사탕 수레마당 C | 전투, 확장 맵 | `ribbon-alley-c` |
| 03 | 장난감 수선길 A | 전투, 렌치 개조 보상, 확장 맵 | `workshop-road-a` |
| 04 | 리본 교차골목 D | 전투, 확장 맵 | `ribbon-alley-d` |
| 05 | 분실물 회수소 | 로코, 확장 맵 | `lost-and-found` |
| 06 | 중간 마을 쉼터 | 볼트 상점 | `night-market` |
| 07 | 태엽 적재마당 C | 전투 | `workshop-road-c` |
| 08 | 분수 우회광장 C | 전투 | `first-step-c` |
| 09 | 깃발 검문광장 C | 전투 | `parade-approach-c` |
| 10 | 사탕색 골목 A | 전투 | `ribbon-alley-a` |
| 11 | 행진 적재뜰 D | 정예 전투 | `parade-approach-d` |
| 12 | 멈추지 않는 행진 | 브라스 | 코드 배경 |

배경은 각 폴더의 `background-compact.prompt.txt`로 그린 그림을 1536×1024 webp로 줄인 것입니다. 예전 시안 폴더(`map-concepts`)는 2026-11-05에 정리했습니다.

게임에서 `F9`를 누르면 튜토리얼부터 다시 시작하거나 원하는 방으로 바로 이동할 수 있습니다.

## 두 번째 맵 (B)

일반 전투 방 9곳에는 그림이 두 장입니다. 원정을 시작할 때 방마다 A·B 중 하나를 고릅니다(`slice.json`의 `variants`). A는 `maps.json`의 `maps`, B는 `alternates`에 있고 그림은 `*2` 폴더(`first-step-a2`, `ribbon-alley-c2`, `workshop-road-a2`, `ribbon-alley-d2`, `workshop-road-c2`, `first-step-c2`, `parade-approach-c2`, `ribbon-alley-a2`, `parade-approach-d2`)입니다. 프롬프트는 각 폴더의 `background-compact.prompt.txt`, 목록은 `background-large-prompts.md`에 있습니다.

## 맵 데이터

좌표는 각 배경 위에서 직접 읽은 화면 좌표이며 1유닛은 40픽셀입니다.

- `walkable`: 캐릭터의 발이 움직일 수 있는 바닥 다각형입니다. 마을에는 걷는 동작이 없어서 없습니다.
- `solids`: 바닥 안의 통과할 수 없는 물체입니다.
- `occluders`: 캐릭터가 뒤로 지나가는 물체입니다. `baseY`보다 위쪽에 발이 있는 캐릭터 위로 같은 배경의 해당 영역을 다시 그립니다.
- `spawn`, `enemySpawns`: 방에 들어올 때의 위치입니다.

새 방을 추가할 때는 배경을 같은 크기로 넣고 `maps.json`에 방 ID로 항목을 추가합니다. 항목이 없는 방은 코드 배경과 사각 전장을 씁니다.

## 아직 없는 것

거점은 `maps.json`의 `villages.court`, 중간 마을은 `villages.market`(야시장, `night-market/background-v2.png`)을 쓰고, 둘 다 걸어 다닐 수 있습니다. 시작 위치, NPC, 출구는 `hub`, `stop-07`에 있고, 주민 명단과 길 지점은 `crowds.village`, `crowds.market`에 있습니다. 막다른 길은 그림 안의 벽과 화단으로 막혀 있고, 수정 프롬프트는 `map-concepts/combat-variants/prompts/close-dead-ends-*.txt`입니다. `props/`의 소품 그림은 지금 쓰지 않으며, 마을에 `props`를 적으면 다시 놓을 수 있습니다. 배경 `background-large.png`는 막다른 길을 그림에서 막은 `background-wide-v3.png`(1536×1024)를 문과 주민 크기에 맞춰 1.25배 확대한 1920×1280, 48×32칸입니다. `mask-large.png`, `mask-v2.png`는 그림에서 바닥이 아닌 픽셀을 표시한 마스크로, `scripts/build-village-foreground.mjs`가 만듭니다. `src/render/depth-mask.js`가 세로줄마다 땅에 닿는 위치를 계산해, 캐릭터보다 앞에 있는 픽셀만 원본 그림에서 몸 위에 다시 그립니다. 아치와 전선처럼 땅에서 뜬 물체는 `overhead`에 실제 지면 위치를 적습니다. 그림을 바꾸면 `villages`의 `size`, 걷는 영역, 충돌, `overhead`와 `crowds`를 맞춘 뒤 마스크를 다시 만듭니다. 

그림의 출구까지 걸어가도 다음 방으로 넘어가지 않습니다. 전투가 끝나면 보상을 고른 뒤 다음 방으로 이동합니다. 마을에서는 걸어 다니지 않고 안내 화면으로 넘어갑니다. 방 시안 중 `first-step B`, `ribbon-alley B`, `workshop-road B`, `parade-approach A/B`는 혼합 지도에 없어서 연결하지 않았습니다.
