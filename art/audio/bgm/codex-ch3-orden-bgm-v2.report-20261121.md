# 오르덴 BGM v2 제작·검수 보고 · 2026-11-21

새 악보로 두 곡을 다시 만들었습니다. 지정 검사기는 수정하지 않았으며, 최종 OGG를 다시 디코딩한 WAV와 실제 렌더링한 악보로 두 곡 모두 전 항목 PASS입니다. v1 OGG·악보도 같은 검사기로 다시 측정해 아래에 함께 기록했습니다. 직접 청음 검수는 수행하지 않았습니다.

| 곡 | 최종 파일 | 조성 · 박자 · 빠르기 | 길이(초) | 용량(KB, 1000B) | LUFS-I | dBTP | 평균 kbps |
|---|---|---|---:|---:|---:|---:|---:|
| 조율실 | [orden-chamber-v2.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/orden-chamber-v2.ogg>) | F#단조 · 4/4 · 126 | 114.28571 | 2076.6 | -16.04 | -1.84 | 145.36 |
| 마지막 정각 | [orden-lasthour-v2.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/orden-lasthour-v2.ogg>) | Eb단조 → Gb·Eb장조 → Eb단조 · 3/4 · 176 | 155.45469 | 2822.4 | -16.03 | -1.72 | 145.25 |

형식은 모두 OGG Vorbis, 44.1kHz 스테레오, 명목 144kbps입니다. 각 파일은 3,000,000바이트 미만입니다. 게임 연결·CREDITS 수정·커밋·푸시는 하지 않았습니다.

## 편곡과 형식

조율실: 총 60마디, 1–4 도입 → 5–20 A → 21–36 B → 37–44 브리지 → 45–60 A 복귀입니다. 4/4의 일정한 박 위에서 16분음표를 3+3+3+3+2+2로 강조합니다. 중음역 바이올린·비올라가 같은 음을 연주하고 첼로가 한 옥타브 아래에서 받칩니다. B는 오르간 코랄·짧은 현 트레몰로·작은 합창 패드, 브리지는 바순·튜바 동기와 계속 움직이는 저음 현·팀파니를 사용했습니다. 하프시코드는 조용하게 두고, 뮤트 트럼펫 대신 호른이 응답합니다.

마지막 정각: 총 152마디, 1–8 도입 → 9–56 A(24마디 두 번) → 57–88 B(16마디 두 번) → 89–104 해돋이 브리지 → 105–152 A 복귀(24마디 두 번)입니다. 지정 A·B 단위를 발전 반복해 길이를 맞췄습니다. 1박의 저음 현·팀파니와 2·3박의 스피카토·스네어가 빠른 왈츠를 유지합니다. 호른 동기는 첼로·비올라와 같은 음으로 겹치고, B와 해돋이 현은 8분음표로 움직입니다. 브리지에서 드럼을 쉬되 저음 현·콘트라베이스·튜바·트롬본은 계속 연주하고 마지막 마디 팀파니 롤로 복귀합니다. 장조 동기는 99–104마디에 한 번만 나옵니다.

모든 구간에 첼로·콘트라베이스·튜바·트롬본을 편성했습니다. 36Hz 하이패스, 260Hz -1.2dB, 3.2kHz -5dB의 넓은 EQ와 4.3kHz 저역통과로 날카로운 대역을 줄였습니다. 하프·첼레스타·하프시코드는 뒤로 배치했습니다. 기존 곡의 오디오·MIDI·선율을 가져오지 않고 지정 동기와 화성 위에 새 프레이즈를 작성했습니다.

## 동기와 실제 화성

마디 번호는 1부터, 아래 박 번호도 1부터 셉니다. 악보 JSON의 `beat`는 지정 형식대로 0부터 기록했습니다. 동기 화성을 먼저 확정하고 반주·패드·종도 그 화성을 따라가도록 작성했습니다.

| 곡 | 시작 마디 | 음과 길이 | 실제 화성 |
|---|---|---|---|
| orden-chamber | 1 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 3 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 5 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 13 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 37 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 41 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 45 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-chamber | 53 | C#2–F#2–G#2–A2 각 1박 → E2 다음 1마디 | F#m(1·2박), C#7(3박), D(4박) → E(다음 마디) |
| orden-lasthour | 1 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 13 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 37 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 57 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 65 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 73 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 81 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 109 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 133 | Bb3–Eb4–F4–Gb4 각 1마디 → Db4 2마디 | Ebm → Ebm → Bbm → Cb → Gb → Gb |
| orden-lasthour | 99 | Bb3–Eb4–F4–G4 각 1마디 → Bb4 2마디 | Eb → Ab → Bb → Eb/G → Eb → Eb |

