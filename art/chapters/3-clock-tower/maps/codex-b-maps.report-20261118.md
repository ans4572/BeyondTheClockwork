# 3장 B 맵 생성·2배 재작화 보고 — 2026-11-18

6개 방 모두 생성 원본·게임 크기 원본·정확히 2배 PNG, 총 18개 결과를 저장했습니다. 기존 파일은 덮어쓰지 않았습니다. 코드·데이터·마스크·게임 연결은 작업하지 않았고 커밋·푸시도 하지 않았습니다.

## 전체 결과

| 방 | 1단계 선택/생성 횟수 | 2배 크기 | 전체 2배 수치 검사 | 남은 미달 |
|---|---|---|---|---|
| 시계탑 정문 B | 2차 / 2회 | 3072×2048 | 미달 | HSV 채도 차 +5.602, 허용 ±5 초과 |
| 톱니 승강로 B | 1차 / 1회 | 3072×2048 | 통과 | 없음 |
| 초침 회랑 B | 1차 / 3회 | 3072×2048 | 통과 | 앞쪽 대리석 난간이 완만한 곡선으로 남아 금지된 둥근 전경 난간 조건 미달 |
| 진자 홀 B | 1차 / 3회 | 2048×3072 | 통과 | 상단 계단 뒤가 장미창 아래 벽으로 닫혀 보여 열린 상단 출구가 불명확함 |
| 신호 구체 저장실 B | 1차 / 1회 | 3072×2048 | 통과 | 없음 |
| 종루 아래 배선실 B | 1차 / 1회 | 3072×2048 | 통과 | 없음 |

## 사용한 방법과 검사

각 B 폴더의 background.prompt.txt 전문을 수정·요약·번역 없이 사용했습니다. 참조 입력은 ① 1장 전투 방 ② 시계탑 정상 background-v2.png ③ 해당 방 A의 게임 크기 PNG 순서입니다. 다른 B 그림이나 A의 2배 그림은 입력하지 않았습니다.
1단계 결과의 원본 바이트를 보존했고, 게임 크기가 이미 같아서 1x PNG에는 자르기·비율 변경을 하지 않았습니다. 50% A/B 겹침 그림으로 바닥판·계단·문과 빈 바닥의 크기를 비교했습니다.
2배 재작화는 해당 A의 프롬프트(COLOUR·CLOCK TOWER·OUTPUT 포함), 3×3 분할, 조각별 RGB 채널 평균·표준편차 맞춤, 선형 페더 합성 방식을 재사용했습니다. 07 오른쪽 아래 조각만 포장재에 꽃을 추가한 후보를 피하려고 3차를 육안으로 선택했습니다. 합성 공식·색 검사·배치 검사 기준은 바꾸지 않았습니다.
1536×1024 입력의 조각은 614×410, 재작화 조각은 1228×820이며, 시작점은 x=0/461/922, y=0/307/614입니다. 06 세로 입력은 조각 410×614 → 820×1228, 시작점 x=0/307/614, y=0/461/922입니다. 생성기가 다른 조각 크기를 반환하면 지정된 조각 크기로 Lanczos 조정한 뒤 검사했습니다. 생성 원본은 별도 raw PNG에 보존했습니다.
완성본을 1x로 Lanczos 축소해 320×320칸마다 FIND_EDGES 상관으로 ±8px를 2px 간격으로 검사했습니다. 가로·세로 모두 방당 20칸이며 모든 최종 칸의 이동은 (0,0)입니다. 바닥만 있는 칸의 예외 승인이나 검사 제외는 사용하지 않았습니다.
수치 기준은 RGB 평균 절대차≤30, HSV 채도·밝기 각각 ±5(0~255), 흰 픽셀(R/G/B 모두≥235) 면적 차 ±0.5%p입니다. 조각의 국소 색 검사가 미달이어도 A 작업 방식대로 최종 전체 합성본이 통과하면 추가 생성하지 않았으며, 아래에 국소 결과도 공개합니다.
출구 중심은 화면에서 보이는 통로 문턱·계단 발치의 육안 근사치입니다. 게임 출구 영역이나 마스크 좌표는 만들지 않았습니다. 수치 검사는 배치·색의 근사 검사이며 모든 미세 질감과 물체 세부의 동일함을 보장하지 않습니다.

