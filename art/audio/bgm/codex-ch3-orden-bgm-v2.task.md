# Codex 작업: 오르덴 배경음악 2곡 다시 만들기 (2026-11-20, v2)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 음악 파일만 만듭니다. 코드와 데이터(`src/`, `test/`, `worker/`, `scripts/`), 기존 음악 파일(v1 `orden-chamber.ogg`, `orden-lasthour.ogg` 포함)은 건드리지 않고, 커밋·푸시도 하지 않습니다. 게임에 연결하는 일은 Claude가 합니다.

v1 지시서 `art/audio/bgm/codex-ch3-orden-bgm.task.md`의 조건(공통 조건, 종소리·합창 예외, 오르덴 설정, 동기, 기존 곡과 겹치지 않게, 보고 형식)을 그대로 따릅니다. FluidSynth + FluidR3 GM 3.1도 그대로 씁니다. v1의 `compose.py`·`engine.py`·`master.py`는 고쳐서 다시 써도 됩니다. 이 문서는 **바뀐 것만** 적습니다.

## 왜 다시 만드나 (사용자가 들어 본 결과)

사용자 평: "먼가 안어울리게 어색하게 들린다." Claude가 v1 악보(`*-score.json`)와 음원을 재어 보니 원인은 아래와 같았습니다. 수치는 모두 `codex-ch3-orden-bgm-v2.check.py`로 잰 값입니다. 사용자가 괜찮다고 한 `belgard-v2`를 기준으로 삼습니다.

| 원인 | 조율실 v1 | 꼭대기 v1 | belgard-v2 |
| --- | --- | --- | --- |
| 길게 끄는 두 음이 반음으로 부딪힘 (곡 전체) | 18번 | **188번** | — |
| 종이 화음에 없는 음을 침 | 4번 | **56번** | — |
| 1.5박 넘게 끄는 음이 화음 밖 | 6.9% | 10.8% | — |
| 주요 파트의 세기 표준편차 | 1~6 (바이올린 3.0) | 1~11 | — |
| 박에서 조금이라도 벗어난 음 | 0% | 0% | — |
| 1초 음량의 최대-최소 차 | **21.0dB** (99초) | 10.4dB | 12.1dB |
| 소리 무게중심 | **2570Hz** | 1863Hz | 1174Hz |

1. **꼭대기:** 오르덴 동기(Bb–Eb–F–Gb–Db)를 구간 화성 위에 그대로 얹었다. 그래서 호른 F와 합창 F#(Gb), 호른 Db와 합창 D가 부딪힌다. Eb 종은 Bb7 마디(12·16·20·24…)에 떨어져 현의 D와 부딪힌다.
2. **조율실:** A의 G# 선율 아래에 A 지속음(9·17·49·57마디), D·Bm 화음 위에 C# 종(21~33마디), D·C#7 위에 오르간·트롬본의 긴 E가 있다. 7/8을 4분음표 84로 걸어 몰아붙이지 못하고 절뚝인다. 브리지(95~110초)에서 소리가 거의 꺼진다. 하프시코드와 높은 바이올린 16분음 때문에 날카롭고 저음이 약하다.
3. **둘 다:** 모든 음이 정확히 박 위에 같은 세기로 찍혀 GM 미디 소리가 그대로 드러난다. 합창(Ahh Choir)과 뮤트 트럼펫이 혼자 드러나는 곳에서 특히 싸구려처럼 들린다.

## 새 파일 이름 (v1은 그대로 둔다)

| 순서 | 파일 | 쓰는 곳 | 길이 (반복 한 바퀴) |
| --- | --- | --- | --- |
| 1 | `art/audio/bgm/orden-chamber-v2.ogg` | 3장 10 조율실 (오르덴 1차전) | 110~140초 |
| 2 | `art/audio/bgm/orden-lasthour-v2.ogg` | 3장 11 무너진 꼭대기 (오르덴 · 마지막 정각) | 130~160초 |