조율실 37·41마디 동기는 바순·튜바·트롬본이며 나머지는 저음 금관·오르간 페달입니다. 마지막 정각 동기는 호른·첼로·비올라가 같은 음을 연주합니다. 모든 긴 음은 시작 화음뿐 아니라 지속 중에 지나는 화음까지 확인했고, 화음 밖으로 남는 긴 음은 0개입니다.

## 종을 친 마디와 음

종은 해당 마디의 구성음으로만 연주합니다. 마지막 정각의 105–152마디에 해당하는 종은 108·112·116·120·124·128·132·136·140·144·148·152마디, 정확히 열두 번입니다. 앞 구간에도 종이 있으며, 해돋이 구간의 큰 종은 99마디 한 번입니다. 낮은 종과 높은 종은 같은 FluidR3 Tubular Bells 프리셋을 옥타브로 겹친 편성입니다.

### orden-chamber

| 마디 | 연주 음(실음) | 실제 화음 |
|---:|---|---|
| 4 | E3 | E |
| 8 | C#3 | C#7 |
| 12 | C#3 | C# |
| 16 | C#3 | C#7 |
| 20 | C#3 | C# |
| 24 | F#3 | F#m |
| 28 | C#3 | C#7 |
| 32 | F#3 | F#m |
| 36 | C#3 | C#7 |
| 40 | C#3 | C#7 |
| 44 | C#3 | C# |
| 48 | C#3 | C#7 |
| 52 | C#3 | C# |
| 56 | C#3 | C#7 |
| 60 | C#3 | C# |

### orden-lasthour

| 마디 | 연주 음(실음) | 실제 화음 |
|---:|---|---|
| 4 | Eb2 + Eb3 | Cb |
| 8 | Bb1 + Bb2 | Bb |
| 12 | Bb1 + Bb2 | Bb7 |
| 16 | Eb2 + Eb3 | Cb |
| 20 | Bb1 + Bb2 | Bb7 |
| 24 | Bb1 + Bb2 | Bb |
| 28 | Bb1 + Bb2 | Bb7 |
| 32 | Bb1 + Bb2 | Bb |
| 36 | Bb1 + Bb2 | Bb7 |
| 40 | Eb2 + Eb3 | Cb |
| 44 | Bb1 + Bb2 | Bb7 |
| 48 | Bb1 + Bb2 | Bb |
| 52 | Bb1 + Bb2 | Bb7 |
| 56 | Bb1 + Bb2 | Bb |
| 60 | Eb2 + Eb3 | Cb |
| 64 | Bb1 + Bb2 | Bb7 |
| 68 | Eb2 + Eb3 | Cb |
| 72 | Bb1 + Bb2 | Bb7 |
| 76 | Eb2 + Eb3 | Cb |
| 80 | Bb1 + Bb2 | Bb7 |
| 84 | Eb2 + Eb3 | Cb |
| 88 | Bb1 + Bb2 | Bb7 |
| 99 | Eb2 + Eb3 | Eb |
| 108 | Bb1 + Bb2 | Bb7 |
| 112 | Eb2 + Eb3 | Cb |
| 116 | Bb1 + Bb2 | Bb7 |
| 120 | Bb1 + Bb2 | Bb |
| 124 | Bb1 + Bb2 | Bb7 |
| 128 | Bb1 + Bb2 | Bb |
| 132 | Bb1 + Bb2 | Bb7 |
| 136 | Eb2 + Eb3 | Cb |
| 140 | Bb1 + Bb2 | Bb7 |
| 144 | Bb1 + Bb2 | Bb |
| 148 | Bb1 + Bb2 | Bb7 |
| 152 | Bb1 + Bb2 | Bb |

## 최종 음원 검사와 v1 비교

아래 v1은 기존 파일을 그대로 디코딩한 재측정 결과입니다. 파트 번호·편성은 두 버전 사이에 바뀌었으므로 같은 채널 번호가 같은 악기를 뜻하지 않을 수 있습니다. `long_off_chord`는 비율이며 0.069는 6.9%입니다.

