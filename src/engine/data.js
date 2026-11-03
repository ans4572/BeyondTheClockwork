import { fitsMap, placeOf } from './map-geometry.js';

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
  assert(s.rooms.length === 12 && s.rooms[0].kind === 'normal' && s.rooms[5].kind === 'shop', '12구간 구조');
  assert(s.permanentStats.length >= 4, '영구 스탯');
  assert(s.statChapters?.ranksPerChapter > 0, '챕터별 스탯 한도');
  for (const [room, place] of Object.entries(maps?.maps || {})) {
    assert(s.rooms.some(r => r.id === room), `맵의 방 없음: ${room}`);
    const map = placeOf(maps, place);
    if (map.walkable) for (const point of [map.spawn, ...map.enemySpawns]) assert(fitsMap(point.x, point.y, map.bodyRadius ?? s.arena.playerRadius, map), `맵 시작 위치가 이동 영역 밖: ${room}`);
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
