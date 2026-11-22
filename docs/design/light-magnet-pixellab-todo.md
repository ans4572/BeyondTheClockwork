# 빛·자력 — PixelLab으로 만들 것 (할 일 목록, 2026-11-21)

**방향 (2026-11-21 정함):** 이펙트(기술 4 · 융합 13 · 바닥 범위 고리 · 굳힘·드러냄 반짝임)는 pixelfx로 만들고, PixelLab은 아래 **아이콘 21개만** 쓴다. 기획은 `light-magnet-concepts.md`, 수치는 `clockwork-design.v1.json`.

**완료 (2026-11-21).** 21개 모두 PixelLab으로 만들어 게임에 연결했다(28장·140회, 후보는 `art/icon-concepts/light-magnet-pixellab/`). 고른 것: 빛 렌즈 a, 자력은 장갑 대신 코일 전자석(c), 프리즘 광선 b, 끌어올리기 b, 나머지 a. 아래는 기록으로 남긴 원래 목록이다.

**어림:** 약 135회 + 다시 뽑기 여유 15~35회 = **약 150~170회**. Pro Flash 48px 이하는 1장에 5회.

## 만드는 법 (소리·물 때와 같게)

- 코드로 그린 임시 아이콘은 지웠고, PixelLab 그림은 **새 이름**(`-v1`)으로 연결했다: 기술·융합은 `src/ui/tool-icons.js` `FILES`(예: `'skill-prismBeam': 'skill-prismBeam-v1'`), 속성·상태 아이콘은 파일 이름을 바꾸고 `src/main.js` `UI_ICONS`, `src/render/canvas.js` `STATUS_ICONS`를 고친다(같은 경로로 덮으면 브라우저가 옛 그림을 붙잡아 둠).

- `create_image_pro_flash`, 투명 배경, 아래 '화풍 기준' 그림을 `style_image`로.
- 다시 그린 그림은 새 파일 이름으로(브라우저가 같은 경로 그림을 붙잡아 둠).
- 색: 빛은 흰 빛 + 프리즘 가장자리 무지개(오르덴의 청록·금빛, 포탈의 노란 표시와 갈라야 함). 자력은 구리 코일 + 은청 자기장선(로코 자석 구역의 **빨간 말굽자석은 쓰지 않음**, 소리의 놋쇠 주황과 갈라야 함).
- 만든 뒤 게임 연결: 속성 아이콘은 `src/main.js` `UI_ICONS`, 상태 아이콘은 `scripts/build-status-icons.mjs` `ICONS`와 `src/render/canvas.js` `STATUS_ICONS`, 기술·융합 아이콘은 이름만 맞으면 `skillIcon(id)`가 찾음.

## 1. 속성 아이콘 2개 — 후보 2장씩 (20회)

32px, `art/ui/element-icons/<id>.png`. 화풍 기준: `art/ui/element-icons/sound.png`(공명 장갑), `water.png`(소방 호스).

| id | 그림 |
| --- | --- |
| `light` | 놋쇠 테두리의 프리즘 렌즈. 가장자리로 무지개가 살짝 갈라짐 |
| `magnet` | 구리 코일을 감은 전자석 장갑. 손바닥 쪽 은청 자기장선 두세 줄 |

## 2. 기술 아이콘 4개 — 후보 2장씩 (40회)

48px, `art/ui/icons/px/skill-<id>.png`. 화풍 기준: `skill-ringPalm.png`, `skill-frostBolt.png`.

| id | 이름 | 그림 |
| --- | --- | --- |
| `prismBeam` | 프리즘 광선 | 작은 프리즘에서 한 줄로 뻗는 흰 광선, 가장자리 무지개 |
| `flashBomb` | 섬광탄 | 던져진 작은 섬광 깡통이 하얗게 터지는 순간 |
| `scrapShot` | 고철 산탄 | 장갑 앞에서 부채꼴로 흩어지는 쇳조각 다섯 개 |
| `magneticLift` | 끌어올리기 | 바닥 원 위로 떠오른 쇳조각 무더기, 아래로 향한 화살 느낌 |