검사기 SHA-256: `ff9d7c09ef8d665d768cc9f53ebe8400cf015c39844a19dccb2d62e79a7c8dbd`. 검사기 원본과 작업 전 해시가 일치합니다. 음원 검사의 WAV는 각 최종 Vorbis를 16비트 PCM으로 디코딩한 파일입니다.

### orden-chamber

| 항목 | v1 | v2 |
|---|---|---|
| clashes | FAIL 18   e.g. bar 9 ch15 A x ch0 G#; bar 9 ch15 A x ch1 G#; bar 17 ch15 A x ch0 G#; bar 17 ch15 A x ch1 G#; bar 21 ch10 C# x ch14 D; bar 21 ch10 C# x ch11 D | PASS 0 |
| long_off_chord | FAIL 0.069   e.g. bar 2 D ch3 E; bar 2 D ch4 E; bar 4 C#7 ch3 E; bar 4 C#7 ch4 E; bar 6 D ch3 E; bar 6 D ch4 E | PASS 0.0 |
| bell_off_chord | FAIL 4   e.g. bar 21 D C#; bar 25 Bm C#; bar 29 D C#; bar 33 Bm C# | PASS 0 |
| dip_db (max-min of 1 s RMS) | FAIL 21.0   e.g. quietest at 99 s | PASS 10.1 |
| seam_db (last s vs first s) | PASS 3.0 | PASS 3.2 |
| centroid_hz | FAIL 2570 | PASS 1042 |

**v1 검사 출력 전체** (종료 코드 1)

```text
orden-chamber
  FAIL  clashes: 18   e.g. bar 9 ch15 A x ch0 G#; bar 9 ch15 A x ch1 G#; bar 17 ch15 A x ch0 G#; bar 17 ch15 A x ch1 G#; bar 21 ch10 C# x ch14 D; bar 21 ch10 C# x ch11 D
  FAIL  long_off_chord: 0.069   e.g. bar 2 D ch3 E; bar 2 D ch4 E; bar 4 C#7 ch3 E; bar 4 C#7 ch4 E; bar 6 D ch3 E; bar 6 D ch4 E
  FAIL  bell_off_chord: 4   e.g. bar 21 D C#; bar 25 Bm C#; bar 29 D C#; bar 33 Bm C#
  FAIL  velocity_sd ch0: 3.0
  FAIL  off_grid ch0: 0.0
  FAIL  velocity_sd ch1: 2.6
  FAIL  off_grid ch1: 0.0
  PASS  velocity_sd ch3: 11.4
  FAIL  off_grid ch3: 0.0
  FAIL  velocity_sd ch5: 5.3
  FAIL  velocity_sd ch6: 6.0
  FAIL  off_grid ch6: 0.0
  FAIL  velocity_sd ch7: 1.2
  FAIL  off_grid ch7: 0.0
  FAIL  velocity_sd ch11: 1.2
  FAIL  off_grid ch11: 0.0
  FAIL  velocity_sd ch13: 2.5
  FAIL  off_grid ch13: 0.0
  FAIL  velocity_sd ch14: 3.6
  FAIL  off_grid ch14: 0.0
  FAIL  velocity_sd ch15: 1.2
  FAIL  off_grid ch15: 0.0
  FAIL  dip_db (max-min of 1 s RMS): 21.0   e.g. quietest at 99 s
  PASS  seam_db (last s vs first s): 3.0
  FAIL  centroid_hz: 2570
```

**v2 검사 출력 전체** (종료 코드 0)

```text
orden-chamber
  PASS  clashes: 0
  PASS  long_off_chord: 0.0
  PASS  bell_off_chord: 0
  PASS  velocity_sd ch0: 10.3
  PASS  off_grid ch0: 1.0
  PASS  velocity_sd ch1: 10.2
  PASS  off_grid ch1: 1.0
  PASS  velocity_sd ch2: 10.3
  PASS  off_grid ch2: 1.0
  PASS  velocity_sd ch3: 11.3
  PASS  off_grid ch3: 1.0
  PASS  velocity_sd ch4: 11.5
  PASS  off_grid ch4: 1.0
  PASS  velocity_sd ch5: 7.3
  PASS  off_grid ch5: 1.0
  PASS  velocity_sd ch6: 7.5
  PASS  off_grid ch6: 1.0
  PASS  velocity_sd ch7: 7.5
  PASS  off_grid ch7: 1.0
  PASS  velocity_sd ch10: 11.4
  PASS  velocity_sd ch13: 7.9
  PASS  off_grid ch13: 1.0
  PASS  velocity_sd ch14: 8.3
  PASS  off_grid ch14: 1.0
  PASS  dip_db (max-min of 1 s RMS): 10.1
  PASS  seam_db (last s vs first s): 3.2
  PASS  centroid_hz: 1042
```

