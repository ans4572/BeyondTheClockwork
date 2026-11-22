# 3장 중앙시계탑 BGM v2 제작 보고 — 2026-11-18

**v2 네 곡 저장 완료.** 네 곡의 형식·음량·피크·용량·반복 샘플 수와 파일 접합의 수치 검사를 통과했다. 벨가드는 별도의 1초 RMS 조건도 통과했다. 아래 비교표는 악보·편성·제공된 기존 곡 정보에 따른 설계 비교이며, 직접 청음에 의한 분위기·유사성·이음매 판정까지 통과했다고 표시하지 않는다. 이 세션에는 오디오를 듣는 도구가 없다.

**사용자 결정:** 쉼터의 `66 BPM·4/4·32마디`와 `60~90초`가 양립하지 않아 확인했고, 사용자는 **“구성 우선: 32마디·116.4초로 제작”**을 선택했다. 따라서 쉼터는 32마디 구성을 보존했으며 116.4초를 길이 미달로 처리하지 않았다. 영어 프롬프트 전문은 수정하지 않았다.

## 저장 결과

| 곡 | 파일 | 길이(초) | KB(1000바이트) | 박자·빠르기 | 마디 수 | LUFS-I | dBTP | kbps |
|---|---|---:|---:|---|---:|---:|---:|---:|
| 중앙시계탑 전투 방 | [tower-v2.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/tower-v2.ogg>) | 101.81805 | 1852.0 | 6/8 · 점4분음표 66 (4분음표 99) | 56 | -15.98 | -5.98 | 145.52 |
| 멈춘 시계 다락 쉼터 | [tower-rest-v2.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/tower-rest-v2.ogg>) | 116.36390 | 2114.4 | 4/4 · 4분음표 66 | 32 | -15.96 | -5.29 | 145.36 |
| 시간지기 틱·톡 | [ticktock-v2.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/ticktock-v2.ogg>) | 107.58676 | 1957.2 | 4/4 · 4분음표 116 | 52 | -15.97 | -3.77 | 145.54 |
| 종루수호자 벨가드 | [belgard-v2.ogg](<C:/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/art/audio/bgm/belgard-v2.ogg>) | 100.00109 | 1817.7 | 4/4 · 4분음표 144 | 60 | -15.99 | -2.99 | 145.41 |

모두 OGG Vorbis / 44.1kHz / 스테레오 / 목표 144kbps이며 3MB 미만이다. v1 네 파일과 다른 기존 음악은 덮어쓰지 않았다. 코드·데이터·CREDITS·게임 연결도 수정하지 않았다.

## v1에서 바꾼 음악적 중심

- **전투 방:** E 도리안의 6/8. 오보에가 네 음을 내려간 뒤 6도로 올라가는 긴 선율을 연주하고, B에서는 비올라가 주선율을 받는다. 마림바는 조용한 한 옥타브 아래 더블링만 맡는다. 시계 느낌은 하프시코드의 16분음표 톱니와 점4분음표마다 흔들리는 콘트라베이스·낮은 클라리넷으로 낸다. 반짝이는 오르골·첼레스타·글로켄슈필·하프, 피치카토 오스티나토와 매 박 우드블록을 쓰지 않았다. 16 A + 16 B + 8 브리지 + 16 A 복귀.
- **쉼터:** Eb장조·Lydian 색채, 66 BPM의 곧은 4/4. 오카리나·나일론 기타가 시작하고 바이올린이 이어받으며 Cm의 B를 지난다. 첼로 대선율과 왈츠 반주를 없앴다. 비브라폰은 SF2의 모터 LFO 진폭을 상쇄해 끄고, 칼림바는 구절 끝에만 넣었다. 시계 클릭은 4마디마다 한 번이다. 8 A + 8 A′ + 8 B + 8 A″.
- **틱·톡:** A단조 116 BPM 4/4. 왼쪽 플루트·오른쪽 오보에의 2마디 문답, 8마디 끝의 3도 화음, 하프시코드·현악4중주 편성이다. 가운데 8마디 B1은 첼로 칸타빌레로 차분하게 바뀌며, B2에서 짧은 현악과 두 배 메트로놈, 호른이 들어온다. 서커스의 튜바·바순 주선율·실로폰·갤럽·움파 반주·심벌 크래시는 없앴다. 메트로놈은 실제 녹음된 클라베스의 짧은 나무 타음과 작은 종으로 구성했으며, 별도 기계 메트로놈 녹음 파일을 사용한 것은 아니다. 4 도입 + 16 A + 8 B1 + 8 B2 + 16 A 복귀.
- **벨가드:** C#단조 144 BPM, 인형극 B에서는 D단조로 반음 상승한다. 낮은 현악·트롬본·튜바가 3+3+2의 8분음표 리프와 반음 갈림을 처음부터 끝까지 계속 연주한다. 호른·트롬본의 주선율, 짧은 트럼펫 응답, 큰 종과 팀파니를 사용했다. 브레이크다운에서도 낮은 현악과 팀파니가 끊기지 않고 커지며, 느린 하프타임·조용한 드론·8마디의 조용한 도입은 없다. 4 강한 도입 + 16 A + 16 B + 8 활동적인 브레이크다운 + 16 A 복귀.

