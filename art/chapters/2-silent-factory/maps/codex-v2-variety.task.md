# 2장 맵 다시 그리기 — 방마다 다르게 (2026-11-07)

1차 12장은 스타일과 크기는 맞았다. 다만 로봇 얼굴이 너무 많고, 12장이 거의 같은 방처럼 보였다.
원인은 다섯 가지였다.
1. 공통 FACTORY LOOK 블록에 '인형 머리 선반, 스마일 도장, 민트·노랑·분홍 기계'가 들어 있었다.
2. 아래쪽 띠에 같은 유리통 프레스와 배관이 반복됐다.
3. 위쪽 벽에 같은 기계 세 대가 나란히 섰다.
4. 바닥이 모두 같은 파란 회색 철판이었다.
5. 빛이 대부분 차가운 낮빛이었다.

이 문서가 1차 프롬프트의 FACTORY LOOK, LIGHT, LAYOUT 줄을 대신한다. 아래는 1차 프롬프트에서 **그대로 둔다**.
- 첫 문단(Use case, 게임 소개)
- 입력 그림 1·2 설명과 CRITICAL SCALE
- "Draw every object at N%" 줄
- 출력 크기
- SIZE AND SHAPE의 비율
- EXITS
- Combat readability
- 금지 목록

## Codex 작업 방법

- 방마다 `background.prompt.txt`의 1차 프롬프트에서 FACTORY LOOK, LIGHT, LAYOUT 세 줄을 지운다.
- 그 자리에 아래 **공통 블록**과 그 방의 **방 블록**을 넣는다.
- SIZE AND SHAPE 줄에서 "a soft rounded rectangle", "large calm factory floor plates", "including foreground machinery along the bottom"은 지운다. 바닥 모양, 재질, 아래쪽 띠는 방 블록을 따른다.
- 입력 그림은 1장 방(입력 1)과 월드맵(입력 2)만 쓴다. **다른 2장 방 그림은 입력으로 넣지 않는다.** 넣으면 같은 기계 띠가 복사된다.
- 저장은 새 이름으로 한다. 01은 `background-v3-raw.png`, `background-v3.png`, `background-v3.prompt.txt`이고, 나머지는 같은 규칙의 `-v2`다. 기존 파일은 지우지 않는다.
- 한 방을 끝낼 때마다 지금까지 만든 방들과 나란히 놓고 본다. 바닥 색이나 구도가 앞 방과 겹치면 다시 만든다.

## 공통 블록 (모든 방에 넣는다)

```
FACTORY BASE (shared by every room, keep it subtle): riveted brass trim, painted steel, round toy-like machine shapes with chunky bolts, clean dark outlines. That is the ONLY shared kit. Everything else — floor material, floor colour, wall composition, foreground, light and palette — comes from ROOM IDENTITY below and must be clearly different from the other factory rooms.
VARIETY RULES (strict):
- NO doll heads, NO toy faces, NO robot faces, NO eyes on shelves, racks, machines or crates. Shelves hold parts, boxes, tools or materials instead. (Only the erasing line room may show dolls, and only faceless.)
- At most ONE small smile pictogram in the whole picture (stamping line excepted). No smile faces on crates, banners or machines.
- At most ONE wind-up key on top of a machine in the whole picture.
- No row of three matching machines in mint / butter yellow / powder pink. Use the room's own palette only.
- No glass-cylinder press with pipes along the bottom edge. The bottom edge uses the room's own FOREGROUND.
- The floor is the room's own material and colour, not blue-grey steel plates (unless the room says so).
- The back wall is not always symmetrical; follow the room's WALL description.
```

## 방 블록

진행할수록 공장 안쪽으로 들어간다. 정문은 밝고 깨끗하고, 깊이 들어갈수록 어둡고 무거워지며, 마지막 방은 웅장하다.

### 01 정문 검수대 (밝은 아침, 첫인상)
```
ROOM IDENTITY — Gate inspection hall.
FLOOR: polished cream and pale mint checkerboard tiles with thin brass inlay lines, a painted butter-yellow queue line running along the floor edge only. Floor shape: wide trapezoid widening toward the bottom.
WALL: asymmetrical. The huge brass factory gate arch fills the LEFT wall (open, morning sky and the pink town beyond). Along the TOP wall, a single long glass-fronted ticket-and-inspection counter with turnstiles and a big round wall clock (no numerals). Notice boards with pictograms only.
FOREGROUND (bottom edge): low brass queue posts with red velvet ropes, a row of folded luggage trolleys, a few potted plants. Low and light, no big machines.
LIGHT: bright warm morning sun pouring in from the open gate on the left, long soft light shafts.
PALETTE: cream, pale mint, brass gold, a touch of red velvet.
```

