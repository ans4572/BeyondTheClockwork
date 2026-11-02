import {readFile,writeFile} from 'node:fs/promises';
import {renderRegionMap,gatePoint,connectionPoints} from '../src/map-review/region-map.js';
import {findReviewPath,isReviewWalkable} from '../src/map-review/navigation.js';
const root=new URL('../art/smile-street/map-concepts/',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const program=await read('region-map/v2/program.json'),old=await read('region-map/layout.json');
const familyName={'first-step':'첫 걸음 광장','ribbon-alley':'사탕색 골목','workshop-road':'장난감 수선길','parade-approach':'행진 준비 거리'};
const newPlans={
 'first-step-c':[{type:'ellipse',x:76,y:83,rx:25,ry:22,label:'분수'}],
 'ribbon-alley-c':[{type:'rect',x:132,y:62,w:49,h:40,label:'사탕 수레'}],
 'ribbon-alley-d':[{type:'rect',x:49,y:35,w:29,h:24,label:'화단'},{type:'rect',x:160,y:117,w:29,h:24,label:'화단'}],
 'workshop-road-c':[{type:'rect',x:43,y:35,w:47,h:25,label:'적재함'},{type:'rect',x:150,y:110,w:47,h:25,label:'적재함'}],
 'parade-approach-c':[{type:'rect',x:48,y:44,w:52,h:13,label:'검문대'},{type:'rect',x:144,y:113,w:52,h:13,label:'검문대'}],
 'parade-approach-d':[{type:'rect',x:92,y:65,w:55,h:30,label:'장비 선반'}]
};
const positions=program.stages.map((_,i)=>i<5?[i,2]:i<10?[9-i,1]:[i-10,0]);
const side=(a,b)=>b[0]>a[0]?'east':b[0]<a[0]?'west':b[1]>a[1]?'south':'north';
const opposite={east:'west',west:'east',north:'south',south:'north'};
const pool=[];
for(const [family,name]of Object.entries(familyName)){const m=await read(family+'/manifest.json');for(const v of m.variants)pool.push({id:family+'-'+v.id,family,name:name+' '+v.id,image:'../../'+family+'/'+v.image,new:false,kind:'combat'});}
const planned=await read('combat-variants/generation-plan.json');
for(const s of planned.specs)pool.push({id:s.id,family:s.family,name:s.name,image:'../../combat-variants/'+s.id+'-v1.png',new:true,kind:s.family==='village'?'safe':'combat',prompt:'../../combat-variants/prompts/'+s.id+'.txt'});
const rooms=program.stages.map((stage,i)=>{
 const original=old.rooms.find(r=>r.id===stage.space),isSafe=['village','bolt-shop'].includes(stage.space),isBoss=['roco-depot','brass-plaza'].includes(stage.space);
 const w=isBoss?300:240,h=isBoss?230:170,[col,row]=positions[i];
 const sx=original?w/original.w:1,sy=original?h/original.h:1;
 const scalePoint=([x,y])=>[x*sx,y*sy];
 const scaleObject=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='number'?v*(['x','w','rx'].includes(k)?sx:['y','h','ry'].includes(k)?sy:Math.min(sx,sy)):v]));
 const kind=isSafe?'village':stage.actors.includes('elite')?'elite':original?.kind==='miniboss'?'miniboss':original?.kind==='regionBoss'?'regionBoss':'normal';
 const shape=isSafe?[[18,0],[222,0],[240,18],[240,152],[222,170],[18,170],[0,152],[0,18]]:original.shape.map(scalePoint);
 const last=i===program.stages.length-1;
 const entry=i?opposite[side(positions[i-1],positions[i])]:'south',exit=last?'north':side(positions[i],positions[i+1]);
 const gates=[{role:'entry',side:entry,at:['east','west'].includes(entry)?h/2:w/2},{role:last?'clear':'exit',side:exit,at:['east','west'].includes(exit)?h/2:w/2}];
 const npc=isSafe?stage.space==='bolt-shop'?{name:'볼트·주민',x:55,y:88}:{name:'주민',x:59,y:104}:null;
 const obstacles=isSafe?[{type:'ellipse',x:120,y:73,rx:23,ry:20,label:'분수'},...(stage.space==='bolt-shop'?[{type:'rect',x:28,y:35,w:55,h:28,label:'부품 수레'}]:[])]:newPlans[stage.pool]||original.obstacles.map(scaleObject);
 const room={...stage,depth:i+1,kind,x:210+col*350-w/2,y:175+row*300-h/2,w,h,shape,gates,obstacles,npc,
  boss:isBoss?scaleObject(original.boss):null,patterns:isBoss?original.patterns?.map(scaleObject):[],
  loop:[[25,28],[w-25,28],[w-25,h-28],[25,h-28],[25,28]],
  detail:isSafe?(stage.space==='bolt-shop'?'로코 격파 후 한 번 쉬는 중간 마을입니다. 주민 대화와 볼트의 부품 상점을 이용하고 후반 전투로 출발합니다. 적은 배치하지 않습니다.':'원정을 시작하는 마을 입구입니다. 비전투 주민의 안내를 받고 첫 전투로 출발합니다. 적은 배치하지 않습니다.'):isBoss?original.detail:'반복 가능한 전투방 후보입니다. 같은 테마가 다시 나와도 장애물·우회로·적 조합을 바꿔 구성합니다.',
  features:isSafe?[stage.space==='bolt-shop'?'주민 대화 + 볼트 N2B 부품 상점 · 위치 고정 상호작용':'비전투 행진 주민 · 출발 안내','안전구역 · 전투/적 스폰 없음',stage.space==='bolt-shop'?'로코 격파 후 유일한 중간 쉼터':'원정 시작 시 준비하는 첫 마을']:isBoss?original.features:['전투방 풀: '+familyName[stage.space],'적 조합: '+stage.actors.join(', '),'배경·적 조합은 제안이며 본편 데이터에 미적용'],
  art:pool.find(p=>p.id===stage.pool)?.image||null};
 const a=gatePoint({...room,x:0,y:0},gates[0]),b=gatePoint({...room,x:0,y:0},gates[1]);
 // Plan units only: route the illustrated dots around props; these are not runtime colliders.
 const layout={width:w,height:h,walkRects:[{x:0,y:0,w,h}],obstacles:obstacles.map(o=>({...o,shape:o.type}))};
 const inset=p=>({x:Math.max(7,Math.min(w-7,p.x)),y:Math.max(7,Math.min(h-7,p.y))});
 const find=(a,b)=>{const p=findReviewPath(layout,a,b,{radius:3,grid:4});if(!p)throw Error('Plan path blocked: '+stage.id);return p.map(p=>[p.x,p.y]);};
 room.walkExample=[[a.x,a.y],...find(inset(a),inset(b)),[b.x,b.y]];
 const inside=([x,y])=>{let yes=false;for(let j=shape.length-1,k=0;k<shape.length;j=k++){const a=shape[k],b=shape[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 const anchors=[[35,35],[w-35,35],[w-35,h-35],[35,h-35]].map(([x,y])=>{const candidates=[];for(let py=12;py<h-12;py+=4)for(let px=12;px<w-12;px+=4)if(inside([px,py])&&isReviewWalkable(layout,{x:px,y:py},3))candidates.push({x:px,y:py});return candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];});
 room.loop=[];for(let j=0;j<anchors.length;j++)room.loop.push(...find(anchors[j],anchors[(j+1)%anchors.length]));
 for(const list of [room.walkExample.slice(1,-1),room.loop])for(let j=1;j<list.length;j++){const a=list[j-1],b=list[j],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let t=0;t<=steps;t++){const p=[a[0]+(b[0]-a[0])*t/steps,a[1]+(b[1]-a[1])*t/steps];if(!inside(p))throw Error('Plan line outside floor: '+stage.id);}}
 return room;
});
const data={schemaVersion:1,title:'웃음거리 · NPC 마을과 전투·보스가 섞인 지도',revision:'mixed-v2',status:'expanded_design_proposal_not_runtime',viewBox:[0,0,1820,1000],units:'diagram_units_not_game_units',orientation:'north_up',rooms,connections:rooms.slice(1).map((r,i)=>({from:rooms[i].id,to:r.id})),pool,safePolicy:program.safePolicy,repetitionPolicy:program.repetitionPolicy};
if(new Set(rooms.map(r=>r.id)).size!==program.stages.length)throw Error('Unique visit IDs required');
const safeRooms=rooms.filter(r=>r.kind==='village');
if(safeRooms.length!==program.safePolicy.count||rooms.filter(r=>r.boss).length!==2)throw Error('Safe/boss count');
if(safeRooms.map(r=>r.depth).join()!==program.safePolicy.visits.join())throw Error('Safe room positions');
const middle=rooms[program.safePolicy.visits[1]-1];
if(rooms[middle.depth-2]?.space!==program.safePolicy.middleAfter||!middle.actors.includes('bolt')||!middle.actors.includes('residents'))throw Error('Middle village must follow Roco and contain residents and Bolt');
for(const r of rooms)if(r.kind==='village'&&r.actors.some(a=>!['bolt','residents'].includes(a)))throw Error('Enemy in safe room');
for(const e of data.connections){const[a,b]=connectionPoints(data,e);if((a.x===b.x)===(a.y===b.y))throw Error('Gate alignment: '+e.from);}
const combat=rooms.filter(r=>['normal','elite'].includes(r.kind));if(combat.length!==9)throw Error('Combat count');
if(pool.filter(p=>p.kind==='combat').length!==14)throw Error('Combat pool count');
for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)throw Error('Overlap');}
await writeFile(new URL('region-map/v2/layout.json',root),JSON.stringify(data,null,2)+'\n');
for(const [filename,options]of [['smile-street-mixed-v2.svg',{}],['smile-street-mixed-boss-zones-v2.svg',{patterns:true}]])await writeFile(new URL('region-map/v2/'+filename,root),renderRegionMap(data,options));
console.log(`Mixed map: ${rooms.length} visits, ${safeRooms.length} safe at ${safeRooms.map(r=>r.depth)}, 9 combat, 2 bosses; ${data.connections.length} aligned links. Middle village follows Roco, with residents and Bolt. Safe zones contain no enemies; rooms do not overlap.`);