## 벨가드 긴장 유지 검사

- 디코딩한 OGG 전체를 1초 단위로 측정: 가장 큰 1초와 가장 작은 1초 RMS 차이 **11.30197 dB**, 조건 ≤12dB 통과.
- 더 촘촘하게 0.25초씩 이동하는 1초 창으로 재검사: 최대 차이 **11.72803 dB**, 역시 ≤12dB.
- 마지막의 1초 미만 조각은 다음 반복의 시작과 연결해 온전한 1초로 측정했다. 브레이크다운과 반복 경계도 포함했고, 작은 구간을 빼거나 제외하지 않았다.
- 이 조건을 맞추기 위해 조용한 부분만 따로 자동 증폭하는 처리는 하지 않았다. 연속 저음 리프와 팀파니의 편성·강약으로 유지했다.

## 기존 곡과의 비교 기준

각 곡마다 **조성·박자표·빠르기·주선율 악기·화성 전체 경로** 다섯 항목 중 최소 세 항목이 다르다. 빠르기는 ±10 BPM를 포함하면 같은 범위로 취급했다. 6/8의 점4분음표 66은 비교할 때 4분음표 99로 환산하여 박자와 빠르기를 중복해 과장하지 않았다.

제공된 기존 곡 표와 남아 있는 최종 악보에 차이가 있었다. 예를 들어 실제 `factory-rest-v2` 캐시는 **G 중심·4/4·74 BPM**이고, town은 **A 중심·95 BPM·7/4**로 기보되어 있다. title-v2 캐시 편곡은 Cm 계열이고, brass는 2/4 느낌을 4/4로 기보했다. 이 경우 어느 쪽을 적용해도 다를 때만 해당 항목의 차이를 세어 보수적으로 비교했다. 실제 오디오와 보관된 OGG의 해시 일치 자료는 [reference-provenance.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/reference-provenance.json>)에 있다.

주선율 악기는 보조 음색의 존재 여부가 아니라 **주선율을 맡는 중심 파트**를 비교했다. 예를 들어 프레스의 피아노·호른에서 벨가드의 호른·트롬본으로 바뀐 것은 피아노가 빠지고 트롬본이 공동 주선율이 되는 변화다.

**화성 비교의 한계:** 벨가드 A의 C#m–A–F#m–G#는 프레스의 Cm–Ab–Fm–G와 기능 진행(i–VI–iv–V)이 같다. 이 짧은 공통 진행을 새로운 화성이라고 세지 않았다. 비교표의 화성 차이는 **반음 상행 D단조 B와 나폴리화음 클라이맥스를 포함한 곡 전체 화성 경로**의 차이를 뜻한다. 원문에서 지정한 화성은 바꾸지 않았다. 화성 경로를 한 항목으로 세는 악보상 비교이며 청감상 유사성이 없다는 보장은 아니다.

### 중앙시계탑 전투 방 — tower-v2

- 새 곡: E Dorian / 6/8 / 99 BPM(비교용 4분음표) / 오보에·비올라.
- 새 화성: Em–A/E–Em–D–C–D–Em–Bm; G–A–Em–F#m–C–D–B7–Em.

| 기존 곡 | 조성 | 박자 | 빠르기 | 주선율 | 화성 전체 경로 | 다른 항목 수 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 다름 | 같거나 겹침 | 다름 | 다름 | 4/5 |
| town-v2 | 다름 | 다름 | 같거나 겹침 | 다름 | 다름 | 4/5 |
| dusk-v2 | 다름 | 다름 | 같거나 겹침 | 다름 | 다름 | 4/5 |
| roco-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| brass-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| factory-v2 | 다름 | 다름 | 같거나 겹침 | 다름 | 다름 | 4/5 |
| factory-rest-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| iris-v2 | 같거나 겹침 | 다름 | 다름 | 다름 | 다름 | 4/5 |
| press-v2 | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |
| orden | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |

