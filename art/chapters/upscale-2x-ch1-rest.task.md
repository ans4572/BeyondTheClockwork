# Codex 작업: 1장 남은 맵 9장을 같은 배치 그대로 2배 해상도로 다시 그리기

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 이미지 생성과 이어 붙이기만 합니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`)와 기존 그림 파일은 건드리지 않고, 커밋·푸시도 하지 않습니다.

**방법은 바로 앞 작업 `art/chapters/upscale-2x-batch.task.md`와 완전히 같습니다.** 그 파일의 '맵마다 순서', '저장 전 확인', '끝나면 보고'를 그대로 따르고, 그때 쓴 프롬프트·이어 붙이기 스크립트(각 맵 폴더의 `upscale-work/`, 예: `art/chapters/1-smile-street/maps/01-first-step-plaza/upscale-work/`)를 다시 씁니다. 앞 작업 17장은 모두 배치 어긋남 0px로 통과해 게임에 들어갔습니다.

## 목표

- 게임은 각 그림 위에 걸을 수 있는 영역, 벽, 마스크, 몹·출구 위치를 원본 좌표 그대로 얹습니다. **모든 물체의 위치·크기·윤곽·개수가 원본과 같아야 합니다.** 새로 그리는 것은 디테일뿐입니다.
- 결과는 원본의 **정확히 2배 크기**(1536×1024 → 3072×2048) PNG입니다.
- 결과는 같은 폴더에 `background-v2x.png`로 저장합니다. 이미 있으면 덮어쓰지 말고 `background-v2x-2.png`처럼 번호를 붙입니다.

## 대상 9장 (이 순서로)

입력은 게임이 지금 쓰는 그림(표의 '원본')입니다. 고칠 점은 없습니다(모서리 하늘색 문제 없음).

| 맵 | 원본 | 비고 |
|---|---|---|
| candyYardB | `art/chapters/1-smile-street/maps/02-candy-cart-yard-b/background-q92.webp` | |
| repairRoadB | `art/chapters/1-smile-street/maps/03-toy-repair-road-b/background-no-benches-q92.webp` | 벤치를 일부러 뺀 그림. 벤치를 새로 그려 넣지 않음 |
| ribbonCrossB | `art/chapters/1-smile-street/maps/04-ribbon-crossing-b/background-q92.webp` | |
| loadingYardB | `art/chapters/1-smile-street/maps/07-wind-up-loading-yard-b/background-q92.webp` | |
| fountainRingB | `art/chapters/1-smile-street/maps/08-fountain-ring-b/background-q92.webp` | |
| checkpointB | `art/chapters/1-smile-street/maps/09-flag-checkpoint-b/background-q92.webp` | |
| sweetAlleyB | `art/chapters/1-smile-street/maps/10-sweet-alley-b/background-q92.webp` | |
| paradeYardB | `art/chapters/1-smile-street/maps/11-parade-yard-b/background-q92.webp` | |
| scrapyard | `art/chapters/1-smile-street/maps/00-scrapyard/background-q92.webp` | 튜토리얼 폐기장. 흙바닥·고물 더미 화풍(다른 1장 방과 다름)을 그대로 유지 |

## 앞 작업에서 배운 것 (이번에 지킬 것)

- **색이 옅어지지 않게:** 앞 작업에서 1장 맵이 줄눈을 진하게 그리면서 채도가 3~7 낮아졌습니다(나중에 따로 보정함). 이번에는 프롬프트 끝에 아래 문단을 덧붙이고, '저장 전 확인'의 색감 기준(HSV 평균 채도·밝기 원본과 ±5 이내)을 꼭 지킵니다. 넘으면 그 조각을 다시 생성합니다.
  ```
  COLOUR: keep the same colour intensity as the input. Do not make the picture paler, greyer or more washed out. Keep tile joints and paving lines as light and thin as in the input; do not darken or thicken them.
  ```
- **이음매:** 앞 작업에서는 보이는 이음매가 없었습니다. 같은 3×3 조각·겹침·페더 섞기를 그대로 씁니다.
- **배치 확인의 거짓 경보:** 바닥만 있는 칸에서 새 줄눈 때문에 윤곽 비교가 2~4px 어긋났다고 나올 수 있습니다. 그 칸의 바닥 테두리·물체 위치가 원본과 같으면 통과로 보고, 보고서에 '바닥만 있는 칸'이라고 적습니다.

## 끝나면 보고

앞 작업 파일의 '끝나면 보고' 형식 그대로, 맵마다 한 줄씩:

1. 결과 경로와 크기(픽셀).
2. 배치: 칸 수와 (0, 0)이 아닌 칸(있으면 위치와 이유).
3. 전체 평균 절대차, 채도·밝기 차, 흰 면적(원본 % / 결과 %).
4. 다시 생성한 조각과 이유, 3번 안에 기준을 못 맞춘 조각.
5. `upscale-work/compare.png` 경로.

마지막에 기준을 못 맞춘 맵만 따로 모아 적습니다. 커밋·푸시는 하지 않습니다.
