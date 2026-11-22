# Codex 작업: 3장 최종 보스 오르덴 배경음악 2곡 (2026-11-20)

경로는 저장소 루트(`Beyond the Clockwork`) 기준입니다. 음악 파일만 만듭니다. 코드와 데이터(`src/`, `test/`, `worker/`, `scripts/`), 기존 음악 파일(`orden.ogg`, `orden-boss.ogg`, `belgard-v2.ogg` 등)은 건드리지 않고, 커밋·푸시도 하지 않습니다. 게임에 연결하는 일은 Claude가 합니다.

방법, 형식, 음량, 반복, 라이선스, 보고 방식은 v1 지시서 `art/audio/bgm/codex-ch3-bgm.task.md`의 '공통 조건'과 '끝나면 보고'를 그대로 따릅니다(FluidSynth + FluidR3 GM 그대로 써도 됨). **예외는 두 가지입니다.**

- **종소리:** 크게 써도 된다. 최종 보스곡이므로 벨가드 곡처럼 탑의 종을 앞에 세운다.
- **합창:** 가사 없는 합창 패드(GM Choir Aahs / Voice Oohs)만 허용한다. 가사, 말소리, 독창, 허밍 선율은 쓰지 않는다.

## 왜 만드나

지금 3장 10 조율실(오르덴 1차전)과 11 무너진 꼭대기(오르덴 · 마지막 정각)에는 자기 곡이 없어서 벨가드 곡(`belgard-v2.ogg`)을 빌려 쓴다. 사용자가 원하는 것은 다음과 같다.

1. **최종 보스답게 웅장한 곡.**
2. **두 곡의 분위기가 달라야 한다.**
   - 10 조율실: 차갑고 완벽한 기계 장치의 위압감.
   - 11 꼭대기: 가면이 깨진 인간 마법사의 마지막 발악. 하늘이 열린 해돋이 아래의 비장함.

## 오르덴은 누구인가 (곡의 바탕)

- 마을을 지키려다 모든 선택을 표준화해 버린 대조율사. 겉은 친절하고 단정한 시계공 인형이고, 마왕이 아니라 '선의가 통제로 굳은' 권력이다. 싸울 때는 마법만 쓴다(바늘, 룬, 속성 광선, 시간 정지, 다른 보스들의 금빛 메아리).
- 대사 결: "흐트러진 박자는 다시 맞추면 그만이다.", "고장 난 태엽 하나가 탑을 멈출 수는 없다."
- 10 조율실: 탑 안의 한 층. 수백 개의 문자판과 조율 장치가 지나치게 완벽하게 정돈된 작업실. 마을·공장·종루로 가는 신호선 세 가닥.
- 11 무너진 꼭대기: 지붕과 벽이 날아가 하늘로 열린 탑 꼭대기. 금 가고 깨진 큰 문자판의 두 바늘이 정각을 가리킨 채 멈춰 있다. 부서진 가장자리 너머로 해가 뜬다. 오르덴은 가면이 깨져 잿빛의 마른 인간 얼굴과 청록 눈이 드러난 채 떠 있다. 마지막 정각에는 종이 열두 번 울린다.

## 두 곡이 함께 쓰는 동기 (오르덴의 동기)

두 곡이 같은 사람의 곡으로 들리도록 짧은 동기 하나를 새로 지어 둘 다에 쓴다.

- **동기:** 음계 5도 아래 → 1도 → 2도 → 단3도로 한 칸씩 오르다가(점점 정확하게 조여 오는 태엽), 아래 7도로 크게 떨어져 길게 끈다(5̣ 1 2 ♭3 | ♭7̣——). 4박 + 길게 끄는 1마디.
- **10번에서는:** 오르간 페달과 저음 금관이 스타카토로 차갑게 찍는다. 장조가 되지 않는다.
- **11번에서는:** 호른과 합창이 레가토로 넓게 부른다. 브리지의 해돋이에서 한 번만 장조로 바뀐다(♭3 → 3).

## 기존 곡과 겹치지 않게

`codex-ch3-bgm-v2.task.md`의 '기존 곡과 겹치지 않게' 표와 규칙을 그대로 따른다. 거기에 3장 v2 네 곡(`tower-v2` E 도리안 6/8, `tower-rest-v2`, `ticktock-v2`, `belgard-v2`)도 비교 대상에 넣는다. 특히 다음을 지킨다.