### 멈춘 시계 다락 쉼터 — tower-rest-v2

- 새 곡: Eb major/Lydian, C minor B / 4/4 / 66 BPM(비교용 4분음표) / 오카리나·바이올린.
- 새 화성: Eb–Bb/D–Cm–Ab–Eb–F/A–Ab–Bb; Cm–Ab–Eb–Bb–Cm–Ab–F–Bb.

| 기존 곡 | 조성 | 박자 | 빠르기 | 주선율 | 화성 전체 경로 | 다른 항목 수 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| town-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| dusk-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| roco-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| brass-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| factory-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| factory-rest-v2 | 다름 | 같거나 겹침 | 같거나 겹침 | 다름 | 다름 | 3/5 |
| iris-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| press-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| orden | 다름 | 다름 | 같거나 겹침 | 다름 | 다름 | 4/5 |

### 시간지기 틱·톡 — ticktock-v2

- 새 곡: A minor, C/E major colour / 4/4 / 116 BPM(비교용 4분음표) / 플루트·오보에, B1 첼로.
- 새 화성: Am–Dm–E–Am–C–F–Bdim–E; C–Em–Dm–G–C–Am–F–E; E–F#m–G#m–A–C#m–B7–E–E7.

| 기존 곡 | 조성 | 박자 | 빠르기 | 주선율 | 화성 전체 경로 | 다른 항목 수 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| town-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| dusk-v2 | 같거나 겹침 | 같거나 겹침 | 다름 | 다름 | 다름 | 3/5 |
| roco-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| brass-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| factory-v2 | 같거나 겹침 | 같거나 겹침 | 다름 | 다름 | 다름 | 3/5 |
| factory-rest-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| iris-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| press-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| orden | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |

### 종루수호자 벨가드 — belgard-v2

- 새 곡: C# minor → D minor B / 4/4 / 144 BPM(비교용 4분음표) / 호른·트롬본 동시 주선율, 피아노 없음.
- 새 화성: C#m–A–F#m–G#/C#m–B–A–G#; B 반음상행 Dm, 클라이맥스 VI–VII–v–i–iv–bII–V–V.

| 기존 곡 | 조성 | 박자 | 빠르기 | 주선율 | 화성 전체 경로 | 다른 항목 수 |
|---|---|---|---|---|---|---:|
| title-v2 / title-v3 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| town-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| dusk-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| roco-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| brass-v2 | 다름 | 같거나 겹침 | 같거나 겹침 | 다름 | 다름 | 3/5 |
| factory-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| factory-rest-v2 | 다름 | 같거나 겹침 | 다름 | 다름 | 다름 | 4/5 |
| iris-v2 | 다름 | 같거나 겹침 | 같거나 겹침 | 다름 | 다름 | 3/5 |
| press-v2 | 다름 | 같거나 겹침 | 같거나 겹침 | 다름 | 다름 | 3/5 |
| orden | 다름 | 다름 | 다름 | 다름 | 다름 | 5/5 |

## 첫 주선율 4마디 윤곽 직접 비교

남아 있는 악보에서 첫 주선율 4마디의 음 시작을 모으고, 옥타브 더블링·동시음은 위 성부 하나로 묶었다. 음 사이의 상승(U)·하강(D) 순서를 비교했다. 같은 음 반복은 별도로 기록하고 방향 비교에서는 제거했다. 도입부에 주선율이 없는 곡은 첫 주선율 시작부터 네 마디를 사용했다.

직접 비교한 12개 악보: **factory-rest-v2, iris-v2, press-v2, 3장 v1 네 곡, title-v2, town-v2, dusk-v2, roco-v2, brass-v2**. 2장 쉼터는 실제 최종 G 중심·4/4 악보를 사용했고, 로코도 최종 긴 프레이즈 버전을 사용했다. 새 네 곡 각각과 비교한 결과, 방향 순서가 정확히 같은 경우는 0개였다.

| 새 곡 | 첫 네 마디의 U/D 순서 | 직접 비교 | 같은 순서 |
|---|---|---:|---:|
| tower-v2 | `DDDUDDDDUDDUDDDD` | 12 | 0 |
| tower-rest-v2 | `UDDDDUDDUDDD` | 12 | 0 |
| ticktock-v2 | `DDUDDDUDDDDDUUDDUUDDDD` | 12 | 0 |
| belgard-v2 | `UUUDUUUDUUUUDUUDUD` | 12 | 0 |