## 01-tower-gate-b — 시계탑 정문 B

### 저장 파일

| 파일 | 크기 |
|---|---|
| [background-v1.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/background-v1.png>) | 1536×1024px |
| [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/background-v1-1x.png>) | 1536×1024px |
| [background-v2x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/background-v2x.png>) | 3072×2048px |

### 1단계 생성·A 비교

- 생성 2회, 2차 선택. 최종: 통과.
- 출구 중심: LEFT 문턱 y≈50%; RIGHT 계단 y≈32%.
- [overlay-a.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/upscale-work/overlay-a.png>) · [A/B 나란히 비교](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/upscale-work/compare-a-attempt2.png>).
- A 입력: [background-v2-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate/background-v2-1x.png>).

| 시도 | 판정 | 재생성·선택 이유 |
|---|---|---|
| 1 | 미달 | 지정된 왼쪽 위 창이 없고 바깥 풍경이 출입문 너머로만 보임; 왼쪽 출구가 지정 높이보다 아래쪽에 있음 |
| 2 | 통과 · 선택 | 화풍·카메라·물체 크기, 재질·빛, 새 벽/가구 구성, 출구·빈 바닥 육안 확인 |

### 3단계 재작화·전체 검사

- 9조각, 총 27회 생성. 최종 20칸 모두 이동 (0,0), 비영점 칸 없음, 예외 승인 없음.
- RGB 평균 절대차: **12.41217**.
- HSV 채도 / 밝기 차: **+5.60236 / +2.82623**.
- 흰 면적 원본 / 결과: **0.79288% / 0.87935%**, 차 **+0.08647%p**.
- 최종 전체 수치 검사: **미달 — 채도 차가 ±5 초과. 각 조각 최대 3회 생성 후 최선 조합 저장.**
- [compare.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/upscale-work/compare.png>) · [원본/축소본 50% 겹침](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/upscale-work/overlay.png>) · [조각별 전체 검사 기록](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate-b/upscale-work/verification.json>).

| 조각 | 총 생성 | 선택 | 재생성 사유 | 선택 조각의 국소 검사 |
|---|---|---|---|---|
| r1c1 | 3회 | 2차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차·흰 면적 차 | 채도·밝기 차·흰 면적 차 |
| r1c2 | 3회 | 1차 | 전체 합성본 채도 차 초과 | 통과 |
| r1c3 | 3회 | 2차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차·흰 면적 차 | 흰 면적 차 |
| r2c1 | 3회 | 2차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차·흰 면적 차 | 채도·밝기 차·흰 면적 차 |
| r2c2 | 3회 | 1차 | 전체 합성본 채도 차 초과 / 국소 흰 면적 차 | 통과 |
| r2c3 | 3회 | 1차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차 | 통과 |
| r3c1 | 3회 | 2차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차·흰 면적 차 | 채도·밝기 차 |
| r3c2 | 3회 | 3차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차·흰 면적 차 | 채도·밝기 차·흰 면적 차 |
| r3c3 | 3회 | 3차 | 전체 합성본 채도 차 초과 / 국소 채도·밝기 차 | 채도·밝기 차 |

9조각 모두 3회 생성했습니다. 최종 배치 이동은 없고 RGB·밝기·흰 면적은 통과했으나 채도 차 +5.602가 남아 이 방을 미달로 분류했습니다.

## 02-gear-shaft-b — 톱니 승강로 B

### 저장 파일

| 파일 | 크기 |
|---|---|
| [background-v1.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/background-v1.png>) | 1536×1024px |
| [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/background-v1-1x.png>) | 1536×1024px |
| [background-v2x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/background-v2x.png>) | 3072×2048px |