- 오르덴 테마 `orden.ogg`(D단조 3/4 76, 하프시코드 째깍 왈츠)와 조성·빠르기가 달라야 한다. 대화 장면 곡이라 전투곡과 겹치면 안 된다.
- 프레스 곡(C단조 4/4 148, 파이프 오르간·팀파니·금관 행진)과 10번은 파이프 오르간을 함께 쓰므로 **조성·박자·주선율 악기를 모두 다르게** 한다.

## 곡 2개

| 순서 | 파일 | 쓰는 곳 | 길이 (반복 한 바퀴) |
| --- | --- | --- | --- |
| 1 | `art/audio/bgm/orden-chamber.ogg` | 3장 10 조율실 (오르덴 1차전) | 120~150초 |
| 2 | `art/audio/bgm/orden-lasthour.ogg` | 3장 11 무너진 꼭대기 (오르덴 · 마지막 정각) | 130~160초 |

각 곡의 생성 프롬프트는 아래 블록을 그대로 쓴다. 요약, 번역, 수정은 하지 않는다.

### 1. 조율실 — `orden-chamber.ogg`

```
Instrumental looping final-boss battle music for a cute wind-up toy fantasy action game, first fight against the grand tuner Orden inside his tuning chamber: cold, immaculate, overwhelming - the hero, a small broken wind-up doll, stands inside a perfect machine that wants to set every heartbeat to its own tempo. Grand and menacing, precise like clockwork, never chaotic. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: a chamber at the top of a great clock tower walled with hundreds of clock faces and tuning dials, everything perfectly aligned; brass, white marble, sky-blue glass, three humming signal wires running out to the town, the factory and the belfry.
Tempo 7/8 grouped 2+2+3 at 168 eighth notes per minute (a relentless limping clockwork drive that never settles into a dance), key of F sharp minor, with a Neapolitan G major chord as his cold signature colour.
Leitmotif (his own, used in both of his themes): five notes rising step by step from the low fifth - low C sharp, F sharp, G sharp, A - then a big fall to a long low E. Here it is cold and staccato: stated by the pipe organ pedal and low trombones in the intro and under every A section.
Lead: a solo string section in octaves (violins and violas unison) playing a sharp, angular melody of fast sixteenth-note runs ending in held notes - like a needle swinging on a tuning dial; answered by a muted trumpet. In the B section a pipe organ takes the lead with a cold chorale over the drive, the strings switch to rapid tremolo.
Clockwork drive: a harpsichord and a marcato string ostinato hammering the 2+2+3 pattern under everything; on the last group of each bar a short metallic clock-hand snap (a tight closed hi-hat or anvil tap). Timpani and a low bass drum mark the downbeats; a tubular bell strikes the leitmotif's first note every 4 bars, cold and exact.
Harmony: F#m - D - G (Neapolitan) - C#7, then F#m - Bm - G - C#; B section: D - E - C#m - F#m, Bm - G - C#sus4 - C#7.
Form: 4 bars intro (organ pedal and trombones state the leitmotif over the ticking harpsichord), 16 bars A (strings' needle melody, muted trumpet answers), 16 bars B (organ chorale, string tremolo, wordless choir pad joining for weight), 8 bars bridge (everything stops but the harpsichord, the tubular bell and the low leitmotif in the contrabassoon - the machine holding its breath - then a snare roll back in), back to A; loops seamlessly with no ending.
Mood words: grand, cold, immaculate, oppressive, precise, inevitable, quietly furious. Orchestral strings, pipe organ, harpsichord, trombones, tuba, muted trumpet, timpani, tubular bells, wordless choir pad; no piano lead, no music box, no glockenspiel lead, no woodblock on every beat, no synthesizers, no electric guitar, no electronic drums, no vocals or lyrics.
```

### 2. 무너진 꼭대기 — `orden-lasthour.ogg`

