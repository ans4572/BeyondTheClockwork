# 무료 음악·효과음 출처 조사

티켓: `tickets/03-audio-sources.md` / 후속 결정: `tickets/04-audio-choice.md`
확인일: 2026-11-02. 법률 자문이 아니며, 약관은 내려받는 시점에 다시 확인해야 한다.

## 결론

- **효과음은 Kenney(CC0)를 기본으로 하고, 빈 곳은 ZzFX 또는 jsfxr로 직접 만든다.**
- **배경음악은 CC0 팩 두 개를 들어 보고 고른다.** Abstraction Music Loop Bundle, Ninja Adventure Asset Pack이다.
- **Pixabay는 쓰지 않는다.** 게임에 넣는 것은 허용되지만, 원본 파일을 공개 저장소에 두면 금지된 "단독 배포"에 해당할 수 있다.
- **Sonniss GDC 번들은 공개 저장소에 넣을 수 없다.** 약관이 원본 재배포를 명시적으로 금지한다.
- **CC-BY-SA, CC-BY-NC, Sampling+, GPL 음원은 피한다.**
- 이 저장소는 실제로 공개 상태다. 인증 없이 호출한 `api.github.com/repos/ans4572/BeyondTheClockwork`가 200을 돌려주었다. 따라서 아래의 "공개 저장소" 조건이 그대로 적용된다.

분위기 적합도는 페이지의 태그와 설명만으로 판단했다. **어떤 곡도 직접 들어 보지 않았다.** 실제 청취는 티켓 04에서 해야 한다.

## 비교표

| 출처 | 라이선스 | 출처 표기 | 공개 저장소에 원본 파일 | 장난감 마을·칩튠 적합도 | 라이선스 페이지 |
|---|---|---|---|---|---|
| Kenney | CC0 | 불필요. 표기한다면 "Kenney" (로고 사용 금지) | **허용** (CC0로 판단. 팩 안의 License.txt는 미확인) | 효과음 좋음. 음악은 짧은 징글뿐이고 긴 배경음악 없음 | https://kenney.nl/support |
| Abstraction Music Loop Bundle | CC0 | 불필요. 표기한다면 "Abstraction" | **허용으로 판단**. 단, 아래 비구속 문구 참고 | 태그상 좋음: chiptune, upbeat, loops, seamless | https://tallbeard.itch.io/music-loop-bundle |
| Ninja Adventure Asset Pack | CC0 | 불필요하나 권장 | **허용** | 들어 봐야 앎. 음악 37곡, 효과음 100개 이상 | https://pixel-boy.itch.io/ninja-adventure-asset-pack |
| ZzFX (코드로 소리 생성) | MIT (라이브러리) | MIT 고지 유지 | **허용**. 음원 파일 자체가 없음 | 복고풍 효과음에 적합 | https://github.com/KilledByAPixel/ZzFX |
| jsfxr | UNLICENSE (도구) | 불필요로 판단 | **허용으로 판단**. 생성음 권리 문구는 없음 | 복고풍 효과음에 적합 | https://sfxr.me/ |
| BeepBox (직접 작곡) | 코드 MIT, 곡은 작곡자 소유 | 불필요로 판단 | **허용** (내 곡이므로) | 작곡 역량에 달림 | https://www.beepbox.co/ |
| Eric Skiff, Resistor Anthems | CC BY 4.0 | **필수** | **허용** | 8비트, 멜로디 중심 | https://ericskiff.com/music/ |
| Freesound | 소리마다 다름: CC0, CC BY, CC BY-NC, Sampling+ | CC0 불필요, CC BY 필수 | CC0·CC BY **허용**, CC BY-NC·Sampling+ **제외** | 품질 편차 큼. CC0 "chiptune" 검색 결과 651개 | https://freesound.org/help/faq/ |
| OpenGameArt | 자산마다 다름: CC0, CC-BY, CC-BY-SA, OGA-BY, GPL 등 | 자산별 | CC0·CC-BY·OGA-BY **허용**. SA·GPL 비권장. **사이트 직접 확인 불가** | 칩튠 자산 많음 | https://opengameart.org/content/faq |
| Incompetech (Kevin MacLeod) | CC BY 4.0 | **필수** | **허용** (라이선스 근거, 사이트 전용 규칙 없음) | 미확인. 칩튠 전문 출처는 아님 | https://incompetech.com/music/royalty-free/faq.html |
| Soundimage (Eric Matyas) | CC BY 4.0 + 제한 1개인 자체 조건 | **필수, 게임 안에** | **불명** | 미확인 | https://soundimage.org/attribution-info/ |
| Ozzed | CC BY-SA 3.0으로 보임 | **필수** | 허용되나 **비권장** (SA) | 칩튠 | https://ozzed.net/ |
| Pixabay | Pixabay Content License | 불필요 | **비권장: 금지에 해당할 수 있음** | 미확인 | https://pixabay.com/service/terms/ |
| Sonniss GDC Bundle | 자체 라이선스 v2.0 | 불필요 | **금지** | 해당 없음 | https://sonniss.com/gdc-bundle-license/ |

