# Codex 작업: 3장 중앙시계탑 배경음악 4곡 다시 만들기 (2026-11-18, v2)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 음악 파일만 만듭니다. 코드와 데이터(`src/`, `test/`, `worker/`, `scripts/`), 기존 음악 파일(v1 `tower.ogg`, `tower-rest.ogg`, `ticktock.ogg`, `belgard.ogg` 포함)은 건드리지 않고, 커밋·푸시도 하지 않습니다. 게임에 연결하는 일은 Claude가 합니다.

방법, 형식, 음량, 반복, 라이선스, 보고 방식은 v1 지시서 `art/audio/bgm/codex-ch3-bgm.task.md`의 '공통 조건'과 '끝나면 보고'를 그대로 따릅니다(FluidSynth + FluidR3 GM 3.1 그대로 써도 됨). 이 문서는 **바뀐 것만** 적습니다.

## 왜 다시 만드나 (사용자가 들어 본 결과)

1. **전투 방·쉼터가 1장 곡과 너무 비슷하다.** 멜로디를 다르게 해야 한다.
   - 원인: v1 프롬프트가 1·2장 곡과 같은 재료를 썼다. 오르골·첼레스타·글로켄슈필이 겹쳐 반짝이고, 피치카토와 우드블록이 박마다 째깍거리고, 클라리넷이 대답하고, 하프가 프레이즈 끝을 닫는 조합이 타이틀·1장·2장 곡에 모두 들어 있다.
   - 특히 쉼터는 2장 쉼터(`factory-rest-v2`)와 조성(F장조), 박자(3/4 왈츠), 화성 진행(F-Dm-Bb-C / Bb-Bbm-F-C), 첼로 대선율까지 같았다.
2. **틱·톡이 너무 통통 튄다.** 차분한 느낌이 같이 있어야 한다. v1은 1장 로코 보스곡과 같은 132 BPM에 바순·튜바·실로폰·슬라이드 휘슬을 써서 로코처럼 들렸다.
3. **벨가드가 보스곡처럼 들리지 않는다.** v1은 100 BPM 하프타임으로 느리고, 8마디 종 도입부와 드론만 남는 브리지가 있어서 긴장이 끊겼다. 무거움은 느린 박이 아니라 **낮은 음역과 두꺼운 소리로** 내고, 박은 보스전답게 계속 몰아붙여야 한다.

## 기존 곡과 겹치지 않게 (새 규칙)

아래는 이미 게임에 있는 곡이다. 새 4곡은 각각 **아래 어느 곡과도 다음 다섯 가지 중 세 가지 이상이 달라야 한다:** 조성, 박자표, 빠르기(±10 BPM 밖), 주선율 악기, 화성 진행.

| 곡 | 조성 | 박자 · 빠르기 | 주선율과 특징 |
| --- | --- | --- | --- |
| title-v2 / title-v3 | D장조 | 4/4 · 84~100 | 피아노, 오르골·첼레스타·글로켄슈필 반짝임, 피치카토, 우드블록·째깍 소리 |
| town-v2 | — | 4/4 | 어쿠스틱 합주 편곡 |
| dusk-v2 | A단조 → C장조 | 4/4 스윙 · 104 | 피아노와 아코디언·클라리넷, 움파, 토이피아노·글로켄슈필 |
| roco-v2 | G단조 | 4/4 · 132 | 스타카토 피아노 리프, 바순·튜바, 실로폰, 슬라이드 휘슬 |
| brass-v2 | Bb단조 | 2/4 행진 · 152 | 행진 스네어, 금관 팡파르, 피아노 옥타브 |
| factory-v2 | A단조 | 4/4 · 104 | 피아노, 피치카토 오스티나토, 첼레스타·오르골, 우드블록, 클라리넷 대답, 하프 |
| factory-rest-v2 | F장조 | 3/4 · 74~80 | 피아노 자장가, 오르골, 첼로 대선율, 하프 글리산도 |
| iris-v2 | E단조 | 4/4 · 138 | 16분음 스타카토 피아노, 스피카토 바이올린, 글로켄슈필 |
| press-v2 | C단조 | 4/4 · 148 | 낮은 피아노 옥타브, 팀파니, 파이프 오르간, 금관 행진 |
| orden | D단조 | 3/4 · 76 | 하프시코드 째깍 오스티나토, 피아노, 오르골, 탑의 종 |