### 02 포장 벨트 (따뜻한 종이와 리본)
```
ROOM IDENTITY — Packing hall.
FLOOR: warm honey-coloured birch wood floorboards running lengthwise, a thin painted border. Floor shape: long straight-sided hall.
WALL: overhead conveyor rails along the TOP wall carry wrapped gift boxes hanging from hooks; giant rolls of kraft paper and red ribbon spools on wall racks; tall stacks of flat cardboard.
FOREGROUND (bottom edge): a low wall of stacked kraft-paper parcels tied with string, a few ribbon carts. No machinery.
LIGHT: warm afternoon daylight in bands from a row of long skylights.
PALETTE: kraft brown, cream paper, cherry red ribbon, honey wood. Very little blue.
```

### 03 부품 창고 (좁고 어두운 선반 골목)
```
ROOM IDENTITY — Parts warehouse.
FLOOR: dark olive-green painted concrete, worn smooth, with yellow-and-black hatched lanes only at the outer floor edge. Floor shape: square room with two notches where shelf bays push in at the top.
WALL: very tall steel shelving with colour-sorted bins of springs, gears, screws, wind-up keys and coils — parts only, no heads or faces. Rolling ladders, a small forklift parked against a shelf, hanging bin labels with pictograms.
FOREGROUND (bottom edge): the tops of a low shelf row and open parts bins seen from above.
LIGHT: dim; narrow cones from hanging green-shaded lamps between shelves, dark gaps between pools of light.
PALETTE: olive, khaki, dull brass, dark green.
```

### 04 도장 라인 (스마일을 찍는 곳 — 스마일 허용)
```
ROOM IDENTITY — Stamping line. This is the ONE room where smile stamps are the theme.
FLOOR: dark slate-grey rubber tiles with faint old ink rings (flat, calm). Floor shape: wide rectangle with clipped corners.
WALL: tall vertical drop-stamp presses (narrow towers, not round domes) along the TOP wall, each lowering a big smile stamp onto paper; large ink tanks and ink rollers; giant sheets of freshly stamped paper hanging to dry on lines. Smile stamps appear on the stamp heads and the drying sheets only.
FOREGROUND (bottom edge): stacks of blank paper sheets and ink drums.
LIGHT: flat white fluorescent strip lights, slightly harsh.
PALETTE: ink indigo, stamp red, paper white, black rubber.
```

### 05 검수실 (중간 보스 아이리스 — 차갑고 하얀 무대)
```
ROOM IDENTITY — Inspector's room, boss arena.
FLOOR: polished white and silver tiles with faint concentric measuring rings engraved around the centre (thin, low contrast). Floor shape: almost perfect circle.
WALL: one HUGE round inspection lens dominating the TOP wall like a stage backdrop; tall mirror panels and measuring rulers around the curved wall; a raised inspector's desk under the lens. The lens is the only eye-like shape.
FOREGROUND (bottom edge): a low curved white railing with brass caps, a few measuring instruments on stands.
LIGHT: cold clinical bright white from the lens above, cool reflections on the floor, the outer wall darker.
PALETTE: white, silver, pale ice blue, one brass ring on the lens.
```

### 06 불량품 보관창고 (쉼터 — 유일하게 따뜻한 곳)
```
ROOM IDENTITY — Hidden reject storeroom, peaceful rest stop. Keep the cosy mood of version 1.
FLOOR: old wooden planks of mismatched colours with patched rugs (rugs flat on the floor, edges calm). Floor shape: a winding path widening into a small open square.
WALL: makeshift stalls built from crates, blankets and old packing boxes; mismatched chairs, a tea kettle, mended tools; string lights. NO shelves of doll heads — replace them with jars, books, spare blankets and repaired odds and ends.
FOREGROUND (bottom edge): a sofa back made of cushions and a low crate table.
LIGHT: warm lanterns and string lights in a dim room.
PALETTE: honey, patchwork red, faded blue, warm brown.
```

### 07 압축 창고 (무거운 쇠와 녹)
```
ROOM IDENTITY — Compression store, two storeys tall.
FLOOR: diamond-pattern steel tread plate, warm grey with faint rust at the edges, hazard chevron stripes only along the walls. Floor shape: tall rectangle.
WALL: towering stacks of compressed cubes (crushed cardboard, flattened tin toys, squashed springs) strapped with bands; huge hydraulic pistons; a steel gantry walkway high on the TOP wall; a freight lift cage in the upper-left corner.
FOREGROUND (bottom edge): a row of strapped compressed bales and a yellow hydraulic pump.
LIGHT: dim, rotating orange warning lamps, deep shadows high up.
PALETTE: rust brown, ochre, gunmetal, hazard yellow.
```