## 3. 융합 아이콘 13개 — 1장씩 (65회)

48px, `art/ui/icons/px/skill-<id>.png`. 화풍 기준: `skill-steamShatter.png`(소리·물 융합 아이콘과 같음).

| id | 이름 | 그림 |
| --- | --- | --- |
| `noonMark` | 한낮 표적 (빛 + 불) | 작은 해 아래로 떨어지는 열빛 기둥 |
| `frostPrism` | 서리 프리즘 (빛 + 얼음) | 얼음 수정 프리즘에서 세 갈래로 갈라지는 광선 |
| `refractBeam` | 굴절 광선 (빛 + 전기) | 한 점에 꽂힌 광선이 꺾여 나가는 번개빛 줄기 |
| `lightDash` | 빛살 질주 (빛 + 바람) | 바람 자국을 끌며 미끄러지는 빛 띠 |
| `lightConstellation` | 공명 별자리 (빛 + 소리) | 빛 줄로 이어진 별 다섯 개, 줄 위 작은 음파 |
| `rainbowBridge` | 무지개 다리 (빛 + 물) | 무지개 호 끝으로 떨어지는 물방울 |
| `moltenBall` | 쇳물 공 (자력 + 불) | 구리 테두리의 달군 쇠공과 튀는 쇳물 |
| `frostShards` | 서리 쇳조각 (자력 + 얼음) | 원을 그리며 도는 얼음 입힌 쇳조각 여섯 개 |
| `railCannon` | 전자 레일포 (자력 + 전기) | 구리 코일 사이로 뻗는 쇠막대와 번개 |
| `scrapSaw` | 고철 회전톱 (자력 + 바람) | 바람에 실려 도는 고철 톱날 |
| `ironString` | 울리는 쇠줄 (자력 + 소리) | 팽팽한 쇠줄 한 가닥이 떨리고 양 끝에 구리 고정쇠, 줄 둘레 음파 |
| `ferroVine` | 자성 유체 덩굴 (자력 + 물) | 검은 자성 유체가 가시처럼 솟는 모양, 은청 광택 |
| `auroraRing` | 북극광 고리 (빛 + 자력) | 초록·보라 오로라 고리와 아래로 내려오는 빛 커튼 |

## 4. 상태 아이콘 2개 — 1장씩 (10회)

원본 `art/status-icon-concepts/c-<name>.png`을 만든 뒤 `node scripts/build-status-icons.mjs`로 24px(`art/ui/status-icons/<id>.png`, 잉크 테두리). 화풍 기준: `art/status-icon-concepts/c-chill.png`.

| id | 원본 이름 | 그림 |
| --- | --- | --- |
| `reveal` | `c-reveal` | 흰 네 갈래 별에 무지개 가장자리(약점이 드러남) |
| `ironDust` | `c-iron-dust` | 작은 쇳가루 더미와 은청 자기장선 |

## 5. 이펙트 11개 — 완료 (2026-11-21, 94회)

사용자가 상태 페이지(`docs/design/light-magnet-status`)에서 고른 11개를 PixelLab으로 바꿨다: 프리즘 광선, 섬광탄, 고철 산탄, 끌어올리기, 굴절 광선, 빛살 질주, 공명 별자리, 서리 쇳조각, 전자 레일포, 고철 회전톱, 울리는 쇠줄. 시트 `art/fx/lm-*-pl-v1.png`, 묶기 `scripts/build-light-magnet-fx.py`, 작업 번호 `docs/design/light-magnet-fx-jobs.json`. 나머지 6개(한낮 표적·서리 프리즘·쇳물 공·자성 유체 덩굴·북극광 고리·굳힘)는 pixelfx, 무지개 다리는 코드 그대로.

## PixelLab이 필요 없는 것 (pixelfx 또는 코드)

이펙트 17개, 바닥 범위 고리 2개, 굳힘·드러냄 반짝임, 모루 선반의 '???' 칸 열기(속성 아이콘을 씀), 개조·특성 카드(기술·속성 아이콘을 씀). F2 몸 그림은 새로 만들지 않는다(공용 시전 동작).
