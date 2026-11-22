# Codex 작업: 2장 남은 맵 17장을 같은 배치 그대로 2배 해상도로 다시 그리기

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 이미지 생성과 이어 붙이기만 합니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`)와 기존 그림 파일은 건드리지 않고, 커밋·푸시도 하지 않습니다.

**방법은 앞 작업 `art/chapters/upscale-2x-batch.task.md`와 완전히 같습니다.** 그 파일의 '맵마다 순서'(3×3 조각, 겹침, 페더 섞기, 조각 크기 공식), '저장 전 확인', '끝나면 보고'를 그대로 따르고, 그때 쓴 프롬프트·이어 붙이기 스크립트(2장 예: `art/chapters/2-silent-factory/maps/09-crane-yard/upscale-work/`)를 다시 씁니다. 앞 작업에서 2장 맵 4장(크레인 적재장 A·B, 지우개 라인 A·B)이 배치 어긋남 0px, 색 차이 ±3 이내로 통과해 게임에 들어갔습니다.

## 목표

- 게임은 각 그림 위에 걸을 수 있는 영역, 벽, 마스크, 몹·출구 위치를 원본 좌표 그대로 얹습니다. **모든 물체의 위치·크기·윤곽·개수가 원본과 같아야 합니다.** 새로 그리는 것은 디테일뿐입니다.
- 결과는 원본의 **정확히 2배 크기** PNG입니다(맵마다 크기가 다르니 표를 보세요). 세로로 긴 맵(1024×1536, 1152×1728)도 같은 3×3 조각 공식을 씁니다.
- 결과는 같은 폴더에 `background-v2x.png`로 저장합니다. 이미 있으면 덮어쓰지 말고 `background-v2x-2.png`처럼 번호를 붙입니다.

## 대상 17장 (이 순서로)

입력은 게임이 지금 쓰는 그림(표의 '원본')입니다.

| 맵 | 원본 | 크기 → 결과 | 비고 |
|---|---|---|---|
| factoryGate | `art/chapters/2-silent-factory/maps/01-gate-inspection/background-v4-q92.webp` | 1536×1024 → 3072×2048 | 왼쪽 아치 너머 바깥 풍경(밝은 하늘·마을)은 그대로 둠 |
| factoryGateB | `art/chapters/2-silent-factory/maps/01-gate-inspection-b/background-v2-q92.webp` | 1536×1024 → 3072×2048 | 위와 같음 |
| packingBelt | `art/chapters/2-silent-factory/maps/02-packing-belt/background-v3-q92.webp` | 1536×1024 → 3072×2048 | 나무 바닥에 비치는 창문 빛줄기는 같은 자리에 깔끔하게 |
| packingBeltB | `art/chapters/2-silent-factory/maps/02-packing-belt-b/background-v2-q92.webp` | 1536×1024 → 3072×2048 | 위와 같음 |
| partsWarehouse | `art/chapters/2-silent-factory/maps/03-parts-warehouse/background-q92.webp` | 1344×896 → 2688×1792 | |
| partsWarehouseB | `art/chapters/2-silent-factory/maps/03-parts-warehouse-b/background-v1-q92.webp` | 1344×896 → 2688×1792 | |
| stampingLine | `art/chapters/2-silent-factory/maps/04-stamping-line/background-v3-q92.webp` | 1536×1024 → 3072×2048 | 걸린 깃발의 웃는 얼굴 무늬는 그대로(글자 아님) |
| stampingLineB | `art/chapters/2-silent-factory/maps/04-stamping-line-b/background-v2-q92.webp` | 1536×1024 → 3072×2048 | 위와 같음 |
| inspectionRoom | `art/chapters/2-silent-factory/maps/05-inspection-room/background-q92.webp` | 1728×1152 → 3456×2304 | 하얗게 반짝이는 바닥을 더 밝게 하지 않음(흰 면적 기준을 특히 지킴) |
| rejectStore | `art/chapters/2-silent-factory/maps/06-reject-storeroom/background-q92.webp` | 1536×1024 → 3072×2048 | |
| compressionStore | `art/chapters/2-silent-factory/maps/07-compression-store/background-v3-q92.webp` | 1280×1280 → 2560×2560 | 정사각형 |
| compressionStoreB | `art/chapters/2-silent-factory/maps/07-compression-store-b/background-v2-q92.webp` | 1280×1280 → 2560×2560 | 정사각형 |
| boilerRoom | `art/chapters/2-silent-factory/maps/10-steam-boiler-room/background-q92.webp` | 1344×896 → 2688×1792 | 바닥 격자판 무늬의 칸 수와 간격을 그대로 |
| boilerRoomB | `art/chapters/2-silent-factory/maps/10-steam-boiler-room-b/background-v1-q92.webp` | 1344×896 → 2688×1792 | 위와 같음 |
| switchRoom | `art/chapters/2-silent-factory/maps/11-signal-switchroom/background-v3-q92.webp` | 1024×1536 → 2048×3072 | 세로로 긴 맵. 하늘색 네온 선의 모양·위치를 그대로 |
| switchRoomB | `art/chapters/2-silent-factory/maps/11-signal-switchroom-b/background-v2-q92.webp` | 1024×1536 → 2048×3072 | 위와 같음 |
| formingHall | `art/chapters/2-silent-factory/maps/12-forming-hall/background-v3-q92.webp` | 1152×1728 → 2304×3456 | 세로로 긴 맵. 바닥 가운데 큰 태엽 열쇠 문장(紋章)의 모양을 그대로 |

## 앞 작업에서 배운 것 (이번에 지킬 것)

- **색이 옅어지지 않게:** 1장 맵에서는 줄눈을 진하게 그리면서 채도가 3~7 낮아졌습니다(2장 맵은 괜찮았음). 이번에도 프롬프트 끝에 아래 문단을 덧붙이고, '저장 전 확인'의 색감 기준(HSV 평균 채도·밝기 원본과 ±5 이내)을 꼭 지킵니다.
  ```
  COLOUR: keep the same colour intensity and the same lighting as the input. Do not make the picture paler, greyer, brighter or more washed out. Keep floor seams, panel lines and grate patterns as thin and as light as in the input; do not darken or thicken them.
  ```
- **흰 면적 기준(2장에도 적용):** R·G·B 모두 235 이상인 픽셀 비율이 원본과 0.5%p 이내. 특히 검수실(inspectionRoom)의 흰 바닥과 조명이 넓어지지 않게.
- **글자 금지:** 간판·서류·저울 눈금 같은 곳에 읽히는 글자나 숫자를 새로 쓰지 않습니다(원본의 무늬는 그대로).
- **배치 확인의 거짓 경보:** 바닥만 있는 칸에서 새 줄눈·무늬 때문에 윤곽 비교가 2~4px 어긋났다고 나올 수 있습니다. 그 칸의 바닥 테두리·물체 위치가 원본과 같으면 통과로 보고, 보고서에 '바닥만 있는 칸'이라고 적습니다.

## 끝나면 보고

앞 작업 파일의 '끝나면 보고' 형식 그대로, 맵마다 한 줄씩:

1. 결과 경로와 크기(픽셀).
2. 배치: 칸 수와 (0, 0)이 아닌 칸(있으면 위치와 이유).
3. 전체 평균 절대차, 채도·밝기 차, 흰 면적(원본 % / 결과 %).
4. 다시 생성한 조각과 이유, 3번 안에 기준을 못 맞춘 조각.
5. `upscale-work/compare.png` 경로.

마지막에 기준을 못 맞춘 맵만 따로 모아 적습니다. 커밋·푸시는 하지 않습니다.
