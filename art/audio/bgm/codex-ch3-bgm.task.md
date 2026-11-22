# Codex 작업: 3장 중앙시계탑 배경음악 4곡 만들기 (2026-11-18)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 음악 파일만 만듭니다. 코드와 데이터(`src/`, `test/`, `worker/`, `scripts/`), 기존 음악 파일은 건드리지 않고, 커밋·푸시도 하지 않습니다. 게임에 연결하는 일은 Claude가 합니다.

## 원하는 느낌

- **3장 전체:** 장난감 나라의 거대한 시계탑. 오르골·첼레스타·글로켄슈필·피치카토가 째깍거리는 장난감 같은 소리와, 높은 탑 안의 신비롭고 조금 쓸쓸한 분위기가 함께 있다. 2000년대 한국 판타지 온라인 게임의 '장난감 도시 시계탑' 사냥터 곡처럼 귀엽지만 밤처럼 신비하고, 같은 마디가 톱니처럼 정확하게 되풀이된다.
- **틱·톡:** 무섭지 않고 **유쾌하고 장난스러운** 보스곡. 광대나 마술사가 무대에서 재주를 부리듯 익살스럽고, 극장처럼 과장되고, 통통 튄다. 그래도 보스전답게 빠르고 바쁘다.
- **벨가드:** **무겁고 장엄한** 보스곡. 큰 종이 울리는 종루, 말없이 대검을 든 중장갑 기사. 느리게 짓누르는 박, 낮은 금관과 팀파니, 종소리.
- **원하지 않는 것:** 칩튠(사각파·삼각파), 신시사이저 리드, 전자 드럼, EDM, 보컬·합창, 공포 효과음.
- 위 느낌은 **분위기의 방향일 뿐 베낄 대상이 아니다.** 특정 게임 곡의 멜로디, 화성 진행, 리듬 꼴, 편곡을 따라 하지 않는다.

## 게임과 3장 이야기 (곡 분위기의 바탕)

- **게임:** "Beyond the Clockwork". 태엽 장난감 마을에서 스스로 생각하게 된 인형 F2가 렌치를 들고 싸우는 귀여운 액션 로그라이트.
- **1·2장 곡과 결 맞추기:** 1·2장 곡은 피아노가 중심인 어쿠스틱 합주다(`codex-ch1-bgm-piano.task.md`, `codex-ch2-bgm-v2.task.md`). 3장도 어쿠스틱 악기만 쓰되, 피아노 대신 **오르골·첼레스타·하프시코드·종** 같은 시계 장치 소리가 앞에 나와도 된다.
- **3장 중앙시계탑:** 마을 한가운데의 시계탑. 공장에서 시작된 명령 신호가 이 탑의 종으로 마을 전체에 퍼진다. F2는 1층 정문에서 4층 조율실과 무너지는 꼭대기까지 오른다.
  - 그림 색: 금빛 놋쇠, 하얀 대리석 계단, 하늘빛 유리 문자판. 1장 과자색(따뜻함), 2장 회청색 강철(차가움) 다음의 '맑고 높은 곳'이다.
  - 오를수록 창밖이 밤하늘에서 새벽빛으로 밝아진다.
  - 방 장치는 초침 박자(1초)로 움직이고, 30초마다 '정각 종'이 울린다(효과음이 따로 있다).
- **이미 있는 3장 곡:** 탑 꼭대기의 오르덴 테마 `orden.ogg`(D단조, 3/4, 76 BPM, 하프시코드 째깍 오스티나토와 오르골). 이번 곡들은 이것과 같은 탑에 있는 곡처럼 들려야 하지만 멜로디를 가져다 쓰지는 않는다.

## 공통 조건

1. **새로 작곡한 곡이어야 한다.** 위 '원하는 느낌'의 방향을 따르되 기존 곡을 흉내 내지 않는다.
2. **실제 악기 소리:** 어쿠스틱 악기 샘플(사운드폰트나 샘플 라이브러리)로 렌더링한다. 순수 신시사이저 파형으로 만들지 않는다.
   - 2장 때처럼 FluidR3 GM(MIT)을 써도 된다. 다른 샘플은 상업 이용이 가능한 라이선스(CC0, MIT, CC-BY 등)만 쓴다. CC-BY라면 출처 표기 문구까지 보고한다.
   - 쓴 샘플, 사운드폰트의 이름과 라이선스를 보고에 적는다.
