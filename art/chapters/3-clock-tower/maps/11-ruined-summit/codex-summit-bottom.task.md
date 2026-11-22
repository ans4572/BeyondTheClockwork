# Codex 작업: 3장 11 무너진 탑 꼭대기, 아래쪽 구름을 탑의 몸체로 바꾸기 (2026-11-21)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 그림만 고칩니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`, `src/data/maps.json`)와 기존 그림 파일은 건드리지 않고, 새 이름으로만 저장합니다. 커밋·푸시도 하지 않습니다. 게임 연결은 Claude가 합니다.

## 왜 고치나

사용자 평: "11장 맵 하단을 보면 시계탑 내부인데 구름 느낌이 있다."

지금 그림(`background-2x-q85.webp`, 원본 `background-v2x.png`)에서는 전투 바닥 아래쪽 가장자리, 부서진 진열장 받침들 사이와 그 아래로 구름이 보입니다. 하지만 이곳은 **탑 꼭대기층의 앞쪽 가장자리**입니다. 바닥 아래로는 탑의 몸체(벽과 내부 구조)가 이어져야 하고, 그 아래로 하늘이 보이면 바닥이 공중에 떠 있는 것처럼 읽힙니다. 화면 왼쪽과 오른쪽 바깥(바닥 테두리 너머 먼 곳)의 구름과 섬은 그대로 둡니다.

## 고칠 곳과 그대로 둘 곳

게임 크기 그림 `background-v2-1x.png`는 1728×1152이고, 1칸은 40px입니다. 걸을 수 있는 바닥의 아래 끝은 y=944px(23.6칸)입니다.

| 구역 (게임 크기 기준) | 할 일 |
| --- | --- |
| y < 930px (화면 위쪽에서 바닥 아래 끝 바로 위까지) | **픽셀 하나도 바꾸지 않는다.** 바닥, 금빛 원, 시계, 계단, 좌우 구름, 섬 모두 그대로. |
| y ≥ 930px, 화면 아래쪽 띠 전체 폭 | 구름과 하늘을 지우고 탑의 몸체로 바꾼다(아래 프롬프트). |
| 그 띠 안의 부서진 진열장 받침, 화분, 등불, 금빛 판 조각 | 모양·자리·크기를 그대로 둔다. 그 **사이로 보이던 구름만** 바꾼다. |

## 순서

1. **편집:** 입력 이미지 1 = `background-v2-1x.png`. 아래 프롬프트를 **그대로** 써서 이미지 편집을 한다(요약·번역·수정 금지). 마스크를 쓸 수 있으면 y ≥ 930px 띠만 편집 영역으로 준다.
2. **합성:** 편집 결과의 y < 930px 부분은 버리고 원본을 그대로 쓴다. 경계는 바닥 아래 끝 바로 아래, 그림자가 진 돌 테두리 위에서 8~12px 정도 섞어 이음매가 보이지 않게 한다. 저장: `background-v3-1x.png` (1728×1152).
3. **2배:** 2배 그림은 `../upscale-2x-rest-report-20261118.md`에 적힌 방법을 그대로 쓴다. 편집한 띠만 다시 만들고, 나머지는 `background-v2x.png`의 픽셀을 그대로 쓴다. 저장: `background-v3x.png` (3456×2304).
4. **게임용:** `background-v3-2x-q85.webp`로 저장한다(기존 webp와 같은 품질 85).

같은 이름의 파일이 이미 있으면 덮어쓰지 말고 `-2`처럼 새 이름으로 저장한다.

## 프롬프트 (그대로 사용)

```
Use case: image edit, bottom band only (inpaint).
Asset type: static production pixel-art game background, Beyond the Clockwork (a cute, toy-like game), chapter 3: the ruined summit of the Central Clock Tower. Input image 1 is the current picture; keep its camera, framing, perspective, pixel density, palette and rendering exactly.

Change ONLY the band along the bottom edge of the picture, below the front edge of the marble fighting floor. Everything above that edge stays exactly as it is.

The problem: through the gaps between the wrecked display-case bases at the bottom, and below them, clouds and sky are visible. This is the top floor of the tower seen from inside the tower's own footprint: the floor must not look like it floats in the sky.

In that bottom band, replace every cloud and every patch of sky with the tower's own body continuing downward out of the picture:
- The broken front edge of the floor shows its thickness: a layer of cracked marble on top of thick dark-blue stone masonry, with brass trim and rivets, the same materials as the low wall stumps around the rim.
- Below and between the wrecked display-case bases, the inside of the tower's top storey is seen through the broken front: dark-blue stone walls, heavy brass beams and girders, and the upper part of a huge brass clockwork mechanism (large gears and shafts) in warm shadow, lit from above by the sunrise with gold rim light on brass edges.
- It darkens gently toward the very bottom edge, as the tower goes down into its own shadow.
Keep the wrecked display-case bases, the two potted plants, the brass lantern and the broken gold plates in the band exactly where and as big as they are now; only what is seen between and below them changes.

Do not change the marble fighting floor, the gold ring, its tick marks, the flower medallions, the cracks, the clock face, the gears behind it, the stair, the stumps, the banners, the fallen bell, or the clouds and the toy island seen beyond the left and right sides of the floor.
No clouds, sky, sea or island anywhere in the bottom band. No floating rock underside, no hanging roots. No UI, labels, text, letters, numbers, logos, watermarks, people or characters. Opaque full-bleed PNG, same size as input image 1.
```

## 저장 전 확인 (하나라도 걸리면 다시, 최대 3번)

- **위쪽 보존:** `background-v3-1x.png`와 `background-v2-1x.png`의 y < 930px 픽셀 차이가 0이다. 2배 그림은 y < 1860px에서 `background-v2x.png`와 차이가 0이다.
- **구름 없음:** y ≥ 930px 띠에 구름·하늘·바다 색이 남지 않았다. 띠 안의 밝은 하늘색·흰 구름색 픽셀 비율을 원본과 함께 적는다.
- **물체 보존:** 띠 안의 진열장 받침, 화분 2개, 등불, 금빛 판 조각의 자리와 크기가 원본과 같다. 원본과 겹쳐 본 확인 그림을 남긴다.
- **이음매:** 경계(y=930px 근처)에서 색 띠나 직선 이음매가 보이지 않는다.
- **화풍:** 채도와 밝기 평균의 차이가 띠 바깥 원본과 ±5 안이다.

## 끝나면 보고

`art/chapters/3-clock-tower/maps/11-ruined-summit/codex-summit-bottom.report-<날짜>.md`에 다음을 적는다.

- 만든 파일 3개의 경로와 크기.
- 위 확인 항목의 수치.
- 원본과 새 그림의 아래쪽 띠를 나란히 놓은 비교 그림 경로.
- 시도 횟수, 그리고 기준 미달 항목이 있으면 그 내용.

참고: 조율실이 무너지는 연출(`10-tuning-chamber`의 금 가는 순간·열리는 순간 그림)은 이 그림으로 장면이 넘어갑니다. 열리는 순간 그림의 아래쪽도 구름이면 넘어갈 때 아래쪽이 바뀌어 보일 수 있습니다. 그 그림은 이번에 고치지 말고, 아래쪽이 어떻게 보이는지만 보고서에 한 줄로 적는다.
