# 타이틀 배경음악 v3 프롬프트 — 옛 칩튠 + 지금 피아노 합치기 (2026-11-09)

- **옛 곡 `title.ogg`:** Abstraction 「Puzzle Pieces」(칩튠, CC0). 통통 튀는 8비트 멜로디와 아르페지오.
- **지금 곡 `title-v2.ogg`:** 같은 곡을 피아노·현악·오르골로 편곡한 버전(100 BPM, 4/4, 38마디, 91.2초).
- **v3 목표:** 피아노가 주인공이고, 옛 칩튠 소리는 뒤에서 멜로디를 같이 따라가며 반짝이는 정도(피아노 70 : 칩튠 30).
  1·2장 곡과 같은 어쿠스틱 결은 유지하면서 옛 곡의 장난기와 레트로 감성을 되살린다.
- 저장할 파일 이름: `art/audio/bgm/title-v3.ogg` (지금 곡은 그대로 둔다).

## A. 옛 곡을 올려서 편곡 (추천: 멜로디가 그대로 남는다)

Suno라면 `title.ogg`(CC0)를 올리고 Cover로 만든다. 연주곡(Instrumental) 켬.

**Style**

```
Instrumental cozy title theme, 100 BPM, 4/4, keep the original melody. Warm grand piano plays the main melody; a soft retro chiptune layer (gentle square-wave lead and quick 8-bit arpeggios, low in the mix) doubles it and sparkles on the off-beats like old handheld game music. Music box, celesta and glockenspiel add toy-like shimmer; pizzicato and light legato strings underneath; soft brushed snare, wood block and a quiet clock tick. 2000s Korean fantasy online RPG title feel meets cozy 8-bit charm. Hopeful, curious, playful, a little bittersweet. Seamless loop, no ending, no fade-out.
```

**Exclude styles**

```
vocals, choir, spoken word, EDM, dubstep, trap, heavy drums, distorted synth, harsh square lead, fade-out
```

## B. 새로 만들기 (옛 곡을 못 올릴 때)

**Style**

```
Instrumental looping title theme for a cute wind-up toy town fantasy roguelite, 100 BPM, 4/4, D major with a short turn to B minor. A bouncy, singable 8-bar melody on warm grand piano, doubled softly by a gentle chiptune square-wave lead and quick 8-bit arpeggios kept low in the mix. Music box, celesta and glockenspiel sparkle like toys; pizzicato strings and light legato strings; soft brushed snare, wood block, a quiet clock tick on each beat. 2000s Korean online RPG piano title meets cozy retro handheld game music. Hopeful, curious, playful, a little bittersweet, a small doll stepping out into the world. Seamless loop, no ending, no fade-out.
```

**Exclude styles:** A와 같음.

## 저장 전 확인

- 피아노가 가장 잘 들린다. 칩튠은 피아노를 덮지 않는다.
- 타악기는 작다(타이틀 화면용).
- 두 번 이어 붙여 들어도 이음매가 튀지 않는다. 끝에 페이드아웃이 없다.
- 70~100초, 소리 크기는 지금 곡과 비슷하게(약 -16 LUFS).
