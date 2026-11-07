# 확장 전투맵 배경 프롬프트

프롬프트를 그대로 붙여 넣고, 표의 참조 그림을 함께 넣어 생성합니다. 결과는 `저장 위치`에 PNG로 저장합니다. 자르기와 게임 연결은 그 뒤에 진행합니다.

| 구간 | 방 | 프롬프트 | 참조 그림 | 저장 위치 | 최종 맵 |
|---|---|---|---|---|---|
| 1 | 첫 걸음 광장 | `01-first-step-plaza/background-large.prompt.txt` | `01-first-step-plaza/background.png` | `01-first-step-plaza/background-large.png` | 38×24 |
| 2 | 사탕 수레마당 | `02-candy-cart-yard/background-large.prompt.txt` | `02-candy-cart-yard/background.png` | `02-candy-cart-yard/background-large.png` | 38×24 |
| 3 | 장난감 수선길 | `03-toy-repair-road/background-large.prompt.txt` | `03-toy-repair-road/background.png` | `03-toy-repair-road/background-large.png` | 46×20 |
| 4 | 리본 교차골목 | `04-ribbon-crossing/background-large.prompt.txt` | `04-ribbon-crossing/background.png` | `04-ribbon-crossing/background-large.png` | 38×25 |
| 5 | 분실물 회수소 | `05-lost-and-found/background-large.prompt.txt` | `03-toy-repair-road/background.png` | `05-lost-and-found/background-large.png` | 34×22 |

맵 1유닛은 40픽셀입니다. 5장 모두 1536×1024로 받아 38.4×25.6유닛으로 게임에 연결했습니다. 표의 최종 맵 크기는 제작 전 계획값입니다. 3구간은 사물이 이미 기존 맵보다 커서 키우지 않고 원본 그대로 썼습니다.

## 야시장 이후 6장

구간이 뒤로 갈수록 해가 져서, 11구간과 브라스 방은 밤입니다. 첫 번째 참조로 아래 표의 그림을, 두 번째 참조로 `06-night-market/background-v2.png`를 넣습니다. 결과는 1536×1024면 됩니다.

| 구간 | 방 | 프롬프트 | 참조 그림 1 | 저장 위치 |
|---|---|---|---|---|
| 07 | 태엽 적재마당 | `07-wind-up-loading-yard/background-large.prompt.txt` | `07-wind-up-loading-yard/background.png` | `07-wind-up-loading-yard/background-large.png` |
| 08 | 분수 우회광장 | `08-fountain-ring/background-large.prompt.txt` | `08-fountain-ring/background.png` | `08-fountain-ring/background-large.png` |
| 09 | 깃발 검문광장 | `09-flag-checkpoint/background-large.prompt.txt` | `09-flag-checkpoint/background.png` | `09-flag-checkpoint/background-large.png` |
| 10 | 사탕색 골목 | `10-sweet-alley/background-large.prompt.txt` | `10-sweet-alley/background.png` | `10-sweet-alley/background-large.png` |
| 11 | 행진 적재뜰 | `11-parade-yard/background-large.prompt.txt` | `11-parade-yard/background.png` | `11-parade-yard/background-large.png` |
| 12 | 멈추지 않는 행진 | `12-march-gate/background-large.prompt.txt` | `11-parade-yard/background.png` | `12-march-gate/background-large.png` |

## 일반 전투 방 축소판 (2026-11-04)

보스 방 2곳처럼 일반 방 9곳도 좁히고, 월드맵 웃음거리 길(크림색 길, 분홍 광장, 줄무늬 차양 가게, 웃는 깃발, 섬 가장자리 절벽)에 맞춥니다. 입구는 모두 왼쪽, 출구는 오른쪽입니다(지도에서 길이 왼쪽에서 오른쪽으로 이어지므로). 싸우는 바닥은 그림의 가로 66% × 세로 55%쯤으로, 보스 방(60% × 55%)보다 조금 넓습니다.

참조 그림 1은 표의 지금 그림, 참조 그림 2는 `art/world-map/smile-street-road-reference.png`(월드맵의 웃음거리 길 부분)입니다. 결과는 표의 저장 위치에 PNG로 저장합니다. 받으면 webp 변환, 걷는 영역 마스크, 시작·출구·적 위치를 새 그림에 맞춥니다.