3. **이음매 없는 반복:** 끝에서 처음으로 넘어갈 때 박자, 음, 소리 크기가 끊기지 않는다. 끝에 페이드아웃, 마무리 화음, 앞쪽 무음을 두지 않는다. 종·오르골·피아노 잔향이 이음매에서 잘리지 않도록 끝부분 잔향을 처음에 겹쳐 넣는다.
4. **형식:** OGG Vorbis, 44.1kHz, 스테레오, 약 128~160kbps. 파일 하나는 3MB 이하.
5. **소리 크기:** 2장 곡과 비슷하게 맞춘다(통합 음량 약 -16 LUFS, 피크 -1 dBTP 이하). 효과음(렌치, 정각 종, 보스 패턴 경고음)이 묻히지 않도록 중저역을 너무 채우지 않는다.
   - 곡 속의 종소리는 게임의 '정각 종' 효과음과 헷갈리지 않게 작고 짧게 쓴다(벨가드 곡만 예외로 크게).
6. **보컬 없음.** 가사, 말소리, 합창, 허밍이 없다.

## 곡 4개 (새 파일 이름)

| 순서 | 파일 | 쓰는 곳 | 길이 (반복 한 바퀴) |
| --- | --- | --- | --- |
| 1 | `art/audio/bgm/tower.ogg` | 3장 전투 방 (01 정문, 02 톱니 승강로, 03 초침 회랑, 06 진자 홀, 07 신호 구체 저장실, 08 종루 아래 배선실) | 100~130초 |
| 2 | `art/audio/bgm/tower-rest.ogg` | 3장 05 멈춘 시계 다락 (쉼터, 상점) | 60~90초 |
| 3 | `art/audio/bgm/ticktock.ogg` | 3장 04 계단 기관실 (중간 보스 틱·톡) | 90~120초 |
| 4 | `art/audio/bgm/belgard.ogg` | 3장 09 종루 (구역 보스 벨가드) | 100~130초 |

각 곡의 생성 프롬프트는 아래 블록을 그대로 쓴다. 요약, 번역, 수정은 하지 않는다.

### 1. 중앙시계탑 전투 방 — `tower.ogg`

