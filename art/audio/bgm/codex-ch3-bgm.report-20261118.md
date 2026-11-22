# 3장 중앙시계탑 배경음악 4곡 제작 보고 — 2026-11-18

**새 곡 4개 저장 완료. 길이·용량·형식·음량·샘플 수·반복 접합의 수치 검사는 통과했다. 직접 청음 검사는 미실시이며, 분위기·주선율·실제 악기처럼 들리는 정도·이음매의 청감 판정은 보류한다.** 이 세션에는 오디오를 듣고 평가하는 도구가 없다. 청음까지 모두 통과했다고 표시하지 않았다.

기존 음악과 코드·데이터·게임 연결·CREDITS는 수정하지 않았다. 게임 등록은 요청대로 후속 작업에 남긴다. 아래 OGG 네 개와 이 보고서만 저장소에 새로 추가했다. 중간 악보·음원·검사 자료와 첫 후보는 별도 검수 폴더에 보존했다.

## 저장 파일과 측정값

| 곡 | 저장 파일 | 길이(초) | 크기(KB, 1000B) | BPM / 박자 | LUFS-I | dBTP | 평균 kbps |
|---|---|---:|---:|---|---:|---:|---:|
| 중앙시계탑 전투 방 | [tower.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/tower.ogg>) | 112.00000 | 2038.0 | 120 / 4/4 | -15.98 | -6.22 | 145.57 |
| 멈춘 시계 다락 쉼터 | [tower-rest.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/tower-rest.ogg>) | 80.00000 | 1456.9 | 72 / 3/4 | -15.98 | -3.64 | 145.69 |
| 시간지기 틱·톡 보스전 | [ticktock.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/ticktock.ogg>) | 101.81805 | 1853.1 | 132 / 2/4 | -15.98 | -2.34 | 145.60 |
| 종루수호자 벨가드 보스전 | [belgard.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/belgard.ogg>) | 115.20000 | 2093.5 | 100 / 4/4 | -15.98 | -2.27 | 145.38 |

모두 OGG Vorbis, 44.1kHz, 스테레오, 목표 비트레이트 144kbps다. 네 파일 모두 3,000,000바이트 미만이고, 통합 음량은 약 -16 LUFS, 트루피크는 -1 dBTP 이하이다.

## 반복 지점과 연결 처리

**네 곡 모두 파일 전체를 그대로 반복한다.** 별도 시작·끝 구간을 설정할 필요가 없다. OGG 태그에 `LOOPSTART=0`, `LOOPEND=총 샘플 수`, `LOOPLENGTH=총 샘플 수`를 기록했다. 끝점은 포함하지 않는 샘플 인덱스다. 반복 기능은 게임 플레이어에서 설정해야 하며, 태그만으로 자동 반복되는 것은 아니다.

각 악보를 이어서 3바퀴 렌더링하고 세 번째 바퀴를 추출했다. 앞 두 바퀴에서 발생한 종·오르골·현악·피아노의 릴리스와 잔향이 시작 지점에 이미 이어지므로, 잔향을 잘라 버리거나 페이드아웃으로 감추지 않았다. EQ와 피크 제한도 반복을 먼저 연결한 상태에서 처리했다. 곡 전체에 페이드인·페이드아웃·종결 화음을 추가하지 않았다.

Vorbis를 다시 PCM으로 디코딩해 정확한 샘플 수와 반복 접합을 확인했다. 파일 끝 샘플과 시작 샘플의 최대 진폭 차이는 내부 샘플 변화의 99백분위보다 작다. 이 검사는 수치 검사이며 청음 검사를 대신하지 않는다.

| 곡 | 반복 구간(초) | 반복 샘플 수 | 경계 진폭 차(0–1) | 내부 변화 99백분위 | 시작 무음 샘플 | 청음 자료 |
|---|---|---:|---:|---:|---:|---|
| tower | 0–112.00000 | 4939200 | 0.0010847 | 0.0659391 | 0 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-two-loops.wav>) |
| tower-rest | 0–80.00000 | 3528000 | 0.0032910 | 0.0882142 | 0 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-rest-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-rest-two-loops.wav>) |
| ticktock | 0–101.81805 | 4490176 | 0.0078642 | 0.0634422 | 0 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/ticktock-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/ticktock-two-loops.wav>) |
| belgard | 0–115.20000 | 5080320 | 0.0028731 | 0.0363407 | 0 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/belgard-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/belgard-two-loops.wav>) |

