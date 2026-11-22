# 오른쪽 계단통 그림 작업 보고 — 2026-11-21

요청한 네 장면의 새 그림 12개를 저장했습니다. 서쪽 입구가 열리고 계단이 동쪽의 바닥 아래로 내려가는 형태입니다. **전체 검수 통과본은 아닙니다.** 네 장 모두 원본 편집을 세 번씩 시도했으며, 아래에 남은 윤곽 차이·합성 경계·색상 및 보존 미달을 명시합니다.

## 저장한 파일 12개

모든 PNG는 불투명 RGB입니다. WebP는 2배 PNG에서 quality 85, method 6으로 저장했습니다. 기존 이름이 없음을 확인한 새 이름만 사용했습니다.

| 장면 | 파일 | 크기(px) | 파일 크기(byte) |
| --- | --- | ---: | ---: |
| A | [background-v3-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/background-v3-1x.png>) | 1728×1152 | 3,554,507 |
| A | [background-v3x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/background-v3x.png>) | 3456×2304 | 14,102,218 |
| A | [background-v3-2x-q85.webp](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/background-v3-2x-q85.webp>) | 3456×2304 | 1,596,064 |
| B | [collapse-1-cracking-v3-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-1-cracking-v3-1x.png>) | 1728×1152 | 3,561,118 |
| B | [collapse-1-cracking-v3x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-1-cracking-v3x.png>) | 3456×2304 | 14,262,286 |
| B | [collapse-1-cracking-v3-2x-q85.webp](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-1-cracking-v3-2x-q85.webp>) | 3456×2304 | 1,648,736 |
| C | [collapse-2-open-v3-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-2-open-v3-1x.png>) | 1728×1152 | 3,477,746 |
| C | [collapse-2-open-v3x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-2-open-v3x.png>) | 3456×2304 | 14,107,856 |
| C | [collapse-2-open-v3-2x-q85.webp](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/10-tuning-chamber/collapse-2-open-v3-2x-q85.webp>) | 3456×2304 | 1,620,552 |
| D | [background-v6-1x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/11-ruined-summit/background-v6-1x.png>) | 1728×1152 | 3,331,486 |
| D | [background-v6x.png](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/11-ruined-summit/background-v6x.png>) | 3456×2304 | 13,422,373 |
| D | [background-v6-2x-q85.webp](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/11-ruined-summit/background-v6-2x-q85.webp>) | 3456×2304 | 1,433,666 |

파일별 SHA-256: [export-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/export-verification.json>).

## 편집·2배 제작 방법

- 내장 이미지 생성 도구로 원본을 편집했습니다. 지시서 프롬프트 A와 B·C·D를 그대로 사용했고, B·C·D는 해당 상태 마지막 한 줄만 선택했습니다. 저장한 프롬프트와 지시서의 정규화된 문자열 일치를 확인했습니다.
- A를 먼저 만들고, B·C·D 편집마다 각 원본을 입력 1, 완성된 A 1배를 입력 2로 넣었습니다. 편집 생성 원본은 1536×1024로 반환되어 1728×1152로 정규화했습니다.
- x1430~1728, y330~790 안쪽 경계에서 10px로 섞고, 바깥은 각 원본 픽셀로 복원했습니다. 지정 작업대와 보행 바닥, 장면별 보호 마스크도 원본을 복원했습니다. A는 보행 범위를 침범했던 북쪽 공 기둥만 (+50, −20)px 이동해 합성했습니다. 이 과정의 기둥 아래 흔적은 미달 항목입니다.
- A01의 3×3 분할에서 편집 영역과 겹치는 오른쪽 열 세 조각만 다시 그렸습니다. 1배 crop은 x1037, y0/346/691의 691×461입니다. 재작화 결과를 1382×922로 정규화하고 A01의 RGB 평균·표준편차 보정과 후보 순위를 그대로 사용했습니다.
- 2배 배치는 x2074, y0/692/1382이며, 세 조각의 겹침은 A01 axis_weight로 합성했습니다. 완성한 오른쪽 열에서 편집 마스크 부분만 사용하고 나머지는 각 장면의 기존 2배 원본을 복원했습니다.
- 2배 B 첫 후보들은 대응하는 A의 완성 2배 조각도 참고했습니다. 위치 이동이 관측되어 B 재시도와 C·D 2배는 각 장면의 완성 1배 조각만 사용했습니다. 2배 프롬프트 본문은 동일합니다. 이는 1배 B·C·D 편집에 A를 넣으라는 절차와 별개입니다.

