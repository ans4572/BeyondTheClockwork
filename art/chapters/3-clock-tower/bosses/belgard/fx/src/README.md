# 벨가드 패턴 소품 (pixelfx, 2026-11-17)

pixelfx(`C:\Users\ans45\pixelfx`, `src/fx/belfry/`)로 코드로 그린 효과. 이 폴더의 `.js`가 원본이고, 시트는 `node tools/render.mjs belfry/<id> --sheet --opts '{...}'`로 다시 만든다.

- `tuning-pillar-v1.png` / `tuning-pillar-ringing-v1.png`: 조율 기둥, `ringing` 0/1. 56×84, 기준점 (28, 78), 24프레임 30fps, 6열.
- `cage-bell-v1.png`: 종 가두기의 종. `cracks` 0~3을 한 줄씩(줄 = 금 단계), 80×72, 기준점 (40, 64), 줄마다 24프레임 20fps.
- `rain-sword-v1.png`: 검비의 작은 칼. 24×48, 기준점 (12, 42), 20프레임 20fps, 7열.
- `tuning-needle-v1.png`: 조율 바늘. 56×64, 기준점 (28, 52), 24프레임 30fps, 6열.

## 벨가드 공격 이펙트 (pixelfx, 2026-11-18)

pixelfx `src/fx/belfry/`의 `bg-*.js`가 원본. 청록판은 `--opts '{"palette":["#0e3a48","#1f7f96","#5fe3ff","#bff6ff","#ffffff"]}'`(파동은 `"dust":"#5a8a96"`도).

- `slash-v1.png` / `slash-cyan-v1.png`: 대검 베기, 오른쪽을 향한 120도·반지름 60px, 0.36초. `spin-v1.png` / `spin-cyan-v1.png`는 같은 효과 `degrees: 360`(회전 베기). 148×148, 기준점 가운데.
- `wave-crest-v1.png` / `-cyan`: 내려찍기 뒤 바닥을 달리는 파동의 앞머리, 반폭 18px, 0.3초 반복. 72×56, 기준점 (52, 28).
- `phantom-sword-v1.png`: 오르덴의 환영 대검, 끝이 오른쪽, 0.8초 반복. 88×36, 기준점 가운데.
- `slam-v1.png`: 대검이 바닥을 찍는 충격(섬광·균열 6줄·먼지 고리, 반지름 30px), 0.75초. 112×104, 기준점 (56, 56).
- `toll-ring-v1.png` / `-cyan`: 바닥으로 퍼지는 종소리 고리(눈금 있는 청동 고리, 반지름 60px), 0.55초. 136×88, 기준점 가운데.


## 바닥 균열 (pixelfx, 2026-11-19)

코드로 그은 선이 바닥에 펜으로 그은 것처럼 어색해서(사용자 요청) pixelfx로 바꿈. 원본 `bg-strike.js`, `bg-fissure.js`. 청록판은 `--opts '{"palette":["#0e3a48","#1f7f96","#5fe3ff","#bff6ff","#ffffff"],"heat":["#0e4a5c","#1f9fbf","#5fe3ff","#d8faff"],"dust":"#5a8a96"}'`.

- `strike-v1.png` / `-cyan`: 칼날이 바닥에 박힐 때(섬광, 가지 친 금 일곱 줄에 녹은 빛이 흰색→금색→어두운 금으로 식음, 그을음, 돌 조각, 불꽃, 먼지), 반지름 40px, 1.2초, 끝에도 금은 남음. 128×112, 기준점 (64, 50), 6열 37프레임.
- `fissure-v1.png` / `-cyan`: 바닥을 따라 갈라지는 금 한 조각(32px, 오른쪽으로, 양 끝이 가운데 줄이라 이어 붙음). 열리고 빛나다 식은 금으로 남음, 1초, 마지막 프레임을 유지. 36×18, 기준점 (2, 10), 4열 31프레임.

## 코드 선 교체 2차 (pixelfx, 2026-11-19)

틱·톡과 벨가드 패턴에서 코드로 그은 선을 모두 pixelfx로 바꿈(사용자 요청). 원본 `path-gem.js`, `hum-thread.js`, `res-blast.js`, `tuner-dial.js`, `fall-streaks.js`(이 폴더), `../../ticktock/fx/src/tt-pieces.js`.

- `../../fx/gem-<색>-v1.png`: 바닥에 박힌 작은 보석, 맥박치듯 빛남(13×11, 기준점 (6, 5), 16프레임 20fps 반복). 색 8가지: red, green, blue, tick, gold, white, cyan, bronze(각각 `--opts '{"palette":[테두리, 몸, 윗면, 반짝임]}'`). 경고·안전 구역의 테두리를 따라 줄지어 놓음.
- `hum-v1.png` / `hum-hot-v1.png`: 울리는 기둥 사이의 떨리는 소리 줄 32px 조각(`amp` 1 / 3), 36×16, 기준점 (2, 8), 6프레임 24fps 반복.
- `res-blast-v1.png`: 그 줄이 터지는 32px 조각, 0.3초, 36×48, 기준점 (2, 24).
- `tuner-dial-v1.png` / `tuner-dial-lit-v1.png`: 위조 명령 기둥 위 반원 눈금판(반지름 26, 흔들림 0.9, 초록 폭 `tune` 0.24), 64×40, 기준점 (32, 33) = 바늘 축. `tune` 값을 바꾸면 다시 뽑아야 함.
- `fall-streaks-v1.png`: 떨어지는 종 위로 스치는 바람 줄기, 72×96, 기준점 (36, 92), 9프레임 30fps 반복.
- 틱·톡 `echo-hand-v1.png`(메아리 시계 바늘, `part` 0), `metronome-rod-v1.png`(거대 메트로놈 막대 32px 조각, `part` 1): 36×12, 기준점 (3, 6), 정지 그림.