## 출처별 근거

### Kenney

- 지원 페이지: "all game assets on the asset pages are public domain licensed (CC0)", "You're free to use them, even in commercial projects", "Attribution is not required". 표기는 "Kenney"로 하되 "Do not use our logo".
- [Music Jingles](https://kenney.nl/assets/music-jingles) 페이지에 CC0와 85개 파일이 표시된다. [RPG Audio](https://kenney.nl/assets/rpg-audio)도 CC0, 50개 파일이며 태그는 foley, footstep, weapon이다.
- [오디오 분류](https://kenney.nl/assets/category:Audio)에는 Casino Audio, Sci-fi Sounds, Interface Sounds, Impact Sounds, Voiceover Pack 2종, Music Jingles, RPG Audio, Digital Audio, UI Audio가 있다. 이름과 파일 수로 볼 때 음악 쪽은 Music Jingles뿐이다.
- 지원 페이지는 재배포를 직접 다루지 않고 동봉 라이선스 파일을 가리킨다. 다만 [CC0 법률문](https://creativecommons.org/publicdomain/zero/1.0/legalcode)은 저작권과 관련 권리를 전면 포기하므로 재배포도 막지 않는다.

**확인하지 못한 것**
- 팩 안의 `License.txt`는 열지 못했다. 다운로드 링크가 페이지 내부 앵커여서 자동으로 받을 수 없었다. 내려받을 때 한 번 확인한다.
- 징글의 음색 구성은 페이지에 없다. 포럼 댓글에 `jingles_NES00`이라는 파일명이 나올 뿐이다.

### Abstraction Music Loop Bundle

- 페이지 문구: "has waived all copyright and related or neighboring rights to the music", 곡 수는 "Over 200 songs". 표기는 "It's not required".
- **주의할 문구.** 제작자는 NFT, AI·머신러닝, "direct resale of unmodified assets"에 쓰이는 것을 "do not endorse"한다고 밝힌다. 또한 수익이 나는 게임 제작자에게 소액 후원을 권한다.
- 금지가 아니라 지지하지 않는다는 표현이고, 별도의 재배포 조항은 페이지에 없다. 게임 저장소는 재판매가 아니므로 CC0 범위 안으로 판단했다. 이 판단은 내 해석이다.

### Ninja Adventure Asset Pack

- "They are released under the Creative Commons Zero (CC0) license", "Attribution is not required but appreciated".
- 음악 37곡, 효과음 100개 이상. 곡 스타일 설명은 페이지에 없다. 제작자 댓글에 FL Studio와 특정 사운드폰트로 만들었다는 언급이 있다.

### Freesound

- [FAQ](https://freesound.org/help/faq/): 업로더가 세 가지 라이선스 중 고른다. CC0는 "you can do pretty much what you want with the sound", CC BY는 항상 원작자를 밝혀야 한다. Noncommercial은 "you can't earn any money", 구형 Sampling+는 상업 광고까지 금지된다.
- [이용약관](https://freesound.org/help/tos_web/) (2022-04-04 시행): 각 소리는 "Creative Commons license indicated for each item"으로 배포된다. 재배포를 별도로 금지하는 문구는 없다.
- CC BY 소리를 편집한 경우 원작자 표기가 계속 필요하다. FAQ의 호환표상 CC BY를 CC0로 바꿀 수도 없다.
- 긴 목록은 전체 크레딧 페이지를 링크하는 방식이 허용된다.

**불명확한 점**
- 약관에 "you may not use the Freesound website portal for commercial purposes"가 있고 상업적 목적의 정의는 없다. 문맥상 소리의 라이선스가 아니라 사이트 이용을 말하는 것으로 읽었지만, 이는 내 해석이다. 상업 판매가 가까워지면 다시 봐야 한다.
- 소리마다 CC 버전이 다를 수 있다. 각 소리 페이지에서 확인해야 한다.

### OpenGameArt

**[FAQ](https://opengameart.org/content/faq)와 자산 페이지는 직접 읽지 못했다.** 사이트가 자동 접근에 403을 돌려주었다. 직접 읽은 것은 OGA-BY 3.0 전문뿐이다. 아래 FAQ 내용은 검색 결과 요약을 거친 2차 정보이므로, 사람이 브라우저로 확인해야 한다.

- 직접 확인: [OGA-BY 3.0 전문](https://static.opengameart.org/OGA-BY-3.0.txt)에는 기술적 조치(DRM) 조항이 없다. 원작자, 제목, 지정 URI 표기와 라이선스 사본 또는 URI 동봉을 요구한다.
- 직접 확인: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/legalcode) 4(a)는 받는 사람의 권리를 제한하는 기술적 조치를 금지한다.
- 검색 요약: FAQ는 모든 자산을 상업 프로젝트에 쓸 수 있다고 하고, 조건은 라이선스마다 다르다고 한다. CC0도 링크를 남기면 고맙다는 요청이 있으나 의무는 아니다.
- 검색 요약: 표기 형식은 각 자산 페이지의 "Copyright/Attribution Notice"를 따른다. 자산마다 여러 라이선스가 함께 걸려 있을 수 있으므로 하나를 골라 기록한다.
- 후보: Juhani Junkala의 "5 Chiptunes (Action)"(반복 재생 5곡, 49.6MB)과 "512 sound effects 8 bit style". 태그와 동봉 안내문 사본 기준 CC0로 보이나 라이선스 필드는 직접 못 봤다.
- 512 효과음은 업로더가 SubspaceAudio로, 동봉 안내문의 저자는 Juhani Junkala로 나온다. 같은 자료로 보이지만 확정하지 못했다.

### Eric Skiff, Resistor Anthems

- "All songs are released under the Creative Commons Attribution 4.0 (CC-BY) license".
- 표기 형식: `Music: Eric Skiff - Song Name - Resistor Anthems - Available at http://EricSkiff.com/music`

### Incompetech

- "Licensed under Creative Commons: By Attribution 4.0". 표기 예: `Title Kevin MacLeod (incompetech.com)`
- 사이트에 원본 재배포 규칙은 없다. CC BY 4.0의 허락 범위로 판단했다.
- 곡을 편집했다면 어느 부분이 자기 작업인지 크레딧에 밝히라고 한다.
- 표기 없는 유료 라이선스도 있으나 [해당 페이지](https://incompetech.com/music/royalty-free/licenses/)에 가격은 없다.

### Soundimage

- 게임 안에 표기해야 한다. "Crediting me on the info page ... is not sufficient". 음악 표기: `Music by Eric Matyas` / `www.soundimage.org`, 효과음은 크레딧의 "Sound effects" 항목에 표기.
- [FAQ](https://soundimage.org/faqs/): "exactly the same as CC by Attribution 4.0 with one restriction". 제한은 음란물 사용 금지다.
- 원본 재배포나 저장소에 관한 문구는 두 페이지 모두에 없다. 제한이 붙은 자체 조건이라 CC BY 4.0을 그대로 적용하기 어려우므로 **불명**으로 둔다.

### Ozzed

- 페이지 문구는 "licensed under Creative Commons"이고, 배지는 CC BY-SA 3.0을 가리킨다. 버전이 본문에 명시되지 않아 곡별 표기를 확인해야 한다.
- 게임 사용은 작곡자 표기 조건으로 허용한다. 위탁 제작 앨범은 예외다.

### Pixabay

[약관](https://pixabay.com/service/terms/) 최종 수정일은 2026-10-20이다.

- 허용: 상업·비상업 목적의 사용, 복사, 수정. [FAQ](https://pixabay.com/service/faq/)는 "Attribution or revenue sharing isn't required"라고 한다.
- 금지: "You cannot sell or distribute the Content ... on a Standalone basis".
- Standalone의 정의: "using the Content in its original form or solely using a filter, changing colors, resizing or cropping". 다른 매체와 결합해도 "the combined effect is to make a "new" creative work"일 때만 Standalone이 아니다.
- FAQ는 "Incorporation into a greater work (e.g. adding it to a book, app, game)"을 예로 든다. 다만 이 답변은 사진을 맥락으로 한다. 음악 항목은 영상·팟캐스트 사용 조건으로 "the music is not offered on its own"을 든다.
- 약관에도 FAQ에도 저장소, GitHub, 오픈소스, 게임 내 파일 추출에 관한 문구는 없다.

**판단.** 게임 안에서 재생하는 것은 허용으로 읽힌다. 그러나 공개 저장소의 MP3는 원본 그대로, 게임 없이 파일 하나만 내려받을 수 있다. 이는 Standalone 정의에 걸릴 수 있으므로 금지로 간주한다. 허용 여부는 **확인되지 않았고**, 안전하다고 말할 수 없다.

- 추가로 곡에 방패 아이콘이 있으면 YouTube Content ID에 등록된 곡이다. 데모 영상을 올릴 때 클레임이 걸릴 수 있다.
- 2019-01-09 이전에 게시된 콘텐츠는 CC0라는 규정이 있다. 오디오에 적용되는 경우가 있는지는 확인하지 못했다.

### Sonniss GDC Bundle

[라이선스](https://sonniss.com/gdc-bundle-license/) v2.0, 2026-08-27 시행.

- "may not distribute, publish, sub-license or otherwise supply the sound effects as sound effects to any other person". 라이브러리나 샘플 팩에 포함해 제공하는 것도 금지이고, "project template, software development kit or anything similar"도 같은 제한의 대상이다.
- 가공한 소리도 라이선스 대상으로 남는다.
- 완성된 프로젝트는 공유·판매할 수 있으므로 비공개 저장소라면 쓸 수 있다. 이 프로젝트에는 맞지 않는다.

### 직접 생성 도구

- **ZzFX:** "MIT licensed, use it anywhere!", 압축 시 1KB 미만, "No sound asset files". 소리가 코드의 숫자 배열이라 저장소 문제가 사라진다.
- **jsfxr:** UNLICENSE. 페이지에 "Unrestricted commercial use"가 있으나 생성음의 소유권 문구는 없다. 직접 만든 소리이므로 문제될 가능성은 낮다고 판단한다.
- **BeepBox:** "BeepBox does not claim ownership over songs created with it, so original songs belong to their authors". 상업 이용에 대한 별도 문구는 없다. 소유권이 작곡자에게 있으므로 상업 이용이 가능하다고 판단한다.

### 확인하지 못한 후보

Patrick de Arteaga(404)와 Zapsplat(403)은 약관 페이지를 읽지 못해 평가에서 뺐다.

## 라이선스 쟁점

**CC BY의 표기 의무.** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode)의 "Share"는 공중이 원하는 때에 접근하도록 제공하는 것까지 포함한다. 그래서 공개 저장소와 공개 데모 모두 표기 의무가 생긴다. 3(a)(2)에 따라 표기는 매체에 맞는 합리적 방식이면 되고, 정보를 담은 페이지의 링크도 예시로 인정된다. 수정했다면 수정 사실을 밝힌다.

**CC-BY-SA를 피하는 이유.** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode)은 음악을 영상에 "synched in timed relation with a moving image"하면 항상 2차 저작물로 본다. [CC FAQ](https://creativecommons.org/faq/)도 같다. 게임 화면이 여기에 해당하는지는 **CC 문서에 답이 없다.** 해당한다면 게임의 내 기여분에도 BY-SA 호환 라이선스를 적용해야 할 수 있다. 데모 한 곡을 위해 질 위험이 아니다.

**DRM 조항.** CC BY 4.0 2(a)(5)(B)는 받는 사람의 권리를 제한하는 기술적 조치를 금지한다. 브라우저 데모와 공개 저장소에는 문제가 없다. Steam 등 출시를 검토할 때는 다시 봐야 한다. 플랫폼 출시는 현재 범위 밖이다.

**CC0의 한계.** CC0 4(c)는 타인의 권리 처리를 책임지지 않는다고 밝힌다. 업로더가 남의 소리를 올렸다면 CC0 표시로 해결되지 않는다. 그래서 개인 업로드 사이트보다 Kenney처럼 제작자가 직접 배포하는 출처가 더 안전하다.

**브라우저 게임의 특성.** 공개 데모는 음원을 URL로 내보내므로, 저장소를 비공개로 바꿔도 파일은 받을 수 있다. 재배포가 제한된 음원은 저장소만의 문제가 아니다. 허용된 출처만 쓰는 것이 가장 단순하다.

## 추천 순위

1. **Kenney:** 효과음과 징글. 제작자 직접 배포, CC0, 표기 불필요. 조건상 가장 깨끗하다.
2. **Abstraction Music Loop Bundle:** 배경음악 1순위 후보. CC0이고 칩튠 태그가 있으며 200곡 이상이다. 소액 후원 요청과 비구속 문구는 사용자가 알고 있어야 한다.
3. **Ninja Adventure Asset Pack:** 배경음악 2순위 후보. CC0, 음악 37곡에 효과음도 함께 있다. 곡 분위기는 들어 봐야 안다.
4. **ZzFX 또는 jsfxr:** 태엽, 클릭, 스파크처럼 Kenney에 맞는 소리가 없을 때 직접 만든다. 라이선스 부담이 가장 적고, 파일이 필요 없는 ZzFX는 용량에도 유리하다.
5. **Eric Skiff, Resistor Anthems:** CC0 후보가 마음에 들지 않을 때의 대안. 표기 한 줄이면 된다.
6. **Freesound의 CC0, OpenGameArt의 CC0·OGA-BY:** 개별 공백을 메우는 용도. 자산마다 라이선스를 확인한다. OpenGameArt는 브라우저로 페이지를 직접 확인한 뒤 쓴다.
7. **BeepBox 직접 작곡:** 원하는 분위기를 찾지 못했을 때. 작곡 시간이 든다.
8. **Incompetech:** 합법적이지만 칩튠 적합도가 확인되지 않아 우선순위가 낮다.

**쓰지 않음:** Pixabay, Sonniss, Soundimage(재배포 불명), Ozzed와 모든 CC-BY-SA, CC-BY-NC, Sampling+, GPL 음원.

## 티켓 04를 위한 메모

- 파일마다 출처 URL, 저자, 라이선스, 내려받은 날짜를 기록한다. CC0도 기록한다. 나중에 출처를 증명하거나 문제 파일을 교체할 때 필요하다.
- CC BY 음원을 쓴다면 게임 크레딧 화면과 저장소의 크레딧 파일 양쪽에 같은 표기를 둔다.
- 저장소 최상위에서 LICENSE 파일을 찾지 못했다. 나중에 코드 라이선스를 추가한다면 제3자 음원은 그 적용 범위에서 제외해야 한다.
- 처음 쓰는 CC0 팩은 다운로드 안의 라이선스 파일을 확인한다.

## 조사 방법과 한계

- 라이선스 페이지는 각 출처의 공식 페이지에서 2026-11-02에 읽었다. 인용은 웹 도구가 짧게 추출한 발췌이며, 약관 전문을 사람이 한 줄씩 대조한 것은 아니다.
- 페이지 접근 실패: OpenGameArt(FAQ, 자산 페이지 403), Zapsplat(403), Patrick de Arteaga(404).
- Pixabay, Freesound, Soundimage 등의 "언급 없음"은 읽은 페이지 기준이다. 해당 사이트의 다른 페이지까지 모두 뒤진 것은 아니다.