- **주선율을 피아노·오르골·글로켄슈필·클라리넷에 맡기지 않는다.** 이 악기들은 색을 더하는 정도로만 쓴다.
- **'박마다 우드블록 째깍'을 쓰지 않는다.** 시계 느낌은 아래 프롬프트에 적은 방식으로 낸다.
- **주선율의 처음 4마디가 위 곡들의 처음 4마디와 같은 윤곽(올라가고 내려가는 방향의 순서)이 아니어야 한다.** 2장 세 곡(`factory-rest-v2`, `iris-v2`, `press-v2`)과 v1 네 곡은 Codex가 쓴 악보가 남아 있으면 그것과 직접 비교한다.

## 곡 4개 (새 파일 이름, v1은 그대로 둔다)

| 순서 | 파일 | 쓰는 곳 | 길이 (반복 한 바퀴) |
| --- | --- | --- | --- |
| 1 | `art/audio/bgm/tower-v2.ogg` | 3장 전투 방 (01·02·03·06·07·08) | 100~130초 |
| 2 | `art/audio/bgm/tower-rest-v2.ogg` | 3장 05 멈춘 시계 다락 (쉼터, 상점) | 60~90초 |
| 3 | `art/audio/bgm/ticktock-v2.ogg` | 3장 04 계단 기관실 (틱·톡) | 90~120초 |
| 4 | `art/audio/bgm/belgard-v2.ogg` | 3장 09 종루 (벨가드) | 100~130초 |

각 곡의 생성 프롬프트는 아래 블록을 그대로 쓴다. 요약, 번역, 수정은 하지 않는다.

### 1. 중앙시계탑 전투 방 — `tower-v2.ogg`