## 작곡·렌더링 방법과 곡별 편성

원문 영어 프롬프트 네 개를 요약·번역·수정하지 않고 작곡 브리프로 사용했다. 외부 곡의 MIDI·악보·멜로디·오디오를 가져오지 않았으며, 이번 작업에서 각 주선율과 응답 선율을 새로 작성했다. 무작위로 음을 늘어놓는 방식이 아니라, 마디 단위 주선율과 반복 모티브·화성·응답을 악보로 작성했다. 지시서에서 제시한 조성·화성·박자·악기 역할을 적용했다.

연주는 **FluidSynth 2.6.2 + FluidR3 GM 3.1** 샘플을 사용했다. 순수 파형 오실레이터·신시사이저 리드·칩튠·음성·합창 패치는 사용하지 않았다. 압축은 FFmpeg의 libvorbis를 사용했다. 음악 생성 서비스는 사용 샘플과 라이선스를 공개하지 않아 이번 음원 제작에는 사용하지 않았다.

- **tower:** D단조 120 BPM 4/4. 오르골·첼레스타의 연속 8분음표, 엇박 피치카토·하프시코드, 글로켄슈필·플루트 주선율, 클라리넷 응답. F장조 B와 오스티나토만 남는 브리지를 둔다. A 16마디 → B 16 → 브리지 8 → A 복귀 16 = 56마디, 112초.
- **tower-rest:** F장조 72 BPM 3/4. 오르골 주선율과 피아노 왈츠, 두 번째 A에서는 한 옥타브 아래 피아노 더블링·첼로·첼레스타를 더한다. Bbm 차용 화성과 불규칙한 약한 시계 소리를 사용했다. 16마디 A → 16 A′ = 80초.
- **ticktock:** G장조 132 BPM 2/4, B에서 E단조 색채. 왼쪽 실로폰·클라리넷과 오른쪽 바순·뮤트 트럼펫이 2마디 문답을 하고 8마디 끝에서 합친다. 튜바·하프시코드의 움파 반주, 우드블록·스네어·캐스터네츠·심벌과 B의 금관을 사용했다. 원문 기본형을 한 번만 연주하면 요구 길이에 못 미치므로 A·B·복귀 A의 16마디 단위를 두 번씩 반복했다. 8 + 32 + 32 + 8 + 32 = 112마디, 약 101.818초.
- **belgard:** D단조 100 BPM 4/4, 무거운 하프타임. 낮게 조율한 튜뷸러 벨과 옥타브 공명, 팀파니·큰북·호른·트롬본·튜바·파이프 오르간이 중심이다. B에서는 차가운 하프시코드·높은 트레몰로 현악과 마디당 두 번의 종을 사용한다. 금속 타격은 녹음된 아고고 패치로 처리했다. 8마디 종 도입부 → 16 A → 16 B → 8 브리지 = 48마디, 115.2초. 반복 때 종 도입부가 다시 나타난 뒤 A로 돌아간다. 브리지는 저음 드론·단일 종 파트·느린 팀파니만 남긴다.

가벼운 저역 정리(36Hz 하이패스, 260Hz 약 -1.4dB)와 피크 제한으로 효과음 공간을 확보했다. 섹션별로 원래 악보의 강약을 남겼다. 특히 벨가드의 조용한 브리지와 다음 종 타격에는 의도된 음악적 강약이 있으므로, 수치상 샘플 연결의 연속성과 별도로 실제 게임에서 청음이 필요하다.

### 사용한 실제 SoundFont 프리셋

아래 이름은 사용한 SF2의 프리셋 헤더에서 읽었다. 프로그램은 0부터 세는 MIDI 번호다. `128/48`은 오케스트라 타악기 킷이고 그 외는 bank 0이다.

