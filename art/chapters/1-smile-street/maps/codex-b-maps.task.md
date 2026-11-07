# Codex 작업: 웃음거리 전투 방 B 맵 9장 생성

저장소 루트(`Beyond the Clockwork`) 기준 경로입니다. 이미지 생성만 하고, 코드·데이터(`src/`, `test/`, `worker/`)와 기존 그림은 건드리지 않습니다.

## 할 일

아래 표의 9개 방마다:

1. `프롬프트` 파일 내용을 그대로 이미지 생성 프롬프트로 씁니다(요약·번역·수정 금지).
2. 입력 이미지 1 = `참조 1`, 입력 이미지 2 = `art/world-map/smile-street-road-reference.png` (이 순서 그대로. 프롬프트가 "input image 1/2"로 부릅니다).
3. 결과를 `저장 위치`에 PNG로 저장합니다. 2304×1536이 아니면 비율을 유지해 2304×1536으로 맞춥니다(늘리거나 잘라 비율을 바꾸지 않음).
4. 저장 위치에 파일이 이미 있으면 덮어쓰지 말고 `-v2`, `-v3`처럼 번호를 올려 새 이름으로 저장합니다.

| 구간 | 방 | 프롬프트 | 참조 1 | 저장 위치 |
|---|---|---|---|---|
| 02 | 첫 걸음 광장 B | `art/chapters/1-smile-street/maps/01-first-step-plaza-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/01-first-step-plaza/background-compact-v1.png` | `art/chapters/1-smile-street/maps/01-first-step-plaza-b/background-compact-v1.png` |
| 03 | 사탕 수레마당 B | `art/chapters/1-smile-street/maps/02-candy-cart-yard-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/02-candy-cart-yard/background-compact-v2.png` | `art/chapters/1-smile-street/maps/02-candy-cart-yard-b/background-compact-v1.png` |
| 04 | 장난감 수선길 B | `art/chapters/1-smile-street/maps/03-toy-repair-road-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/03-toy-repair-road/background-compact-v1.png` | `art/chapters/1-smile-street/maps/03-toy-repair-road-b/background-compact-v1.png` |
| 05 | 리본 교차골목 B | `art/chapters/1-smile-street/maps/04-ribbon-crossing-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/04-ribbon-crossing/background-compact-v1.png` | `art/chapters/1-smile-street/maps/04-ribbon-crossing-b/background-compact-v1.png` |
| 08 | 태엽 적재마당 B | `art/chapters/1-smile-street/maps/07-wind-up-loading-yard-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/07-wind-up-loading-yard/background-compact-v1.png` | `art/chapters/1-smile-street/maps/07-wind-up-loading-yard-b/background-compact-v1.png` |
| 09 | 분수 우회광장 B | `art/chapters/1-smile-street/maps/08-fountain-ring-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/08-fountain-ring/background-compact-v1.png` | `art/chapters/1-smile-street/maps/08-fountain-ring-b/background-compact-v1.png` |
| 10 | 깃발 검문광장 B | `art/chapters/1-smile-street/maps/09-flag-checkpoint-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/09-flag-checkpoint/background-compact-v1.png` | `art/chapters/1-smile-street/maps/09-flag-checkpoint-b/background-compact-v1.png` |
| 11 | 사탕색 골목 B | `art/chapters/1-smile-street/maps/10-sweet-alley-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/10-sweet-alley/background-compact-v1.png` | `art/chapters/1-smile-street/maps/10-sweet-alley-b/background-compact-v1.png` |
| 12 | 행진 적재뜰 B | `art/chapters/1-smile-street/maps/11-parade-yard-b/background-compact.prompt.txt` | `art/chapters/1-smile-street/maps/11-parade-yard/background-compact-v2.png` | `art/chapters/1-smile-street/maps/11-parade-yard-b/background-compact-v1.png` |

## 저장 전 확인 (한 장씩)

결과가 아래에 하나라도 걸리면 같은 프롬프트로 다시 생성합니다(최대 3번, 그래도 안 되면 가장 나은 것을 저장하고 보고).

- 참조 1과 같은 화풍·카메라 각도·물체 크기이고, 시간대 빛(낮/늦은 오후/해질녘/밤)이 참조 1과 같다.
- 참조 1의 배치를 그대로 베끼지 않았다(프롬프트의 LAYOUT대로 다른 방이다).
- 출구가 정확히 2개: 왼쪽 가장자리 하나, 오른쪽 가장자리 하나. 위·아래로 열린 길이 없다.
- 가운데 싸우는 바닥이 넓고 비어 있다(작은 소품이 흩어져 있지 않음).
- 사람·장난감 주민·캐릭터·글자·숫자·UI가 없다.

## 끝나면 보고

1. 저장한 파일 경로 9개와 각 크기(픽셀).
2. 다시 생성한 방과 이유, 3번 안에 기준을 못 맞춘 방.
3. 커밋·푸시는 하지 않습니다.
