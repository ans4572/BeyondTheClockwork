import { fitsMap, placeOf } from './map-geometry.js';
import { chapterList, chapterRooms, allRooms } from './chapters.js';

export function validateData(data) {
  const { combat: c, progression: p, slice: s, maps } = data;
  const assert = (condition, message) => { if (!condition) throw new Error(`게임 데이터 오류: ${message}`); };
  assert(c.schemaVersion === 1 && p.schemaVersion === 1 && s.schemaVersion === 1, '지원하지 않는 버전');
  assert(c.player.combo.length === 3 && c.player.maxHp > 0, '플레이어 기본값');
  assert(c.elements.length === 4 && c.skills.length === 8 && c.fusions.length === 6, '수직 조각 콘텐츠 수');
  const keys = new Set();
  for (const element of c.elements) assert(c.skills.filter(x => x.element === element.id).length === 2, `${element.id} 기술 수`);
  for (const fusion of c.fusions) {
    const key = [...fusion.pair].sort().join('+');
    assert(!keys.has(key) && fusion.pair[0] !== fusion.pair[1] && fusion.pair.every(id => s.elements.includes(id)), `융합 중복/속성: ${key}`);
    assert(s.fusionBehavior[fusion.id], `융합 실행 규칙: ${fusion.id}`);
    if(fusion.behavior)assert(JSON.stringify(fusion.behavior)===JSON.stringify(s.fusionBehavior[fusion.id]),`기획/실행 동작 불일치: ${fusion.id}`);
    keys.add(key);
  }
  for (const skill of c.skills) assert(s.skillBehavior[skill.id] && skill.cooldown > 0, `기술 실행 규칙: ${skill.id}`);
  for (const chapter of chapterList(s)) {
    const rooms = chapterRooms(s, chapter.id);
    assert(rooms.length === 12 && rooms[0].kind === 'normal' && rooms[5].kind === 'shop' && rooms[11].boss, `12구간 구조: ${chapter.id}`);
    assert(!chapter.after || chapterList(s).some(c => c.id === chapter.after), `앞 장 없음: ${chapter.id}`);
  }
  const roomIds = allRooms(s).map(r => r.id);
  assert(new Set(roomIds).size === roomIds.length, '방 ID 중복');
  assert(s.permanentStats.length >= 4, '영구 스탯');
  assert(s.statChapters?.ranksPerChapter > 0, '챕터별 스탯 한도');
  for (const [room, place] of Object.entries(maps?.maps || {})) {
    assert(roomIds.includes(room), `맵의 방 없음: ${room}`);
    const map = placeOf(maps, place);
    if (map.walkable) for (const point of [map.spawn, ...map.enemySpawns]) assert(fitsMap(point.x, point.y, map.bodyRadius ?? s.arena.playerRadius, map), `맵 시작 위치가 이동 영역 밖: ${room}`);
  }
  for (const [room, list] of Object.entries(maps?.alternates || {})) {
    const owner = allRooms(s).find(r => r.id === room);
    assert(owner && (owner.variants?.length || 1) === list.length + 1, `방의 그림 수와 맵 수가 다름: ${room}`);
    for (const place of list) { const map = placeOf(maps, place); for (const point of [map.spawn, ...map.enemySpawns]) assert(fitsMap(point.x, point.y, map.bodyRadius ?? s.arena.playerRadius, map), `두 번째 맵 시작 위치가 이동 영역 밖: ${room}`); }
  }
  if (maps?.intro) { const yard = placeOf(maps, maps.intro); for (const point of [yard.spawn, ...yard.enemySpawns]) assert(fitsMap(point.x, point.y, yard.bodyRadius, yard), '폐기장 시작 위치가 이동 영역 밖'); }
  for (const stat of s.permanentStats) assert(stat.maxRank > 0 && stat.perRank > 0 && stat.baseCost > 0 && stat.costStep >= 0, `영구 스탯: ${stat.id}`);
  return data;
}

export async function loadData() {
  const names = ['combat', 'progression', 'slice', 'maps', 'dialogue'];
  const values = await Promise.all(names.map(async name => {
    const response = await fetch(`src/data/${name}.json`);
    if (!response.ok) throw new Error(`${name}.json을 불러올 수 없습니다 (${response.status})`);
    return response.json();
  }));
  return validateData(Object.fromEntries(names.map((name, i) => [name, values[i]])));
}