| 곡 | 채널 | Bank/Program | SF2 프리셋 이름 | 역할 |
|---|---:|---|---|---|
| tower | 0 | 0/10 | Music Box | Music box, precise repeating eighths |
| tower | 1 | 0/8 | Celesta | Celesta, interlocking eighths |
| tower | 2 | 0/9 | Glockenspiel | Glockenspiel, curious melody |
| tower | 3 | 0/73 | Flute | Flute, melody doubled |
| tower | 4 | 0/71 | Clarinet | Clarinet, phrase answers |
| tower | 5 | 0/45 | Pizzicato Section | Pizzicato strings, gears off-beat |
| tower | 6 | 0/6 | Harpsichord | Harpsichord off-beat answers |
| tower | 7 | 0/48 | Strings | Soft legato strings |
| tower | 8 | 0/70 | Bassoon | Bassoon, gentle walking bass |
| tower | 10 | 0/46 | Harp | Harp, phrase-end figures |
| tower | 11 | 0/115 | Woodblock | Woodblock tick and lower tock |
| tower | 12 | 0/14 | Tubular Bells | Quiet, short high bell every eight bars |
| tower-rest | 0 | 0/10 | Music Box | Music box, tender sleepy lead |
| tower-rest | 1 | 0/0 | Yamaha Grand Piano | Acoustic piano, waltz left hand |
| tower-rest | 2 | 0/0 | Yamaha Grand Piano | Soft piano, melody an octave below in A-prime |
| tower-rest | 3 | 0/42 | Cello | Cello countermelody in A-prime |
| tower-rest | 4 | 0/48 | Strings | Quiet bowed string pad |
| tower-rest | 5 | 0/8 | Celesta | Celesta grace notes |
| tower-rest | 6 | 0/46 | Harp | Harp sweeps at phrase ends |
| tower-rest | 7 | 0/115 | Woodblock | Sparse, irregular clock wakes |
| ticktock | 0 | 0/13 | Xylophone | Tick left, xylophone lead |
| ticktock | 1 | 0/71 | Clarinet | Tick left, clarinet doubles |
| ticktock | 2 | 0/70 | Bassoon | Tock right, bassoon answers |
| ticktock | 3 | 0/59 | Muted Trumpet | Tock right, muted trumpet accents |
| ticktock | 4 | 0/58 | Tuba | Tuba, oom-pah bass |
| ticktock | 5 | 0/6 | Harpsichord | Harpsichord, off-beat pah |
| ticktock | 6 | 0/45 | Pizzicato Section | Pizzicato, cheeky bounce |
| ticktock | 7 | 0/9 | Glockenspiel | Glockenspiel sparkles |
| ticktock | 8 | 0/40 | Violin | Acoustic violin, short gliding runs |
| ticktock | 9 | 128/48 | Orchestra Kit | Orchestral bass drum, snare, cymbal, castanets |
| ticktock | 10 | 0/60 | French Horns | French horns, B-section brass |
| ticktock | 11 | 0/57 | Trombone | Trombone, B-section off-beats |
| ticktock | 12 | 0/115 | Woodblock | Alternating high tick and low tock |
| belgard | 0 | 0/60 | French Horns | Unison low horns, solemn oath melody |
| belgard | 1 | 0/57 | Trombone | Trombones, wide heavy melody |
| belgard | 2 | 0/58 | Tuba | Tuba foundation |
| belgard | 3 | 0/42 | Cello | Low cello answers |
| belgard | 4 | 0/48 | Strings | Low acoustic strings, grinding eighths |
| belgard | 5 | 0/19 | Church Organ | Sampled pipe organ chord bed |
| belgard | 6 | 0/47 | Timpani | Timpani, slow footsteps |
| belgard | 7 | 0/14 | Tubular Bells | Deep transposed tubular/church bell |
| belgard | 8 | 0/14 | Tubular Bells | Upper octave bell resonance |
| belgard | 9 | 128/48 | Orchestra Kit | Orchestral bass drum, low tom, cymbal |
| belgard | 10 | 0/6 | Harpsichord | Cold harpsichord eighths in puppet phase |
| belgard | 11 | 0/44 | Tremolo | High bowed tremolo strings in puppet phase |
| belgard | 12 | 0/113 | Agogo | Struck metal agogo, sword-on-stone accent |
| belgard | 13 | 0/43 | Contrabass | Contrabass drone in bridge |

## 샘플 라이선스와 출처 표기

**샘플:** FluidR3 GM 3.1, **라이선스:** MIT. 기존 2장 작업에 사용했던 동일 사운드폰트를 재사용했다. 새 외부 샘플을 내려받거나, 상업 이용 조건이 불명확한 음원을 섞지 않았다.