검사 입력: [v2 악보 JSON](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-score.json>) · [최종 OGG 디코딩 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-v2-decoded.wav>) · [v1 출력 원본](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-v1-checker.txt>) · [v2 출력 원본](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-v2-checker.txt>)

### orden-lasthour

| 항목 | v1 | v2 |
|---|---|---|
| clashes | FAIL 188   e.g. bar 2 ch3 F# x ch2 F; bar 4 ch2 C# x ch3 D; bar 8 ch2 C# x ch3 D; bar 12 ch3 D x ch10 Eb; bar 12 ch3 D x ch11 Eb; bar 12 ch10 Eb x ch0 D | PASS 0 |
| long_off_chord | FAIL 0.108   e.g. bar 12 Bb7 ch10 Eb; bar 12 Bb7 ch11 Eb; bar 16 Bb ch10 Eb; bar 16 Bb ch11 Eb; bar 20 Bb7 ch10 Eb; bar 20 Bb7 ch11 Eb | PASS 0.0 |
| bell_off_chord | FAIL 56   e.g. bar 12 Bb7 Eb; bar 12 Bb7 Eb; bar 16 Bb Eb; bar 16 Bb Eb; bar 20 Bb7 Eb; bar 20 Bb7 Eb | PASS 0 |
| dip_db (max-min of 1 s RMS) | PASS 10.4 | PASS 8.3 |
| seam_db (last s vs first s) | PASS 0.3 | PASS 0.2 |
| centroid_hz | FAIL 1863 | PASS 1146 |

**v1 검사 출력 전체** (종료 코드 1)

```text
orden-lasthour
  FAIL  clashes: 188   e.g. bar 2 ch3 F# x ch2 F; bar 4 ch2 C# x ch3 D; bar 8 ch2 C# x ch3 D; bar 12 ch3 D x ch10 Eb; bar 12 ch3 D x ch11 Eb; bar 12 ch10 Eb x ch0 D
  FAIL  long_off_chord: 0.108   e.g. bar 12 Bb7 ch10 Eb; bar 12 Bb7 ch11 Eb; bar 16 Bb ch10 Eb; bar 16 Bb ch11 Eb; bar 20 Bb7 ch10 Eb; bar 20 Bb7 ch11 Eb
  FAIL  bell_off_chord: 56   e.g. bar 12 Bb7 Eb; bar 12 Bb7 Eb; bar 16 Bb Eb; bar 16 Bb Eb; bar 20 Bb7 Eb; bar 20 Bb7 Eb
  PASS  velocity_sd ch0: 11.5
  FAIL  off_grid ch0: 0.0
  FAIL  velocity_sd ch1: 1.2
  FAIL  off_grid ch1: 0.0
  PASS  velocity_sd ch2: 6.4
  FAIL  off_grid ch2: 0.0
  FAIL  velocity_sd ch3: 3.6
  FAIL  off_grid ch3: 0.0
  PASS  velocity_sd ch4: 6.8
  FAIL  off_grid ch4: 0.0
  FAIL  velocity_sd ch5: 4.2
  FAIL  off_grid ch5: 0.0
  FAIL  velocity_sd ch6: 2.2
  FAIL  off_grid ch6: 0.0
  FAIL  velocity_sd ch7: 1.2
  FAIL  off_grid ch7: 0.0
  FAIL  velocity_sd ch12: 3.6
  FAIL  off_grid ch12: 0.0
  PASS  dip_db (max-min of 1 s RMS): 10.4
  PASS  seam_db (last s vs first s): 0.3
  FAIL  centroid_hz: 1863
```

**v2 검사 출력 전체** (종료 코드 0)