| 구간 | 방 | 프롬프트 | 참조 그림 1 | 저장 위치 |
|---|---|---|---|---|
| 02 | 첫 걸음 광장 | `01-first-step-plaza/background-compact.prompt.txt` | `01-first-step-plaza/background-large.webp` | `01-first-step-plaza/background-compact-v1.png` |
| 03 | 사탕 수레마당 | `02-candy-cart-yard/background-compact.prompt.txt` | `02-candy-cart-yard/background-large.webp` | `02-candy-cart-yard/background-compact-v1.png` |
| 04 | 장난감 수선길 | `03-toy-repair-road/background-compact.prompt.txt` | `03-toy-repair-road/background-large.webp` | `03-toy-repair-road/background-compact-v1.png` |
| 05 | 리본 교차골목 | `04-ribbon-crossing/background-compact.prompt.txt` | `04-ribbon-crossing/background-large.webp` | `04-ribbon-crossing/background-compact-v1.png` |
| 08 | 태엽 적재마당 | `07-wind-up-loading-yard/background-compact.prompt.txt` | `07-wind-up-loading-yard/background-large.webp` | `07-wind-up-loading-yard/background-compact-v1.png` |
| 09 | 분수 우회광장 | `08-fountain-ring/background-compact.prompt.txt` | `08-fountain-ring/background-large.webp` | `08-fountain-ring/background-compact-v1.png` |
| 10 | 깃발 검문광장 | `09-flag-checkpoint/background-compact.prompt.txt` | `09-flag-checkpoint/background-large.webp` | `09-flag-checkpoint/background-compact-v1.png` |
| 11 | 사탕색 골목 | `10-sweet-alley/background-compact.prompt.txt` | `10-sweet-alley/background-large.webp` | `10-sweet-alley/background-compact-v1.png` |
| 12 | 행진 적재뜰 | `11-parade-yard/background-compact.prompt.txt` | `11-parade-yard/background-large.webp` | `11-parade-yard/background-compact-v1.png` |

## 일반 전투 방 두 번째 맵 (2026-11-05)

보스 방을 뺀 일반 전투 방 9곳에 맵을 한 장씩 더 만듭니다. 원정마다 각 정거장에서 두 맵 중 하나가 나옵니다. 같은 동네·같은 시간대의 빛은 지키고, 배치·소품·출구 위치는 기존 방과 다르게 합니다.

참조 그림 1은 표의 기존 방 그림, 참조 그림 2는 `art/world-map/smile-street-road-reference.png`입니다. 결과는 2304×1536 PNG로 표의 저장 위치에 저장합니다. 받으면 webp 변환, 걷는 영역 마스크, 시작·출구·적 위치를 맞추고 `slice.json`의 방 variants로 연결합니다.

| 구간 | 방 | 프롬프트 | 참조 그림 1 | 저장 위치 | 입구 → 출구 |
|---|---|---|---|---|---|
| 02 | 첫 걸음 광장 B | `01-first-step-plaza-b/background-compact.prompt.txt` | `01-first-step-plaza/background-compact-v1.png` | `01-first-step-plaza-b/background-compact-v1.png` | 왼쪽 아래 → 오른쪽 가운데 |
| 03 | 사탕 수레마당 B | `02-candy-cart-yard-b/background-compact.prompt.txt` | `02-candy-cart-yard/background-compact-v2.png` | `02-candy-cart-yard-b/background-compact-v1.png` | 왼쪽 위 → 오른쪽 아래 |
| 04 | 장난감 수선길 B | `03-toy-repair-road-b/background-compact.prompt.txt` | `03-toy-repair-road/background-compact-v1.png` | `03-toy-repair-road-b/background-compact-v1.png` | 왼쪽 가운데 → 오른쪽 위 |
| 05 | 리본 교차골목 B | `04-ribbon-crossing-b/background-compact.prompt.txt` | `04-ribbon-crossing/background-compact-v1.png` | `04-ribbon-crossing-b/background-compact-v1.png` | 왼쪽 위 → 오른쪽 아래 |
| 08 | 태엽 적재마당 B | `07-wind-up-loading-yard-b/background-compact.prompt.txt` | `07-wind-up-loading-yard/background-compact-v1.png` | `07-wind-up-loading-yard-b/background-compact-v1.png` | 왼쪽 아래 → 오른쪽 가운데 |
| 09 | 분수 우회광장 B | `08-fountain-ring-b/background-compact.prompt.txt` | `08-fountain-ring/background-compact-v1.png` | `08-fountain-ring-b/background-compact-v1.png` | 왼쪽 가운데 → 오른쪽 아래 |
| 10 | 깃발 검문광장 B | `09-flag-checkpoint-b/background-compact.prompt.txt` | `09-flag-checkpoint/background-compact-v1.png` | `09-flag-checkpoint-b/background-compact-v1.png` | 왼쪽 위 → 오른쪽 가운데 |
| 11 | 사탕색 골목 B | `10-sweet-alley-b/background-compact.prompt.txt` | `10-sweet-alley/background-compact-v1.png` | `10-sweet-alley-b/background-compact-v1.png` | 왼쪽 가운데 → 오른쪽 아래 |
| 12 | 행진 적재뜰 B | `11-parade-yard-b/background-compact.prompt.txt` | `11-parade-yard/background-compact-v2.png` | `11-parade-yard-b/background-compact-v1.png` | 왼쪽 아래 → 오른쪽 가운데 |