```
Instrumental looping background music for a dungeon area of a cute wind-up toy fantasy action game: the inside of a huge, ancient toy-town clock tower at night - mysterious, dreamy and a little eerie, like walking through the clockwork of time itself, but still gentle and toy-like. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: "the Central Clock Tower", all gold brass gears, white marble stairs and sky-blue glass clock faces; the hero, a small wind-up doll, climbs it floor by floor between giant pendulums, sweeping second hands and turning gear floors.
Tempo 6/8 at a dotted-quarter pulse of 66 (a slow rolling swing like a pendulum), key of E Dorian (E minor with a raised C sharp), with whole-tone runs as colour.
Lead: an oboe melody, haunting and wistful, doubled softly by a marimba an octave below; the second time, a solo viola takes the melody and the oboe plays a counter-line. The melody is built from a falling four-note chime figure that is answered by a rising leap of a sixth, with long held notes and a few chromatic sighs - it must not sound like a lullaby, a march or a dance.
Clockwork: the time is kept by a harpsichord playing rolling broken-chord sixteenths in the left hand like a gear train turning, and by pendulum swings - a low bowed contrabass and bass clarinet rocking between two notes once per dotted quarter. Ticks are sparse and irregular: a few dry clicks of a small metal mechanism (claves or a closed triangle tap), never on every beat. Every 8 bars a whole-tone glissando on a vibraphone, like the hands of a giant clock turning.
Harmony: Em - A/E - Em - D, then C - D - Em - Bm; B section G - A - Em - F#m - C - D - B7 (whole-tone run) - Em.
Form: 16 bars A (oboe and harpsichord, sparse and mysterious), 16 bars B (viola melody, oboe counter-line, soft string pad and vibraphone, the night sky opening), 8 bars bridge (only harpsichord gears, pendulum bass and the vibraphone whole-tone glissandi), back to A; loops seamlessly with no ending.
Do not lead with piano, music box, glockenspiel or clarinet; no pizzicato ostinato, no woodblock on every beat, no harp at phrase ends.
Mood words: mysterious, dreamy, timeless, wistful, a little eerie, precise, high up at night. Acoustic oboe, viola, marimba, vibraphone, harpsichord, bowed bass and strings; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 2. 멈춘 시계 다락 쉼터 — `tower-rest-v2.ogg`

```
Instrumental looping rest-area music for a cute wind-up toy fantasy action game. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: a cosy wooden attic high inside the clock tower, full of old wall clocks that have all stopped. Clock-folk who were judged "broken" hide here, mend each other and open a little shop for the hero. Candle-lit, dusty, quiet and kind - a room where time is allowed to stop, with the night sky through a round window.
Tempo 66 BPM, 4/4, straight (no swing, not a waltz), key of E-flat major with a gentle Lydian colour (A natural) and a turn to C minor in the B section.
Lead: an ocarina or a soft recorder playing a simple, open melody with long notes and a few wide, hopeful leaps, like someone humming while repairing a clock; the second time, a solo violin plays it softly, the ocarina answering.
Accompaniment: a fingerpicked nylon-string acoustic guitar in steady, gentle eighth-note patterns, a warm bowed viola or horn pad, a soft vibraphone with the motor off holding long chords, a kalimba adding a few small notes at phrase ends.
Stopped clocks: no steady tick at all. Every 4 bars, one single soft click of a clock trying to start, then silence again.
Harmony: Eb - Bb/D - Cm - Ab, then Eb - F/A (Lydian) - Ab - Bb; B section Cm - Ab - Eb - Bb - Cm - Ab - F - Bb.
Form: 8 bars intro-A (guitar and ocarina), 8 bars A', 8 bars B (violin, C minor, a little lonely), 8 bars A'' (all together, warm); loops seamlessly with no ending.
Do not lead with piano or music box; no waltz, no harp glissando, no cello countermelody, no celesta sparkle.
Mood words: hidden, cosy, mending, candle-lit, quiet hope, a little lonely. Acoustic guitar, ocarina, violin, viola, vibraphone and kalimba; no drums, no synthesizers, no chiptune, no vocals.
```

### 3. 시간지기 틱·톡 보스전 — `ticktock-v2.ogg`

```
Instrumental looping boss battle music for a cute wind-up toy fantasy action game: a witty, elegant boss theme for two polite, show-off twin conductors - playful and theatrical, but composed and dignified, like a refined chamber-music duel in a ballroom rather than a circus. Calm on the surface, quick underneath. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
The bosses: Tick and Tock, twin conductor dolls in tailcoats with tall metronomes on their backs, Tick in red and Tock in blue. They share one life and take turns attacking, always one on the beat and the other on the off-beat, with perfect manners. Their arena is a square stair-engine room with a red staircase on the left and a blue one on the right.
Tempo 116 BPM, 4/4, key of A minor with elegant turns to C major and E major (harmonic minor colour).
Signature: a baroque-style chamber orchestra - a harpsichord continuo and a string quartet playing crisp staccato and spiccato figures; two solo voices that answer each other like the twins: a flute ("Tick", panned left) and an oboe ("Tock", panned right), trading 2-bar phrases, meeting in clean parallel thirds at the end of every 8 bars.
Metronome: a real metronome sound (a dry wooden click with a small bell on the first beat of each bar), quiet, like the twins keeping time; in the B section it clicks twice as fast.
Lead: a poised, witty melody with dotted rhythms, small ornaments (mordents, short trills) and polite little pauses, like a bow before each attack; it smiles but never laughs.
Calm: the B section turns legato and calm for 8 bars - a slow, graceful cantabile on solo cello under sustained strings, the harpsichord still ticking - before the quick figures return.
Rhythm: light and exact - pizzicato double bass on the beats, soft timpani on beat 1 every 2 bars, a snare drum only as short rolls into each new section. No cymbal crashes, no bass drum on every beat.
Form: 4 bars intro (metronome and harpsichord), 16 bars A (flute and oboe trading phrases over staccato strings), 8 bars B1 (calm cello cantabile), 8 bars B2 (the metronome doubles, spiccato sixteenths, French horns join - the phase where their metronomes speed up), back to A; loops seamlessly with no ending.
Do not use oom-pah, tuba, bassoon lead, xylophone runs, slide whistle, circus percussion or a galloping 2/4 feel.
Mood words: witty, elegant, playful, poised, composed, precise, a little smug, with a calm, graceful middle. Harpsichord, string quartet and chamber orchestra with flute, oboe and horns; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 4. 종루수호자 벨가드 보스전 — `belgard-v2.ogg`

