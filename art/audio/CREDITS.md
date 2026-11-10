# 효과음·배경음악 출처

`sfx/` 에 남은 녹음은 모두 Kenney(www.kenney.nl)의 CC0 음원이다. 출처 표기 의무는 없다. 원본 라이선스: `sfx/kenney-License.txt`.

| 게임 이름 | 원본 묶음 | 원본 파일 |
|---|---|---|
| buy | Casino Audio | chips-handle-1 |
| tune | RPG Audio | metalLatch |
| click, equip | UI Audio | click1, switch1 |
| deny | Interface Sounds | error_001 |

그 밖의 효과음은 녹음 파일 없이 코드로 합성한다. 플레이어(렌치·회피·피격 등), 얼음 기술, 적·보스 공격, 클리어·보상 소리는 `src/audio/coded.js`, 불·전기·바람 기술과 융합, 마을 종, 원정 실패 나팔은 `src/audio/elements.js`.

## 배경음악

`bgm/` 의 곡은 모두 Abstraction의 Music Loop Bundle(https://tallbeard.itch.io/music-loop-bundle) 음원이다. CC0이며 출처 표기 의무는 없다. 원본 라이선스: `bgm/abstraction-LICENSE.txt`. 제작자는 NFT, AI·머신러닝, 수정 없는 재판매에 쓰는 것을 지지하지 않는다고 밝혔다(금지 조항은 아님). 게임으로 수익을 내면 소액 후원을 권한다.

| 게임 이름 | 장면 | 원본 묶음 | 원본 파일 |
|---|---|---|---|
| title | 타이틀 화면, 오프닝·튜토리얼 | chiptune | Three Red Hearts Puzzle Pieces |
| town | 웃음 마을(출발 광장), 뒷마당 | 2024-q3 | Interior Birdecorator Explore |
| street | 웃음거리 02~05구간 | 2024-q4 | Sketchbook 2024-12-26 |
| roco | 중간보스 로코 | 2025-q4 | Sketchbook 2025-11-13 |
| dusk | 07 쉼터~12구간 | chiptune | Three Red Hearts Modern Bits |
| brass | 최종 보스 브라스 | chiptune | Three Red Hearts Go (No Vocal) |

## 2장 무음공장 배경음악 (2026-11-08)

2장 곡 4개는 위 Abstraction 묶음이 아니다. 작업서는 `bgm/codex-ch2-bgm-v2.task.md`(피아노 중심, 보컬 없음).

| 게임 이름 | 장면 | 길이 | 출처 |
|---|---|---|---|
| factory-v2 | 2장 전투 방(01~04, 07~11) | 182.5초 | 사용자가 준 MP3 「삐걱이는 생산라인 (2)」를 OGG로 바꾸고 소리 크기만 맞춤(편곡·길이 그대로) |
| factory-rest-v2 | 2장 06 불량품 보관창고(쉼터) | 77.8초 | Codex 작곡 「Silent Factory - Between the Shifts」, 74 BPM |
| iris-v2 | 2장 05 검수실(아이리스) | 97.4초 | Codex 작곡 「Inspector Iris - Exact Measure」, 138 BPM |
| press-v2 | 2장 12 정형실(프레스) | 103.8초 | Codex 작곡 「Director Press - The Same Shape」, 148 BPM |

Codex 작곡 3곡은 새로 쓴 곡을 FluidR3 GM 3.1 사운드폰트(실제 악기 녹음 샘플)로 연주해 만들었다. 사운드폰트 라이선스는 MIT: Copyright 2000-2002, 2008 Frank Wen; 2008 Toby Smithe (https://deb.debian.org/debian/pool/main/f/fluid-soundfont/). MIT 전문은 각 파일의 OGG 태그(LICENSE_TEXT)에 들어 있다.

factory-v2의 원곡 권리와 이용 조건은 그 MP3를 만든 곳의 약관을 따른다(예: Suno로 만든 곡이면 만든 요금제의 상업 이용 조건).

## 1장 피아노 버전 배경음악 (2026-11-09)

작업서는 `bgm/codex-ch1-bgm-piano.task.md`. 위 표의 town·dusk·roco·brass를 대신한다(옛 파일은 남겨 둠). street(01~05 낮 전투 방)는 그대로. 타이틀·완주 화면은 사용자 결정으로 다시 옛 칩튠 `title`을 쓴다(2026-11-09). title-v2 파일은 남겨 둠.

| 게임 이름 | 장면 | 길이 | 출처 |
|---|---|---|---|
| title-v2 | 타이틀, 원정 완주 화면 | 91.2초 | Abstraction 「Puzzle Pieces」(CC0)를 Codex가 어쿠스틱 합주로 편곡 |
| town-v2 | 웃음마을(마을·등록·뒷마당) | 101.7초 | Abstraction 「Explore」(CC0)를 Codex가 어쿠스틱 합주로 편곡 |
| dusk-v2 | 1장 07 야시장 쉼터~12구간 | 128.2초 | Abstraction 「Modern Bits」(CC0)를 Codex가 어쿠스틱 합주로 편곡 |
| roco-v2 | 1장 06 중간 보스 로코 | 94.6초 | Codex 작곡 「Collector Roco - Handle with Care」 |
| brass-v2 | 1장 13 최종 보스 브라스 | 101.1초 | Codex 작곡 「Captain Brass - The Last Parade」 |

다섯 곡 모두 FluidR3 GM 3.1 사운드폰트(MIT, Copyright 2000-2002, 2008 Frank Wen; 2008 Toby Smithe)로 연주했고, MIT 전문은 각 파일의 OGG 태그(LICENSE_TEXT)에 있다. 끝에 페이드아웃이 없어 그대로 반복된다(2026-11-09 측정: 마지막 1초 음량이 곡 평균과 같음).

## 오르덴 테마 (2026-11-09)

| 게임 이름 | 장면 | 길이 | 출처 |
|---|---|---|---|
| orden | 1·2장 끝 시계탑 꼭대기 장면(오르덴과 벨가드) | 94.7초 | 사용자가 makebestmusic.com에서 `bgm/orden.prompt.md`로 만듦. 이용 조건은 그 사이트 약관을 따름 |

76 BPM 3/4 40마디. 마지막 마디는 길게 끄는 음이 잦아드는 것이라(약 -10 dB) 페이드아웃이 아니며, 곡 전체를 그대로 반복한다.
