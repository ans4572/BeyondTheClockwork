# Codex 작업: 3장 10 조율실·11 무너진 탑 꼭대기, 오른쪽 계단을 '아래에서 올라오는 계단통'으로 다시 그리기 (2026-11-21)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다.

- 그림만 고칩니다.
- 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`, `src/data/maps.json`)와 기존 그림 파일은 건드리지 않습니다. 새 이름으로만 저장합니다.
- 커밋·푸시도 하지 않습니다.
- 게임 연결, 이동 범위, 깊이 마스크, 시작 위치, 해방 컷신 그림 교체는 Claude가 합니다.

## 왜 바꾸나

- **9 종루:** F2는 오른쪽 계단을 **올라가서** 다음 방으로 나갑니다(`09-belfry/background-v2-1x.png`, 오른쪽 위로 올라가는 계단).
- **10 조율실:** 오른쪽에 **같은 방향으로 올라가는 계단**이 또 있고, F2가 그 계단 끝에서 시작합니다.
- **결과:** 위층에 올라왔는데 계단을 **내려오며** 등장하는 것처럼 보입니다. 사용자 평: "시작도 오른쪽 계단을 내려가는 느낌이라 어색하다."
- **고칠 방향:** 10의 오른쪽 계단을 **바닥에 뚫린 계단통**으로 바꿉니다. 계단은 아래층(종루)으로 내려가고, F2는 그 입구에서 아래층으로부터 막 올라온 모습이 됩니다.
- **11도 함께:** 11은 10이 무너진 뒤의 같은 자리입니다. 10의 붕괴 장면 그림 두 장도 같은 자리를 보여 줍니다. 그래서 아래 **네 장 모두** 같은 계단통으로 바꿉니다.

## 고칠 그림 네 장

모두 게임 크기 1728×1152입니다(1칸 40px). 2배 원본은 3456×2304입니다.

| # | 장면 | 1배 원본 (편집 대상) | 2배 원본 | 새 이름 (1배 / 2배 / 게임용) |
| --- | --- | --- | --- | --- |
| A | 10 조율실 (평소) | `10-tuning-chamber/background-v2-1x.png` | `background-v2x.png` | `background-v3-1x.png` / `background-v3x.png` / `background-v3-2x-q85.webp` |
| B | 10 붕괴 1 (금 감) | `10-tuning-chamber/collapse-1-cracking-v1-1x.png` | `collapse-1-cracking-v2x.png` | `collapse-1-cracking-v3-1x.png` / `collapse-1-cracking-v3x.png` / `collapse-1-cracking-v3-2x-q85.webp` |
| C | 10 붕괴 2 (뚫림) | `10-tuning-chamber/collapse-2-open-v2-1x.png` | `collapse-2-open-v2x.png` | `collapse-2-open-v3-1x.png` / `collapse-2-open-v3x.png` / `collapse-2-open-v3-2x-q85.webp` |
| D | 11 무너진 탑 꼭대기 | `11-ruined-summit/background-v5-1x.png` | `background-v5x.png` | `background-v6-1x.png` / `background-v6x.png` / `background-v6-2x-q85.webp` |

(폴더는 모두 `art/chapters/3-clock-tower/maps/` 아래.) 같은 이름의 파일이 이미 있으면 덮어쓰지 말고 `-2`처럼 새 이름으로 저장합니다.

## 고칠 곳과 그대로 둘 곳 (게임 크기 기준 px)

| 구역 | 할 일 |
| --- | --- |
| 오른쪽 계단 구역: 대략 x 1430~1728, y 330~790 | 올라가는 계단·난간·기둥 머리를 지우고 **계단통**을 그린다. 아래 '계단통 모양' 참고. |
| 그 밖의 모든 곳 | **픽셀 하나도 바꾸지 않는다.** 바닥, 금빛 시계판(원·눈금·꽃 마름모), 뒤쪽 조율 장치와 큰 시계, 왼쪽·위쪽 작업대, 오른쪽 위 작업대(돋보기·도구 선반), 아래쪽 진열장, 등불, 화분, 벽. D는 하늘·구름·섬, 떨어진 종, 부서진 기둥과 붉은 천도 그대로. |

### 계단통 모양

- **위치:** 지금 계단이 있던 자리. 바닥에 직사각형에 가까운 구멍을 냅니다(대략 x 1470~1728, y 430~760).
- **입구 방향:** 구멍의 **왼쪽(서쪽) 변이 입구**입니다. 그곳에서 맨 윗단이 바닥 높이로 방 바닥과 맞닿습니다. F2가 여기서 나와 왼쪽(방 가운데)으로 걸어갑니다.
- **계단 방향:** 계단은 입구에서 **오른쪽 안쪽으로 내려갑니다**. 아래로 갈수록 단이 바닥보다 낮아지고 어두워집니다. 아래층에서 따뜻한 빛이 조금 올라옵니다.
  - 지금 계단처럼 위로 쌓아 올린 모양이 아니라, 바닥을 파고 내려간 모양이어야 합니다.
- **난간:** 구멍의 뒤(북)·오른쪽(동)·앞(남) 세 변에 낮은 대리석 난간과 놋쇠 갓을 두릅니다. 입구(서쪽 변)는 비웁니다.
  - 입구 양쪽 모서리에는 지금 계단의 둥근 놋쇠 공 기둥 머리를 하나씩 둡니다.
- **재질:** 지금 계단과 같은 분홍 대리석, 같은 놋쇠, 같은 아침 빛과 화풍. 바닥 타일은 구멍 가장자리까지 이어집니다.
- **장면별 상태:**
  - A: 멀쩡함.
  - B: 난간에 실금 몇 줄, 맨 윗단에 작은 금.
  - C·D: 난간이 군데군데 부서져 돌 조각이 됨, 단 모서리가 깨짐. 그래도 아래로 내려가는 계단통인 것은 분명히 보여야 함. D는 탑 바깥 하늘이 오른쪽 끝에 보이는 지금 구도를 유지.
- **네 장 맞추기:** 구멍의 자리·크기·입구 방향은 네 장 모두 같아야 합니다(겹쳐 봤을 때 윤곽 차이 6px 이내). **A를 먼저 만들고**, B·C·D는 A를 참고 이미지로 함께 넣어 같은 모양으로 맞춥니다.

### 게임 쪽 조건

- **나오는 바닥:** x 1290~1470, y 540~760은 걸을 수 있는 깨끗한 바닥이어야 합니다. 난간·기둥·돌 조각을 두지 않습니다. F2가 계단통 입구에서 이 바닥으로 나옵니다.
- **맨 윗단:** 입구의 맨 윗단(대략 x 1470~1530, y 560~700)은 바닥과 같은 높이로 보여야 합니다. 여기가 F2의 시작 자리가 됩니다.
- **오른쪽 위 작업대:** 대략 x 1270~1440, y 330~430은 지금 그대로 둡니다. 계단통 난간이 작업대를 가리지 않게 합니다.

## 순서

1. **A 편집:**
   - 입력 이미지 1: `10-tuning-chamber/background-v2-1x.png`.
   - 아래 '프롬프트 A'를 **그대로** 씁니다(요약·번역·수정 금지).
   - 마스크를 쓸 수 있으면 x 1430~1728, y 330~790만 편집 영역으로 줍니다.
2. **B·C·D 편집:**
   - 입력 이미지 1: 각 원본. 입력 이미지 2: 1단계에서 만든 A(`background-v3-1x.png`).
   - '프롬프트 B·C·D'를 그대로 쓰고, 맨 끝 한 줄만 장면에 맞게 고릅니다.
   - 편집 영역은 A와 같습니다.
3. **합성 (네 장 모두):**
   - 편집 영역 밖은 원본 픽셀을 씁니다. 경계는 8~12px에 걸쳐 섞습니다.
   - 바닥 타일 줄눈이 경계에서 끊기거나 두 겹이 되면 안 됩니다.
   - 저장: 1배 새 이름.
4. **2배 (네 장 모두):**
   - `../upscale-2x-rest-report-20261118.md`의 A01 방식과 `11-ruined-summit/codex-summit-floor.report-20261121.md`의 방식을 그대로 씁니다.
   - 편집한 영역만 다시 만들고, 그 밖은 각 2배 원본 픽셀을 그대로 씁니다.
   - 저장: 2배 새 이름.
5. **게임용:** 2배 그림을 webp(quality 85, method 6)로 저장합니다.

## 프롬프트 A (그대로 사용)

```
Use case: image edit, one region only (inpaint).
Asset type: static production pixel-art game background, Beyond the Clockwork (a cute, toy-like game), chapter 3: the tuning chamber at the top of the Central Clock Tower, morning light. Input image 1 is the picture to edit; keep its camera, framing, perspective, pixel density, palette and rendering exactly.

