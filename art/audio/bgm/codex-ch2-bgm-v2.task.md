# Codex 작업: 2장 무음공장 배경음악 4곡 다시 만들기 — 피아노 중심 (2026-11-08, v2)

저장소 루트(`Beyond the Clockwork`)를 기준으로 한 경로입니다. 음악 파일만 만듭니다. 코드와 데이터(`src/`, `test/`, `worker/`), 기존 음악 파일(v1 포함)은 건드리지 않습니다. 게임에 연결하는 일은 Claude가 합니다.

## 왜 다시 만드나

v1(`factory.ogg`, `factory-rest.ogg`, `iris.ogg`, `press.ogg`)은 칩튠과 신시사이저 위주라 **기계음, 전자음악 느낌**이 강했다. 이번에는 **피아노가 중심인 어쿠스틱 판타지 RPG 배경음악**으로 다시 만든다.

- **원하는 감성:** 2000년대 한국 판타지 온라인 게임의 마을·사냥터 배경음악처럼 귀에 남는 피아노 멜로디, 가벼운 오케스트라, 정겹고 아련한 분위기.
- **원하지 않는 것:** 칩튠(사각파·삼각파), 신시사이저 리드, 전자 드럼, EDM, 일렉트로닉 효과음, 기계 소음.
- **무음공장의 기계 느낌:** 전자음이 아니라 어쿠스틱 악기로 낸다. 피치카토 현악, 첼레스타, 오르골, 나무 블록, 브러시 스네어, 시계 똑딱 소리를 쓴다.

## 게임과 2장 이야기 (곡 분위기의 바탕)

- **게임:** "Beyond the Clockwork". 태엽 장난감 마을에서 스스로 생각하게 된 인형 F2가 렌치를 들고 싸우는 귀여운 액션 로그라이트.
- **2장 무음공장:** '불량' 딱지가 붙은 주민을 실어 와 생각을 지우고 똑같은 웃음으로 다시 찍어 내는 공장. 귀엽고 장난감 같지만 조용히 섬뜩하다. 공포는 아니다.
  - 조립대의 작업 신호에 맞춰 라인이 한 박자씩 움직인다.
  - 공장은 소리를 지우는 곳이다. 공장 안의 곡은 조용하고 절제되게, 보스전은 크게 터진다.

## 공통 조건

1. **새로 작곡한 곡이어야 한다.** 특정 게임·영화·노래의 멜로디, 화성 진행, 편곡을 흉내 내지 않는다. 위 '감성'은 분위기의 방향이지 베낄 대상이 아니다.
2. **실제 악기 소리:** 피아노, 현악, 목관, 금관, 첼레스타, 글로켄슈필, 오르골, 하프, 팀파니 같은 어쿠스틱 악기 샘플(사운드폰트나 샘플 라이브러리)로 렌더링한다. 순수 신시사이저 파형으로 만들지 않는다.
   - 샘플은 상업 이용이 가능한 라이선스(CC0, MIT, CC-BY 등)만 쓴다. CC-BY라면 출처 표기 문구까지 보고한다.
   - 쓴 샘플, 사운드폰트의 이름과 라이선스를 보고에 적는다.
3. **이음매 없는 반복:** 끝에서 처음으로 넘어갈 때 박자, 음, 소리 크기가 끊기지 않는다. 끝에 페이드아웃, 마무리 화음, 앞쪽 무음을 두지 않는다. 피아노 잔향이 이음매에서 끊기지 않도록 끝부분 잔향을 처음에 겹쳐 넣는다.
4. **형식:** OGG Vorbis, 44.1kHz, 스테레오, 약 128~160kbps. 파일 하나는 3MB 이하.
5. **소리 크기:** 1장 곡과 비슷하게 맞춘다(통합 음량 약 -16 LUFS, 피크 -1 dBTP 이하). 효과음이 묻히지 않도록 중저역을 너무 채우지 않는다.
6. **보컬 없음.** 가사, 말소리, 합창이 없다.

## 곡 4개 (새 파일 이름, v1은 그대로 둔다)