A01 기준 구현: [stitch.py](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/chapters/3-clock-tower/maps/01-tower-gate/upscale-work/stitch.py>). 2배 프롬프트: [upscale.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/upscale.prompt.txt>).

| 장면 | 1배 생성 횟수 | 채택 후보 | 2배 조각별 횟수(위/중간/아래) | 채택 2배 후보 |
| --- | ---: | ---: | --- | --- |
| A | 3 | 1 | 1 / 1 / 2 | 1 / 1 / 2 |
| B | 3 | 1 | 2 / 2 / 3 | 2 / 2 / 3 |
| C | 3 | 3 | 1 / 1 / 3 | 1 / 1 / 2 |
| D | 3 | 2 | 1 / 1 / 1 | 1 / 1 / 1 |

B는 2·3차 후보가 A와의 난간 위치 차이 또는 맨 윗단 표현을 개선하지 못해 1차 결과를 유지했습니다. A·C·D도 방향·보행 공간·상태 표현을 함께 보고 선택했습니다.

## 픽셀 보존 검사

범위는 반열린 구간으로 검사했습니다. 보행 구역은 지시서 끝 좌표를 포함해 x1290:1471, y540:761을 보호했습니다. **차이 0은 무손실 PNG 기준**입니다. 손실 압축인 WebP에는 같은 픽셀 동일성을 주장하지 않습니다.

| 장면 | 1배: 영역 밖 / 작업대 / 보행 바닥 | 2배: 영역 밖 / 작업대 / 보행 바닥 | 기타 보호 마스크 안 변경(1배/2배) |
| --- | --- | --- | --- |
| A | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 |
| B | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 |
| C | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 |
| D | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 |

수치 원본: [final-pixel-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/final-pixel-verification.json>). 10·11 폴더의 작업 전 그림 559개는 SHA-256 변경 0개입니다. 이 작업은 게임 코드·데이터·테스트를 편집하지 않았습니다. 다만 전체 시작 스냅샷 727개 중 그림 외 30개에서 작업 도중 해시 변경이 관측되었습니다. 작성 주체는 확인하지 않았으며, 동시 진행 중인 별도 작업일 수 있습니다. 해당 파일들은 되돌리지 않았습니다. 목록은 [export-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/export-verification.json>)에 있습니다.

**범위 밖 보존과 편집 구역 안의 모든 소품 보존은 다른 검사입니다.** 마스크로 보호한 D의 기둥·붉은 천·종은 원본을 사용했지만, 편집 구역 안의 기존 하늘까지 전부 복원하지는 못했습니다. 아래 추가 표본은 이 제한을 보여 줍니다.

| 장면 | 기존 하늘 표본(1배 좌표 x1540:1570, y430:445)의 변경 픽셀: 1배 / 2배 |
| --- | --- |
| C | 450 / 450 · 1799 / 1800 |
| D | 450 / 450 · 1800 / 1800 |

## 계단 방향·입구·보행 공간

네 장 모두 서쪽 변은 열려 있고 계단 단면은 오른쪽 안쪽으로 낮아지며, 아래층의 따뜻한 빛이 보입니다. 지정 보행 사각형에는 새 난간·기둥·돌을 두지 않았습니다. B의 맨 윗단 금, C·D의 깨진 난간과 단 모서리도 확인했습니다. 단, A의 북쪽 기둥 하단 연결과 서쪽 맨 윗단의 경계 때문에 완전히 자연스러운 바닥 높이 연결로 판정하지는 않습니다.

