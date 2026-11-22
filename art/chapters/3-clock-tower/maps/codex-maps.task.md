# Codex 작업: 3장 중앙시계탑 방 그림 11장 생성

저장소 루트(`Beyond the Clockwork`) 기준 경로입니다. 이미지 생성만 하고, 코드·데이터(`src/`, `test/`, `worker/`)와 기존 그림은 건드리지 않습니다. 커밋·푸시는 하지 않습니다.

## 입력 이미지

- 입력 이미지 1 = `art/chapters/1-smile-street/maps/01-first-step-plaza/background-compact-v1.png` (1장 전투 방, 화풍·카메라·물체 크기 기준, 1536×1024)
- 입력 이미지 2 = `art/scenes/clocktower-summit/background-v2.png` (시계탑 안 이야기 장면, 재료·색 기준)
- 입력 이미지 3 = 01 시계탑 정문의 결과 `art/chapters/3-clock-tower/maps/01-tower-gate/background-v1.png` (02~11만)

## 할 일

1. **01 시계탑 정문을 먼저** 만들고 아래 확인을 통과시킵니다. 나머지 방은 이 그림을 입력 이미지 3으로 씁니다.
2. 02~11을 표 순서대로 만듭니다.
3. 방마다 `프롬프트` 파일 내용을 그대로 이미지 생성 프롬프트로 씁니다(요약·번역·수정 금지). 입력 이미지는 위 순서 그대로 넣습니다(프롬프트가 "input image 1/2/3"으로 부릅니다).
4. 결과는 생성된 크기 그대로 `저장 위치`에 PNG로 저장합니다(게임 크기로 줄이는 것은 이쪽에서 함). 파일이 이미 있으면 덮어쓰지 말고 `-v2`, `-v3`으로 새 이름을 씁니다.

| # | 방 | 종류 | 프롬프트 | 입력 | 출력 크기 | 저장 위치 |
|---|---|---|---|---|---|---|
| 01 | 시계탑 정문 | 일반 | `art/chapters/3-clock-tower/maps/01-tower-gate/background.prompt.txt` | 1·2 | 1536x1024 | `art/chapters/3-clock-tower/maps/01-tower-gate/background-v1.png` |
| 02 | 톱니 승강로 | 일반 | `art/chapters/3-clock-tower/maps/02-gear-shaft/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/02-gear-shaft/background-v1.png` |
| 03 | 초침 회랑 | 일반 | `art/chapters/3-clock-tower/maps/03-second-hand-gallery/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/03-second-hand-gallery/background-v1.png` |
| 04 | 계단 기관실 | 중간 보스 · 시간지기 틱·톡 | `art/chapters/3-clock-tower/maps/04-stair-engine-room/background.prompt.txt` | 1·2·3 | 1024x1024 | `art/chapters/3-clock-tower/maps/04-stair-engine-room/background-v1.png` |
| 05 | 멈춘 시계 다락 | 쉼터 · 상점 | `art/chapters/3-clock-tower/maps/05-stopped-clock-attic/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/05-stopped-clock-attic/background-v1.png` |
| 06 | 진자 홀 | 일반 (정예 시작) | `art/chapters/3-clock-tower/maps/06-pendulum-hall/background.prompt.txt` | 1·2·3 | 1024x1536 | `art/chapters/3-clock-tower/maps/06-pendulum-hall/background-v1.png` |
| 07 | 신호 구체 저장실 | 일반 | `art/chapters/3-clock-tower/maps/07-signal-orb-vault/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/07-signal-orb-vault/background-v1.png` |
| 08 | 종루 아래 배선실 | 일반 | `art/chapters/3-clock-tower/maps/08-belfry-wiring-room/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/08-belfry-wiring-room/background-v1.png` |
| 09 | 종루 | 구역 보스 · 종루수호자 벨가드 | `art/chapters/3-clock-tower/maps/09-belfry/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/09-belfry/background-v1.png` |
| 10 | 조율실 | 최종 보스 1 · 대조율사 오르덴 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/10-tuning-chamber/background-v1.png` |
| 11 | 무너진 탑 꼭대기 | 최종 보스 2 · 오르덴 · 마지막 정각 | `art/chapters/3-clock-tower/maps/11-ruined-summit/background.prompt.txt` | 1·2·3 | 1536x1024 | `art/chapters/3-clock-tower/maps/11-ruined-summit/background-v1.png` |

## 저장 전 확인 (한 장씩)

하나라도 걸리면 같은 프롬프트로 다시 생성합니다(최대 3번, 그래도 안 되면 가장 나은 것을 저장하고 보고).

- 입력 이미지 1과 같은 화풍(픽셀 아트)·쿼터뷰 카메라·물체 크기다. 입력 이미지 2의 그림체나 정면 카메라를 따라가지 않았다.
- 출구 수와 위치가 프롬프트의 EXITS와 같다(11번은 왼쪽 하나뿐).
- 가운데 싸우는 바닥이 비어 있고, 크기가 프롬프트의 비율과 비슷하다. 04번은 바닥이 정사각형(가로 = 세로)이다.
- 시계 문자판에 숫자·글자가 없다. 사람·인형·캐릭터·보스·글자·숫자·UI가 없다.
- 보스 방(04·09·10·11)은 ROOM IDENTITY의 MOOD가 한눈에 읽힌다: 04 빨강·파랑 대칭의 박자 무대, 09 무거운 청동 종루, 10 완벽하게 정돈된 조율실, 11 하늘로 열린 무너진 꼭대기와 해돋이.
- 시간대 빛이 층마다 밝아진다: 01~04 밤, 05~07 깊은 밤, 08~09 새벽 전, 10 새벽, 11 해돋이.

## 끝나면 보고

1. 저장한 파일 경로 11개와 각 크기(픽셀).
2. 다시 생성한 방과 이유, 3번 안에 기준을 못 맞춘 방.
