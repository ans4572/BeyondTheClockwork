# F2 그림체 개선 시범 제작 v1 (2026-11-26)

3챕터 보스(벨가드·틱톡)보다 F2가 단순해 보이는 문제를 줄이려는 시범 제작이다. 디자인·크기·실루엣은 그대로 두고 명암과 금속 표현만 보스 수준으로 올렸다. 게임에는 아직 적용하지 않았다.

- `base-south-current.png`: 지금 F2 정면(PixelLab 캐릭터 3f7a0f77, 96×96).
- `base-south-belgard-style.png`: 채택 후보 A. `edit_image_pro_flash`(method=reference)에 벨가드 대기 프레임의 머리·가슴 96×96 조각(`style-ref-belgard.png`)을 그림체 기준으로 줌. 몸 범위(bbox)가 원본과 같음(10,6)-(75,89). 색 47 → 93.
- `base-south-tick-style.png`: 후보 B, 틱 조각(`style-ref-tick.png`) 기준. A보다 조금 부드러움.
- `idle-south/`, `walk-south/`: A를 132×132 캔버스 가운데(18,18)에 놓고 PixMiniMax로 만든 정면 대기 8장·걷기 12장. `0.png`는 입력 프레임(반복 재생에서 뺌). 기존 locomotion 프롬프트와 같은 동작 설명.
- `compare.gif`, `compare-still.png`: 옛 F2·새 F2(대기·걷기)와 틱·벨가드를 게임 화면 크기 그대로 3배 확대해 나란히 놓은 비교.

## v2: 헬멧 얼룩 제거(사용자 요청, 2026-11-26)

- `base-south-v2-clean.png`: A의 헬멧 왼쪽 위 초록 천 조각(얼룩처럼 보임)과 화면 왼쪽 노란 점 1개를 `inpaint_image_pro_flash`로 지움. 마스크 `mask-helmet-patch.png`(149픽셀) 밖은 원본과 바이트 단위로 같음. 몸 범위 그대로.
- `idle-south-v2/`, `walk-south-v2/`: v2로 다시 만든 정면 대기 8장·걷기 12장(같은 프롬프트에 '헬멧은 깨끗한 아이보리' 추가). 헬멧 윗부분 초록 픽셀이 프레임마다 약 80 → 0(남은 건 외곽선·눈·렌치 색).
- `clean-compare.png`: A와 v2 비교. `compare-v2.gif`: 옛 F2·v2와 틱·벨가드 비교.
- v2에 쓴 생성: 인페인트 5 + 애니메이션 2 = 7회.

사용한 생성(v1): 그림체 편집 5 × 2 = 10, 애니메이션 1 + 1 = 2, 합계 12회(남은 497회). 132px 캔버스에서 12프레임 클립이 1회로 계산됨을 확인.
