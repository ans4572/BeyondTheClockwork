# Codex 작업: 타이틀·야시장·로코·브라스 배경음악 4곡을 피아노 중심으로 다시 만들기 (2026-11-09)

저장소 루트(`Beyond the Clockwork`)를 기준으로 한 경로입니다. 음악 파일만 만듭니다. 코드와 데이터(`src/`, `test/`, `worker/`), 기존 음악 파일은 건드리지 않습니다. 게임에 연결하는 일은 Claude가 합니다.

## 왜 다시 만드나

1장 곡(`title.ogg`, `dusk.ogg`, `roco.ogg`, `brass.ogg`)은 Abstraction의 Music Loop Bundle(CC0)에서 가져온 칩튠·전자음 곡이다. 2장 곡은 피아노 중심 어쿠스틱 판타지 RPG 음악으로 새로 만들었다(`codex-ch2-bgm-v2.task.md`). 그래서 1장으로 돌아오면 소리 결이 달라진다. 이 네 곡을 **지금 곡의 역할과 빠르기, 기분은 살리고 피아노가 중심인 곡**으로 다시 만들어 2장과 결을 맞춘다.

- **원하는 감성:** 2000년대 한국 판타지 온라인 게임 배경음악처럼 귀에 남는 피아노 멜로디와 가벼운 오케스트라. 2장 v2 곡들과 한 게임의 음악으로 들려야 한다.
- **원하지 않는 것:** 칩튠(사각파·삼각파), 신시사이저 리드, 전자 드럼, EDM, 일렉트로닉 효과음.
- **1장 웃음거리의 느낌:** 2장 공장이 조용하고 서늘했다면, 1장은 밝은 장난감 마을의 축제와 행진이다. 장난감 같은 소리는 전자음이 아니라 어쿠스틱 악기로 낸다: 오르골, 첼레스타, 글로켄슈필, 실로폰, 토이 피아노, 피치카토 현악, 나무 블록, 작은북.

## 게임과 1장 이야기 (곡 분위기의 바탕)

- **게임:** "Beyond the Clockwork". 태엽 장난감 마을에서 스스로 생각하게 된 인형 F2가 렌치를 들고 싸우는 귀여운 액션 로그라이트.
- **1장 웃음거리:** 언제나 웃어야 하는 장난감 마을. 웃지 않거나 박자가 다른 인형은 '불량'으로 잡혀 간다. 겉은 축제처럼 밝고 귀엽지만 그 아래는 조금 숨 막힌다. 공포는 아니다.
- **F2:** '스스로 생각함'이라는 이유로 불량 판정을 받아 폐기될 뻔한 인형. 렌치 하나로 태엽 밖으로 걸어 나간다.

## 공통 조건

1. **새로 작곡한 곡이어야 한다.** 지금 곡을 포함해 특정 게임·영화·노래의 멜로디, 화성 진행, 편곡을 흉내 내지 않는다. 아래 '지금 곡'은 역할과 빠르기의 참고일 뿐 베낄 대상이 아니다.
2. **실제 악기 소리:** 피아노, 현악, 목관, 금관, 첼레스타, 글로켄슈필, 오르골, 하프, 팀파니 같은 어쿠스틱 악기 샘플(사운드폰트나 샘플 라이브러리)로 렌더링한다. 순수 신시사이저 파형으로 만들지 않는다.
   - 샘플은 상업 이용이 가능한 라이선스(CC0, MIT, CC-BY 등)만 쓴다. CC-BY라면 출처 표기 문구까지 보고한다.
   - 쓴 샘플과 사운드폰트의 이름, 라이선스를 보고에 적는다.
3. **이음매 없는 반복 (가장 중요):** 게임은 파일 끝에서 처음으로 바로 이어 붙여 계속 튼다.
   - 끝에 **페이드아웃, 마무리 화음, 뒤쪽 무음**을 두지 않는다. 앞쪽 무음도 두지 않는다.
   - 파일 길이는 **마디의 정수배**로 자른다(예: 120 BPM 4/4라면 2초의 정수배).
   - 끝부분 피아노·현악 잔향은 잘라 내지 말고 곡의 처음에 겹쳐 넣는다.
   - 참고: 2장 `factory-v2.ogg`는 끝 5초가 무음으로 페이드아웃되어, 반복할 때 곡이 끝난 것처럼 들렸다(지금은 코드로 그 앞에서 되감는다). 이번 곡은 이런 끝이 없어야 한다.
4. **형식:** OGG Vorbis, 44.1kHz, 스테레오, 약 128~160kbps. 파일 하나는 3MB 이하.
5. **소리 크기:** 지금 1장·2장 곡과 비슷하게 맞춘다(통합 음량 약 -16 LUFS, 피크 -1 dBTP 이하). 효과음이 묻히지 않도록 중저역을 너무 채우지 않는다.
6. **보컬 없음.** 가사, 말소리, 합창이 없다.

## 곡 4개 (새 파일 이름, 지금 곡은 그대로 둔다)

