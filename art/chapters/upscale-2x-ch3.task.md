# Codex 작업: 3장 11 꼭대기 다시 그리기 + 그림 13장을 같은 배치 그대로 2배 해상도로 다시 그리기

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 이미지 생성과 이어 붙이기만 합니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`)와 기존 그림 파일은 건드리지 않고, 커밋·푸시도 하지 않습니다.

**방법은 1·2장 작업과 완전히 같습니다.** `art/chapters/upscale-2x-batch.task.md`의 '맵마다 순서'(3×3 조각, 겹침, 페더 섞기, 조각 크기 공식), '저장 전 확인', '끝나면 보고'를 그대로 따르고, `art/chapters/upscale-2x-ch2-rest.task.md`의 '앞 작업에서 배운 것'(색이 옅어지지 않게 덧붙이는 COLOUR 문단, 흰 면적 기준, 글자 금지, 바닥만 있는 칸의 거짓 경보)도 그대로 지킵니다. 그때 쓴 프롬프트와 이어 붙이기 스크립트(예: `art/chapters/2-silent-factory/maps/09-crane-yard/upscale-work/`)를 다시 씁니다.

## 목표

- 게임은 각 그림 위에 걸을 수 있는 영역, 벽, 마스크, 몹·출구 위치를 원본 좌표 그대로 얹습니다. **모든 물체의 위치·크기·윤곽·개수가 원본과 같아야 합니다.** 새로 그리는 것은 디테일뿐입니다.
- 입력은 각 폴더의 **게임 크기 원본 `*-1x.png`**(무손실, 이쪽에서 게임 크기로 맞춰 둠)입니다. Codex가 처음 만든 큰 PNG(`background-v1.png`, `background-v2.png` 등)는 쓰지 않습니다.
- 결과는 입력의 **정확히 2배 크기** PNG입니다. 저장 이름은 표의 '결과'. 이미 있으면 덮어쓰지 말고 `-2`처럼 번호를 붙입니다.
- 각 맵의 작업 파일은 그 맵 폴더의 `upscale-work/`에 둡니다(붕괴 그림 두 장은 `10-tuning-chamber/upscale-work/collapse-1/`, `collapse-2/`).

## 먼저: 11 무너진 꼭대기 다시 그리기 (v2)

11 v1은 열리는 순간(10)과 바닥 고리 위치(약 60px 위)·바닥 무늬(두 겹 고리와 회색 띠)·앞쪽(흰 난간과 공중에 뜬 바위섬)·계단 위치(왼쪽)가 달라, 겹쳐 바꿀 때 다른 장소로 바뀐 것처럼 보입니다. 그래서 열리는 순간 그림을 그대로 고쳐 '몇 초 뒤 잔해가 다 떨어진 모습'으로 다시 만듭니다.

- 프롬프트: `art/chapters/3-clock-tower/maps/11-ruined-summit/background-v2.prompt.txt` (요약·번역·수정 금지)
- 입력 (순서대로): 1 = `art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-2-open-v2.png`, 2 = `art/chapters/3-clock-tower/maps/11-ruined-summit/background-v1.png`
- 이미지 편집(입력 1을 고치는 방식)으로, 1536×1024, 저장 `art/chapters/3-clock-tower/maps/11-ruined-summit/background-v2.png`
- 저장 전 확인 (최대 3번):
  - 입력 1과 50% 겹쳐 보기: 바닥 금 고리(눈금 있는 한 줄)·꽃 문양·큰 문자판·오른쪽 계단 아래쪽의 위치와 크기가 같음(고리 경계 차이 8px 이내). 겹친 그림을 검수 폴더에 남김.
  - 공중에 떠 있는 잔해가 없음. 바닥 아래에 바위섬·톱니·배관이 없음(탑의 부서진 벽이 아래로 이어짐).
  - 앞쪽은 부서진 진열장 밑부분이 같은 자리에 남고, 그 사이로 아래 구름이 보임.
  - 전투 바닥(고리 안과 둘레)에 잔해·구멍 없음. 글자·숫자·인물·UI 없음, 문자판은 눈금만.
- 저장한 뒤 1728×1152로 LANCZOS 축소한 무손실 PNG를 `art/chapters/3-clock-tower/maps/11-ruined-summit/background-v2-1x.png`로 저장합니다(아래 13번의 입력).

## 대상 13장 (이 순서로)

모두 `art/chapters/3-clock-tower/maps/` 아래입니다.

| # | 그림 | 입력 | 크기 → 결과 크기 | 결과 | 비고 |
|---|---|---|---|---|---|
| 1 | 01 시계탑 정문 | `01-tower-gate/background-v2-1x.png` | 1536×1024 → 3072×2048 | `01-tower-gate/background-v2x.png` | 왼쪽 열린 문 너머 거리·꽃밭은 그대로 |
| 2 | 02 톱니 승강로 | `02-gear-shaft/background-v1-1x.png` | 1536×1024 → 3072×2048 | `02-gear-shaft/background-v2x.png` | 큰 톱니의 이 개수와 간격을 그대로 |
| 3 | 03 초침 회랑 | `03-second-hand-gallery/background-v2-1x.png` | 1536×1024 → 3072×2048 | `03-second-hand-gallery/background-v2x.png` | 문자판 창 너머 지붕·달은 그대로, 문자판에 숫자 금지 |
| 4 | 04 계단 기관실 | `04-stair-engine-room/background-v2-1x.png` | 1440×1440 → 2880×2880 | `04-stair-engine-room/background-v2x.png` | 정사각형. 금 테두리 바닥의 네 모서리 위치를 정확히 그대로(틱·톡 패턴이 이 바닥에 맞춰져 있음). 바닥 왼쪽 붉은빛·오른쪽 푸른빛을 더 진하게 하지 않음 |
| 5 | 05 멈춘 시계 다락 | `05-stopped-clock-attic/background-v2-1x.png` | 1344×896 → 2688×1792 | `05-stopped-clock-attic/background-v2x.png` | 벽시계들에 숫자 금지(눈금만) |
| 6 | 06 진자 홀 | `06-pendulum-hall/background-v1-1x.png` | 1024×1536 → 2048×3072 | `06-pendulum-hall/background-v2x.png` | 세로로 긴 맵 |
| 7 | 07 신호 구체 저장실 | `07-signal-orb-vault/background-v2-1x.png` | 1536×1024 → 3072×2048 | `07-signal-orb-vault/background-v2x.png` | 구체의 청록 빛을 넓히지 않음 |
| 8 | 08 종루 아래 배선실 | `08-belfry-wiring-room/background-v2-1x.png` | 1536×1024 → 3072×2048 | `08-belfry-wiring-room/background-v2x.png` | 케이블 청록 빛을 넓히지 않음 |
| 9 | 09 종루 | `09-belfry/background-v2-1x.png` | 1728×1152 → 3456×2304 | `09-belfry/background-v2x.png` | 아치 너머 마을은 작게 그대로(더 크게·가깝게 그리지 않음), 다른 탑을 새로 그리지 않음 |
| 10 | 10 조율실 | `10-tuning-chamber/background-v2-1x.png` | 1728×1152 → 3456×2304 | `10-tuning-chamber/background-v2x.png` | 아래 '붕괴 그림 세 장' 참고 |
| 11 | 10 금 가는 순간 | `10-tuning-chamber/collapse-1-cracking-v1-1x.png` | 1728×1152 → 3456×2304 | `10-tuning-chamber/collapse-1-cracking-v2x.png` | 아래 '붕괴 그림 세 장' 참고 |
| 12 | 10 열리는 순간 | `10-tuning-chamber/collapse-2-open-v2-1x.png` | 1728×1152 → 3456×2304 | `10-tuning-chamber/collapse-2-open-v2x.png` | 아래 '붕괴 그림 세 장' 참고 |
| 13 | 11 무너진 꼭대기 (v2) | `11-ruined-summit/background-v2-1x.png` | 1728×1152 → 3456×2304 | `11-ruined-summit/background-v2x.png` | 해돋이 빛을 더 밝게 하지 않음(흰 면적 기준을 특히 지킴) |

## 붕괴 그림 세 장 (10번, 11번, 12번)

게임은 오르덴 1차를 쓰러뜨리면 10 → 금 가는 순간 → 열리는 순간 → 11(v2)을 차례로 겹쳐 바꿉니다. 11 v2도 같은 바닥을 쓰므로 같은 규칙(같은 조각 나누기, 손상 없는 바닥은 10번 결과에 맞춤)을 따르고, 가운데 바닥 차이도 함께 보고합니다. 세 장의 손상되지 않은 부분이 2배에서 서로 다르게 그려지면 겹쳐 바꿀 때 바닥 무늬가 번쩍입니다.

- 세 장 모두 **같은 프롬프트, 같은 조각 나누기(같은 조각 경계와 겹침)**를 씁니다.
- 10번(조율실)을 먼저 끝내고, 11번·12번의 **손상되지 않은 조각**(특히 가운데 바닥 조각)은 10번 결과의 같은 조각을 보며 그 줄눈·대리석 무늬·금 고리의 모양에 맞춥니다. 금·잔해·불꽃이 있는 곳만 그 그림대로 그립니다.
- 저장 전 확인에 하나 더: 가운데 바닥 영역(1x 좌표 (650,490)–(830,610)을 2배한 영역)에서 10번 결과와 11번·12번 결과의 RGB 평균 절대차를 재서 보고합니다(기준 없이 수치만).

## 저장 전 확인

`upscale-2x-batch.task.md`의 기준 그대로:
- 배치: 2배 결과를 반으로 줄여 원본과 겹쳤을 때 모든 조각 어긋남 0px(바닥만 있는 칸의 2~4px 거짓 경보는 위 규칙대로).
- 색: 전체 평균 절대차, HSV 평균 채도·밝기가 원본과 ±5 이내, 흰 면적(R·G·B 모두 235 이상) 비율 차 0.5%p 이내.
- 글자·숫자·인물·UI를 새로 그리지 않음. 시계 문자판은 눈금만.

## 끝나면 보고

`art/chapters/3-clock-tower/maps/upscale-2x-report-<날짜>.md`에, 그림마다 한 줄씩:

1. 결과 경로와 크기(픽셀).
2. 배치: 조각 수와 (0, 0)이 아닌 조각(있으면 위치와 이유).
3. 전체 평균 절대차, 채도·밝기 차, 흰 면적(원본 % / 결과 %).
4. 다시 생성한 조각과 이유, 3번 안에 기준을 못 맞춘 조각.
5. `upscale-work/compare.png` 경로.
6. (11번·12번·13번만) 가운데 바닥 영역의 10번 결과와의 RGB 평균 절대차.
7. 11 v2: 저장 경로, 생성 횟수, 입력 1과의 고리 경계(왼·오른·위·아래 px), 50% 겹침 그림 경로.

마지막에 기준을 못 맞춘 그림만 따로 모아 적습니다. 커밋·푸시는 하지 않습니다.
