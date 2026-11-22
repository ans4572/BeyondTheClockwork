# 3장 오르덴 최종 보스 BGM 제작 보고 · 2026-11-20

새 곡 두 개를 작곡·렌더링하여 저장했습니다. 두 곡 모두 길이·용량·형식·음량·트루피크·반복 샘플 수·경계의 수치 검사를 통과했습니다. 직접 청음에 의한 분위기·선율 인지성·이음매 판정은 수행하지 않았습니다. 미리듣기와 두 바퀴 청음 파일을 아래에 남겼습니다.

**템포 조건 예외:** 조율실의 원문 지정 8분음표 168은 4분음표 84입니다. 기존 orden의 4분음표 76과는 8 BPM 차이이므로, ±10 BPM 비교 규칙상 속도는 다름으로 세지 않았습니다. 원문 템포를 유지했고 조성·박자·주선율 악기·전체 화성 경로 네 항목의 차이로 최소 3항목 규칙은 충족합니다.

| 곡 | 저장 파일 | 길이(초) | KB(1000B) | 조성 · 박자 · 템포 | LUFS-I | dBTP | kbps |
|---|---|---:|---:|---|---:|---:|---:|
| orden-chamber | [orden-chamber.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/orden-chamber.ogg>) | 149.99946 | 2723.9 | F#단조 · 7/8(2+2+3) · 8분음표 168(4분음표 84) | -16.00 | -2.66 | 145.28 |
| orden-lasthour | [orden-lasthour.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/orden-lasthour.ogg>) | 155.45469 | 2822.3 | Eb단조 · 3/4 · 4분음표 176, 한 마디를 큰 한 박으로 느낌 | -16.01 | -2.95 | 145.24 |

두 곡 모두 OGG Vorbis / 44.1kHz / 스테레오 / 목표 144kbps이며 각각 3,000,000바이트 미만입니다. 게임 연결·CREDITS 수정·커밋·푸시는 하지 않았습니다.

**조율실 구성:** 1–4마디 도입 → 5–20 A → 21–36 B → 37–44 브리지 → 45–60 A 복귀, 총 60마디입니다. C#–F#–G#–A–낮은 E의 공통 동기를 오르간 페달과 낮은 트롬본이 스타카토로 연주합니다. A는 바이올린·비올라 옥타브의 날카로운 16분음표 선율과 뮤트 트럼펫 응답, B는 파이프 오르간 코랄과 트레몰로 현·가사 없는 합창 패드입니다. 하프시코드와 짧은 현악이 2+2+3 반주를 유지하며 G장조 나폴리화음을 지정 화성에 넣었습니다. 브리지는 하프시코드·종·낮게 연주한 바순 동기만 남기고 스네어 롤로 복귀합니다.

**마지막 정각 구성:** 1–8마디 도입 → 9–56 A(24마디 두 번) → 57–88 B(16마디 두 번) → 89–104 해돋이 브리지 → 105–152 A 복귀(24마디 두 번), 총 152마디입니다. 프롬프트의 A·B 단위를 발전 반복하여 130–160초 길이에 맞췄습니다. 넓은 도약의 현악 주선율, 첼로 탄식, 호른과 합창 패드, B의 빠른 바이올린 아르페지오, 팀파니·스네어·태고풍 큰북의 빠른 3박자 진행으로 첫 곡과 구분했습니다. 하프·첼레스타는 높은 음역의 작은 장식에만 사용했습니다.

해돋이 브리지는 **89–104마디에 한 번**만 있습니다. Gb–Db/F–Ebm–Cb–Ab–Bbsus4–Bb–Eb장조를 각 2마디씩 연주하고 105마디에서 Eb단조로 돌아옵니다. 103–104마디의 동기는 **Bb–Eb–F–G–높은 Bb**로, Gb를 G로 올리고 마지막 하강 대신 3도 상승을 사용했습니다. 이는 원문의 한 번 장조 변형과 “rising third instead of falling seventh”를 적용한 것입니다.

| 곡 | 공통 동기를 넣은 시작 마디 |
|---|---|
| 조율실 | 오르간 페달·트롬본: **1, 3, 5, 13, 45, 53**. 낮은 바순: **37, 41**. 각각 2마디 동기. |
| 마지막 정각 | 호른 도입 **1, 5**. A 첼로 **13, 21, 29, 37, 45, 53, 109, 117, 125, 133, 141, 149**. A 호른 **17, 41, 113, 137**. B 호른 **57, 61, 65, 69, 73, 77, 81, 85**. 장조 변형 호른·합창 **103**. 기본 동기는 4마디, 장조 변형은 2마디. |

종은 조율실에서 1·5·9…57마디에 낮은 C#로 4마디마다 울립니다. 마지막 정각은 낮은 튜뷸러 벨과 옥타브를 겹친 큰 종입니다. 마지막 48마디에 **108·112·116·120·124·128·132·136·140·144·148·152마디**, 정확히 **12번** 울립니다. 이 열두 번은 마지막 A 복귀 구간의 카운트이며 도입·앞 구간·해돋이에도 별도의 종이 있습니다.

