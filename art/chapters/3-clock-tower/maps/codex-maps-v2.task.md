# Codex 작업: 3장 중앙시계탑 방 그림 6장 다시 생성 (2차)

저장소 루트(`Beyond the Clockwork`) 기준 경로입니다. 이미지 생성만 하고, 코드·데이터와 기존 그림(1차 `background-v1.png` 포함)은 건드리지 않습니다. 커밋·푸시는 하지 않습니다.

## 왜 다시 만드나 (1차 검토 결과)

- 01·03·05·07·08: 방이 하늘에 뜬 둥근 원판처럼 그려짐(아래 모서리에 하늘, 앞쪽 둥근 난간과 바위·톱니 받침). 탑 **안의 한 층**으로 보여야 함. 여러 방의 앞쪽(난간 + 가운데 톱니 아치)이 똑같음.
- 07: 왼쪽 창 너머가 거리 높이의 마을·정원(2층인데 1층처럼 보임).
- 04: 전투 바닥이 가로 2 : 세로 1. 화면에서 정사각형이어야 함(틱·톡 패턴이 가로·세로를 똑같이 씀).
- 층 높이 단서: 방마다 창밖 풍경으로 몇 층인지 보이게 함(HEIGHT CUE).

## 입력 이미지

- 입력 이미지 1 = `art/chapters/1-smile-street/maps/01-first-step-plaza/background-compact-v1.png`
- 입력 이미지 2 = `art/scenes/clocktower-summit/background-v2.png`
- 입력 이미지 3 = 이번에 새로 만든 01 `art/chapters/3-clock-tower/maps/01-tower-gate/background-v2.png` (03·04·05·07·08만)

## 할 일

1. **01을 먼저** 만들고 아래 확인을 통과시킵니다. 나머지는 새 01을 입력 이미지 3으로 씁니다.
2. 프롬프트 파일 내용을 그대로 씁니다(요약·번역·수정 금지). 결과는 생성된 크기 그대로 저장, 이미 있으면 `-v3`처럼 새 이름.

| # | 방 | 프롬프트 | 입력 | 출력 크기 | 저장 위치 |
|---|---|---|---|---|---|
| 01 | 시계탑 정문 | `art/chapters/3-clock-tower/maps/01-tower-gate/background-v2.prompt.txt` | 1·2 | 1536x1024 | `art/chapters/3-clock-tower/maps/01-tower-gate/background-v2.png` |
| 03 | 초침 회랑 | `art/chapters/3-clock-tower/maps/03-second-hand-gallery/background-v2.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/03-second-hand-gallery/background-v2.png` |
| 04 | 계단 기관실 | `art/chapters/3-clock-tower/maps/04-stair-engine-room/background-v2.prompt.txt` | 1·2·3 | 1024x1024 | `art/chapters/3-clock-tower/maps/04-stair-engine-room/background-v2.png` |
| 05 | 멈춘 시계 다락 | `art/chapters/3-clock-tower/maps/05-stopped-clock-attic/background-v2.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/05-stopped-clock-attic/background-v2.png` |
| 07 | 신호 구체 저장실 | `art/chapters/3-clock-tower/maps/07-signal-orb-vault/background-v2.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/07-signal-orb-vault/background-v2.png` |
| 08 | 종루 아래 배선실 | `art/chapters/3-clock-tower/maps/08-belfry-wiring-room/background-v2.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/08-belfry-wiring-room/background-v2.png` |

## 저장 전 확인 (한 장씩, 최대 3번)

- 그림 가장자리와 네 모서리에 하늘·구름·빈 공간이 없다. 방 아래에 바위나 톱니 받침이 보이지 않는다(탑 안의 한 층).
- 앞쪽(아래 가장자리)이 그 방의 FOREGROUND 소품이다. 둥근 난간 + 가운데 톱니 아치가 아니다.
- HEIGHT CUE의 창밖 풍경이 보인다: 01 거리 높이, 03 가까운 지붕 바로 아래, 05 지붕들이 멀리 아래, 07 위에서 내려다본 마을(창이며 문이 아님), 08 창 높이의 구름과 아주 작은 마을.
- 04: 금색 테두리 바닥이 화면에서 가로 = 세로(픽셀로 재서 차이 10% 이내).
- 출구 위치가 EXITS와 같고, 숫자·글자·인물·UI가 없다.

## 끝나면 보고

1. 저장한 파일 경로와 크기. 2. 다시 생성한 방과 이유. 3. 04의 바닥 가로·세로 픽셀.