각 곡의 생성 프롬프트는 아래 블록을 그대로 쓴다. 요약, 번역, 수정은 하지 않는다.

### 1. 조율실 — `orden-chamber-v2.ogg`

```
Instrumental looping final-boss battle music for a cute wind-up toy fantasy action game, first fight against the grand tuner Orden inside his tuning chamber: cold, immaculate, overwhelming - the hero, a small broken wind-up doll, stands inside a perfect machine that wants to set every heartbeat to its own tempo. Grand and menacing, precise like clockwork, driving from the first bar to the last. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: a chamber at the top of a great clock tower walled with hundreds of clock faces and tuning dials, everything perfectly aligned; brass, white marble, sky-blue glass, three humming signal wires running out to the town, the factory and the belfry.
Tempo 126 BPM, 4/4, key of F sharp minor, with a Neapolitan G major chord as his cold signature colour. The clockwork asymmetry lives inside the bar, not in the metre: the sixteenth-note ostinato is grouped 3+3+3+3+2+2, so the beat stays steady and driving while the gears seem to slip against it.
Leitmotif (his own, used in both of his themes): low C sharp, F sharp, G sharp, A on four quarter notes, then a fall to a long low E for a whole bar. Here it is cold and marcato: low trombones, tuba and the pipe organ pedal, under every A section. The harmony follows the motif: F sharp minor under C sharp and F sharp, C sharp 7 under G sharp, D under A, and E major under the long E.
Lead: violins and violas in unison in the middle register (G3 to D5), doubled an octave below by the cellos - a dark, angular melody of sixteenth-note runs that end on long held chord tones, like a needle settling on a dial; answered by four horns, not trumpets. In the B section the pipe organ takes a cold chorale over the drive, the violins switch to tremolo and the low strings keep the sixteenths.
Clockwork drive: cellos, basses and a harpsichord (kept quiet, under the strings) play the 3+3+3+3+2+2 ostinato under everything; a short metallic snap (a tight closed hi-hat or anvil tap) on each group of 2. Timpani and bass drum on beats 1 and 3, a snare roll into every 8th bar. A tubular bell strikes on the downbeat every 4 bars, always on a note of the chord it falls on.
Harmony: F#m - D - G (Neapolitan) - C#7, then F#m - Bm - G - C#; B section: D - E - C#m - F#m, Bm - G - C#sus4 - C#7.
Form: 4 bars intro at full tempo (the ostinato, timpani and the low brass stating the leitmotif - no quiet organ-only opening), 16 bars A (string needle melody, horn answers, leitmotif in the low brass), 16 bars B (organ chorale, string tremolo, a soft wordless choir doubling the strings for weight), 8 bars bridge (still at full tempo and never quiet: the harpsichord and low string sixteenths, timpani, the bell and the leitmotif in the bassoons and tuba, building with a long crescendo and a snare roll), back to A; loops seamlessly with no ending.
Mood words: grand, cold, immaculate, oppressive, precise, inevitable, quietly furious, heavy and dark rather than bright. Orchestral strings with strong cellos and basses, pipe organ, harpsichord as a quiet layer, horns, trombones, tuba, timpani, tubular bells, wordless choir pad; no piano lead, no music box, no glockenspiel, no muted trumpet, no woodblock on every beat, no synthesizers, no electric guitar, no electronic drums, no vocals or lyrics.
```

### 2. 무너진 꼭대기 — `orden-lasthour-v2.ogg`