**정확 비교 미확인:** `title-v3`, 사용자 제공 오디오를 변환한 `factory-v2`, 생성 서비스에서 만든 `orden`은 대응하는 정확한 MIDI·악보가 없어 첫 네 마디 방향을 확정 비교하지 못했다. title-v3를 title-v2와 같다고 가정하지 않았다(디코딩 파형이 완전히 같지 않음). 다른 조건을 맞추기 위해 이 세 곡의 음원을 새 곡에 넣거나 멜로디를 추정해 재사용하지 않았다. 남아 있는 악보의 윤곽 비교는 [melody-contours.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/melody-contours.json>)에 있으며, 단순 방향 순서가 다르다는 사실만으로 청감상 유사성까지 검증한 것은 아니다.

## 반복과 청음 자료

**네 곡 모두 0초부터 파일 끝까지 전체 반복한다. 별도 부분 반복 구간은 필요하지 않다.** OGG의 `LOOPSTART=0`, `LOOPEND=총 샘플 수`, `LOOPLENGTH=총 샘플 수` 태그를 넣었다. 끝점은 포함하지 않는 인덱스다. 실제 반복 재생 동작은 게임 쪽에서 연결한다.

샘플 악기를 세 바퀴 연속 렌더링한 뒤 세 번째 바퀴를 추출하여 직전 반복의 릴리스·잔향이 시작에 이미 겹치도록 했다. EQ·피크 제한도 반복을 연결한 상태에서 처리했다. 페이드인·페이드아웃·끝 무음·종결 화음을 추가하지 않았다. OGG를 다시 디코딩해 총 샘플 수가 악보의 반복 길이와 정확히 같은지 확인했다.

| 곡 | 전체 반복 끝(초) | 반복 샘플 수 | 경계 샘플 차(0–1) | 내부 샘플 변화 99백분위 | 청음 자료 |
|---|---:|---:|---:|---:|---|
| tower-v2 | 101.81805 | 4490176 | 0.0044506 | 0.0576049 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-v2-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-v2-two-loops.wav>) |
| tower-rest-v2 | 116.36390 | 5131648 | 0.0014226 | 0.0514212 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-rest-v2-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-rest-v2-two-loops.wav>) |
| ticktock-v2 | 107.58676 | 4744576 | 0.0006039 | 0.0505102 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/ticktock-v2-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/ticktock-v2-two-loops.wav>) |
| belgard-v2 | 100.00109 | 4410048 | 0.0075789 | 0.0387426 | [이음매 앞뒤 12초](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/belgard-v2-loop-join.mp3>) · [두 바퀴 전체](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/belgard-v2-two-loops.wav>) |

경계 샘플의 진폭 차이는 네 곡 모두 내부 변화의 99백분위보다 작고 시작 무음 샘플은 0이다. 이 수치는 클릭·패딩·샘플 수 이상을 찾는 보조 검사이며, 주관적인 이음매·분위기 판정을 대신하지 않는다. 틱톡의 도입/차분한 B1, 쉼터의 긴 음 등에는 원래 악보의 강약 변화가 남아 있다.

## 도구·샘플·라이선스