| 순서 | 파일 | 쓰는 곳 | 길이 (반복 한 바퀴) |
| --- | --- | --- | --- |
| 1 | `art/audio/bgm/factory-v2.ogg` | 2장 전투 방 (01~04, 07~11) | 90~120초 |
| 2 | `art/audio/bgm/factory-rest-v2.ogg` | 2장 06 불량품 보관창고 (쉼터, 상점) | 60~90초 |
| 3 | `art/audio/bgm/iris-v2.ogg` | 2장 05 검수실 (중간 보스 아이리스) | 90~120초 |
| 4 | `art/audio/bgm/press-v2.ogg` | 2장 12 정형실 (구역 보스 프레스) | 100~130초 |

각 곡의 생성 프롬프트는 아래 블록을 그대로 쓴다. 요약, 번역, 수정은 하지 않는다.

### 1. 무음공장 전투 방 — `factory-v2.ogg`

```
Instrumental looping background music for a field/dungeon area of a cute fantasy action game, in the spirit of nostalgic 2000s Korean fantasy online RPG field music: a memorable piano melody over a light acoustic orchestra. Original composition; do not imitate any existing game's melody.
Setting: "the Silent Factory", a toy factory where wind-up toys stamped "defective" are brought to have their thoughts erased. Quietly mysterious and a little sad, but still cute; never horror, never electronic.
Tempo 104 BPM, 4/4, key of A minor (with a brighter C major passage in the B section).
Lead: a lyrical grand piano melody in the right hand, an 8-bar phrase that is easy to hum, answered by a clarinet.
Accompaniment: pizzicato strings playing a steady eighth-note ostinato like an assembly line moving one step at a time; a celesta and a music box doubling the melody's high notes; soft legato strings underneath; a harp arpeggio at phrase ends.
Rhythm: acoustic only - a wooden block "tick" on every beat like a clock or a work signal, a soft brushed snare on 2 and 4, a light bass drum or low pizzicato bass on 1 and 3, a small triangle at the start of every 4 bars.
Chords: Am - F - C - E, then Dm - Am - F - E; B section C - G - Am - Em - F - C - Dm - E.
Form: 16 bars A (piano melody, sparse), 16 bars B (fuller strings, the melody up an octave, clarinet countermelody), back to A; loops seamlessly with no ending.
Mood words: curious, gentle, nostalgic, slightly melancholic, steady. Acoustic piano and light orchestra; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 2. 무음공장 쉼터 — `factory-rest-v2.ogg`

```
Instrumental looping rest-area music for a cute fantasy action game, in the spirit of the warm, nostalgic town themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
Setting: a hidden storeroom deep inside the Silent Factory where toys stamped "defective" hide together, mend each other, and a small trader sells spare parts. Safe, warm and small, with a faint sadness - a quiet place out of sight of the assembly line.
Tempo 80 BPM, 3/4 waltz, key of F major with a few borrowed minor colours (F - Dm - Bb - C, then Bb - Bbm - F - C).
Lead: a tender solo piano melody like a lullaby the toys hum to each other; the second time it returns, a music box doubles it an octave higher.
Accompaniment: soft piano left-hand waltz pattern, a warm cello countermelody, a gentle string pad, an occasional harp glissando, a far-off clock ticking very quietly and slowly (as if the factory line cannot reach this room).
Form: 16 bars A (piano alone with soft strings), 16 bars A' (music box doubling, cello countermelody), loops seamlessly with no ending.
Mood words: hiding, mending, kind, hopeful, a little lonely. Acoustic piano, music box, cello and strings; no drums except the faint clock tick; no synthesizers, no chiptune, no vocals.
```

### 3. 검수관 아이리스 보스전 — `iris-v2.ogg`

```
Instrumental looping boss battle music for a cute fantasy action game, in the spirit of the dramatic piano-and-orchestra boss themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
The boss: Inspector Iris, a cold, precise inspection doll with a searchlight lens helmet, a clipboard and a "reject" stamp. She measures every toy's smile, walk and answers, and stamps anything off-standard as defective. Her room is a bright, clean white-and-silver inspection hall with a huge round lens.
Tempo 138 BPM, 4/4, key of E minor; tense, exact and elegant.
Signature: a fast staccato piano ostinato in sixteenths that sweeps up and down like a searchlight scanning (Em - C - Am - B); violins playing sharp spiccato figures; glockenspiel and crotale stabs on the off-beats like stamps coming down; a ticking woodblock like a measuring instrument; a rising string tremolo every 8 bars.
Lead: a cold, angular melody in octaves on the piano, answered by unison violins, with wide leaps and exact rhythm, as if reading out a verdict.
Rhythm: orchestral percussion - timpani on 1 and 3, snare drum on 2 and 4, tight hi-hat or shaker sixteenths, a low tom pickup before bar 4.
Form: 8-bar intro groove (part of the loop), 16 bars A, 16 bars B (half-time feel, the melody an octave higher with brass joining and glockenspiel doubled - the phase where her cross lasers start), back to A; loops seamlessly with no ending.
Mood words: clinical, scanning, judging, relentless, elegant, a little menacing. Piano and orchestra; no synthesizers, no chiptune, no electronic drums, no vocals.
```

### 4. 총감독 프레스 보스전 — `press-v2.ogg`

```
Instrumental looping final boss battle music for a cute fantasy action game, in the spirit of the grand, emotional piano-and-orchestra final boss themes of 2000s Korean fantasy online RPGs. Original composition; do not imitate any existing game's melody.
The boss: Director Press, the giant foreman doll of the Silent Factory, with hydraulic piston arms and a pressure gauge on his chest; he presses everything into the same shape. His arena is the forming hall deep underground: a cathedral-like dark hall of black metal and gold with a giant press machine built into the wall like a throne. He was once the hero's boss: dignified, heavy, unyielding, and in the end tragic.
Tempo 148 BPM, 4/4, key of C minor; grand and oppressive.
Signature: heavy low piano octaves together with timpani and a big orchestral bass drum on the downbeat of every bar, like a press coming down; a dark church pipe organ holding the chords (Cm - Ab - Fm - G, then Cm - Bb - Ab - G); low brass (horns, trombones, tuba) answering; anvil or hammered-metal accents (acoustic) in the fills; string ostinato driving underneath.
Lead: a proud, march-like melody on horns and piano together, with a sorrowful counter-line on solo violin in the B section.
Rhythm: orchestral percussion - timpani, bass drum, snare, cymbals; toms in fills; double-time snare in the B section.
Form: 8 bars intro (piano octaves, timpani and organ only), 16 bars A (full orchestra), 16 bars B (more intense, melody up a fourth, presses every half bar like the walls closing in), 8 bars bridge (quiet piano and a slow clock tick, the last phase where he tests the hero with a mould), back to A; loops seamlessly with no ending.
Mood words: crushing, ceremonial, unstoppable, tragic authority. Piano, pipe organ and full orchestra; no synthesizers, no chiptune, no electronic drums, no vocals.
```

## 저장 전 확인 (한 곡씩)

하나라도 걸리면 다시 만든다. 최대 3번까지 하고, 그래도 안 되면 가장 나은 것을 저장하고 보고한다.

- **악기:** 피아노가 분명히 들리는 중심 악기다. 사각파·삼각파 같은 칩튠 소리, 신시사이저 리드, 전자 드럼, 기계 소음이 없다.
- **멜로디:** 곡마다 따라 흥얼거릴 수 있는 분명한 주선율이 있다.
- **반복:** 파일을 두 번 이어 붙여 들었을 때 이음매에서 박자가 밀리거나, 툭 끊기거나, 소리 크기가 튀거나, 피아노 잔향이 잘리지 않는다.
- **길이와 크기:** 위 표의 길이 안이고, 파일은 3MB 이하다.
- **분위기:**
  - 전투 방: 조용하고 호기심 어린 단조 피아노와 피치카토
  - 쉼터: 따뜻한 3박자 피아노 자장가
  - 아이리스: 훑어 내리는 스타카토 피아노와 도장 같은 글로켄슈필
  - 프레스: 정박마다 내려찍는 피아노 옥타브와 팀파니, 파이프 오르간
- **금지:** 보컬, 기존 곡을 흉내 낸 멜로디, 라이선스가 불분명하거나 상업 이용이 안 되는 샘플이 없다.

## 끝나면 보고

1. 저장한 파일 4개의 경로, 길이(초), 크기(KB)
2. 만든 방법: 도구, 쓴 샘플이나 사운드폰트의 이름, 라이선스, 출처 표기 문구
3. 다시 만든 곡과 그 이유
4. 커밋과 푸시는 하지 않는다.

그다음 Claude가 `src/audio/music.js`에 네 곡을 등록하고, 2장 전투 방·06 쉼터·05 검수실·12 정형실에서 각 곡이 나오게 연결하며, `art/audio/CREDITS.md`에 출처를 적는다.