| 순서 | 파일 | 쓰는 곳 | 지금 곡 (참고) | 길이 (반복 한 바퀴) |
| --- | --- | --- | --- | --- |
| 1 | `art/audio/bgm/title-v2.ogg` | 타이틀 화면, 1장 클리어 화면 | `title.ogg` 91초, 느긋한 칩튠 | 70~100초 |
| 2 | `art/audio/bgm/dusk-v2.ogg` | 1장 07 중간 마을 쉼터(야시장)와 그 뒤 08~12 해 질 녘 전투 방 | `dusk.ogg` 128초, 약 103 BPM | 90~120초 |
| 3 | `art/audio/bgm/roco-v2.ogg` | 1장 06 분실물 회수소 (중간 보스 로코) | `roco.ogg` 224초, 약 120 BPM | 90~120초 |
| 4 | `art/audio/bgm/brass-v2.ogg` | 1장 13 멈추지 않는 행진 (구역 보스 브라스) | `brass.ogg` 71초, 빠른 행진 | 90~120초 |

`dusk`는 야시장 쉼터에서만이 아니라 그 뒤 전투 방에서도 나온다. 그래서 쉬는 곡이 아니라 **싸우면서 들어도 되는 해 질 녘 축제 곡**이어야 한다.

각 곡의 생성 프롬프트는 아래 블록을 그대로 쓴다. 요약, 번역, 수정은 하지 않는다.

### 1. 타이틀 — `title-v2.ogg`

```
Instrumental looping title screen music for a cute fantasy action roguelite, in the spirit of the memorable piano title themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
The story in one picture: a small wind-up doll named F2 holds a wrench and a paper notice stamped "defective - thinks for itself", standing at the edge of a bright toy town that always smiles. Hopeful, curious and a little bittersweet, like the first page of an adventure.
Tempo 84 BPM, 4/4, key of D major, with a turn to B minor in the B section.
Lead: a warm, singable grand piano melody in the right hand, an 8-bar phrase that people hum after hearing it once; the second time, a music box and a celesta double it an octave higher.
Accompaniment: flowing piano left-hand arpeggios, soft legato strings, a flute countermelody in the B section, a harp glissando into each new section, a very quiet clock tick on every beat.
Rhythm: almost none - a soft brushed snare and a gentle bass drum only from the B section, no loud percussion.
Chords: D - A/C# - Bm - G - D/F# - G - A; B section Bm - G - D - A - Bm - G - Em - A.
Form: 16 bars A (piano with soft strings), 16 bars B (fuller strings and flute, the melody rising), 8 bars A' (music box doubling), loops seamlessly with no ending, no fade-out and no final chord.
Mood words: hopeful, gentle, nostalgic, wondering, a small doll stepping out. Acoustic piano, music box, celesta, flute, harp and strings; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 2. 야시장과 해 질 녘 거리 — `dusk-v2.ogg`

```
Instrumental looping field music for a cute fantasy action roguelite, in the spirit of the lively yet wistful evening town and field themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
Setting: the toy town "Smile Street" at dusk. Lanterns light up a night market of wind-up stalls, candy carts and music boxes, while the wooden guards still march the streets and the hero fights through them toward the town square. Festive and warm on the surface, a little tired and wistful underneath - the day's forced smiles are wearing thin.
Tempo 104 BPM, 4/4 with a light swing on the eighth notes, key of A minor moving to C major in the B section.
Lead: a catchy, dancing piano melody with grace notes, answered by an accordion or a clarinet like a street musician at the market.
Accompaniment: piano left-hand oom-pah bass and chords, pizzicato strings, a toy piano and glockenspiel sparkling on the off-beats like lanterns, an acoustic guitar strum, a cello countermelody in the B section.
Rhythm: acoustic only - a tambourine, a small snare drum with brushes, a wooden block, a light bass drum on 1 and 3; steady enough to fight to.
Chords: Am - Dm - G - C - F - Dm - E - E7; B section C - G - Am - Em - F - C - Dm - E.
Form: 16 bars A (piano and accordion, market bustle), 16 bars B (brighter in C major, strings join, the melody up an octave), 8 bars C (quieter, piano and music box only, the lanterns flickering), back to A; loops seamlessly with no ending, no fade-out and no final chord.
Mood words: festive, lantern-lit, playful, wistful, a crowd moving at sunset. Acoustic piano, accordion, toy piano, glockenspiel, guitar and light strings; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 3. 수거반장 로코 보스전 — `roco-v2.ogg`

