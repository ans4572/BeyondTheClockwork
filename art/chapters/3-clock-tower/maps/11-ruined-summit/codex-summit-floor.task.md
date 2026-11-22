# Codex 작업: 3장 11 무너진 탑 꼭대기, 아래쪽을 대리석 바닥으로 다시 그리기 (2026-11-21)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 그림만 고칩니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`, `src/data/maps.json`)와 기존 그림 파일은 건드리지 않고, 새 이름으로만 저장합니다. 커밋·푸시도 하지 않습니다. 게임 연결, 이동 범위, 깊이 마스크는 Claude가 합니다.

## 지금까지의 경과

1. **처음 그림(`background-v2-1x.png`):** 전투 바닥 앞쪽 끝 아래로 구름이 보였습니다. 사용자 평: "시계탑 내부인데 구름 느낌이 있다."
2. **Codex 1차(`background-v3-1x.png`):** 구름을 탑 내부의 톱니 구멍으로 바꿨습니다. 사용자 평: "더 어색하다. 바닥으로 만드는 게 낫지 않을까?"
3. **Claude 합성(`background-v4-1x.png`):** 위쪽 바닥을 잘라 붙여 난간까지 바닥을 이었습니다. 사용자 평: "뭔가 어긋나서 어색하다." 잘라 붙인 곳에서 타일 줄눈이 위쪽 바닥과 이어지지 않고 끊기거나 엇갈립니다. 같은 무늬와 빛줄기 조각이 되풀이되고, 난간 조각 둘레가 들쭉날쭉합니다.

이번에는 이미지 편집으로 **처음부터 한 장의 바닥으로** 다시 그립니다. `background-v4-1x.png`는 "어디까지 바닥이어야 하는지"를 보여 주는 배치 참고로만 씁니다. 그 그림의 타일은 따라 그리지 않습니다.

## 고칠 곳과 그대로 둘 곳

게임 크기 그림 `background-v2-1x.png`는 1728×1152이고, 1칸은 40px입니다.

| 구역 (게임 크기 기준) | 할 일 |
| --- | --- |
| y < 930px | **픽셀 하나도 바꾸지 않는다.** 바닥, 금빛 원, 시계, 계단, 좌우 구름, 섬, 종, 등불, 화분 모두 그대로. |
| y ≥ 930px, 왼쪽 등불 기둥과 오른쪽 화분 기둥 사이 | 구름과 하늘을 모두 지운다. 그 자리에 위쪽 대리석 바닥이 **같은 타일 격자 그대로** 앞쪽 부서진 난간까지 이어지게 그린다. 오른쪽 난간 조각들 사이로 보이던 하늘(대략 x 1370~1450, y 940~1000)도 바닥으로 채운다. |
| 그 띠 안의 부서진 난간, 진열장 받침, 금빛 판 조각, 화분 2개, 등불 | 모양, 자리, 크기를 그대로 둔다. 그 **사이와 뒤로 보이던 구름만** 바닥으로 바꾼다. |
| 화면 맨 왼쪽과 맨 오른쪽 바깥(기둥 너머)의 구름 | 그대로 둔다. 탑 바깥 하늘이다. |

**게임 쪽 조건:** x 380~1260px 구간에서는 y = 976px(24.4칸)까지가 F2가 걷는 바닥입니다. 이 줄까지는 난간이나 돌 조각 없이 깨끗한 바닥이어야 합니다. 난간 조각은 그 아래에서 시작해야 합니다. 원본 난간 조각의 윗면은 대부분 y 990~1000px 근처이니, 난간을 옮기지 않으면 지켜집니다.

## 순서

1. **편집:**
   - 입력 이미지 1: `background-v2-1x.png` (편집할 그림).
   - 입력 이미지 2: `background-v4-1x.png` (바닥이 어디까지 오는지만 보여 주는 참고).
   - 아래 프롬프트를 **그대로** 써서 편집한다(요약·번역·수정 금지). 마스크를 쓸 수 있으면 y ≥ 930px 띠만 편집 영역으로 주고, 그 안의 난간·받침·화분·등불은 마스크에서 뺀다.
2. **합성:**
   - 편집 결과의 y < 930px 부분은 버리고 원본을 쓴다.
   - 경계는 8~12px에 걸쳐 섞는다. 단, 섞는 구간에서 줄눈이 두 겹으로 보이면 안 된다(아래 확인 항목).
   - 난간·받침·화분·등불·금빛 판 조각은 원본 픽셀을 다시 얹는다. 둘레에 구름색 테두리나 들쭉날쭉한 흰 픽셀이 남지 않게, 원본 윤곽선을 따라 깔끔하게 자른다.
   - 저장: `background-v5-1x.png` (1728×1152).
3. **2배:**
   - 지난번 보고서(`codex-summit-bottom.report-20261121.md`)와 `../upscale-2x-rest-report-20261118.md`의 A01 방식을 그대로 쓴다.
   - 편집한 띠만 다시 만들고, y < 1860px와 앞쪽 물체는 `background-v2x.png`의 픽셀을 그대로 쓴다.
   - 저장: `background-v5x.png` (3456×2304).