```text
orden-lasthour
  PASS  clashes: 0
  PASS  long_off_chord: 0.0
  PASS  bell_off_chord: 0
  PASS  velocity_sd ch0: 12.8
  PASS  off_grid ch0: 1.0
  PASS  velocity_sd ch1: 9.0
  PASS  off_grid ch1: 1.0
  PASS  velocity_sd ch2: 9.1
  PASS  off_grid ch2: 1.0
  PASS  velocity_sd ch3: 8.2
  PASS  off_grid ch3: 1.0
  PASS  velocity_sd ch4: 9.1
  PASS  off_grid ch4: 1.0
  PASS  velocity_sd ch5: 14.7
  PASS  off_grid ch5: 1.0
  PASS  velocity_sd ch6: 7.9
  PASS  off_grid ch6: 1.0
  PASS  velocity_sd ch7: 7.8
  PASS  off_grid ch7: 1.0
  PASS  velocity_sd ch12: 9.8
  PASS  off_grid ch12: 1.0
  PASS  velocity_sd ch13: 7.9
  PASS  off_grid ch13: 1.0
  PASS  velocity_sd ch14: 8.1
  PASS  off_grid ch14: 1.0
  PASS  velocity_sd ch15: 8.0
  PASS  off_grid ch15: 1.0
  PASS  dip_db (max-min of 1 s RMS): 8.3
  PASS  seam_db (last s vs first s): 0.2
  PASS  centroid_hz: 1146
```

검사 입력: [v2 악보 JSON](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-score.json>) · [최종 OGG 디코딩 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-v2-decoded.wav>) · [v1 출력 원본](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-v1-checker.txt>) · [v2 출력 원본](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-v2-checker.txt>)

## 연주 강약과 음색 겹침

강박·약박의 차이, 8마디 프레이즈의 상승·하강, 작은 개별 강약 변화를 넣었습니다. 하프시코드는 정확한 박을 유지하며 다른 성부는 시작점을 ±5–12ms 범위로 설정했습니다. 실제 렌더링 사건은 FluidSynth의 64샘플(약 1.45ms) 단위에 맞췄습니다. 악보에는 실제 사건 시각과 원래 박을 함께 남겼습니다. 2박을 넘는 현·금관·합창에 CC11 85→104→118→88의 부풀었다 줄어드는 곡선을 넣고 실제 렌더링에 적용했습니다.

합창은 GM Choir Aahs(실제 SF2 이름 Ahh Choir)의 가사 없는 섹션 패드만 썼습니다. 모든 합창 음은 같은 음·시작·길이의 현이 받칩니다. 합창과 받침 현을 동일한 합성기 게인으로 따로 렌더링하고 개별 정규화 없이 비교했습니다. 아래 최대치는 합창이 활성인 1초 창 중 가장 큰 상대 음량이며 모두 -6dB 이하입니다.

| 곡 | 합창 음 / 같은 음의 현 받침 | 합창 상대 음량 최대(dB) | 긴 금관 / 같은 음 더블링 | 실제 CC11 사건 |
|---|---:|---:|---:|---:|
| orden-chamber | 48 / 48 | -23.78 | 16 / 16 | 1096 |
| orden-lasthour | 240 / 240 | -28.63 | 50 / 50 | 4120 |

뮤트 트럼펫·피아노·오르골·글로켄슈필·우드블록·전자 드럼은 사용하지 않았습니다. French Horns는 호른 섹션 패치로 네 대 호른 역할을 맡겼으며 개별 연주자 네 명을 따로 녹음한 것은 아닙니다.

## 반복과 미리듣기

두 파일 모두 0초부터 끝점까지 전체 반복입니다. 악보를 연속 세 바퀴 렌더링해 앞 두 바퀴를 예열하고 세 번째 바퀴를 추출했습니다. 앞 바퀴의 릴리스·리버브가 시작점에 이어지고, EQ·리미터도 반복 신호로 예열했습니다. 페이드 도입·페이드아웃·별도 종결 화음·앞쪽 무음은 넣지 않았습니다. OGG의 LOOPSTART=0, LOOPEND/LOOPLENGTH=총 샘플 수입니다.

| 곡 | 반복 끝(초) | 샘플 수 / 디코딩 샘플 수 | 경계 진폭 차 | 실제 끝 1초와 처음 1초 RMS 차(dB) |
|---|---:|---:|---:|---:|
| orden-chamber | 114.28571 | 5040000 / 5040000 | 0.0162604 | 1.31 |
| orden-lasthour | 155.45469 | 6855552 / 6855552 | 0.0066952 | 0.20 |

지정 검사기는 정수 초 단위로 자른 마지막 완전한 1초를 사용합니다. 위 표는 파일의 실제 끝에서 잰 별도 수치이며 이쪽도 5dB 이내입니다. 경계 한 샘플 변화도 내부 변화의 99백분위 대비 기준을 통과했습니다.