```
Instrumental looping mid-boss battle music for a cute fantasy action roguelite, in the spirit of the energetic piano-and-orchestra boss themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
The boss: Collector Roco, a big clumsy collector robot of the toy town's lost-and-found office. He grabs "broken" toys with a giant claw, pulls them in with a magnet and a suction hose, drops crates from a crane and slaps "defective" stickers on everything. His room is a cluttered warehouse full of boxes, chutes and conveyor belts. Threatening but comical - a bully doing his job too eagerly.
Tempo 132 BPM, 4/4, key of G minor; bouncy, busy and mischievous.
Signature: a bouncing staccato piano riff in the low and middle register, like a claw snapping open and shut (Gm - Eb - F - D); a bassoon and tuba doubling the bass line for a clumsy, heavy-footed feel; xylophone runs like boxes tumbling down a chute; a ratchet and a slide whistle (acoustic) as short accents in fills.
Lead: a playful but menacing piano melody in octaves, answered by muted trumpets and pizzicato strings, with sudden stops on the last beat of every 4 bars like the claw grabbing.
Rhythm: orchestral percussion - timpani, snare drum, a woodblock, a cowbell-like metal clank; driving eighth notes in the low strings.
Form: 4-bar intro groove (part of the loop), 16 bars A, 16 bars B (more frantic, horns join, the melody up a third - the phase where he gets angry), 8 bars break (piano and xylophone only, then a timpani roll), back to A; loops seamlessly with no ending, no fade-out and no final chord.
Mood words: mischievous, clumsy, grabbing, busy, comically threatening. Piano and orchestra with toy percussion; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 4. 행진대장 브라스 보스전 — `brass-v2.ogg`

```
Instrumental looping final boss battle music for a cute fantasy action roguelite, in the spirit of the grand, emotional piano-and-orchestra final boss themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
The boss: Captain Brass, the marching-band captain who rules the toy town of Smile Street. He keeps everyone in step with his baton, rings a great stopping bell, blasts trumpet waves and sends ranks of toy soldiers marching across the square; anyone out of step falls. His arena is the town square at night under the clock. Proud, rigid, magnificent - and in the end a doll who never learned to walk to his own beat.
Tempo 152 BPM, 2/4 military march feel (counted in 4/4 for the notation), key of B-flat minor; relentless and grand.
Signature: a driving marching snare drum and big bass drum on every beat like an endless parade; low piano octaves hammering the downbeats together with timpani; a full brass section (trumpets, horns, trombones, tuba) playing fanfare figures; a tubular bell struck at the start of every 8 bars like his stopping bell; a piccolo trill on top in the B section.
Lead: a heroic but oppressive march melody on piano and trumpets together, with a sorrowful solo violin counter-line in the B section.
Chords: Bbm - Gb - Db - F, then Bbm - Ebm - F - F7; B section Gb - Db - Ebm - Bbm - Gb - Ab - F - F.
Form: 8 bars intro (snare and piano octaves only, the parade approaching), 16 bars A (full march), 16 bars B (more intense, melody up a fourth, cymbal crashes every 2 bars - his rage phase), 8 bars bridge (the march suddenly stops: quiet piano, a music box and a slow clock tick, then the snare starts again), back to A; loops seamlessly with no ending, no fade-out and no final chord.
Mood words: marching, commanding, unstoppable, ceremonial, tragic pride. Piano, brass, marching percussion and strings; no synthesizers, no chiptune, no electronic drums, no vocals.
```

## 저장 전 확인 (한 곡씩)

하나라도 걸리면 다시 만든다. 최대 3번까지 하고, 그래도 안 되면 가장 나은 것을 저장하고 보고한다.

- **악기:** 피아노가 분명히 들리는 중심 악기다. 칩튠 소리, 신시사이저 리드, 전자 드럼이 없다.
- **멜로디:** 곡마다 따라 흥얼거릴 수 있는 분명한 주선율이 있다.
- **반복:** 파일을 두 번 이어 붙여 들었을 때 이음매에서 박자가 밀리거나, 툭 끊기거나, 소리 크기가 튀거나, 잔향이 잘리지 않는다. **마지막 3초의 소리 크기가 곡 전체 평균보다 6dB 넘게 작지 않다**(페이드아웃 금지).
- **길이와 크기:** 위 표의 길이 안이고, 마디의 정수배이며, 파일은 3MB 이하다.
- **분위기:**
  - 타이틀: 느긋하고 희망찬 피아노 주제, 타악기는 거의 없음
  - 야시장: 스윙 섞인 춤추는 피아노와 아코디언, 싸우면서 들어도 될 만큼 꾸준한 박
  - 로코: 집게처럼 통통 튀는 스타카토 피아노, 장난스럽고 둔한 저음
  - 브라스: 매 박 행진 작은북과 내려찍는 피아노 옥타브, 금관 팡파르, 8마디마다 종
- **2장과 결:** `factory-v2.ogg`, `iris-v2.ogg`와 이어 들었을 때 같은 게임의 음악으로 들린다.
- **금지:** 보컬, 기존 곡을 흉내 낸 멜로디, 라이선스가 불분명하거나 상업 이용이 안 되는 샘플이 없다.

## 끝나면 보고

1. 저장한 파일 4개의 경로, 길이(초), BPM, 마디 수, 크기(KB)
2. 만든 방법: 도구, 쓴 샘플이나 사운드폰트의 이름, 라이선스, 출처 표기 문구
3. 다시 만든 곡과 그 이유
4. 커밋과 푸시는 하지 않는다.

그다음 Claude가 `src/audio/music.js`에 네 곡을 등록해 지금 곡을 바꾸고, 반복 이음매와 음량을 확인하며, `art/audio/CREDITS.md`에 출처를 적는다.