**반복 구간은 두 파일 모두 처음부터 끝까지 전체**입니다. 별도 구간 설정 없이 파일 전체를 반복합니다. 앞쪽 무음·곡 끝 페이드아웃·별도 마무리 화음을 추가하지 않았습니다. LOOPSTART=0, LOOPEND/LOOPLENGTH=총 샘플 수(끝점 미포함)를 OGG에 기록했습니다. 실제 게임 플레이어의 반복 기능은 후속 연결에서 설정해야 합니다.

| 곡 | 반복 구간(초) | 샘플 수 | 경계 진폭 차(0–1) | 내부 변화 99백분위 | 청음 자료 |
|---|---|---:|---:|---:|---|
| orden-chamber | 0–149.99946 | 6614976 | 0.0049483 | 0.0692081 | [30초 미리듣기](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber-preview.mp3>) · [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber-loop-join.mp3>) · [두 바퀴 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber-two-loops.wav>) |
| orden-lasthour | 0–155.45469 | 6855552 | 0.0186503 | 0.0563326 | [30초 미리듣기](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour-preview.mp3>) · [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour-loop-join.mp3>) · [두 바퀴 WAV](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour-two-loops.wav>) |

각 악보를 연속 3바퀴 렌더링하고 앞 두 바퀴를 예열한 뒤 세 번째 바퀴를 추출했습니다. 앞 바퀴의 악기 릴리스와 리버브가 시작점으로 이어집니다. EQ와 피크 제한도 반복 신호에서 예열했습니다. 인코딩한 OGG를 다시 PCM으로 디코딩해 샘플 수·시작 무음·경계를 검사했습니다. 수치 검사는 실제 청감을 대신하지 않습니다.

조율실 마지막 1초 대비 처음 1초 RMS는 약 -6.99dB로 도입 편성이 더 조용합니다. 마지막 정각은 약 -0.67dB입니다. 조율실 A 복귀에서 오르간 도입으로 돌아가는 편성 차이는 남겼고 전체 게인 페이드로 감추지 않았습니다. 클릭 수치 통과와 별개로 이 전환의 자연스러움은 청음 확인 대상입니다.

**기존 곡 비교**

지시서 표와 보관된 악보 정보를 함께 사용했습니다. 빠르기는 모두 4분음표 기준으로 환산하며 ±10 BPM 범위는 공통으로 처리했습니다. 화성은 곡 전체 경로의 비교로, i–VI–III–V 같은 공통 기능 진행 자체를 새 발명이라고 주장하지 않습니다. 마지막 정각 B와 두 벨가드 곡의 호른 주선율은 공통으로 처리했습니다. 해돋이에서만 공유하는 장조도 조성 차이로 세지 않았습니다.

**orden-chamber**

| 비교 대상 | 조성 | 박자 | 빠르기 | 주선율 | 전체 화성 경로 | 다른 항목 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 다름 | 공통/겹침 | 다름 | 다름 | 4/5 |
| town-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| dusk-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| roco-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| brass-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| factory-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| factory-rest-v2 | 다름 | 다름 | 공통/겹침 | 다름 | 다름 | 4/5 |
| iris-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| press-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| orden | 다름 | 다름 | 공통/겹침 | 다름 | 다름 | 4/5 |
| tower-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower-rest-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| ticktock-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| belgard-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| tower-rest v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| ticktock v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| belgard v1 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |

**orden-lasthour**

| 비교 대상 | 조성 | 박자 | 빠르기 | 주선율 | 전체 화성 경로 | 다른 항목 |
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

두 곡 모두 모든 비교 대상과 최소 **4/5** 항목이 구분됩니다. 조율실과 프레스는 특히 F#단조/C단조, 7/8/4/4, 현악 주선율/피아노·금관 주선율이 다릅니다. 두 곡이 파이프 오르간을 함께 쓴다는 사실을 악기 차이로 세지 않았습니다.

기존 곡 16개의 첫 4마디 주선율 윤곽을 비교했습니다. 같은 시점의 옥타브 더블링을 합치고 반복음을 제외한 U/D 순서를 비교했으며 동일한 순서는 **0개**였습니다. 2장 factory-rest-v2·iris-v2·press-v2, 3장 v1 네 곡과 v2 네 곡은 실제 보관 악보를 직접 읽었습니다. 1장 다섯 곡은 앞 작업에서 읽기 전용으로 재구성한 악보의 저장 윤곽을 사용했습니다. title-v3·사용자 제공 factory-v2·기존 orden은 정확 악보가 없어 선율 윤곽 직접 비교를 완료했다고 주장하지 않습니다. 이 비교는 오디오 지문 검사나 청감상 유사성 보증이 아닙니다.

**제작 방법과 샘플**

