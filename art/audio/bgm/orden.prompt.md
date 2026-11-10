# 오르덴 테마 배경음악 프롬프트 — 중앙시계탑 꼭대기 장면 (2026-11-09)

- **쓰는 곳:** 1장·2장을 끝낸 뒤 나오는 시계탑 꼭대기 장면(오르덴과 벨가드의 대화). 지금은 이 장면에 타이틀 곡이 나온다.
- **새 파일:** `art/audio/bgm/orden.ogg`. 받으면 Claude가 이 장면에만 연결한다. 끝나면 완주 화면은 다시 타이틀 곡.
- **오르덴:** 마을을 지키려다 모든 선택을 표준화해 버린 대조율사. 겉은 친절하고 단정한 시계공 인형. 마왕이 아니라 '선의가 통제로 굳은' 권력.
  - 대사 결: "흐트러진 박자는 다시 맞추면 그만이다.", "고장 난 태엽 하나가 탑을 멈출 수는 없다."
- **곡의 느낌:** 차갑고 정확하고 장엄하다. 그 밑에 쓸쓸함이 한 줄 깔린다. 대사 밑에 깔리므로 조용하고 박이 일정하다. 큰 북이나 클라이맥스는 없다.
- **게임과 결 맞추기:** 1·2장 곡처럼 피아노가 중심인 어쿠스틱 합주다. 오르덴만의 색은 시계 장치 소리(하프시코드, 오르골, 탑의 종, 째깍 소리)로 낸다.

## A. Suno (Instrumental 켬)

**Style**

```
Instrumental looping villain theme for a cute wind-up toy fantasy game, the calm ruler at the top of a great clock tower. 76 BPM, 3/4, a slow, precise clockwork waltz in D minor. A cold, elegant piano melody over a steady harpsichord ostinato that ticks like gears; a music box doubles the melody an octave up; low legato strings and a soft pipe organ pad underneath; a deep tower bell tolls once every 8 bars; a quiet clock tick on every beat. Restrained, ceremonial, controlled and quietly menacing, with a lonely, sorrowful line in the cello. Kind face, iron rule. 2000s Korean fantasy online RPG piano style. Calm enough to sit under dialogue, no big climax. Seamless loop, no ending, no fade-out.
```

**Exclude styles**

```
vocals, choir, spoken word, EDM, dubstep, trap, rock drums, heavy percussion, distorted synth, chiptune, horror screams, fade-out
```

## A-2. makebestmusic.com (Text to Instrumental 탭)

제외 칸이 없어서 빼고 싶은 것을 설명 끝에 문장으로 넣었다. 길이 제한에 걸리면 짧은 판을 쓴다.

```
Slow clockwork waltz, 76 BPM, 3/4, D minor. Theme of a calm, kind-faced ruler at the top of a great clock tower in a cute wind-up toy world. Cold, elegant piano melody over a steady ticking harpsichord ostinato; a music box doubles the melody; low strings and a soft pipe organ underneath; a lonely cello line; a deep tower bell once every 8 bars; a quiet clock tick on every beat. Precise, ceremonial, quietly menacing, a little sad. Calm enough for dialogue, no big climax. No vocals, no drums, no synths, no chiptune. Seamless loop, no fade-out.
```

짧은 판:

```
Slow clockwork waltz in D minor, 76 BPM: cold elegant piano, ticking harpsichord, music box, low strings, soft organ, tower bell. Calm, precise, quietly menacing villain theme. No vocals, no drums, no synths.
```

## B. 직접 작곡용 (Codex 등)

```
Instrumental looping theme for Grand Tuner Orden, the final ruler of a cute wind-up toy island, heard in the scene at the top of the central clock tower where he hears that the hero has broken another of his districts. Original composition; do not imitate any existing game's melody.
Character: a kind-looking, neat clockmaker doll who wanted to end conflict and so made every choice the same. Not a demon: a guardian whose care hardened into control. Calm, certain, precise; beneath it, something lonely.
Tempo 76 BPM, 3/4, D minor; a slow clockwork waltz.
Lead: a cold, elegant 8-bar piano melody in the right hand, stepwise and exact, ending each phrase on a held note like a clock hand stopping; the second time a music box doubles it an octave higher.
Accompaniment: a steady harpsichord ostinato in eighth notes like turning gears; low legato strings; a soft pipe organ pad; a solo cello counter-line in the B section, sorrowful.
Rhythm: no drums. A quiet wooden clock tick on every beat and a deep tower bell struck once at the start of every 8 bars.
Chords: Dm - A/C# - Dm/C - G/B - Bb - Gm - A - A; B section F - C/E - Dm - Am - Bb - F/A - Gm - A7.
Form: 16 bars A (piano, harpsichord, ticks), 16 bars B (strings and cello rise, the bell twice), 8 bars A' (music box doubling, thinner), loops seamlessly with no ending, no fade-out and no final chord.
Mood words: precise, ceremonial, controlled, quietly menacing, lonely. Piano, harpsichord, music box, strings, cello, soft organ, tower bell; no synthesizers, no chiptune, no electronic drums, no vocals.
```

## 저장 전 확인

- 피아노와 하프시코드가 분명히 들리고, 대사를 덮지 않을 만큼 조용하다(약 -18 LUFS, 다른 곡보다 살짝 작게).
- 북 없이 째깍 소리와 종만으로 박이 느껴진다.
- 두 번 이어 붙여 들어도 이음매가 튀지 않는다. 끝에 페이드아웃이 없다.
- 60~100초.