| 장면 | 계단통 3배 확대(1배 / 2배 원본 기준) | 오른쪽 구역 비교(1배 / 2배) |
| --- | --- | --- |
| A | [1배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-final-1x-stairwell-3x.png>) / [2배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-final-2x-stairwell-3x.png>) | [1배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-comparison-1x.png>) / [2배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-comparison-2x.png>) |
| B | [1배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-final-1x-stairwell-3x.png>) / [2배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-final-2x-stairwell-3x.png>) | [1배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-comparison-1x.png>) / [2배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-comparison-2x.png>) |
| C | [1배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-final-1x-stairwell-3x.png>) / [2배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-final-2x-stairwell-3x.png>) | [1배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-comparison-1x.png>) / [2배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-comparison-2x.png>) |
| D | [1배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-final-1x-stairwell-3x.png>) / [2배 확대](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-final-2x-stairwell-3x.png>) | [1배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-comparison-1x.png>) / [2배 비교](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-comparison-2x.png>) |

각 비교는 원본/새 그림의 x1150:1728, y250:950을 나란히 배치했습니다. 3배 확대는 각 PNG의 실제 픽셀을 최근접 확대했습니다.

## 네 장 일치: 미달

A와 각 장면의 입구 공 두 개·북/남 난간 표본을 ±45px 안에서 정규화 상관도로 비교했습니다. 아래 값은 **부분 표본의 이동량**이며, 완전한 윤곽 거리나 전 구간 최대 오차를 뜻하지 않습니다. 파손으로 달라진 면은 상관도가 낮아 수치의 신뢰도가 떨어집니다.

| 장면 | 북쪽 공 Δx,Δy | 남쪽 공 Δx,Δy | 북쪽 난간 Δx,Δy | 남쪽 난간 Δx,Δy |
| --- | --- | --- | --- | --- |
| B | (+2, -1), r=0.835 | (+1, +0), r=0.908 | (+1, +0), r=0.951 | (+0, +1), r=0.976 |
| C | (-17, +1), r=0.757 | (-6, -9), r=0.863 | (-32, +16), r=0.722 | (-27, +1), r=0.732 |
| D | (-4, +31), r=0.701 | (+0, -2), r=0.794 | (+6, +45), r=0.576 | (-22, +11), r=0.794 |

B 표본은 2px 이내이지만 전체 윤곽의 6px 이내를 수치로 증명한 것은 아닙니다. C는 북쪽 공의 수평 차이 17px, D는 북쪽 공의 수직 차이 31px가 남아 **네 장 모두 6px 이내라는 기준은 미달**입니다. D 북쪽 난간의 +45px는 탐색 끝·낮은 상관도에 걸린 값이므로 확정된 윤곽 오차로 사용하지 않습니다.

겹침 자료: [네 장 평균 겹침](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-ABCD-average-1x-3x.png>), [색상별 경계 겹침(A 빨강/B 파랑/C 초록/D 보라)](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-ABCD-edges-1x-3x.png>).

| 비교 | 1배 겹침 | 2배 겹침 |
| --- | --- | --- |
| A/B | [overlay-A-B-1x-3x.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-A-B-1x-3x.png>) | [overlay-A-B-2x-3x.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-A-B-2x-3x.png>) |
| A/C | [overlay-A-C-1x-3x.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-A-C-1x-3x.png>) | [overlay-A-C-2x-3x.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-A-C-2x-3x.png>) |
| A/D | [overlay-A-D-1x-3x.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-A-D-1x-3x.png>) | [overlay-A-D-2x-3x.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/overlay-A-D-2x-3x.png>) |

표본 좌표·상관도: [selected-cross-scene-alignment.json](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/selected-cross-scene-alignment.json>). 모든 후보별 정렬 파일도 같은 작업 폴더에 있습니다.

## 줄눈·합성 경계: 미달

장면마다 1배·2배 각각 다섯 곳의 실제 4배 확대를 남겼습니다. 검사 구간(1배 px)은 ① x1390:1470,y540:660, ② x1510:1630,y290:370, ③ x1510:1630,y750:830, ④ x1431:1511,y560:680, ⑤ x1470:1570,y440:540입니다. ①②③은 경계 위아래 40px를 포함하고, ④는 보행 보호 경계 x1471, ⑤는 작업대/북쪽 난간 연결을 봅니다.

네 장의 ④에서 원본 보행 바닥과 생성 바닥이 만나는 수직 명암 경계 및 줄눈의 어긋남이 보입니다. A에는 북쪽 기둥 아래에 잘린 밝은 조각과 받침 연결 흔적도 남았습니다. 특히 2배에서 원본과 재작화된 타일 선의 굵기 차이가 더 보입니다. 따라서 “끊김·겹침 없는 줄눈” 통과로 표시하지 않습니다.