지정 영어 프롬프트 두 블록을 요약·번역·수정하지 않고 작곡 브리프로 사용했으며 원문을 검수 폴더에 보존했습니다. 기존 곡의 오디오·MIDI·선율을 가져오지 않고 새 음표·프레이즈·보이싱·편성을 작성했습니다. 렌더링은 FluidSynth 2.6.2 + FluidR3 GM 3.1, 인코딩·음량 검사는 FFmpeg/libvorbis입니다. 녹음된 어쿠스틱 악기 샘플을 사용했고 순수 파형 오실레이터·칩튠·전자 드럼을 합성해 대신하지 않았습니다.

합창은 예외로 허용된 GM program 52(0부터 세는 번호), SF2 실제 이름 **Ahh Choir**의 가사 없는 합창 섹션 패드만 사용했습니다. 가사·말소리·독창·허밍은 넣지 않았습니다. 콘트라바순 역할은 별도 콘트라바순 샘플이 아니라 **Bassoon 샘플을 낮은 음역으로 연주**했습니다. 호른은 French Horns 섹션 패치로 네 대 호른의 역할을 맡겼으며 개별 네 연주자를 따로 녹음한 것은 아닙니다.

| 곡 | 실제 SF2 프리셋(중복 제외) |
|---|---|
| orden-chamber | Violin, Viola, Muted Trumpet, Church Organ, Trombone, Harpsichord, Strings, Contrabass, Timpani, Orchestra Kit, Tubular Bells, Ahh Choir, Bassoon, Tremolo, Tuba |
| orden-lasthour | Strings, Cello, French Horns, Ahh Choir, Contrabass, Trumpet, Trombone, Timpani, Orchestra Kit, Tubular Bells, Harp, Celesta, Taiko Drum, Tuba |

36Hz 하이패스와 260Hz 약 -1.4dB EQ로 저역 혼탁을 정리하고 -16 LUFS 부근으로 맞춘 뒤 트루피크를 재측정했습니다. 구간별 임의 자동 증폭이나 끝 페이드아웃은 하지 않았습니다.

**라이선스·출처**

FluidR3 GM 3.1 샘플은 **MIT**입니다. 새 외부 샘플은 내려받지 않고 이전에 사용한 동일 SF2를 재사용했습니다. 출처: [Debian fluid-soundfont](https://deb.debian.org/debian/pool/main/f/fluid-soundfont/). SF2 크기 148398306바이트, SHA-256 74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0. 샘플의 MIT 저작권 고지와 전문을 각 OGG의 LICENSE_TEXT 태그에 넣었고 [원 패키지 저작권 자료](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/FluidR3-COPYRIGHT.txt>)도 보존했습니다. Debian 패키징 코드의 별도 GPL 고지와 샘플의 MIT 고지를 구분했습니다.

후속 CREDITS용 표기 문구:

> Instrument samples: FluidR3 GM 3.1. Copyright 2000–2002, 2008 Frank Wen; 2008 Toby Smithe. Licensed under the MIT License. Original Orden boss compositions created for Beyond the Clockwork.

**재제작·미달·남은 확인**

- 두 곡 모두 작곡·렌더링 1회, 재작곡 없음. 음량 조절·검증은 작곡 횟수와 구분했습니다.
- 길이·용량·44.1kHz 스테레오 Vorbis·음량·트루피크·샘플 수·반복 경계 수치 기준 미달 곡은 없습니다.
- 조율실과 기존 orden의 ±10 BPM 밖 속도 차이 조건은 미달입니다. 원문 지정 8분음표 168을 지켰으며 임의로 템포를 바꾸지 않았습니다. 전체 5항목 중 최소 3항목 차이 규칙은 4항목 차이로 충족합니다.
- 직접 청음 항목은 두 곡 모두 미확인입니다. 선율의 감정·음색·웅장함과 조율실 도입으로 돌아가는 전환은 제공한 청음 파일로 확인할 수 있습니다.

**검수 자료**

| 곡 | 원문 프롬프트 | 새 악보 | MIDI | 수치 검사 |
|---|---|---|---|---|
| orden-chamber | [prompt](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber.prompt.txt>) | [score.json](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber-score.json>) | [MIDI](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber.mid>) | [verification](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-chamber-verification.json>) |
| orden-lasthour | [prompt](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour.prompt.txt>) | [score.json](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour-score.json>) | [MIDI](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour.mid>) | [verification](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/orden-lasthour-verification.json>) |

[비교표·선율 윤곽·실제 SF2 악기 정보](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/comparisons.json>) · [최종 파일·보존 검사](<C:/Users/ans45/.codex/visualizations/2026/11/16/01a1e1aa-fe2c-7340-9cb0-9b34b3ef23ed/orden-bgm-20261120/final-verification.json>)

기존 음원·오디오 문서 46개는 작업 시작 시와 SHA-256이 모두 같습니다. 이 작업에서는 코드·데이터·CREDITS를 수정하지 않았고 저장소에는 새 OGG 두 개와 이 보고서만 추가했습니다. 검수 중 별도 작업으로 코드·데이터 3개 파일의 변경이 감지되어 기록했으며 되돌리지 않았습니다. 커밋·푸시는 하지 않았습니다.