### 1단계 생성·A 비교

- 생성 1회, 1차 선택. 최종: 통과.
- 출구 중심: LEFT 다리 문턱 y≈62%; RIGHT 계단 y≈46%.
- [overlay-a.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/upscale-work/overlay-a.png>) · [A/B 나란히 비교](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/upscale-work/compare-a-attempt1.png>).
- A 입력: [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft/background-v1-1x.png>).

| 시도 | 판정 | 재생성·선택 이유 |
|---|---|---|
| 1 | 통과 · 선택 | 화풍·카메라·물체 크기, 재질·빛, 새 벽/가구 구성, 출구·빈 바닥 육안 확인 |

### 3단계 재작화·전체 검사

- 9조각, 총 9회 생성. 최종 20칸 모두 이동 (0,0), 비영점 칸 없음, 예외 승인 없음.
- RGB 평균 절대차: **8.74692**.
- HSV 채도 / 밝기 차: **+4.45961 / +1.29903**.
- 흰 면적 원본 / 결과: **0.21801% / 0.09190%**, 차 **-0.12611%p**.
- 최종 전체 수치 검사: 통과.
- [compare.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/upscale-work/compare.png>) · [원본/축소본 50% 겹침](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/upscale-work/overlay.png>) · [조각별 전체 검사 기록](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/02-gear-shaft-b/upscale-work/verification.json>).

| 조각 | 총 생성 | 선택 | 재생성 사유 | 선택 조각의 국소 검사 |
|---|---|---|---|---|
| r1c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c2 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c3 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r2c1 | 1회 | 1차 | 없음 | 통과 |
| r2c2 | 1회 | 1차 | 없음 | 통과 |
| r2c3 | 1회 | 1차 | 없음 | 통과 |
| r3c1 | 1회 | 1차 | 없음 | 통과 |
| r3c2 | 1회 | 1차 | 없음 | 통과 |
| r3c3 | 1회 | 1차 | 없음 | 통과 |

## 03-second-hand-gallery-b — 초침 회랑 B

### 저장 파일

| 파일 | 크기 |
|---|---|
| [background-v1.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/background-v1.png>) | 1536×1024px |
| [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/background-v1-1x.png>) | 1536×1024px |
| [background-v2x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/background-v2x.png>) | 3072×2048px |

### 1단계 생성·A 비교

- 생성 3회, 1차 선택. 최종: 미달 — 앞쪽 대리석 난간이 완만한 곡선으로 남아 금지된 둥근 전경 난간 조건 미달.
- 출구 중심: LEFT 통로 문턱 y≈52%; RIGHT 통로 문턱 y≈52%.
- [overlay-a.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/upscale-work/overlay-a.png>) · [A/B 나란히 비교](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/upscale-work/compare-a-attempt1.png>).
- A 입력: [background-v2-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery/background-v2-1x.png>).

| 시도 | 판정 | 재생성·선택 이유 |
|---|---|---|
| 1 | 미달 · 선택 | 앞쪽 대리석 난간이 완만한 곡선으로 남아 금지된 둥근 전경 난간 조건 미달 |
| 2 | 미달 | 앞쪽 곡선 난간이 남음; 상단 왼쪽의 창과 시계바늘 벽이 A 구성에 더 가까워 새 벽 구성 조건이 약함 |
| 3 | 미달 | 앞쪽 곡선 난간이 남음 |

초기 저장 뒤 최종 육안 검토에서 앞쪽 난간의 곡선을 발견해 2·3차를 추가 생성했습니다. 세 후보 모두 이 조건을 완전히 충족하지 못했습니다. 왼쪽 창과 뒤쪽 톱니 정비대 구성이 가장 잘 맞는 1차를 유지했으며 기존 출력은 덮어쓰지 않았습니다.

### 3단계 재작화·전체 검사