4. **게임용:** `background-v5-2x-q85.webp`로 저장한다(quality 85, method 6).

같은 이름의 파일이 이미 있으면 덮어쓰지 말고 `-2`처럼 새 이름으로 저장한다.

## 프롬프트 (그대로 사용)

```
Use case: image edit, bottom band only (inpaint).
Asset type: static production pixel-art game background, Beyond the Clockwork (a cute, toy-like game), chapter 3: the open-air ruined summit of the Central Clock Tower at sunrise. Input image 1 is the picture to edit; keep its camera, framing, perspective, pixel density, palette and rendering exactly. Input image 2 is only a layout guide: it shows that the floor should run all the way to the broken front parapet. Do not copy its tiles, which are badly patched.

Change ONLY the band along the bottom edge of the picture, below the current front edge of the pink marble fighting floor. Everything above that edge stays exactly as it is.

The problem: in that band, clouds and sky show through between and behind the broken front parapet, so the floor looks like it floats in the sky. This is the tower's top floor; its floor must continue to its own front wall.

In that bottom band, replace every cloud and every patch of sky with the same pink marble floor continuing toward the viewer until it meets the foot of the broken front parapet:
- The same large diamond (isometric) marble tiles as the floor above, with the same thin grout lines. Every grout line from the floor above continues straight on through the band without a break, a jog or a doubled line; tiles keep the same size and angle. The small mosaic texture inside each tile varies naturally, with no repeated patch.
- The same warm sunrise light: the soft vertical streaks of gold light on the floor carry on downward and fade naturally; no new bright blobs.
- A soft purple-grey contact shadow on the floor right at the foot of the parapet pieces and the rubble, a few pixels wide, so they sit on the floor.
- A few small marble chips and grit near the rubble are fine. No holes, pits, cracks into darkness, gears or machinery.
Keep the broken parapet, the wrecked display-case bases, the gold plates, the two potted plants and the brass lantern exactly where and as big as they are now; only what is seen between and behind them changes.

Do not change the marble floor above the band, the gold ring, its tick marks, the flower medallions, the existing cracks, the clock face, the gears behind it, the stair, the stumps, the banners, the fallen bell, or the clouds and the toy island beyond the far left and far right of the tower.
No clouds, sky, sea or island between the left lantern pillar and the right plant pillar in the bottom band. No UI, labels, text, letters, numbers, logos, watermarks, people or characters. Opaque full-bleed PNG, same size as input image 1.
```

## 저장 전 확인 (하나라도 걸리면 다시, 최대 3번)

- **위쪽 보존:** `background-v5-1x.png`와 `background-v2-1x.png`의 y < 930px 픽셀 차이가 0이다. 2배 그림은 y < 1860px에서 `background-v2x.png`와 차이가 0이다.
- **줄눈 이어짐 (이번 핵심):**
  - 경계(y=930px) 위아래 40px를 4배로 확대한 그림을 x 300~1400 구간에서 세 장 이상 만든다.
  - 위쪽 바닥의 줄눈이 끊기거나, 엇갈리거나, 두 겹으로 보이는 곳이 없어야 한다.
  - 띠 안 타일의 크기와 기울기가 위쪽과 같아야 한다.
- **되풀이 없음:** 띠 안에 똑같은 무늬 조각이나 빛 얼룩이 두 번 이상 나오지 않는다.
- **구름 없음:** 왼쪽 등불 기둥과 오른쪽 화분 기둥 사이 y ≥ 930px에 구름·하늘색 픽셀이 남지 않았다. 원본과 결과의 밝은 하늘색·흰 구름색 픽셀 비율을 함께 적는다.
- **걷는 줄:** x 380~1260px, y 930~976px 구간이 모두 깨끗한 바닥이다(난간·돌 조각 없음).
- **물체 보존:** 난간, 받침, 금빛 판, 화분 2개, 등불의 자리·크기·윤곽이 원본과 같다. 원본과 겹쳐 본 확인 그림을 남긴다. 둘레에 흰 테두리나 들쭉날쭉한 픽셀이 없다.
- **화풍:** 띠 안 바닥의 채도·밝기 평균이 바로 위쪽 바닥(y 820~930px)과 ±5 안이다. 이번에는 같은 대리석이므로 이 기준을 지킨다.

## 끝나면 보고

`art/chapters/3-clock-tower/maps/11-ruined-summit/codex-summit-floor.report-<날짜>.md`에 다음을 적는다.

- 만든 파일 3개의 경로와 크기.
- 위 확인 항목의 수치와 확대 그림 경로.
- v2(구름), v4(Claude 합성), v5(새 그림)의 아래쪽 띠(y 760~1152px)를 위아래로 나란히 놓은 비교 그림 경로.
- 시도 횟수, 그리고 기준 미달 항목이 있으면 그 내용.

참고: 조율실이 무너지는 연출(`10-tuning-chamber`)은 이 그림으로 장면이 넘어갑니다. 이번에는 고치지 않는다.