```
Instrumental looping final-boss battle music for a cute wind-up toy fantasy action game, the last fight against Orden "at the last hour" on the ruined summit of the clock tower: epic, tragic and desperate - his smiling mask has shattered, showing the ashen face of a human mage who gave everything to keep the town in order, and now the sky is open and the sun is rising behind him. The final battle of the chapter: sweeping, emotional, heroic for the small wind-up hero, sorrowful for him. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: the top of the clock tower torn open to the sky - no roof, no walls, broken brass gears and a huge cracked clock face whose two hands are stuck at twelve; beyond the broken edge, clouds and the first sunrise. At the last hour a great bell tolls twelve times.
Tempo 3/4 at 176 BPM, a huge, fast, swirling waltz - his clockwork waltz broken open into a storm. Every one of the three beats is played: low strings on beat 1, spiccato strings and snare on beats 2 and 3, so the drive never thins to one note a bar. Key of E flat minor, the bridge turning to G flat major and then E flat major at the sunrise.
Leitmotif (his own, used in both of his themes): low B flat, E flat, F, G flat, one bar each, then a long low D flat over two bars. Here it is broad and legato: four horns in unison doubled by the cellos and violas, the wordless choir only as a soft halo above. The harmony follows the motif, not the section's chords: Ebm under B flat and E flat, Bbm under F, Cb under G flat, Gb major under the long D flat.
Lead: a full string section with soaring violins playing a long, passionate melody of wide leaps (octaves and sixths) and falling sighs, every long note a chord tone, sighs resolving within one beat; a solo cello answers with the leitmotif in a lament between phrases - the human behind the mask. In the B section the horns carry the leitmotif while the violins race in eighth-note arpeggios of the chord above.
Drive: low strings and timpani on every downbeat, spiccato strings and snare on beats 2 and 3, a low taiko-like drum on the first beat of every 2nd bar, cymbal swells into each phrase, harp and celesta only as glitter in the high register. A great church bell (tubular bells and a low bell together) tolls on the first beat of every 4th bar, only on E flat minor, C flat or A flat minor bars when it strikes E flat (or strikes B flat on a B flat bar) - the last hour counting down.
Harmony: Ebm - Cb - Gb - Bb7, Ebm - Abm - Cb - Bb; B section: Cb - Db - Bbm - Ebm, Abm - Fm7b5 - Bbsus4 - Bb7; bridge (the sunrise): Gb - Db/F - Ebm - Cb - Ab - Bbsus4 - Bb - Eb major (the leitmotif once in major: B flat, E flat, F, G, then up to B flat, over Eb - Ab - Bb - Eb/G - Eb), then a sudden drop back to Eb minor.
Form: 8 bars intro (the bell tolls, horns and low strings state the leitmotif over a rising timpani roll), 24 bars A (violins' soaring melody, cello answers), 16 bars B (horns' leitmotif, racing violins), 16 bars bridge (the sunrise: the drums drop out, the strings keep moving in eighth notes, strings and horns swell into major, one great bell, then a timpani roll and a crash back into the minor), back to A; loops seamlessly with no ending.
Mood words: epic, tragic, desperate, sweeping, sorrowful, defiant, dawn breaking, the end of an age, warm and full rather than thin. Full orchestra: strings, four horns, trumpets, trombones, tuba, timpani, snare, low taiko-like drum, cymbals, tubular bells and a deep bell, harp, celesta, a soft wordless choir pad; no piano lead, no music box, no harpsichord ostinato (that belongs to his first theme), no woodblock ticks, no synthesizers, no electric guitar, no electronic drums, no vocals or lyrics.
```

## 작곡·편곡 규칙 (두 곡 공통)

1. **화음 안의 음으로 쓴다.**
   - 1.5박 넘게 끄는 음은 그 순간의 화음 구성음이어야 한다(서스펜션은 1박 안에 해결).
   - 동기가 나오는 마디는 위 프롬프트에 적은 '동기 화성'으로 바꿔 적는다. 마디 안에서 화음이 바뀌면 `harmony`에 `beat`(마디 안 0부터 센 박)를 붙여 적는다.
   - 패드(합창·지속 현·오르간)는 화음이 바뀔 때마다 가까운 구성음으로 옮겨 간다. 앞 화음의 음을 끌고 가지 않는다.