| 장면 | 1배 4배 확대(①~⑤) | 2배 4배 확대(①~⑤) |
| --- | --- | --- |
| A | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-1x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-1x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-1x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-1x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-1x-seam-5-4x.png>) | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-2x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-2x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-2x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-2x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-2x-seam-5-4x.png>) |
| B | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-1x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-1x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-1x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-1x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-1x-seam-5-4x.png>) | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-2x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-2x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-2x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-2x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-2x-seam-5-4x.png>) |
| C | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-1x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-1x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-1x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-1x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-1x-seam-5-4x.png>) | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-2x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-2x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-2x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-2x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-2x-seam-5-4x.png>) |
| D | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-1x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-1x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-1x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-1x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-1x-seam-5-4x.png>) | [1](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-2x-seam-1-4x.png>) / [2](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-2x-seam-2-4x.png>) / [3](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-2x-seam-3-4x.png>) / [4](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-2x-seam-4-4x.png>) / [5](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-2x-seam-5-4x.png>) |

모아보기: [AB 1배](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/seam-contact-AB-1x.png>), [AB 2배](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/seam-contact-AB-2x.png>), [CD 1배](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/seam-contact-CD-1x.png>), [CD 2배](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/seam-contact-CD-2x.png>). 모아보기는 축소 미리보기이고, 위 개별 파일이 원래 4배 확대입니다.

## 바닥 채도·밝기

Pillow HSV의 S/V 0~255 평균입니다. 지시서 ±5 기준으로 비교했습니다. 먼저 출구 바로 서쪽의 보존된 바닥 x1450:1470,y620:740과 그 옆 원본 x1430:1450,y620:740을 비교했습니다. 이 표본은 원본 픽셀이므로 **재작화 바닥 전체의 색상 일치 증거가 아닙니다**. C·D 1배 밝기 미달은 이 원본 바닥에 이미 존재하는 인접 조명 차이입니다.

| 장면 | 1배 ΔS / ΔV | 2배 ΔS / ΔV |
| --- | ---: | ---: |
| A | +1.116 / -1.177 | +0.789 / -2.930 |
| B | +2.055 / -2.481 | +1.953 / -2.002 |
| C | +3.060 / +6.524 | +2.175 / +2.119 |
| D | +4.179 / +6.621 | +3.475 / +4.806 |

추가로 실제 합성된 바닥 x1473:1491,y705:725와 옆 원본 바닥 x1451:1469,y705:725를 비교했습니다. 한정된 바닥 표본이며 표면 조명·그림자 차이도 포함합니다.

| 장면 | 실제 합성 바닥 1배 ΔS / ΔV | 실제 합성 바닥 2배 ΔS / ΔV |
| --- | ---: | ---: |
| A | +4.200 / +10.850 — 미달 | +2.679 / +10.430 — 미달 |
| B | +5.092 / +17.300 — 미달 | +9.606 / +12.485 — 미달 |
| C | +0.431 / -10.086 — 미달 | +3.100 / -4.527 — 통과 |
| D | +3.833 / +7.961 — 미달 | +5.320 / +10.354 — 미달 |

원본 S/V 평균과 추가 하늘 표본: [supplemental-visual-metrics.json](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/supplemental-visual-metrics.json>). 원본 보존 범위를 다시 칠해 색상 수치를 맞추지는 않았습니다.

## 2배 조각 검사

A01 기준: 축소 비교 RGB 평균 차이≤30, S/V 차이 각각±5, RGB 모두235 이상인 흰 영역 차이±0.5%p, 320px 셀의 경계 최적 이동(2px 간격 탐색)이 모두 0입니다. 이는 셀 단위 보조 검사이며 개별 기둥·줄눈의 완전한 일치를 보증하지 않습니다.