- 9조각, 총 9회 생성. 최종 20칸 모두 이동 (0,0), 비영점 칸 없음, 예외 승인 없음.
- RGB 평균 절대차: **8.88378**.
- HSV 채도 / 밝기 차: **+4.89109 / +2.15346**.
- 흰 면적 원본 / 결과: **0.55981% / 0.69528%**, 차 **+0.13547%p**.
- 최종 전체 수치 검사: 통과.
- [compare.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/upscale-work/compare.png>) · [원본/축소본 50% 겹침](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/upscale-work/overlay.png>) · [조각별 전체 검사 기록](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/03-second-hand-gallery-b/upscale-work/verification.json>).

| 조각 | 총 생성 | 선택 | 재생성 사유 | 선택 조각의 국소 검사 |
|---|---|---|---|---|
| r1c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c2 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c3 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r2c1 | 1회 | 1차 | 없음 | 통과 |
| r2c2 | 1회 | 1차 | 없음 | 통과 |
| r2c3 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r3c1 | 1회 | 1차 | 없음 | 통과 |
| r3c2 | 1회 | 1차 | 없음 | 통과 |
| r3c3 | 1회 | 1차 | 없음 | 흰 면적 차 |

## 06-pendulum-hall-b — 진자 홀 B

### 저장 파일

| 파일 | 크기 |
|---|---|
| [background-v1.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/background-v1.png>) | 1024×1536px |
| [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/background-v1-1x.png>) | 1024×1536px |
| [background-v2x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/background-v2x.png>) | 2048×3072px |

### 1단계 생성·A 비교

- 생성 3회, 1차 선택. 최종: 미달 — 상단 계단 뒤가 장미창 아래 벽으로 닫혀 보여 열린 상단 출구가 불명확함.
- 출구 중심: BOTTOM 입구 x≈50%; TOP 계단 발치 x≈50%(뒤쪽 벽으로 닫힘).
- [overlay-a.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/upscale-work/overlay-a.png>) · [A/B 나란히 비교](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/upscale-work/compare-a-attempt1.png>).
- A 입력: [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall/background-v1-1x.png>).

| 시도 | 판정 | 재생성·선택 이유 |
|---|---|---|
| 1 | 미달 · 선택 | 상단 계단 뒤가 장미창 아래 벽으로 닫혀 보여 열린 상단 출구가 불명확함 |
| 2 | 미달 | 상단 계단 뒤가 창 아래 벽으로 닫힘; 앞쪽 좌우에 둥근 벽과 하단 모서리 톱니가 남음 |
| 3 | 미달 | 상단 계단 뒤가 창 아래 벽으로 닫힘; 앞쪽 둥근 난간과 하단 모서리 톱니가 남음 |

세 후보 모두 상단 계단 끝이 창 아래 벽으로 닫혀 보입니다. 상단 계단 발치는 열려 있지만 위쪽으로 이어지는 통로 표현은 미달입니다. 선택한 1차에도 입구 양옆의 낮은 난간·기단이 완만한 곡선인 부분은 남습니다. 뒤쪽 벽 장치·장미창과 입구 전경은 A와 다르며 중앙 바닥은 비어 있습니다.

### 3단계 재작화·전체 검사

- 9조각, 총 10회 생성. 최종 20칸 모두 이동 (0,0), 비영점 칸 없음, 예외 승인 없음.
- RGB 평균 절대차: **7.10743**.
- HSV 채도 / 밝기 차: **+4.02875 / +1.14647**.
- 흰 면적 원본 / 결과: **0.03611% / 0.02767%**, 차 **-0.00844%p**.
- 최종 전체 수치 검사: 통과.
- [compare.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/upscale-work/compare.png>) · [원본/축소본 50% 겹침](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/upscale-work/overlay.png>) · [조각별 전체 검사 기록](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/06-pendulum-hall-b/upscale-work/verification.json>).

