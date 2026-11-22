# Codex 작업: 전투 맵 17장을 같은 배치 그대로 2배 해상도로 다시 그리기

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 이미지 생성과 이어 붙이기만 합니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`)와 기존 그림 파일은 건드리지 않고, 커밋·푸시도 하지 않습니다.

마을 배경(`art/chapters/1-smile-street/maps/00-village-court/`)을 같은 방식으로 이미 성공했습니다. 그때 만든 작업 지시서 `upscale-2x.task.md`, 프롬프트 `upscale-work/prompt.txt`, 이어 붙이기 스크립트 `upscale-work/stitch.py`를 먼저 읽고 그대로 이어 씁니다. 스크립트는 그림 크기에 맞게 일반화합니다.

## 목표

- 게임은 각 그림 위에 걸을 수 있는 영역, 벽, 마스크, 몹·출구 위치를 원본 좌표 그대로 얹습니다. 따라서 **모든 물체의 위치·크기·윤곽·개수가 원본과 같아야 합니다.** 새로 그리는 것은 디테일뿐입니다(아래 표의 '고칠 점'만 예외).
- 결과는 원본의 **정확히 2배 크기** PNG입니다.

## 대상 (이 순서로 진행)

입력은 게임이 지금 쓰는 그림(표의 '원본')입니다. 결과는 같은 폴더에 `background-v2x.png`로 저장합니다. 이미 있으면 덮어쓰지 말고 `background-v2x-2.png`처럼 번호를 붙입니다.

### 1순위: 결함이 있는 맵

| 맵 | 원본 | 크기 → 결과 | 고칠 점 |
|---|---|---|---|
| craneYard | `art/chapters/2-silent-factory/maps/09-crane-yard/background-v4-q92.webp` | 1728×1152 → 3456×2304 | A |
| craneYardB | `art/chapters/2-silent-factory/maps/09-crane-yard-b/background-v3-q92.webp` | 1728×1152 → 3456×2304 | A |
| erasingLine | `art/chapters/2-silent-factory/maps/08-erasing-line/background-v4-q92.webp` | 1024×1536 → 2048×3072 | B |
| erasingLineB | `art/chapters/2-silent-factory/maps/08-erasing-line-b/background-v3-q92.webp` | 1024×1536 → 2048×3072 | B |
| firstStep | `art/chapters/1-smile-street/maps/01-first-step-plaza/background-q92.webp` | 1536×1024 → 3072×2048 | C |
| firstStepB | `art/chapters/1-smile-street/maps/01-first-step-plaza-b/background-q92.webp` | 1536×1024 → 3072×2048 | C |
| market | `art/chapters/1-smile-street/maps/06-night-market/background-q92.webp` | 1536×1024 → 3072×2048 | C |

### 2순위: 1장 본 방 (원정마다 지나감)

모두 1536×1024 → 3072×2048, 고칠 점 없음.

| 맵 | 원본 |
|---|---|
| candyYard | `art/chapters/1-smile-street/maps/02-candy-cart-yard/background-q92.webp` |
| repairRoad | `art/chapters/1-smile-street/maps/03-toy-repair-road/background-q92.webp` |
| ribbonCross | `art/chapters/1-smile-street/maps/04-ribbon-crossing/background-q92.webp` |
| lostFound | `art/chapters/1-smile-street/maps/05-lost-and-found/background-q92.webp` |
| loadingYard | `art/chapters/1-smile-street/maps/07-wind-up-loading-yard/background-q92.webp` |
| fountainRing | `art/chapters/1-smile-street/maps/08-fountain-ring/background-q92.webp` |
| checkpoint | `art/chapters/1-smile-street/maps/09-flag-checkpoint/background-q92.webp` |
| sweetAlley | `art/chapters/1-smile-street/maps/10-sweet-alley/background-q92.webp` |
| paradeYard | `art/chapters/1-smile-street/maps/11-parade-yard/background-q92.webp` |
| marchGround | `art/chapters/1-smile-street/maps/12-march-gate/background-q92.webp` |

튜토리얼 맵(`00-scrapyard`)은 이번 작업에서 뺍니다.

### 고칠 점 (프롬프트 끝에 해당 문단을 덧붙임)

- **A (크레인 적재장):**
  ```
  FLOOR FIX: the open floor is smeared with blurry diagonal light and shadow streaks. Keep the streaks in the same places with the same colours, but draw them as clean, soft-edged light shapes over a crisply drawn concrete floor with visible slab joints and small wear marks. No smudging, no blur.
  ```
- **B (지우개 라인):**
  ```
  FLOOR FIX: the central walkway is an almost flat lavender with blotchy swirl noise. Keep the same lavender colour and the same walkway outline, but replace the swirl noise with clean, subtle floor panels whose joint lines follow the walkway border, with faint even texture. No swirls, no blotches.
  ```
- **C (하늘이 비치는 모서리):** 아래 가장자리 모서리 하나에 연한 하늘색 배경이 비칩니다(그 맵의 다른 모서리는 절벽·톱니·꽃으로 채워져 있음). 네 모서리를 보고 하늘색이 보이는 곳에만 아래 문단을 씁니다. 이 모서리는 배치 확인에서 뺍니다(걸을 수 있는 바닥 밖입니다).
  ```
  CORNER FIX: the light-blue sky showing in the bottom corner is a mistake. Fill that corner with the floating island's rocky cliff, brass gears and pink flower bushes, continuing the island edge exactly as it looks along the rest of the bottom border. Change nothing else.
  ```

## 맵마다 순서

1. 작업 폴더 `<맵 폴더>/upscale-work/`를 만듭니다. 조각과 중간 파일은 모두 여기에 둡니다(git에서 이미 빠져 있음).
2. 원본을 3×3 조각으로 자릅니다. 원본 크기가 W×H이면:
   - 조각 크기: `round(0.4W) × round(0.4H)`
   - 시작 x: `0`, `round(0.3W)`, `W − 조각 너비` / 시작 y: `0`, `round(0.3H)`, `H − 조각 높이`
3. 조각마다 그 조각만 입력 이미지로 넣고, 마을 때 프롬프트(`upscale-work/prompt.txt`)에 그 맵의 '고칠 점' 문단을 덧붙여 생성합니다. 고칠 점 C는 하늘이 보이는 조각에만 붙입니다.
   - 이미지 도구는 조각 비율에 가장 가까운 크기로 그리게 하고, 결과를 Lanczos로 **정확히 조각 크기의 2배**에 맞춥니다.
4. 2배 좌표에 놓고, 겹치는 띠를 선형 페더로 섞어 한 장으로 합칩니다. 조각끼리 색감이 다르면, 섞기 전에 원본 같은 영역을 2배로 키운 것에 채널별 평균·표준편차를 맞춥니다(마을 때와 같음).
5. 아래 확인을 통과하면 `background-v2x.png`로 저장합니다.
6. `upscale-work/compare.png`를 만듭니다. 원본(픽셀 그대로 2배)과 결과를 나란히 놓은 비교 그림이고, 바닥 한 곳, 물체가 많은 곳 한 곳, 고칠 점이 있으면 그 부분 한 곳을 넣습니다.

## 저장 전 확인

하나라도 걸리면 그 조각을 다시 생성합니다. 같은 조각은 최대 3번까지 시도하고, 그래도 안 되면 가장 나은 것을 쓰고 보고합니다.

- **배치(가장 중요, 숫자):** 결과를 원본 크기로 줄여(Lanczos) 원본과 비교합니다.
  - 두 그림을 각각 회색조로 바꾸고 윤곽(FIND_EDGES)을 구합니다.
  - 320×320 칸마다 결과 윤곽을 ±8px(2px 간격) 밀어 보면서 원본 윤곽과의 상관이 가장 큰 이동량을 찾습니다.
  - **모든 칸에서 이동량이 (0, 0)** 이어야 합니다. 고칠 점 C의 모서리 칸은 뺍니다.
  - 마을 결과는 24칸 모두 (0, 0)이었습니다.
- **전체 차이(숫자):** RGB 평균 절대차 30 이하. 마을 결과는 23이었고, 디테일을 새로 그리면 이 정도 차이는 정상입니다. 고칠 점 A·B의 바닥 칸은 이 계산에서 뺍니다.
- **색감(숫자):** HSV 평균 채도와 평균 밝기가 각각 원본과 ±5(0~255 기준) 이내.
- **흰 면적(1장 맵만, 숫자):** R·G·B가 모두 235 이상인 픽셀 비율이 원본과 0.5%p 이내. 꽃이 부풀어 서로 붙으면 이 값이 커집니다.
- **눈으로:**
  - 조각 경계에서 선이 끊기거나, 물체가 두 번 그려지거나, 색 띠가 생기지 않았다.
  - 걸을 수 있는 바닥 위에 새 물체가 생기지 않았다.
  - 글자·숫자·사람·캐릭터가 없다(원래 있던 간판 무늬는 그대로).
  - 흐릿하지 않다.

## 끝나면 보고

맵마다 한 줄씩:

1. 결과 경로와 크기(픽셀).
2. 배치: 칸 수와 (0, 0)이 아닌 칸(있으면 위치).
3. 전체 평균 절대차, 채도·밝기 차, 흰 면적(원본 % / 결과 %).
4. 다시 생성한 조각과 이유, 3번 안에 기준을 못 맞춘 조각.
5. `compare.png` 경로.

마지막에 기준을 못 맞춘 맵만 따로 모아 적습니다. 커밋·푸시는 하지 않습니다.