- 새 주선율과 응답 선율을 직접 악보로 작성하고 **FluidSynth 2.6.2 + FluidR3 GM 3.1**로 렌더링했다. 과거 곡에서는 렌더링 엔진과 라이선스 자료만 재사용했고, 선율·화성 비교를 위한 읽기 외에는 음악 재료를 가져오지 않았다.
- 순수 파형 오실레이터·신시사이저 리드·칩튠·전자 드럼·보컬·합창 패치를 쓰지 않았다. 피아노·오르골·글로켄슈필·첼레스타·우드블록 GM 115 패치도 새 네 곡에 넣지 않았다. 낮은 클라리넷은 전투곡의 진자 반주만 맡는다.
- 사운드폰트는 **MIT 라이선스**이다. 샘플을 새로 내려받지 않고 앞 작업과 같은 파일을 재사용했다. 출처: [Debian fluid-soundfont](https://deb.debian.org/debian/pool/main/f/fluid-soundfont/). 저작권 자료: [FluidR3-COPYRIGHT.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/FluidR3-COPYRIGHT.txt>).
- 비브라폰 모터 끄기: SF2의 해당 악기 글로벌 구역에 `modLfoToVolume=20`이 있어서, 쉼터 비브라폰 채널에 생성기 오프셋 `13: -20`을 적용했다. 단순히 기본 패치를 모터 꺼짐이라고 가정하지 않았다.
- FFmpeg/libvorbis로 인코딩했다. 36Hz 하이패스와 260Hz 약 -1.4dB 정리, 주기적으로 예열한 피크 제한을 사용했다. MIT 저작권 고지와 전문을 각 OGG의 `LICENSE_TEXT` 태그에 기록했다.

출처 표기 문구:

> Instrument samples: FluidR3 GM 3.1. Copyright 2000–2002, 2008 Frank Wen; 2008 Toby Smithe. Licensed under the MIT License. Original chapter-three v2 compositions created for Beyond the Clockwork.

MIT 고지 전문:

```text
Copyright: 2000-2002, 2008 Frank Wen <getfrank@gmail.com>
2008 Toby Smithe
License: MIT
Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```

### 사용 프리셋

| 곡 | 채널 | Bank/Program(0 기준) | SF2 이름 | 역할 |
|---|---:|---|---|---|
| tower-v2 | 0 | 0/68 | Oboe | Oboe, new falling-chime theme and rising sixth |
| tower-v2 | 1 | 0/12 | Marimba | Marimba, very soft octave-below melody |
| tower-v2 | 2 | 0/41 | Viola | Solo viola, B-section melody |
| tower-v2 | 3 | 0/6 | Harpsichord | Harpsichord, continuous rolling sixteenths |
| tower-v2 | 4 | 0/43 | Contrabass | Bowed contrabass, dotted-quarter pendulum |
| tower-v2 | 5 | 0/71 | Clarinet | Low-register clarinet, bass-clarinet pendulum colour only |
| tower-v2 | 6 | 0/48 | Strings | Soft bowed strings in B only |
| tower-v2 | 7 | 0/11 | Vibraphone | Vibraphone, whole-tone clock-hand sweep every eight bars |
| tower-v2 | 9 | 128/48 | Orchestra Kit | Recorded closed triangle/claves, sparse irregular mechanism clicks |
| tower-rest-v2 | 0 | 0/79 | Ocarina | Ocarina, spacious hopeful lead |
| tower-rest-v2 | 1 | 0/24 | Nylon String Guitar | Fingerpicked nylon acoustic guitar, straight eighths |
| tower-rest-v2 | 2 | 0/40 | Violin | Solo violin, second phrase and C-minor B melody |
| tower-rest-v2 | 3 | 0/41 | Viola | Warm bowed viola pad; no cello countermelody |
| tower-rest-v2 | 4 | 0/11 | Vibraphone | Soft sustained vibraphone, motor off |
| tower-rest-v2 | 5 | 0/108 | Kalimba | Kalimba, a few phrase-end notes |
| tower-rest-v2 | 9 | 128/48 | Orchestra Kit | One dry acoustic clave click every four bars; no percussion groove |
| ticktock-v2 | 0 | 0/73 | Flute | Tick: left solo flute, poised dotted theme |
| ticktock-v2 | 1 | 0/68 | Oboe | Tock: right solo oboe, two-bar responses |
| ticktock-v2 | 2 | 0/6 | Harpsichord | Harpsichord continuo, exact flowing chamber counterpoint |
| ticktock-v2 | 3 | 0/40 | Violin | Quartet violin, crisp staccato and spiccato |
| ticktock-v2 | 4 | 0/41 | Viola | Quartet viola, inner contrapuntal line |
| ticktock-v2 | 5 | 0/42 | Cello | Solo cello cantabile in calm eight-bar B1 |
| ticktock-v2 | 6 | 0/45 | Pizzicato Section | Pizzicato double-bass colour on beats |
| ticktock-v2 | 7 | 0/48 | Strings | Sustained acoustic strings under calm middle |
| ticktock-v2 | 8 | 0/14 | Tubular Bells | Very small metronome bell on bar starts |
| ticktock-v2 | 9 | 128/48 | Orchestra Kit | Dry sampled clave metronome click; short acoustic snare pickups only |
| ticktock-v2 | 10 | 0/60 | French Horns | French horns in quick B2 |
| ticktock-v2 | 11 | 0/47 | Timpani | Quiet timpani, downbeat every two bars |
| belgard-v2 | 0 | 0/60 | French Horns | Horns, rising oath and large falling leap |
| belgard-v2 | 1 | 0/57 | Trombone | Trombones, unison heroic-tragic lead |
| belgard-v2 | 2 | 0/57 | Trombone | Low trombone, hammering 3+3+2 riff |
| belgard-v2 | 3 | 0/58 | Tuba | Tuba, thick low riff |
| belgard-v2 | 4 | 0/42 | Cello | Cellos, relentless eighths with half-step grind |
| belgard-v2 | 5 | 0/43 | Contrabass | Bowed basses, low octave of the riff |
| belgard-v2 | 6 | 0/19 | Church Organ | Acoustic pipe organ underneath active sections |
| belgard-v2 | 7 | 0/44 | Tremolo | High violin tremolo in puppet climax |
| belgard-v2 | 8 | 0/6 | Harpsichord | Cold harpsichord sixteenths in D-minor puppet phase |
| belgard-v2 | 9 | 128/48 | Orchestra Kit | Orchestral bass drum on 3+3+2, section cymbals, pickup snare rolls |
| belgard-v2 | 10 | 0/56 | Trumpet | Acoustic trumpets, sharp answering stabs |
| belgard-v2 | 11 | 0/14 | Tubular Bells | Great deep tubular bell on every two bars, each climax bar |
| belgard-v2 | 12 | 0/14 | Tubular Bells | Upper octave resonance of great bell |
| belgard-v2 | 13 | 0/47 | Timpani | Timpani locks into all three riff accents |

## 재제작·미달·미확인

- tower-v2: 1회 렌더링. 지정 편성·박자·길이·음량 및 직접 비교 가능한 악보 윤곽 검사 통과.
- tower-rest-v2: 2회 렌더링. 첫 후보의 기본 비브라폰에 모터 LFO가 있음을 샘플 메타데이터에서 발견해, 이를 끄고 다시 렌더링했다. 첫 후보는 [검수 폴더](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-rest-v2-attempt1>)에 보존했다. 길이는 사용자 선택에 따라 116.4초이다.
- ticktock-v2: 1회 렌더링. 차분한 첼로 B1 8마디와 빠른 B2를 구분한 새 실내악 곡으로 작성했다.
- belgard-v2: 1회 렌더링. 1초 RMS 최대·최소 차이 11.30dB, 이동창 재검사 11.73dB로 긴장 유지 조건을 통과했다.

**3회 안에 수치 기준을 못 맞춘 곡: 없음.** 사용자 승인한 쉼터 길이 예외를 포함해 수치 검사는 통과했다. **직접 청음에 의한 분위기·선율 인지성·악기 음색·반복 청감은 네 곡 모두 미확인**, 정확한 악보가 없는 세 기존 곡과의 첫 선율 비교도 미확인이다. 임의 재생성을 반복해 이 미확인을 통과로 바꾸지는 않았다.

## 원문·검수·기존 파일 보존

| 곡 | 원문 프롬프트 | 새 악보·편성 | 수치 검사 |
|---|---|---|---|
| tower-v2 | [tower-v2.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-v2.prompt.txt>) | [tower-v2-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-v2-score.json>) | [tower-v2-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-v2-verification.json>) |
| tower-rest-v2 | [tower-rest-v2.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-rest-v2.prompt.txt>) | [tower-rest-v2-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-rest-v2-score.json>) | [tower-rest-v2-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/tower-rest-v2-verification.json>) |
| ticktock-v2 | [ticktock-v2.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/ticktock-v2.prompt.txt>) | [ticktock-v2-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/ticktock-v2-score.json>) | [ticktock-v2-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/ticktock-v2-verification.json>) |
| belgard-v2 | [belgard-v2.prompt.txt](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/belgard-v2.prompt.txt>) | [belgard-v2-score.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/belgard-v2-score.json>) | [belgard-v2-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/belgard-v2-verification.json>) |

- 비교표 데이터: [feature-comparisons.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/feature-comparisons.json>); 실제 SF2 프리셋·샘플 정보: [sample-presets.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/sample-presets.json>).
- 최종 보존·형식 검사: [final-verification.json](<C:/Users/ans45/.codex/visualizations/2026/11/06/01a1b245-dc04-7d21-8fc4-761dfc220d6c/ch3-bgm-v2-20261118/final-verification.json>).
- 작업 시작 전 기록한 기존 음악·문서·코드·데이터 **180개 모두 SHA-256 동일**. v1 네 곡, 기존 v1 보고서, 게임 코드와 CREDITS를 수정하지 않았다.
- 저장소에는 v2 OGG 네 개와 이 보고서만 추가했다. 중간 작업은 별도 검수 폴더에 보존했다. 커밋·푸시·게임 연결 없음.