| 조각 | 총 생성 | 선택 | 재생성 사유 | 선택 조각의 국소 검사 |
|---|---|---|---|---|
| r1c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c2 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c3 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r2c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r2c2 | 1회 | 1차 | 없음 | 통과 |
| r2c3 | 1회 | 1차 | 없음 | 통과 |
| r3c1 | 1회 | 1차 | 없음 | 통과 |
| r3c2 | 1회 | 1차 | 없음 | 통과 |
| r3c3 | 2회 | 2차 | 생성 원본 비율 불일치로 난간·벽 경계 이동 | 통과 |

첫 합성에서 1x 기준 (640,960)칸 (-4,0), (960,960)칸 (-8,2), (960,1280)칸 (-8,0)이 검출됐습니다. 오른쪽 아래 r3c3의 생성 원본이 1145×1373으로 비율부터 달라 경계가 변한 것이 원인입니다. 같은 프롬프트의 2차로 교체해 세 칸 모두 (0,0)이 됐습니다. 바닥만 있는 칸으로 승인하지 않았습니다.

## 07-signal-orb-vault-b — 신호 구체 저장실 B

### 저장 파일

| 파일 | 크기 |
|---|---|
| [background-v1.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/background-v1.png>) | 1536×1024px |
| [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/background-v1-1x.png>) | 1536×1024px |
| [background-v2x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/background-v2x.png>) | 3072×2048px |

### 1단계 생성·A 비교

- 생성 1회, 1차 선택. 최종: 통과.
- 출구 중심: LEFT 통로 문턱 y≈36%; RIGHT 통로 문턱 y≈62%.
- [overlay-a.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/upscale-work/overlay-a.png>) · [A/B 나란히 비교](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/upscale-work/compare-a-attempt1.png>).
- A 입력: [background-v2-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault/background-v2-1x.png>).

| 시도 | 판정 | 재생성·선택 이유 |
|---|---|---|
| 1 | 통과 · 선택 | 화풍·카메라·물체 크기, 재질·빛, 새 벽/가구 구성, 출구·빈 바닥 육안 확인 |

### 3단계 재작화·전체 검사

- 9조각, 총 11회 생성. 최종 20칸 모두 이동 (0,0), 비영점 칸 없음, 예외 승인 없음.
- RGB 평균 절대차: **9.96776**.
- HSV 채도 / 밝기 차: **+4.06544 / +1.58559**.
- 흰 면적 원본 / 결과: **0.55586% / 0.73654%**, 차 **+0.18067%p**.
- 최종 전체 수치 검사: 통과.
- [compare.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/upscale-work/compare.png>) · [원본/축소본 50% 겹침](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/upscale-work/overlay.png>) · [조각별 전체 검사 기록](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/07-signal-orb-vault-b/upscale-work/verification.json>).

| 조각 | 총 생성 | 선택 | 재생성 사유 | 선택 조각의 국소 검사 |
|---|---|---|---|---|
| r1c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c2 | 1회 | 1차 | 없음 | 통과 |
| r1c3 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r2c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r2c2 | 1회 | 1차 | 없음 | 통과 |
| r2c3 | 1회 | 1차 | 없음 | 통과 |
| r3c1 | 1회 | 1차 | 없음 | 통과 |
| r3c2 | 1회 | 1차 | 없음 | 통과 |
| r3c3 | 3회 | 3차 | 짚 포장재에 꽃 모양 추가; 3차 육안 선택 | 채도·밝기 차 |

r3c3은 1차의 짚 포장재가 꽃 무늬로 바뀌어 2·3차를 생성했습니다. 3차는 포장재 형태를 가장 잘 보존해 육안으로 선택했습니다. 조각의 국소 채도 차는 남지만 최종 전체 채도 +4.065, 밝기 +1.586, 흰 면적 차 +0.181%p로 모두 통과했습니다. 입력·출력 기하 변형이나 원본 픽셀 중첩은 하지 않았습니다.

## 08-belfry-wiring-room-b — 종루 아래 배선실 B

### 저장 파일

| 파일 | 크기 |
|---|---|
| [background-v1.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/background-v1.png>) | 1536×1024px |
| [background-v1-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/background-v1-1x.png>) | 1536×1024px |
| [background-v2x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/background-v2x.png>) | 3072×2048px |