| 장면/행 | RGB 차이 | ΔS / ΔV | 흰 영역 Δ%p | 이동 셀 수 | 판정 |
| --- | ---: | ---: | ---: | ---: | --- |
| A/1 | 13.457 | +1.538 / +0.146 | +0.040 | 0 | 통과 |
| A/2 | 10.142 | +0.437 / -0.334 | +0.401 | 0 | 통과 |
| A/3 | 11.352 | +2.545 / +0.641 | +0.178 | 0 | 통과 |
| B/1 | 13.945 | +2.259 / +0.177 | -0.027 | 0 | 통과 |
| B/2 | 9.492 | +1.307 / -0.085 | +0.369 | 0 | 통과 |
| B/3 | 11.464 | +1.914 / +0.115 | +0.418 | 0 | 통과 |
| C/1 | 9.191 | +1.341 / +0.132 | +0.449 | 0 | 통과 |
| C/2 | 8.826 | +0.609 / -0.064 | +0.262 | 0 | 통과 |
| C/3 | 11.421 | +2.409 / +0.423 | +0.531 | 0 | 미달: white_area |
| D/1 | 8.572 | +1.437 / +0.906 | -0.133 | 0 | 통과 |
| D/2 | 9.271 | +1.464 / +0.362 | +0.170 | 0 | 통과 |
| D/3 | 9.620 | +1.673 / +0.619 | +0.390 | 0 | 통과 |

C 아래 조각은 3회 후 최선인 2차를 채택했지만 흰 영역 차이 +0.531%p로 미달입니다. 사용하지 않은 영역의 화분·유리까지 포함한 전체 조각 검사이며, 최종 PNG에서는 마스크 밖을 모두 원본으로 복원했습니다.

세부 후보/원시·보정 수치: [A](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/upscale-A-verification.json>), [B](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/upscale-B-verification.json>), [C](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/upscale-C-verification.json>), [D](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/upscale-D-verification.json>).

## Claude 인계: 입구 맨 윗단 중심

모두 1배 그림의 왼쪽 위를 (0,0)으로 한 px 좌표입니다. 시각적으로 추정한 맨 윗단 발판 중심이며 약 ±8px의 읽기 오차가 있습니다. 평소 장면 A의 시작 위치 후보는 **(1490, 650)**입니다. 발 위치 기준이며 스프라이트 중심·충돌 범위·깊이 마스크는 이 작업에서 검증하거나 연결하지 않았습니다.

| 장면 | 맨 윗단 중심 추정(x,y) | 표시 그림 |
| --- | --- | --- |
| A | (1490, 650) | [A-top-step-centre.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/A-top-step-centre.png>) |
| B | (1490, 648) | [B-top-step-centre.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/B-top-step-centre.png>) |
| C | (1488, 639) | [C-top-step-centre.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/C-top-step-centre.png>) |
| D | (1490, 650) | [D-top-step-centre.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/D-top-step-centre.png>) |

좌표 눈금 비교: [top-step-coordinate-guide.png](<C:/Users/ans45/.codex/visualizations/2026/11/21/01a1fc46-4589-7d01-97fc-412ec9b8fb1f/stairwell-20261121/top-step-coordinate-guide.png>). C·D 윤곽 미달이 있으므로 네 장을 완전히 같은 출입 윤곽으로 간주하지 않아야 합니다.

## 남은 항목

- 네 장 모두 보행 원본과 합성 바닥 사이의 줄눈·명암 연결이 매끄럽지 않습니다. A 북쪽 기둥의 하단 접합 흔적도 남았습니다.
- C·D는 A와의 공 기둥/난간 윤곽 차이 6px 기준에 미달합니다. B는 표본은 맞지만 전체 윤곽 거리 통과를 보증하지 않습니다.
- C·D의 편집 구역 안 기존 하늘은 일부 생성 결과로 바뀌었습니다. 편집 구역 밖 차이 0 및 지정 보호물 보존과 구분해야 합니다.
- 원본 보존 바닥의 C·D 1배 밝기는 ±5 밖입니다. 실제 합성 바닥의 추가 표본 판정도 위 표에 그대로 남겼습니다.
- C의 2배 아래 조각 흰 영역 차이는 +0.531%p로 0.5%p 기준을 조금 넘습니다.
- 네 장 모두 1배 생성 3회 한도에 도달했습니다. 결과물은 미달이 기록된 검토용 후보이며, 모든 기준을 통과한 최종 승인본으로 표시하지 않습니다.

게임 연결·이동 범위·깊이 마스크·시작 위치·컷신 교체는 수행하지 않았고, 커밋·푸시도 하지 않았습니다.
