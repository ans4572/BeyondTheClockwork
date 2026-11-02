# 확장 전투맵 배경 프롬프트

프롬프트를 그대로 붙여 넣고, 표의 참조 그림을 함께 넣어 생성합니다. 결과는 `저장 위치`에 PNG로 저장합니다. 자르기와 게임 연결은 그 뒤에 진행합니다.

| 구간 | 방 | 프롬프트 | 참조 그림 | 저장 위치 | 최종 맵 |
|---|---|---|---|---|---|
| 1 | 첫 걸음 광장 | `first-step-a/background-large.prompt.txt` | `first-step-a/background.png` | `first-step-a/background-large.png` | 38×24 |
| 2 | 사탕 수레마당 | `ribbon-alley-c/background-large.prompt.txt` | `ribbon-alley-c/background.png` | `ribbon-alley-c/background-large.png` | 38×24 |
| 3 | 장난감 수선길 | `workshop-road-a/background-large.prompt.txt` | `workshop-road-a/background.png` | `workshop-road-a/background-large.png` | 46×20 |
| 4 | 리본 교차골목 | `ribbon-alley-d/background-large.prompt.txt` | `ribbon-alley-d/background.png` | `ribbon-alley-d/background-large.png` | 38×25 |
| 5 | 분실물 회수소 | `lost-and-found/background-large.prompt.txt` | `workshop-road-a/background.png` | `lost-and-found/background-large.png` | 34×22 |

맵 1유닛은 40픽셀입니다. 5장 모두 1536×1024로 받아 38.4×25.6유닛으로 게임에 연결했습니다. 표의 최종 맵 크기는 제작 전 계획값입니다. 3구간은 사물이 이미 기존 맵보다 커서 키우지 않고 원본 그대로 썼습니다.

## 야시장 이후 6장

구간이 뒤로 갈수록 해가 져서, 11구간과 브라스 방은 밤입니다. 첫 번째 참조로 아래 표의 그림을, 두 번째 참조로 `night-market/background-v2.png`를 넣습니다. 결과는 1536×1024면 됩니다.

| 구간 | 방 | 프롬프트 | 참조 그림 1 | 저장 위치 |
|---|---|---|---|---|
| 07 | 태엽 적재마당 | `workshop-road-c/background-large.prompt.txt` | `workshop-road-c/background.png` | `workshop-road-c/background-large.png` |
| 08 | 분수 우회광장 | `first-step-c/background-large.prompt.txt` | `first-step-c/background.png` | `first-step-c/background-large.png` |
| 09 | 깃발 검문광장 | `parade-approach-c/background-large.prompt.txt` | `parade-approach-c/background.png` | `parade-approach-c/background-large.png` |
| 10 | 사탕색 골목 | `ribbon-alley-a/background-large.prompt.txt` | `ribbon-alley-a/background.png` | `ribbon-alley-a/background-large.png` |
| 11 | 행진 적재뜰 | `parade-approach-d/background-large.prompt.txt` | `parade-approach-d/background.png` | `parade-approach-d/background-large.png` |
| 12 | 멈추지 않는 행진 | `march-gate/background-large.prompt.txt` | `parade-approach-d/background.png` | `march-gate/background-large.png` |