### 1단계 생성·A 비교

- 생성 1회, 1차 선택. 최종: 통과.
- 출구 중심: LEFT 통로 문턱 y≈50%; RIGHT 상승 계단 y≈30%.
- [overlay-a.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/upscale-work/overlay-a.png>) · [A/B 나란히 비교](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/upscale-work/compare-a-attempt1.png>).
- A 입력: [background-v2-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room/background-v2-1x.png>).

| 시도 | 판정 | 재생성·선택 이유 |
|---|---|---|
| 1 | 통과 · 선택 | 화풍·카메라·물체 크기, 재질·빛, 새 벽/가구 구성, 출구·빈 바닥 육안 확인 |

### 3단계 재작화·전체 검사

- 9조각, 총 9회 생성. 최종 20칸 모두 이동 (0,0), 비영점 칸 없음, 예외 승인 없음.
- RGB 평균 절대차: **9.40841**.
- HSV 채도 / 밝기 차: **+2.04147 / +1.04570**.
- 흰 면적 원본 / 결과: **0.36151% / 0.41645%**, 차 **+0.05495%p**.
- 최종 전체 수치 검사: 통과.
- [compare.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/upscale-work/compare.png>) · [원본/축소본 50% 겹침](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/upscale-work/overlay.png>) · [조각별 전체 검사 기록](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/08-belfry-wiring-room-b/upscale-work/verification.json>).

| 조각 | 총 생성 | 선택 | 재생성 사유 | 선택 조각의 국소 검사 |
|---|---|---|---|---|
| r1c1 | 1회 | 1차 | 없음 | 채도·밝기 차 |
| r1c2 | 1회 | 1차 | 없음 | 통과 |
| r1c3 | 1회 | 1차 | 없음 | 통과 |
| r2c1 | 1회 | 1차 | 없음 | 통과 |
| r2c2 | 1회 | 1차 | 없음 | 통과 |
| r2c3 | 1회 | 1차 | 없음 | 통과 |
| r3c1 | 1회 | 1차 | 없음 | 통과 |
| r3c2 | 1회 | 1차 | 없음 | 통과 |
| r3c3 | 1회 | 1차 | 없음 | 통과 |

## 기준을 못 맞춘 방

- **01 시계탑 정문 B**: 재작화 9조각을 각각 최대 3회 생성했으나 전체 채도 차 **+5.602**가 허용 ±5를 넘었습니다. 배치·RGB·밝기·흰 면적 검사는 통과했습니다.
- **03 초침 회랑 B**: 같은 프롬프트로 3회 생성했으나 앞쪽 대리석 난간의 곡선을 없애지 못했습니다. 1차를 최선으로 유지했습니다. 2배 재작화 수치 검사는 모두 통과했습니다.
- **06 진자 홀 B**: 3회 생성했으나 상단 계단 뒤가 창 아래 벽으로 막혀 보이는 출구 표현이 남습니다. 입구 양옆 낮은 난간·기단의 완만한 곡선도 일부 남습니다. 전경이 가장 정돈된 1차를 선택했습니다. 2배 재작화는 r3c3 한 번 재생성 후 모든 수치 검사를 통과했습니다.

## 파일 보존 확인

- 작업 전 기록한 기존 686개 파일의 SHA-256을 다시 비교: 변경·삭제 **0개**.
- 6개 방 × 3개 결과 = 18개 PNG의 크기·불투명 여부 확인 완료. 생성 원본은 생성기가 반환한 파일과 바이트 해시가 같습니다. 게임 크기 1x는 원본과 픽셀이 같고, 2배 결과는 각 방의 정확히 2배입니다.
- 6개 지정 프롬프트와 A 입력의 해시, 54개 입력 조각, A 업스케일 프롬프트 재사용, 조각당 최대 3회, 모든 생성 raw 파일 보존을 확인했습니다.
- 코드·데이터·기존 그림·마스크 수정 없음. 커밋·푸시 없음.