- **orden-chamber:** [30초 미리듣기](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-preview.mp3>) · [이음매 앞뒤 12초 MP3](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-loop-join.mp3>) · [12초 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-loop-join.wav>) · [두 바퀴 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-two-loops.wav>)
- **orden-lasthour:** [30초 미리듣기](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-preview.mp3>) · [이음매 앞뒤 12초 MP3](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-loop-join.mp3>) · [12초 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-loop-join.wav>) · [두 바퀴 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-two-loops.wav>)

## 기존 곡과의 비교

조성·박자·4분음표 빠르기(±10 BPM 밖)·주선율 악기·전체 화성 경로를 비교했습니다. ±10에 정확히 걸리는 빠르기는 공통으로 셌습니다. 짧은 공통 기능 화성을 고유한 발명으로 주장하지 않으며 전체 경로로 비교했습니다. 마지막 정각과 벨가드의 호른 주선율은 공통으로 처리했습니다.

조율실과 ticktock-v2는 126/116으로 빠르기를 공통으로 셌고, 4/4도 공통입니다. 조성·주선율·전체 화성 경로 세 항목은 다릅니다. iris-v2(138), belgard-v2(144), press-v2(148)는 조율실과 모두 네 항목이 다릅니다. v1에 있던 “프레스와 박자도 달라야 함”은 이번 v2의 명시적 4/4 지정으로 대체했습니다. 프레스와 조율실은 4/4를 공유하며 나머지 네 비교 항목이 다릅니다.

### orden-chamber

| 비교 곡 | 조성 | 박자 | 빠르기 | 주선율 | 전체 화성 경로 | 다른 항목 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| town-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| dusk-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| roco-v2 | 다름 | 공통/겹침 | 공통/겹침 | 다름 | 다름 | 3/5 |
| brass-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| factory-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| factory-rest-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| iris-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| press-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| orden | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower-rest-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| ticktock-v2 | 다름 | 공통/겹침 | 공통/겹침 | 다름 | 다름 | 3/5 |
| belgard-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| tower v1 | 다름 | 공통/겹침 | 공통/겹침 | 다름 | 다름 | 3/5 |
| tower-rest v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| ticktock v1 | 다름 | 다름 | 공통/겹침 | 다름 | 다름 | 4/5 |
| belgard v1 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |

### orden-lasthour

| 비교 곡 | 조성 | 박자 | 빠르기 | 주선율 | 전체 화성 경로 | 다른 항목 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| town-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| dusk-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| roco-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| brass-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| factory-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| factory-rest-v2 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| iris-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| press-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| orden | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| tower-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower-rest-v2 | 공통/겹침 | 다름 | 다름 | 다름 | 다름 | 4/5 |
| ticktock-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| belgard-v2 | 다름 | 다름 | 다름 | 공통/겹침 | 다름 | 4/5 |
| tower v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower-rest v1 | 다름 | 공통/겹침 | 다름 | 다름 | 다름 | 4/5 |
| ticktock v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| belgard v1 | 다름 | 다름 | 다름 | 공통/겹침 | 다름 | 4/5 |

조율실은 모든 대상과 최소 3/5, 마지막 정각은 최소 4/5 항목이 다릅니다. 기존 16개 악보의 첫 네 선율 마디와, 옥타브 더블링·반복음을 합친 U/D 방향 순서를 비교했을 때 동일 순서는 0개였습니다. 새 악보는 흔들린 실제 시각 대신 원래 박으로 묶어 비교해 연주 시차가 윤곽 차이로 계산되지 않도록 했습니다.

2장 세 곡, 3장 v1·v2 네 곡씩은 보관 악보를 직접 읽었고 1장 다섯 곡은 이전에 읽기 전용으로 재구성한 악보의 저장 윤곽을 썼습니다. title-v3·사용자 제공 factory-v2·기존 orden은 정확 악보가 없어 직접 선율 비교를 완료했다고 주장하지 않습니다. 오디오 지문 검사나 청감 유사성 판정은 수행하지 않았습니다. 비교 원자료와 각 참조 경로·해시는 [comparisons.json](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/comparisons.json>)에 있습니다.

## 제작 도구·라이선스·출처