2. **종은 화음 구성음만 친다.** 그 마디 화음에 종 음이 없으면 근음으로 바꾸거나 그 마디를 건너뛴다.
3. **사람이 연주한 것처럼.**
   - 세기: 프레이즈마다 올라갔다 내려가고, 강박은 세게, 약박은 약하게. 음이 40개 넘는 파트는 세기 표준편차 6 이상.
   - 시간: 음 시작을 ±5~12ms 흔든다(하프시코드만 정확히 둬도 됨). 하프시코드 말고 음이 40개 넘는 파트는 30% 이상이 정확한 박에서 벗어나야 한다.
   - 2박 넘게 끄는 현·금관·합창에는 CC11(익스프레션)로 부풀었다 줄어드는 곡선을 넣는다.
4. **GM 음색이 드러나지 않게.**
   - 합창은 혼자 나오지 않는다. 늘 현이 같은 음을 받치고, 음량은 현보다 6dB 이상 작게.
   - 금관 긴 음은 같은 음을 현이나 다른 금관이 겹친다. 뮤트 트럼펫은 쓰지 않는다.
5. **어둡고 두껍게.** 첼로·콘트라베이스·튜바·트롬본이 모든 구간에 있다. 2~6kHz를 줄이고 하프시코드·첼레스타·하프는 뒤로 뺀다. 소리 무게중심은 1500Hz 이하(belgard-v2 1174Hz).
6. **꺼지는 구간이 없게.**
   - 1초 음량의 최대-최소 차: 조율실 13dB 이하, 꼭대기 14dB 이하(해돋이 브리지 포함).
   - 반복 이음매: 마지막 1초와 처음 1초의 음량 차 5dB 이하. 곡 첫머리를 조용한 도입으로 시작하지 않는다.

## 저장 전 확인 (한 곡씩)

각 곡의 악보와 최종 OGG를 디코딩한 wav로 아래를 돌려 **모두 PASS**여야 저장한다.

```
python art/audio/bgm/codex-ch3-orden-bgm-v2.check.py <곡>-score.json <곡>-decoded.wav
```

- 이 스크립트는 위 규칙 1~3, 5~6을 잰다: 반음 충돌 6번 이하, 화음 밖 긴 음 4% 이하, 화음 밖 종 0번, 세기, 박 흔들림, 음량 폭, 이음매, 무게중심.
- 악보는 v1과 같은 `score.json` 형식으로 남긴다. 스크립트 기준은 고치지 않는다.
- v1 지시서의 수치 확인(길이, 용량, -16 LUFS, 트루피크, 샘플 수, 반복 경계)도 그대로 통과해야 한다.
- 통과하지 못하면 다시 만든다. 곡마다 최대 3번까지 하고, 그래도 안 되면 가장 나은 것을 저장하고 '미달'과 실패한 항목을 보고한다.
- 조율실은 이제 4/4 126이다. '기존 곡과 겹치지 않게' 비교를 다시 하고, 특히 `ticktock-v2`(A단조 4/4 116), `iris-v2`(E단조 4/4 138), `belgard-v2`(C#단조 4/4 144), `press-v2`(C단조 4/4 148)와 다섯 가지 중 세 가지 이상 다른지 표로 적는다.

## 끝나면 보고

`art/audio/bgm/codex-ch3-orden-bgm-v2.report-<날짜>.md`에 v1 보고서와 같은 항목을 적고, 다음을 더한다.

- 곡마다 위 확인 스크립트의 출력 전체(v1 값과 나란히).
- 동기 마디와 그 아래 실제로 적은 화음.
- 종을 친 마디와 음.
- 30초 미리듣기와 이음매 앞뒤 12초 파일 경로.

커밋·푸시는 하지 않는다. 그다음 Claude가 `src/audio/music.js`에 두 곡을 등록하고, 3장 10·11 방에 연결하고, `art/audio/CREDITS.md`에 출처를 적는다.
