# Codex 작업: 3장 남은 그림 11장을 같은 배치 그대로 2배 해상도로 다시 그리기 (이어서)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 이미지 생성과 이어 붙이기만 합니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`)와 기존 그림 파일은 건드리지 않고, 커밋·푸시도 하지 않습니다.

## 지난 작업에서 이어서

`art/chapters/upscale-2x-ch3.task.md`(2026-11-16)가 중간에 멈췄습니다. 그 지시서의 '목표', '붕괴 그림 세 장', '저장 전 확인'은 그대로 유효하고, 이 문서는 **남은 것만** 다시 정리합니다.

- **이미 끝남(다시 하지 않음):** 01 시계탑 정문 A, 02 톱니 승강로 A(`background-v2x.png`, 검사 통과, 게임 연결됨). 11 무너진 꼭대기 v2 다시 그리기(`11-ruined-summit/background-v2.png`, `background-v2-1x.png`). 3장 B 맵 6장(`codex-b-maps.report-20261118.md`).
- **03 초침 회랑 A는 거의 끝남:** `03-second-hand-gallery/upscale-work/`에 조각 9개와 이어 붙인 후보(`stitched-candidate.png`)가 있고, 배치는 20칸 모두 (0,0), 평균 절대차 9.51, 밝기 +2.17, 흰 면적 +0.12%p로 통과, **채도만 +5.40으로 기준(±5) 초과**입니다. 처음부터 다시 하지 말고 여기서 이어 갑니다(아래 1번).

## 방법

1·2장, 3장 01·02 A와 B 6장 작업과 **완전히 같습니다.**

- `art/chapters/upscale-2x-batch.task.md`의 '맵마다 순서'(3×3 조각, 겹침, 페더 섞기, 조각 크기 공식), '저장 전 확인', '끝나면 보고'.
- `art/chapters/upscale-2x-ch2-rest.task.md`의 '앞 작업에서 배운 것'(색이 옅어지지 않게 덧붙이는 COLOUR 문단, 흰 면적 기준, 글자 금지, 바닥만 있는 칸의 거짓 경보).
- 프롬프트와 이어 붙이기 스크립트는 `art/chapters/3-clock-tower/maps/01-tower-gate/upscale-work/`(`config.json`, `stitch.py`, `prompt*.txt`)를 다시 씁니다. 3장 그림이라 프롬프트의 CLOCK TOWER 문단도 그대로 둡니다.
- 입력은 각 폴더의 **게임 크기 원본 `*-1x.png`**(무손실)입니다. Codex가 처음 만든 큰 PNG(`background-v1.png`, `background-v2.png` 등)는 입력으로 쓰지 않습니다.
- 결과는 입력의 **정확히 2배 크기** PNG. 이미 있으면 덮어쓰지 말고 `-2`처럼 번호를 붙입니다.
- 각 맵의 작업 파일은 그 맵 폴더의 `upscale-work/`(붕괴 그림 두 장은 `10-tuning-chamber/upscale-work/collapse-1/`, `collapse-2/`).
- **조각은 최대 3번까지 생성합니다.** 3번 안에 전체 기준을 못 맞추면, 가장 기준에 가까운 조합으로 결과를 저장하고 보고서에 '미달'로 적은 뒤 다음 그림으로 넘어갑니다(멈추지 않음). 조각 하나의 국소 검사가 미달이어도 최종 전체 합성본이 통과하면 더 생성하지 않습니다.

## 대상 (이 순서로)

게임에 이미 쓰이는 1~7번을 먼저 끝내고, 아직 게임에 없는 오르덴 방(8~11번)은 그다음에 합니다. 모두 `art/chapters/3-clock-tower/maps/` 아래입니다.

