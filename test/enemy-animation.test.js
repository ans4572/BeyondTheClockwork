import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {EnemyRig,enemyTimeline,enemyFrameSchedule} from '../src/animation/enemy-rig.js';import {DIRECTION_ANGLES} from '../src/animation/f2-rig.js';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const [config,slice]=await Promise.all([json('../art/animations/mobs/normal-elite/enemies.json'),json('../src/data/slice.json')]),rig=new EnemyRig(config,slice),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('enemy motion timelines preserve tell, dash and separately telegraphed elite followup',()=>{
 const g=enemyTimeline('guard',slice),r=enemyTimeline('rabbit',slice),t=enemyTimeline('trumpet',slice),e=enemyTimeline('elite',slice);
 assert.deepEqual([g.primaryMs,r.primaryMs,t.primaryMs,e.primaryMs],[650,700,800,800]);assert.equal(g.durationMs,1650);assert.equal(r.dashEndMs-r.primaryMs,350);assert.equal(r.rootMotionDistanceUnits,slice.enemies.rabbit.dashDistance);assert.equal(r.durationMs,2000);assert.equal(t.durationMs,2500);assert.equal(e.followupMs,1600);assert.equal(e.durationMs,3000);
 for(const id of ['guard','rabbit','trumpet','elite']){const tl=enemyTimeline(id,slice),f=enemyFrameSchedule(tl);assert.equal(f.durationsMs.reduce((a,b)=>a+b,0),tl.durationMs);assert.ok(f.durationsMs.every(d=>d>0&&d%10===0));for(const event of tl.events)assert.ok(f.timesMs.includes(event.timeMs));}
});
test('all moves loop exactly and attacks return to idle without baking root travel',()=>{
 for(const def of config.enemies)for(const direction of Object.keys(DIRECTION_ANGLES)){const a=rig.pose({enemy:def.id,direction,phase:0}),b=rig.pose({enemy:def.id,direction,phase:1});assert.deepEqual(a.legs,b.legs);assert.deepEqual(a.head,b.head);assert.deepEqual(a.arms,b.arms);const idle=rig.pose({enemy:def.id,direction,action:'idle'}),end=rig.pose({enemy:def.id,direction,action:'attack',timeMs:enemyTimeline(def.id,slice).durationMs});assert.deepEqual(end.legs,idle.legs);assert.deepEqual(end.head,idle.head);assert.deepEqual(end.arms,idle.arms);assert.deepEqual(end.root,[0,0,0]);}
});
test('humanoid joints retain bone lengths and rabbit uses four finite compressible spring legs',()=>{
 for(const def of config.enemies)for(const direction of Object.keys(DIRECTION_ANGLES))for(const action of ['move','attack'])for(let i=0;i<=48;i++){
  const p=rig.pose({enemy:def.id,direction,action,phase:i/48,timeMs:enemyTimeline(def.id,slice).durationMs*i/48});
  if(def.kind==='spring_rabbit'){assert.equal(p.legs.length,4);for(const leg of p.legs){assert.ok(leg.ankle[1]>=.065-1e-9);assert.ok(dist(leg.top,leg.ankle)>.05&&dist(leg.top,leg.ankle)<.7);}}
  else{for(const leg of p.legs){assert.ok(Math.abs(dist(leg.hip,leg.knee)-p.m.upperLeg)<1e-6);assert.ok(Math.abs(dist(leg.knee,leg.ankle)-p.m.lowerLeg)<1e-6);assert.ok(leg.ankle[1]>=.065-1e-8);}for(const arm of p.arms){assert.ok(Math.abs(dist(arm.shoulder,arm.elbow)-p.m.upperArm)<1e-6);assert.ok(Math.abs(dist(arm.elbow,arm.wrist)-p.m.lowerArm)<1e-6);}}
 }
});
test('guard/elite keep one baton in the same hand and trumpet grips stay attached while moving',()=>{
 for(const direction of Object.keys(DIRECTION_ANGLES)){
  for(const id of ['guard','elite'])for(let i=0;i<32;i++){const p=rig.pose({enemy:id,direction,action:'attack',timeMs:enemyTimeline(id,slice).durationMs*i/32});assert.deepEqual(p.weaponGrip,p.arms.find(a=>a.side===-1).wrist);assert.ok(Math.abs(dist(p.weaponGrip,p.weaponTip)-p.def.weaponLength)<1e-8);}
  const first=rig.pose({enemy:'trumpet',direction}),grips=first.arms.map(a=>dist(a.wrist,first.hornMouth));for(let i=0;i<32;i++){const p=rig.pose({enemy:'trumpet',direction,phase:i/32});for(let j=0;j<2;j++)assert.ok(Math.abs(dist(p.arms[j].wrist,p.hornMouth)-grips[j])<1e-8);}
 }
});
