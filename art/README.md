# 아트 에셋

- [애니메이션 모음](animations/index.html): 주인공 움직임·스킬, NPC, 몹
- [애니메이션 폴더 안내](animations/README.md)
- 장별 그림 `chapters/`: 장 번호-이름 폴더 안에 `maps/`(정거장 번호-방 이름 폴더)와 `hazards/`(방 장치)
  - [1장 웃음거리 맵](chapters/1-smile-street/maps/README.md)
  - [2장 무음공장](chapters/2-silent-factory/README.md)
- [선택된 융합 스킬 시안](player-f2/fusion-concepts/index.html)
- 속성 아이콘 `ui/element-icons/`: PixelLab pixflux 32px(화면에는 2배), 속성 장치(과열 코일, 냉각 분사기, 축전지, 압축 송풍기)
- [정리 내역](../docs/art-cleanup-report.json)

예전 맵 시안(`chapters/1-smile-street/map-concepts`)과 몹·보스 시안(`mob-concepts`, `chapters/1-smile-street/*-concepts`)은 2026-11-05에 정리했습니다. 게임에 쓰는 맵은 `chapters/1-smile-street/maps`에 A·B 두 장씩(B는 `-b` 폴더) 있습니다. 애니메이션은 검토용 아트이며 게임 연동 여부는 각 manifest의 appliedToGame 값을 따르며, 게임이 실제로 읽는 주인공 클립은 [game-clips.json](animations/player/game-clips.json)입니다.