Change ONLY the right-hand staircase area (the marble stairs climbing toward the upper right, with their balustrade and brass ball posts). Everything else stays exactly as it is.

The problem: the player arrives in this room from the floor below, but the staircase here climbs UP, so the player seems to come down into the room. Replace that climbing staircase with an open stairwell cut down into the floor, the way up from the floor below:
- A near-rectangular opening in the pink marble floor where the stairs were, its long side running front to back along the right of the room.
- Its WEST side (facing the middle of the room) is the mouth: the top step sits flush with the floor there and the floor tiles run right up to it. From the mouth the marble steps go DOWN to the east, each step lower than the floor and a little darker, disappearing below floor level; a soft warm glow rises from the floor below.
- A low pink marble balustrade with brass caps runs along the north, east and south sides of the opening; the west side (the mouth) is open, with one round brass ball post on each corner of the mouth, like the ones on the old staircase.
- Same pink marble, same brass, same morning light and rendering as the rest of the room. The floor tiles around the opening continue cleanly with no broken grout lines.
- The floor just west of the opening stays clear open floor: no balustrade, posts, rubble or props there.

Do not change the marble floor elsewhere, the gold dial ring on the floor, its tick marks and flower medallions, the tuning apparatus and the great clock at the back, the workbenches and tool shelves (keep the bench with the magnifier and tool rack at the upper right fully visible), the glass display cases, lanterns and potted plants at the front, or the walls.
No UI, labels, text, letters, numbers, logos, watermarks, people or characters. Opaque full-bleed PNG, same size as input image 1.
```

## 프롬프트 B·C·D (그대로 사용, 마지막 줄만 장면에 맞게 하나 고름)

```
Use case: image edit, one region only (inpaint), matched to a reference.
Asset type: static production pixel-art game background, Beyond the Clockwork (a cute, toy-like game), chapter 3: the Central Clock Tower's tuning chamber as its top breaks apart. Input image 1 is the picture to edit; keep its camera, framing, perspective, pixel density, palette and rendering exactly. Input image 2 is the same room before it broke, already edited: it shows the open stairwell that must replace the climbing staircase on the right.