```
Instrumental looping background music for a dungeon area of a cute wind-up toy fantasy action game, in the spirit of the toy-town clock tower field music of 2000s Korean fantasy online RPGs: whimsical and toy-like on the surface, mysterious and a little lonely underneath. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: "the Central Clock Tower", a huge clock tower in the middle of a toy town, all gold brass gears, white marble stairs and sky-blue glass clock faces; the hero, a small wind-up doll, climbs it floor by floor at night, between giant pendulums, sweeping second hands and turning gear floors.
Tempo 120 BPM, 4/4, key of D minor (with a brighter F major passage in the B section).
Signature: a steady clockwork ostinato that never stops - a music box and a celesta playing a ticking eighth-note figure, pizzicato strings and a harpsichord answering on the off-beats like gears meshing, a wooden block or clock "tick" on every beat and a soft "tock" a tone lower on beats 2 and 4.
Lead: a curious, slightly mysterious melody on glockenspiel and flute together, an 8-bar phrase that is easy to hum, with small chromatic turns like a key winding; answered by a clarinet.
Accompaniment: soft legato strings underneath, a gentle bassoon or pizzicato bass walking on 1 and 3, a harp arpeggio at phrase ends, a small high bell (very short and quiet) at the start of every 8 bars.
Chords: Dm - Bb - Gm - A, then Dm - F - C - A7; B section F - C - Dm - Am - Bb - F - Gm - A.
Form: 16 bars A (music box and celesta, sparse), 16 bars B (fuller strings, melody up an octave, the night opening into a clear sky), 8 bars bridge (only the clockwork ostinato and pizzicato, like the gears heard alone), back to A; loops seamlessly with no ending.
Mood words: whimsical, toy-like, mysterious, curious, precise, a little lonely, high up at night. Acoustic music box, celesta, glockenspiel, harpsichord, pizzicato and light orchestra; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 2. 멈춘 시계 다락 쉼터 — `tower-rest.ogg`

```
Instrumental looping rest-area music for a cute wind-up toy fantasy action game, in the spirit of the warm, nostalgic town themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: a cosy wooden attic inside the clock tower, full of old wall clocks that have all stopped. Clock-folk who were judged "broken" hide here, mend each other and open a little shop for the hero. Safe, warm, candle-lit, a little dusty and sleepy, with a faint sadness - a room where time is allowed to stop.
Tempo 72 BPM, 3/4 waltz, key of F major with a few borrowed minor colours (F - Dm - Bb - C, then Bb - Bbm - F - C).
Lead: a tender, slightly sleepy music box melody like an old wind-up box that still plays; the second time it returns, a soft piano doubles it an octave lower and a celesta adds small grace notes.
Accompaniment: a gentle piano left-hand waltz, a warm cello countermelody, a soft string pad, an occasional harp glissando. Clock ticks are sparse and uneven - a few slow ticks that stop and start again, as if the stopped clocks wake up for a moment and fall asleep again; no steady metronome.
Form: 16 bars A (music box and soft strings), 16 bars A' (piano doubling, cello countermelody, celesta), loops seamlessly with no ending.
Mood words: hidden, cosy, kind, mending, sleepy, a little lonely. Acoustic music box, celesta, piano, cello and strings; no drums except the faint uneven clock ticks; no synthesizers, no chiptune, no vocals.
```

### 3. 시간지기 틱·톡 보스전 — `ticktock.ogg`

```
Instrumental looping boss battle music for a cute wind-up toy fantasy action game: a playful, mischievous, comedic boss theme, like two show-off jesters putting on a circus act - theatrical, bouncy and cheeky rather than scary, but still fast and busy enough for a boss fight. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
The bosses: Tick and Tock, twin conductor dolls in tailcoats with tall metronomes on their backs, Tick in red and Tock in blue. They share one life, keep time with their metronomes and take turns attacking - Tick thrusts and dashes, Tock sweeps - always one on the beat, the other on the off-beat. Their arena is a square stair-engine room with a red staircase on the left and a blue one on the right.
Tempo 132 BPM, 2/4 (a bouncy circus gallop / oom-pah feel), key of G major with sly chromatic slides and a cheeky turn to E minor.
Signature: two voices that answer each other like the twins - a xylophone or clarinet "Tick" panned left and a bassoon or muted trumpet "Tock" panned right, trading 2-bar phrases, then playing together in unison at the end of each 8 bars; a woodblock metronome tick on every beat, alternating a high "tick" and a lower "tock".
Lead: a cheerful, cocky, sing-song melody with staccato notes, grace notes, little trills and comic pauses, like a magician's "ta-da".
Accompaniment: oom-pah accompaniment (tuba or pizzicato double bass on the beat, accordion or harpsichord chords off the beat), pizzicato strings, glockenspiel sparkles, slide whistle-like string glissandi (acoustic, short) at phrase ends, a snare drum roll and cymbal crash as a pickup into each section.
Rhythm: acoustic orchestral and circus percussion - bass drum and cymbals on 1, snare on 2, woodblock and castanets; a few stop-time breaks where only the metronome ticks for one bar before everything jumps back in.
Form: 8 bars intro (only the metronome tick and the two voices calling each other), 16 bars A (the twins' call-and-response), 16 bars B (faster feel with double-time snare, the melody up a fourth, full brass - the phase where their metronome speeds up), 8 bars bridge (a sly, tiptoeing pizzicato version, like the twins sneaking around), back to A; loops seamlessly with no ending.
Mood words: playful, mischievous, comedic, theatrical, bouncy, cheeky, show-off, fast. Acoustic circus band and light orchestra; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 4. 종루수호자 벨가드 보스전 — `belgard.ogg`

```
Instrumental looping boss battle music for a cute wind-up toy fantasy action game: a heavy, grave, ceremonial boss theme, slow and crushing rather than fast and frantic. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
The boss: Belgard, the silent guardian of the belfry, a heavily armoured knight doll with a huge greatsword who never speaks; the great bell of the clock tower hangs above his round arena and relays the tower's orders to the whole town. At half health the ruler of the tower takes him over like a puppet: his eyes glow cold teal, flying swords and rains of blades join his attacks.
Tempo 100 BPM, 4/4 with a heavy half-time feel, key of D minor; grave, armoured, unstoppable.
Signature: deep church bells and tubular bells tolling on the downbeat of every bar (big and resonant, the heart of the piece); timpani and a large orchestral bass drum hitting with them like heavy footsteps; low brass (horns, trombones, tuba) holding a stern, slow melody; low strings in a grinding eighth-note ostinato underneath; a pipe organ pad holding the chords.
Lead: a solemn, march-like melody on unison horns and trombones, few notes, wide and heavy, like an oath; answered by low cellos.
Chords: Dm - Bb - Gm - A, then Dm - C - Bb - A; B section Gm - Dm - Eb - A - Bb - Gm - Eb - A.
Rhythm: orchestral percussion only - timpani, bass drum, low toms, cymbals, an anvil or hammered-metal accent (acoustic) on the last beat of every 4 bars like a sword striking stone.
Form: 8 bars intro (bells, timpani and organ only), 16 bars A (full low orchestra, slow and heavy), 16 bars B (the puppet phase: a cold harpsichord ticking ostinato and high tremolo strings enter over the bells, the melody moves up an octave, the bells toll twice per bar, more urgent and eerie but the tempo stays the same), 8 bars bridge (only a low drone, a single bell and slow timpani, like the hall holding its breath), back to A; loops seamlessly with no ending.
Mood words: heavy, grave, armoured, ceremonial, solemn, crushing, silent resolve, tolling. Great bells, pipe organ, low brass, timpani and full orchestra; no synthesizers, no chiptune, no electronic drums, no vocals, no choir.
```

## 저장 전 확인 (한 곡씩)

하나라도 걸리면 다시 만든다. 최대 3번까지 하고, 그래도 안 되면 가장 나은 것을 저장하고 '미달'로 보고한 뒤 다음 곡으로 넘어간다(멈추지 않는다).

- **악기:** 어쿠스틱 악기 소리다. 사각파·삼각파 같은 칩튠 소리, 신시사이저 리드, 전자 드럼, 기계 소음이 없다.
- **멜로디:** 곡마다 따라 흥얼거릴 수 있는 분명한 주선율이 있다.
- **반복:** 파일을 두 번 이어 붙여 들었을 때 이음매에서 박자가 밀리거나, 툭 끊기거나, 소리 크기가 튀거나, 잔향이 잘리지 않는다.
- **길이와 크기:** 위 표의 길이 안이고, 파일은 3MB 이하다.
- **분위기 (네 곡이 서로 분명히 달라야 한다):**
  - 전투 방: 오르골·첼레스타가 째깍거리는, 장난감 같지만 신비로운 D단조
  - 쉼터: 멈춘 시계가 가끔 깨어나는 느린 3박자 오르골 자장가
  - 틱·톡: 왼쪽·오른쪽 두 악기가 주고받는, 익살스럽고 통통 튀는 서커스 갤럽(무섭지 않다)
  - 벨가드: 마디마다 큰 종과 팀파니가 짓누르는 느리고 무거운 행진(빠르거나 경쾌하지 않다)
- **금지:** 보컬·합창, 기존 곡을 흉내 낸 멜로디나 편곡, 라이선스가 불분명하거나 상업 이용이 안 되는 샘플이 없다.

## 끝나면 보고

`art/audio/bgm/codex-ch3-bgm.report-<날짜>.md`에:

1. 저장한 파일 4개의 경로, 길이(초), 크기(KB), BPM, 통합 음량(LUFS)과 피크(dBTP)
2. 반복 지점: 파일 전체가 그대로 반복되는지, 아니면 반복 구간(시작 초, 끝 초)을 따로 정해야 하는지
3. 만든 방법: 도구, 쓴 샘플이나 사운드폰트의 이름, 라이선스, 출처 표기 문구
4. 다시 만든 곡과 그 이유, 3번 안에 기준을 못 맞춘 곡
5. 커밋과 푸시는 하지 않는다.

그다음 Claude가 `src/audio/music.js`에 네 곡을 등록하고, 3장 전투 방·05 쉼터·04 계단 기관실·09 종루에서 각 곡이 나오게 연결하며, `art/audio/CREDITS.md`에 출처를 적는다.