- 배포 출처: [Debian fluid-soundfont](https://deb.debian.org/debian/pool/main/f/fluid-soundfont/).
- 원 패키지에 포함된 저작권·라이선스 자료: [FluidR3-COPYRIGHT.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/FluidR3-COPYRIGHT.txt>).
- 사용 SF2 크기: 148398306바이트, SHA-256 `74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`.
- 사운드폰트의 저작권 고지와 MIT 전문을 각 OGG의 `LICENSE_TEXT` 태그에도 넣었다. Debian 패키징 스크립트의 별도 라이선스를 샘플 라이선스로 혼동하지 않았다.

후속 CREDITS 작성 시 사용할 표기 문구:

> Instrument samples: FluidR3 GM 3.1. Copyright 2000–2002, 2008 Frank Wen; 2008 Toby Smithe. Licensed under the MIT License. Original chapter-three compositions created for Beyond the Clockwork.

MIT 고지 전문:

```text
Copyright: 2000-2002, 2008 Frank Wen <getfrank@gmail.com>
2008 Toby Smithe
License: MIT
Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```

## 재제작 내역과 남은 확인

- **tower:** 1회 작곡·렌더링. 수치 검사 통과.
- **tower-rest:** 1회 작곡·렌더링. 수치 검사 통과.
- **ticktock:** 2회. 첫 후보에서는 마지막 1마디가 우드블록만 남아, 첫 1초/끝 1초 RMS 비교가 +6.83dB였다. 마지막 마디의 불필요한 정지 구간을 없애 연주를 연결했고 두 번째 후보에서는 차이의 절댓값이 약 3.88dB로 줄었다. 다른 구간의 익살스러운 정지와 좌우 문답은 유지했다. 첫 후보는 [검수 폴더](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/ticktock-attempt1>)에 보존했다.
- **belgard:** 2회. 첫 후보는 브리지 말미에 드론만 남아 첫 1초/끝 1초 RMS 차이가 약 +22.89dB였다. 브리지의 종과 느린 팀파니를 끝까지 이어 잔향이 반복 시작으로 연결되도록 보완했다. 두 번째 후보에서도 조용한 브리지와 종 도입부의 의도된 강약은 남는다(같은 1초 비교 +17.48dB). 이 값은 타격 후 자연 감쇠와 편성 변화도 포함하므로, 클릭이나 갑작스러운 게인 변화를 의미하는 판정값으로 사용하지 않았다. 첫 후보는 [검수 폴더](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/belgard-attempt1>)에 보존했다.

**3회 안에 수치 기준을 못 맞춘 곡: 없음.** 네 곡 모두 음량·피크·길이·크기·샘플 수·반복 경계 수치 검사를 통과했다. **청음 항목은 네 곡 모두 미확인**이다. 보컬·합창 패치와 전자 리드·전자 드럼은 악보 및 사용 프리셋에서 제외했지만, 주선율의 인지성·분위기·음색·반복 이음매의 실제 청감은 이 세션에서 검증할 수 없어 판정을 보류했다. 청음 자료 링크는 위 반복 표에 있다.

## 원문과 검수 자료

| 곡 | 수정하지 않은 프롬프트 | 악보·편성 | 수치 검사 | 프롬프트 SHA-256 |
|---|---|---|---|---|
| tower | [tower.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower.prompt.txt>) | [tower-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-score.json>) | [tower-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-verification.json>) | `bfa3b9350e12355da0a245153544de566b3c423fd970d11c69406f9a95226054` |
| tower-rest | [tower-rest.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-rest.prompt.txt>) | [tower-rest-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-rest-score.json>) | [tower-rest-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/tower-rest-verification.json>) | `fd7cd0b01d6f1afae92a3b492546a1861cd544a59be711d0b89f7bdb2adcef49` |
| ticktock | [ticktock.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/ticktock.prompt.txt>) | [ticktock-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/ticktock-score.json>) | [ticktock-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/ticktock-verification.json>) | `a2f2bda7583a3ce0b10dc00e0d68f7ff03b3d5d888a938fbbcc3707c19ceacc1` |
| belgard | [belgard.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/belgard.prompt.txt>) | [belgard-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/belgard-score.json>) | [belgard-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/belgard-verification.json>) | `e4c9ca52eddd52aca473e4b1a64daa1511059b9cc4a77c08bdb0235bc2582a69` |

- 최종 파일 보존 및 형식 재검사: [final-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-20261118/final-verification.json>).
- 시작 시 기록한 기존 음악·문서·코드·데이터 **174개 모두 SHA-256 동일**. 기존 음악 파일과 CREDITS를 덮어쓰지 않았다.
- 이번 작업 안에서 만든 첫 후보를 보완할 때는 첫 결과를 검수 폴더에 보존하고 이번 작업이 소유한 새 출력만 갱신했다. 시작 전 존재하던 파일은 갱신 대상에서 제외했다.
- 커밋·푸시 없음. 게임 연결 없음.