FluidSynth 2.6.2 + FluidR3 GM 3.1의 실제 악기 샘플을 사용했습니다. 새 외부 샘플은 내려받지 않았습니다. 영어 프롬프트 두 블록은 수정·번역·요약 없이 작곡 브리프로 사용했으며 원문과 SHA-256을 악보·OGG 태그·검수 자료에 보존했습니다. 인코딩과 음량 검사는 FFmpeg/libvorbis입니다.

| 곡 | 실제 SF2 프리셋(중복 제외) |
|---|---|
| orden-chamber | Violin, Viola, Cello, Contrabass, Trombone, Tuba, Church Organ, French Horns, Orchestra Kit, Harpsichord, Timpani, Tubular Bells, Ahh Choir, Strings, Bassoon |
| orden-lasthour | Strings, Cello, Viola, French Horns, Contrabass, Tuba, Trombone, Timpani, Orchestra Kit, Tubular Bells, Harp, Celesta, Ahh Choir, Taiko Drum, Trumpet |

FluidR3 GM 3.1 샘플 라이선스는 **MIT**입니다. 출처: [Debian fluid-soundfont](https://deb.debian.org/debian/pool/main/f/fluid-soundfont/). 실제 SF2 크기 148398306바이트, SHA-256 `74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`입니다. 샘플의 MIT 저작권 고지·전문을 각 OGG의 LICENSE_TEXT에 넣었고 Debian 패키징 코드의 별도 GPL 고지와 구분했습니다. [원 패키지 저작권 자료](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/FluidR3-COPYRIGHT.txt>)를 보존했습니다.

> Instrument samples: FluidR3 GM 3.1. Copyright 2000–2002, 2008 Frank Wen; 2008 Toby Smithe. Licensed under the MIT License. Original Orden boss compositions created for Beyond the Clockwork.

## 재제작·미달·보호 확인

- 조율실: 작곡·렌더링 2회. 첫 시도는 악보·음량 폭·무게중심을 통과했으나 지정 검사기의 반복 음량 차가 5.8dB로 미달했습니다. 두 번째 시도에서 도입을 강하게 시작하고 마지막 프레이즈가 내려오는 강약 곡선으로 바꿨습니다. 첫 시도는 검수 폴더의 `orden-chamber-attempt1`에 남겼습니다. 전체 음량 페이드로 숨기지 않았습니다.
- 마지막 정각: 작곡·렌더링 1회, 모든 지정 검사 통과. 음량 정규화·인코딩 검수는 작곡 시도와 구분했습니다.
- 최종 수치 기준 미달 항목은 없습니다. 직접 청음에 의한 감정·음색·웅장함·이음매 판정은 미확인입니다. 30초·이음매·두 바퀴 청음 자료를 남겼습니다.
- 작업 전 보호 파일 213개를 해시로 대조했습니다. 기존 `art/audio` 파일 변경은 0개입니다. 이 작업에서 저장소에 추가하는 파일은 새 OGG 두 개와 이 보고서뿐입니다.

동시에 진행되는 별도 작업으로 다음 보호 경로의 해시가 달라져 있습니다. 이 작업에서는 해당 파일을 수정하거나 되돌리지 않았습니다.

- `C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\src\data\slice.json`
- `C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\src\engine\bell-boss.js`
- `C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\src\engine\game.js`
- `C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\src\engine\orden-boss.js`
- `C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\src\render\orden-boss-draw.js`
- `C:\Users\ans45\OneDrive\바탕 화면\Beyond the Clockwork\test\orden-boss.test.js`

## 검수 자료

[최종 검증 JSON](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/final-verification.json>) · [v1/v2 검사 출력과 입력 해시](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/checker-results.json>) · [비교와 실제 악기 목록](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/comparisons.json>)

- orden-chamber: [악보](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-score.json>) · [원문 프롬프트](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber.prompt.txt>) · [수치 검증](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-verification.json>) · [마스터링 기록](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-chamber-mastering.json>)
- orden-lasthour: [악보](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-score.json>) · [원문 프롬프트](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour.prompt.txt>) · [수치 검증](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-verification.json>) · [마스터링 기록](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-v2-20261121/orden-lasthour-mastering.json>)

파일 SHA-256:

- `orden-chamber-v2.ogg`: `10c3e28927a32c01d0a532dd1ab33bb0b857087c2fb136fa26007a15a65439f6`
- `orden-lasthour-v2.ogg`: `c0189afcc43c184217a2d16213ae17e7f8d8012c071bedba49a4bd87b37d87a3`