| # | 그림 | 입력 | 크기 → 결과 크기 | 결과 | 비고 |
|---|---|---|---|---|---|
| 1 | 03 초침 회랑 | `03-second-hand-gallery/background-v2-1x.png` | 1536×1024 → 3072×2048 | `03-second-hand-gallery/background-v2x.png` | 아래 '03 마무리' 참고. 문자판 창 너머 지붕·달은 그대로, 문자판에 숫자 금지 |
| 2 | 04 계단 기관실 | `04-stair-engine-room/background-v2-1x.png` | 1440×1440 → 2880×2880 | `04-stair-engine-room/background-v2x.png` | 정사각형. 조각 크기 공식은 가로·세로 똑같이. 금 테두리 바닥의 네 모서리 위치를 정확히 그대로(틱·톡 패턴이 이 바닥에 맞춰져 있음). 바닥 왼쪽 붉은빛·오른쪽 푸른빛을 더 진하게 하지 않음 |
| 3 | 05 멈춘 시계 다락 | `05-stopped-clock-attic/background-v2-1x.png` | 1344×896 → 2688×1792 | `05-stopped-clock-attic/background-v2x.png` | 벽시계들에 숫자 금지(눈금만) |
| 4 | 06 진자 홀 | `06-pendulum-hall/background-v1-1x.png` | 1024×1536 → 2048×3072 | `06-pendulum-hall/background-v2x.png` | 세로로 긴 맵(조각 410×614 → 820×1228, 시작점 x=0/307/614, y=0/461/922, B와 같음) |
| 5 | 07 신호 구체 저장실 | `07-signal-orb-vault/background-v2-1x.png` | 1536×1024 → 3072×2048 | `07-signal-orb-vault/background-v2x.png` | 구체의 청록 빛을 넓히지 않음 |
| 6 | 08 종루 아래 배선실 | `08-belfry-wiring-room/background-v2-1x.png` | 1536×1024 → 3072×2048 | `08-belfry-wiring-room/background-v2x.png` | 케이블 청록 빛을 넓히지 않음 |
| 7 | 09 종루 | `09-belfry/background-v2-1x.png` | 1728×1152 → 3456×2304 | `09-belfry/background-v2x.png` | 벨가드 방. 아치 너머 마을은 작게 그대로(더 크게·가깝게 그리지 않음), 다른 탑을 새로 그리지 않음 |
| 8 | 10 조율실 | `10-tuning-chamber/background-v2-1x.png` | 1728×1152 → 3456×2304 | `10-tuning-chamber/background-v2x.png` | `upscale-2x-ch3.task.md`의 '붕괴 그림 세 장' 규칙 |
| 9 | 10 금 가는 순간 | `10-tuning-chamber/collapse-1-cracking-v1-1x.png` | 1728×1152 → 3456×2304 | `10-tuning-chamber/collapse-1-cracking-v2x.png` | 같음 |
| 10 | 10 열리는 순간 | `10-tuning-chamber/collapse-2-open-v2-1x.png` | 1728×1152 → 3456×2304 | `10-tuning-chamber/collapse-2-open-v2x.png` | 같음 |
| 11 | 11 무너진 꼭대기 (v2) | `11-ruined-summit/background-v2-1x.png` | 1728×1152 → 3456×2304 | `11-ruined-summit/background-v2x.png` | 같음. 해돋이 빛을 더 밝게 하지 않음(흰 면적 기준을 특히 지킴) |

## 03 마무리

1. `03-second-hand-gallery/upscale-work/attempts.json`과 `verification.json`에서 조각마다 이미 몇 번 생성했는지 확인합니다(3번을 다 쓴 조각은 r1-c1, r1-c3, r3-c3).
2. 채도 차에 가장 많이 기여하는 조각(조각별 HSV 채도 차가 큰 순) 가운데 아직 3번을 다 쓰지 않은 조각만 같은 프롬프트로 다시 생성하고, 이미 있는 후보 중 가장 나은 것과 바꿔 끼워 전체 검사를 다시 합니다.
3. 통과하면 `background-v2x.png`로 저장합니다. 3번을 다 써도 채도만 미달이면 가장 가까운 조합을 저장하고 '미달'로 적습니다(3장 B 01도 채도 +5.6으로 이렇게 저장했습니다).
4. 기존 `stitched-candidate.png`와 시도 파일은 지우지 않습니다.

## 저장 전 확인

`upscale-2x-batch.task.md`의 기준 그대로:

- **배치:** 2배 결과를 반으로 줄여 원본과 겹쳤을 때 모든 칸 어긋남 0px(바닥만 있는 칸의 2~4px 거짓 경보는 그 규칙대로).
- **색:** 전체 평균 절대차 30 이하, HSV 평균 채도·밝기가 원본과 ±5 이내, 흰 면적(R·G·B 모두 235 이상) 비율 차 0.5%p 이내.
- **금지:** 글자·숫자·인물·UI를 새로 그리지 않음. 시계 문자판은 눈금만.

## 끝나면 보고

`art/chapters/3-clock-tower/maps/upscale-2x-rest-report-<날짜>.md`에, 그림마다:

1. 결과 경로와 크기(픽셀).
2. 배치: 칸 수와 (0, 0)이 아닌 칸(있으면 위치와 이유).
3. 전체 평균 절대차, 채도·밝기 차, 흰 면적(원본 % / 결과 %).
4. 다시 생성한 조각과 이유, 3번 안에 기준을 못 맞춘 조각.
5. `upscale-work/compare.png` 경로.
6. (9·10·11번만) 가운데 바닥 영역(1x 좌표 (650,490)–(830,610)을 2배한 영역)의 8번 결과와의 RGB 평균 절대차.

마지막에 기준을 못 맞춘 그림만 따로 모아 적습니다. 커밋·푸시는 하지 않습니다.