Change ONLY the right-hand staircase area. Replace the marble stairs climbing toward the upper right, with their balustrade and brass ball posts, by the stairwell exactly as in input image 2: the same opening cut down into the floor at the same place and size, its mouth on the west side with the top step flush with the floor, the steps going down to the east below floor level with a soft warm glow from below, a low marble balustrade with brass caps on the north, east and south sides, a round brass ball post on each corner of the mouth. The floor just west of the opening stays clear open floor.

Everything else in input image 1 stays exactly as it is: its own cracks, rubble, sky, clouds, island, fallen bell, broken pillars, banners, lanterns and plants. Do not copy anything else from input image 2.
No UI, labels, text, letters, numbers, logos, watermarks, people or characters. Opaque full-bleed PNG, same size as input image 1.
State of the stairwell (B): sound, with a few hairline cracks in the balustrade and a small crack on the top step, matching the cracks elsewhere in this picture.
State of the stairwell (C, D): ruined like the rest of this picture: the balustrade broken in places into chunks of marble lying on the floor, step edges chipped; it must still read clearly as a stairwell going down, and its mouth and the floor west of it stay clear of rubble.
```

## 저장 전 확인 (하나라도 걸리면 다시, 장마다 최대 3번)

- **밖 보존:** 1배 새 그림과 원본의 편집 영역 밖(위 표의 '그 밖') 픽셀 차이가 0이다. 2배도 같은 영역에서 2배 원본과 차이가 0이다.
- **방향:** 계단이 바닥 아래로 내려가는 계단통으로 읽힌다. 위로 올라가는 계단으로 보이면 다시 한다. 확대 그림(계단통 구역 3배)을 남긴다.
- **입구와 나오는 바닥:** 입구(서쪽 변)가 열려 있고, x 1290~1470, y 540~760에 난간·기둥·돌 조각이 없다.
- **작업대:** 오른쪽 위 작업대(x 1270~1440, y 330~430)가 원본과 같다.
- **네 장 일치:** A·B·C·D의 계단통 윤곽(구멍 가장자리와 입구 기둥 두 개)을 겹친 그림을 만든다. 자리 차이가 6px 이내다.
- **줄눈:** 편집 경계 위아래 40px를 4배로 확대한 그림을 세 장 이상 만든다. 바닥 줄눈이 끊기거나 엇갈리거나 두 겹인 곳이 없다.
- **화풍:** 계단통 둘레 바닥의 채도·밝기 평균이 바로 옆 원본 바닥과 ±5 안이다.

## 끝나면 보고

`art/chapters/3-clock-tower/maps/codex-stairwell.report-<날짜>.md`에 다음을 적는다.

- 만든 파일 12개의 경로와 크기.
- 위 확인 항목의 수치와 확대·겹침 그림 경로.
- 장마다 원본과 새 그림의 오른쪽 구역(x 1150~1728, y 250~950)을 나란히 놓은 비교 그림 경로.
- 장마다 시도 횟수, 기준 미달 항목이 있으면 그 내용.
- 계단통 입구 맨 윗단의 가운데 좌표(1배 px). Claude가 시작 위치로 씁니다.
