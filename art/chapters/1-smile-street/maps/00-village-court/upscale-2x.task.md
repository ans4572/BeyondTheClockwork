# Codex 작업: 웃음 마을 배경을 같은 배치 그대로 2배 해상도로 다시 그리기

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 이미지 생성과 이어 붙이기만 합니다. 코드·데이터(`src/`, `test/`, `worker/`, `scripts/`)와 기존 그림 파일은 건드리지 않습니다. 커밋·푸시도 하지 않습니다.

## 목표

- 원본: `art/chapters/1-smile-street/maps/00-village-court/background-wide-v7.png` (1920×1280, 손실 없는 원본)
- 결과: `art/chapters/1-smile-street/maps/00-village-court/background-wide-v8-2x.png` (**정확히 3840×2560**)
- 게임은 이 그림 위에 걸을 수 있는 영역, 벽·소품 충돌, NPC·포탈 위치를 원본 좌표로 그대로 얹습니다. 따라서 **모든 물체의 위치·크기·윤곽·개수가 원본과 같아야 합니다.** 새로 그리는 것은 디테일뿐입니다.
- 지금 게임은 원본 픽셀을 그대로 2배로 키워 보여 주고 있어서, 꽃·화분·가로등·진열대 윤곽이 계단처럼 보입니다. 이 계단을 없애고, 같은 화풍으로 2배 촘촘하게 그린 그림을 만드는 것이 목표입니다.
- 지난번 실패(Real-ESRGAN 2배): 흰 꽃이 부풀어 서로 붙었고, 벽돌 무늬가 뭉개져 흰 면이 넓어졌습니다. 같은 실수를 반복하지 않습니다.

## 순서

1. 작업 폴더 `art/chapters/1-smile-street/maps/00-village-court/upscale-work/`를 만듭니다. 조각과 중간 파일은 모두 여기에 둡니다.
2. **먼저 한 장으로 시도합니다.** 이미지 도구가 3840×2560(또는 같은 3:2 비율로 2560 이상)을 한 번에 낼 수 있으면, 원본 전체를 입력 이미지로 넣고 아래 프롬프트로 생성합니다. 결과가 3840×2560이 아니면 비율을 유지한 채 3840×2560으로 맞춥니다.
3. 한 장으로 안 되면(출력이 작거나, 아래 확인에서 떨어지면) **조각으로 나눠 그립니다.**
   - 원본을 3×3 조각으로 자릅니다. 조각 하나는 768×512이고, 시작 x는 0, 576, 1152, 시작 y는 0, 384, 768입니다(이웃 조각과 가로 192px, 세로 128px가 겹침).
   - 조각마다 그 조각만 입력 이미지로 넣고, 아래 프롬프트로 1536×1024(정확히 2배)를 생성합니다. `tile-r{행}-c{열}.png`로 저장합니다.
   - 2배 좌표(시작 x 0, 1152, 2304 / 시작 y 0, 768, 1536)에 놓고, 겹치는 띠(가로 384px, 세로 256px)는 선형 페더로 섞어 3840×2560 한 장으로 합칩니다. 스크립트는 `upscale-work/stitch.py`(Python + Pillow/numpy)로 남깁니다.
   - 조각끼리 색감이 다르면, 섞기 전에 각 조각의 채널별 평균·표준편차를 원본 같은 영역을 2배로 키운 것에 맞춥니다.
4. 결과를 `background-wide-v8-2x.png`로 저장합니다. 이미 있으면 덮어쓰지 말고 `-v2`, `-v3`처럼 이름을 바꿉니다.
5. 비교 그림 `upscale-work/compare.png`를 만듭니다. 분수 주변, 꽃 화단, 진열대, 벽돌 벽 네 곳을 각각 원본(픽셀 그대로 2배)과 새 그림으로 나란히 잘라 붙입니다.

## 이미지 프롬프트 (조각이든 한 장이든 그대로 사용)

```
Redraw input image 1 at exactly twice the resolution. This is a faithful high-resolution remaster, not a new picture.

KEEP EXACTLY: the camera angle, the composition, and the position, size, silhouette and count of every object (buildings, walls, stalls, awnings, fountain, benches, lamp posts, flower pots, flower beds, crates, signs, paving lines, steps, edges of the walkable floor). Nothing moves, nothing is added, nothing is removed. Keep every colour, the time-of-day lighting and the shadow directions.

IMPROVE ONLY: edge quality and fine detail. Replace the blocky stair-step outlines with clean, crisp outlines drawn at the new resolution. Add small surface detail inside existing shapes: individual petals and leaves, brick and tile joints, wood grain, fabric folds on awnings, small highlights on metal and glass.

STYLE: the same cheerful hand-drawn top-down game background style as the input, with the same outline weight relative to object size and the same flat-shaded colour blocks. Crisp, not blurry, not painterly, not photographic, no film grain, no airbrushed gradients.

DO NOT: enlarge or merge flowers (each white flower stays a separate small flower the same size as in the input), smooth brick or paving patterns into flat colour, brighten white areas, add text, numbers, letters, people, characters, toys, animals or UI.
```

## 저장 전 확인

하나라도 걸리면 그 조각(또는 한 장)을 다시 생성합니다. 같은 부분은 최대 3번까지 시도하고, 그래도 안 되면 가장 나은 것을 쓰고 보고합니다.

- **배치 일치(숫자):** 결과를 1920×1280으로 줄여(Lanczos) 원본과 비교합니다. RGB 평균 절대차가 12 이하이고, 64×64 칸 중 평균 절대차가 30을 넘는 칸이 없어야 합니다. 조각은 768×512로 줄여 원본 조각과 같은 기준으로 봅니다.
- **흰 면적(숫자):** R·G·B가 모두 235 이상인 픽셀의 비율이 원본과 0.3%p 이내여야 합니다. 원본은 약 3.44%입니다(직접 다시 재서 씁니다).
- **이음매(눈):** 3×3 조각 경계선 위치(x 1152~1536, 2304~2688 / y 768~1024, 1536~1792)에 선이 끊기거나, 물체가 두 번 그려지거나, 색 띠가 생긴 곳이 없어야 합니다.
- **눈으로:** 흰 꽃이 서로 붙지 않았고, 벽돌·바닥 줄눈이 살아 있고, 윤곽이 계단 없이 매끈하며, 흐릿하지 않아야 합니다. 글자·사람·캐릭터가 없어야 합니다.

## 끝나면 보고

1. 한 장으로 했는지, 조각으로 했는지.
2. 결과 파일 경로와 크기(픽셀).
3. 배치 일치 숫자(전체 평균 절대차, 가장 큰 칸 값과 위치)와 흰 면적(원본 % / 결과 %).
4. 다시 생성한 조각과 이유, 3번 안에 기준을 못 맞춘 조각.
5. `upscale-work/compare.png` 경로.
