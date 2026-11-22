# Codex 작업: 3장 09 종루·10 조율실 다시 생성 + 10 붕괴 연출 그림 2장 (3차)

저장소 루트(`Beyond the Clockwork`) 기준 경로입니다. 이미지 생성만 하고, 코드·데이터와 기존 그림(`background-v1.png` 등)은 건드리지 않습니다. 커밋·푸시는 하지 않습니다.

## 왜 다시 만드나 (2026-11-16 검토)

- **09 종루:** 08(바로 아래층)보다 높은데 아치 너머 마을이 더 크고 가깝게 보임. 마을 안에 시계탑이 하나 더 있음(지금 그 시계탑 안에 있음). 바닥 아래로 돌 기초와 톱니 받침이 보여 공중에 뜬 판처럼 보임.
- **10 조율실:** 탑 안의 한 층(4층)인데 공중에 뜬 둥근 판처럼 그려짐(아래 돌 기초·톱니 받침, 앞쪽 둥근 난간 + 가운데 톱니 아치). 창밖 높이 단서가 없음.
- **10 → 11 붕괴 연출 (새로 추가):** 오르덴 1차를 쓰러뜨리면 조율실에 금이 가고, 벽과 천장이 떨어져 나가며, 그대로 11 무너진 꼭대기로 이어지게 합니다. 게임이 그림 네 장을 차례로 겹쳐 바꿉니다(10 → 금 간 10 → 열리는 10 → 11). 그래서 **네 장의 카메라·바닥 위치·큰 시계 문자판 위치가 같아야** 합니다. 11(`11-ruined-summit/background-v1.png`)은 지금 그대로 쓰고, 10을 11에 맞춥니다.

## 입력 이미지

- A = `art/chapters/1-smile-street/maps/01-first-step-plaza/background-compact-v1.png` (화풍·카메라·물체 크기 기준)
- B = `art/scenes/clocktower-summit/background-v2.png` (시계탑 재료)
- C = `art/chapters/3-clock-tower/maps/01-tower-gate/background-v2.png` (같은 건물 기준)
- D = `art/chapters/3-clock-tower/maps/08-belfry-wiring-room/background-v2.png` (09의 바로 아래층, 높이 비교용)
- E = `art/chapters/3-clock-tower/maps/11-ruined-summit/background-v1.png` (10이 무너진 뒤, 위치 맞춤 기준)
- F = 이번에 만든 10 결과 `10-tuning-chamber/background-v2.png`
- G = 이번에 만든 금 간 10 결과 `10-tuning-chamber/collapse-1-cracking-v1.png`

## 할 일 (순서대로)

프롬프트 파일 내용을 그대로 씁니다(요약·번역·수정 금지). 입력 이미지는 표의 순서대로 넣습니다(프롬프트의 "Input image 1, 2…"가 그 순서). 결과는 생성된 크기 그대로 PNG로 저장하고, 파일이 이미 있으면 덮어쓰지 말고 `-v3`처럼 새 이름으로 저장합니다.

| 순서 | 그림 | 프롬프트 | 입력 (순서대로) | 출력 크기 | 저장 위치 |
|---|---|---|---|---|---|
| 1 | 09 종루 | `art/chapters/3-clock-tower/maps/09-belfry/background-v2.prompt.txt` | A·B·C·D | 1536x1024 | `art/chapters/3-clock-tower/maps/09-belfry/background-v2.png` |
| 2 | 10 조율실 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/background-v2.prompt.txt` | A·B·C·E | 1536x1024 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/background-v2.png` |
| 3 | 10 금 가는 순간 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-1-cracking.prompt.txt` | F·E | 1536x1024 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-1-cracking-v1.png` |
| 4 | 10 열리는 순간 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-2-open.prompt.txt` | G·E | 1536x1024 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-2-open-v1.png` |

3·4번은 가능하면 **이미지 편집**(입력 1을 고치는 방식)으로 만듭니다. 새로 그리면 물체 위치가 달라져 겹쳐 바꿀 때 튑니다.

## 저장 전 확인 (한 장씩, 최대 3번)

**공통:** 숫자·글자·인물·UI 없음. 문자판은 눈금만. 빈 바닥에 잔해·작은 물체 없음.

**1. 09 종루**
- 아치 너머 마을이 D(08)의 창밖보다 **더 작고 멀리** 보이고, 아치 턱 바로 아래에 구름이 깔림.
- 마을에 시계탑·종탑·첨탑 등 높은 탑이 하나도 없음.
- 네 모서리와 아래 가장자리가 돌·청동·종 틀(하늘 아님). 바닥 아래에 돌 기초·톱니 받침이 보이지 않음.
- 출구: 왼쪽 가운데(입구), 오른쪽 가운데(위로 가는 좁은 계단).

**2. 10 조율실**
- 탑 안의 한 층: 모서리에 하늘·구름 없음, 바닥 아래 기초·톱니 받침 없음, 앞쪽 둥근 난간·가운데 톱니 아치 없음.
- 양옆 좁은 창 너머가 구름 바다와 하늘뿐(마을·지붕 안 보임).
- **E와 50% 겹쳐 보기:** 둥근 바닥(금 고리)의 위치·크기가 E와 거의 같고(가장자리 차이 그림 폭의 3% 이내), 위쪽 가운데 큰 시계 문자판의 위치·크기도 E와 비슷함. 겹친 그림을 검수 폴더에 남겨 주세요.

**3. 10 금 가는 순간**
- **F와 50% 겹쳐 보기:** 금·먼지·불꽃 말고는 물체가 움직이거나 크기·색이 바뀐 곳이 없음.
- 문자판 바늘 두 개가 똑바로 위(12시). 바닥은 가는 금만 있고 평평함(구멍·잔해 없음).

**4. 10 열리는 순간**
- **G·E와 각각 50% 겹쳐 보기:** 바닥 위치·크기가 둘과 같고, 문자판 위치가 둘과 비슷함.
- 천장과 벽 위쪽이 바깥으로 떨어져 나가고, 그 사이로 E와 같은 해돋이 하늘이 보임. 바닥 위에는 잔해가 없음.

## 끝나면 보고

1. 저장한 파일 경로와 크기. 2. 다시 생성한 그림과 이유. 3. 겹쳐 보기 그림 경로(10과 E, 금 간 10과 10, 열리는 10과 금 간 10·E). 4. 10 바닥 금 고리의 픽셀 경계(왼·오른·위·아래)와 E의 같은 경계.