### 08 소거 라인 (색이 빠지는 방 — 인형은 여기만, 얼굴 없이)
```
ROOM IDENTITY — Erasing line, the saddest room. Colour drains out here.
FLOOR: soft pale grey felt-like flooring, very smooth and quiet. Floor shape: long hall narrowing slightly toward the right.
WALL: along the TOP wall a slow line of plain wooden toy mannequins with completely blank, featureless heads (NO faces, NO smiles, NO eyes) waiting on hooks; soft white felt roller machines above them; chalk-dust haze drifting near the walls only. Left side of the room keeps a little colour, the right side is almost fully grey.
FOREGROUND (bottom edge): rows of empty small chairs and folded grey cloths.
LIGHT: soft, flat, overcast-white light, no strong shadows.
PALETTE: near-monochrome grey, lilac grey, chalk white; only faint pastel on the far left.
```

### 09 크레인 적재장 (반쯤 열린 지붕, 저녁 하늘)
```
ROOM IDENTITY — Crane yard under a half-open roof.
FLOOR: weathered dark asphalt-grey concrete with flush steel rail tracks set into the floor edges only, faded painted loading-zone borders. Floor shape: big open rectangle, the top edge stepped.
WALL: the roof is partly open — a dusk sky (orange to violet) visible across the top; two big yellow gantry cranes with hooks and hanging crates ABOVE the walls only; stacked shipping crates and pallets; a loading dock edge on the right.
FOREGROUND (bottom edge): the top of a low concrete dock wall with bollards and coiled ropes.
LIGHT: dusk light from the open roof, long shadows, orange lamps on the cranes.
PALETTE: dusk violet, sunset orange, crane yellow, concrete grey.
```

### 10 증기 보일러실 (붉은 벽돌과 열기)
```
ROOM IDENTITY — Steam boiler room.
FLOOR: dark cast-iron grate floor tiles over a faint warm glow (flat, calm, medium-dark value so characters still read). Floor shape: small rounded room.
WALL: red brick walls; big copper and black-iron boilers with round pressure gauges (pictogram dials, no numbers) and glowing fire doors; thick copper pipes and valve wheels; coal bins. Steam only at the walls.
FOREGROUND (bottom edge): a copper pipe run with valve wheels and a coal shovel rack.
LIGHT: dark room lit by orange-red firelight from the boiler doors.
PALETTE: brick red, copper, black iron, ember orange.
```

### 11 신호선 배전실 (밤의 도시 같은 패널)
```
ROOM IDENTITY — Signal switchroom.
FLOOR: dark navy polished steel with thin glowing cyan seams at the floor border only. Floor shape: rounded rectangle, slightly wider at the top.
WALL: floor-to-ceiling switchboard panels covered in hundreds of tiny amber and cyan indicator lamps like a city at night; relay cabinets; thick glowing cyan signal cables gathering from every wall and running up the TOP-RIGHT wall through a round window that shows the distant clock tower at night.
FOREGROUND (bottom edge): the top of a long operator console with levers and patch cables.
LIGHT: dark room lit by cyan cable glow and amber indicator lamps.
PALETTE: deep navy, signal cyan, small amber dots.
```

### 12 정형실 (최종 보스 프레스 — 웅장한 대성당)
```
ROOM IDENTITY — Forming hall, final boss arena. Cathedral scale.
FLOOR: polished black metal with gold inlay, one huge engraved circular mould seal centred on the floor (shallow, low contrast). Floor shape: wide arena with a straight top edge in front of the press.
WALL: a GIANT press machine with two jointed mechanical arms built into the TOP wall like a throne; tall gothic-arched steel columns; a row of empty body moulds (hollow shells, no faces) in wall niches; conveyor channels feeding the press inside the wall.
FOREGROUND (bottom edge): the tops of two massive gold-capped columns at the bottom corners, the space between them open.
LIGHT: dramatic dark hall, strong cool spotlights on the floor from high above, a red-orange glow inside the press.
PALETTE: black, gold, crimson, cold white spotlight.
```

## 겹치지 않는지 확인

| 방 | 바닥 | 빛 | 대표 색 |
| --- | --- | --- | --- |
| 01 | 크림·민트 체크 타일 | 아침 햇살 | 크림, 민트 |
| 02 | 자작나무 마루 | 오후 햇살 | 크라프트 갈색, 빨강 |
| 03 | 올리브 콘크리트 | 어두운 녹색 등 | 올리브, 카키 |
| 04 | 검은 고무 타일 | 형광등 | 남색 잉크, 빨강 |
| 05 | 흰·은색 타일 | 차가운 흰빛 | 흰색, 은색 |
| 06 | 헌 나무판 + 깔개 | 랜턴 | 꿀색, 패치워크 |
| 07 | 녹슨 줄무늬 철판 | 주황 경고등 | 녹, 황토 |
| 08 | 회색 펠트 | 흐린 흰빛 | 거의 무채색 |
| 09 | 아스팔트 콘크리트 | 저녁노을 | 보라, 주황 |
| 10 | 주철 격자 | 불빛 | 벽돌 빨강, 구리 |
| 11 | 남색 철판 | 청록 신호선 | 남색, 청록 |
| 12 | 검은 금속 + 금 | 스포트라이트 | 검정, 금, 진홍 |