```
Instrumental looping boss battle music for a cute wind-up toy fantasy action game: an intense, heavy, epic boss fight theme - dark, armoured and relentless, the drive never stops from the first bar. The weight comes from low, thick sound and great bells, not from a slow tempo. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
The boss: Belgard, the silent guardian of the belfry, a heavily armoured knight doll with a huge greatsword who never speaks; the great bell of the clock tower hangs above his round arena and relays the tower's orders to the whole town. At half health the ruler of the tower takes him over like a puppet: his eyes glow cold teal, flying swords and rains of blades join his attacks.
Tempo 144 BPM, 4/4, key of C sharp minor; the puppet section moves up a semitone to D minor.
Drive: low strings (cellos and basses) and low brass (trombones, tuba) play a hammering eighth-note riff grouped 3+3+2 that never lets go, with a half-step "grinding" figure (C# - D - C#); timpani and big orchestral bass drum lock onto the 3+3+2 accents; a snare drum plays sixteenth-note rolls into every 4th bar; crash cymbals on the downbeat of each new section.
Bells: a great church bell (deep tubular bell, with its octave) strikes on the downbeat of every 2 bars like a war drum; in the climaxes it strikes every bar.
Lead: a dark, heroic-tragic theme on unison French horns and trombones, strong and singable, rising in steps and falling in a big leap, like a knight's oath; trumpets answer with short, sharp stabs; high strings play fast tremolo on top in the climaxes.
Harmony: C#m - A - F#m - G#, then C#m - B - A - G#; climax A - B - G#m - C#m - F#m - D (Neapolitan) - G# - G#.
Form: 4 bars intro (a single great bell strike, then the riff and timpani start at full tempo), 16 bars A (riff, horn theme, trumpet stabs), 16 bars B (the puppet section: up to D minor, a cold harpsichord playing fast sixteenths and high violin tremolo join the riff, the bell strikes every bar, the theme an octave higher), 8 bars breakdown (still at full tempo: only timpani, low strings pulsing in eighths and the bell, building with a long crescendo and a snare roll), back to A; loops seamlessly with no ending.
Do not lead with piano; no march snare pattern, no slow half-time sections, no quiet drone bridge, no 8-bar quiet intro.
Mood words: intense, heavy, epic, relentless, armoured, tolling, tragic resolve. Great bells, low brass, timpani, full orchestra, pipe organ underneath, harpsichord in the puppet section; no synthesizers, no chiptune, no electronic drums, no vocals, no choir.
```

## 저장 전 확인 (한 곡씩, v1 기준에 더해)

하나라도 걸리면 다시 만든다. 최대 3번까지 하고, 그래도 안 되면 가장 나은 것을 저장하고 '미달'로 보고한 뒤 다음 곡으로 넘어간다.

- **겹침:** 위 '기존 곡과 겹치지 않게' 표의 모든 곡과 다섯 가지 중 세 가지 이상이 다르다. 곡마다 그 비교 표를 보고서에 적는다.
- **주선율 악기:** 전투 방은 오보에·비올라, 쉼터는 오카리나(또는 리코더)·바이올린, 틱·톡은 플루트·오보에, 벨가드는 호른·트롬본이다. 피아노·오르골·글로켄슈필·클라리넷이 주선율을 맡지 않는다.
- **분위기:**
  - 전투 방: 진자처럼 흔들리는 6/8, 신비롭고 꿈같은 E 도리안
  - 쉼터: 박자 없이 멈춘 시계, 기타와 오카리나의 조용한 4/4
  - 틱·톡: 바로크 실내악처럼 단정하고 재치 있게, 가운데 8마디는 차분한 첼로
  - 벨가드: 첫 마디부터 끝까지 몰아붙이는 144 BPM, 종과 낮은 금관, 조용한 구간 없음
- **벨가드 긴장:** 1초 단위 RMS가 곡 전체에서 가장 큰 곳보다 12dB 넘게 떨어지는 구간이 없다(브레이크다운 포함).
- **금지:** v1 지시서의 금지 항목 그대로.

## 끝나면 보고

`art/audio/bgm/codex-ch3-bgm-v2.report-<날짜>.md`에 v1 보고서와 같은 항목, 그리고 곡마다 '기존 곡과의 비교 표'(조성·박자표·빠르기·주선율 악기·화성 진행 중 다른 것)를 적는다. 커밋·푸시는 하지 않는다.

그다음 Claude가 `src/audio/music.js`에 v2 네 곡을 등록하고, 3장 전투 방·05 쉼터·04 계단 기관실·09 종루에 연결하며, `art/audio/CREDITS.md`에 출처를 적는다.