```
Instrumental looping final-boss battle music for a cute wind-up toy fantasy action game, the last fight against Orden "at the last hour" on the ruined summit of the clock tower: epic, tragic and desperate - his smiling mask has shattered, showing the ashen face of a human mage who gave everything to keep the town in order, and now the sky is open and the sun is rising behind him. The final battle of the chapter: sweeping, emotional, heroic for the small wind-up hero, sorrowful for him. Original composition; do not imitate any existing game's melody, chord progression or arrangement.
Setting: the top of the clock tower torn open to the sky - no roof, no walls, broken brass gears and a huge cracked clock face whose two hands are stuck at twelve; beyond the broken edge, clouds and the first sunrise. At the last hour a great bell tolls twelve times.
Tempo 3/4 at 176 BPM felt in one (a huge, fast, swirling waltz - his clockwork waltz broken open and turned into a storm), key of E flat minor, the bridge turning to G flat major and then E flat major at the sunrise.
Leitmotif (his own, used in both of his themes): five notes rising step by step from the low fifth - low B flat, E flat, F, G flat - then a big fall to a long low D flat. Here it is broad and legato: sung by four horns in unison with the wordless choir, wide and aching.
Lead: a full string section with soaring violins playing a long, passionate melody of wide leaps (octaves and sixths) and falling sighs; a solo cello answers with the leitmotif in a lament between phrases - the human behind the mask. In the B section the horns and choir carry the leitmotif while the violins race in fast arpeggios above.
Drive: driving low strings and timpani on every downbeat, a snare and taiko-like low drum pattern pushing the waltz forward, cymbal swells at phrase ends, harp and celesta only as glitter in the high register. A great church bell (tubular bells and a low bell together) tolls on the first beat of every 4th bar - the last hour counting down.
Harmony: Ebm - Cb - Gb - Bb7, Ebm - Abm - Cb - Bb; B section: Cb - Db - Bbm - Ebm, Abm - Fm7b5 - Bbsus4 - Bb7; bridge (the sunrise): Gb - Db/F - Ebm - Cb - Ab - Bbsus4 - Bb - Eb major (the leitmotif once in major, rising third instead of falling seventh), then a sudden drop back to Eb minor.
Form: 8 bars intro (the bell tolls, horns and choir state the leitmotif slowly over a rising timpani roll), 24 bars A (violins' soaring melody, cello answers), 16 bars B (horns and choir leitmotif, racing violins), 16 bars bridge (the sunrise: the drums drop out, strings and choir swell into major, one great bell, then a timpani roll and a crash back into the minor), back to A; loops seamlessly with no ending.
Mood words: epic, tragic, desperate, sweeping, sorrowful, defiant, dawn breaking, the end of an age. Full orchestra: strings, four horns, trumpets, trombones, tuba, timpani, snare, low taiko-like drum, cymbals, tubular bells and a deep bell, harp, celesta, wordless choir pad; no piano lead, no music box, no harpsichord ostinato (that belongs to his first theme), no woodblock ticks, no synthesizers, no electric guitar, no electronic drums, no vocals or lyrics.
```

## 두 곡이 달라야 하는 점 (확인용)

| | 10 조율실 `orden-chamber` | 11 꼭대기 `orden-lasthour` |
| --- | --- | --- |
| 느낌 | 차갑다, 완벽하다, 숨 막힌다 | 비장하다, 슬프다, 하늘이 열린다 |
| 조성 | F#단조(나폴리 G장조 화음) | Eb단조 → 브리지에서 Gb장조·Eb장조 |
| 박자 · 빠르기 | 7/8(2+2+3) · 8분음표 168 | 3/4 한 박 느낌 · 176 |
| 주선율 | 현악 유니즌의 날카로운 16분음 → 파이프 오르간 코랄 | 바이올린의 넓은 도약 선율, 첼로 탄식, 호른·합창 |
| 박을 미는 것 | 하프시코드와 마르카토 현의 2+2+3 오스티나토 | 저음 현·팀파니·스네어·태고풍 큰북의 왈츠 |
| 동기 | 오르간 페달·트롬본이 스타카토로 차갑게 | 호른·합창이 레가토로 넓게, 해돋이에서 한 번 장조 |
| 종 | 튜블러 벨이 4마디마다 정확히 한 번 | 큰 종이 4마디마다 울리며 마지막 정각을 셈 |

## 끝나면 보고

`codex-ch3-bgm.task.md`의 '끝나면 보고' 형식을 따르고, 보고서는 `art/audio/bgm/codex-ch3-orden-bgm.report-YYYYMMDD.md`로 둔다. 곡마다 다음을 적는다.

- 실제 조성·박자·빠르기·길이·반복 지점(초).
- 동기를 어디에 넣었는지(마디).
- 위 '기존 곡과 겹치지 않게' 비교 결과.
- 통합 음량(LUFS)과 피크(dBTP).
