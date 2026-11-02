import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {StreetRig,MerchantInteraction,streetProjectedStride} from '../src/animation/street-rig.js';import {DIRECTION_ANGLES,footCycle} from '../src/animation/f2-rig.js';
const config=JSON.parse(await readFile(new URL('../art/animations/npc/characters.json',import.meta.url),'utf8')),rig=new StreetRig(config),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('residents walk in eight directions with fixed bone lengths and matching loop endpoints',()=>{
 for(const c of config.characters.filter(c=>c.role==='resident'))for(const direction of Object.keys(DIRECTION_ANGLES)){
  const a=rig.pose({character:c.id,direction,phase:0}),b=rig.pose({character:c.id,direction,phase:1});assert.deepEqual(a.legs,b.legs);assert.deepEqual(a.arms,b.arms);assert.deepEqual(a.propCenter,b.propCenter);
  for(let i=0;i<48;i++){const p=rig.pose({character:c.id,direction,phase:i/48});for(const l of p.legs){assert.ok(Math.abs(dist(l.hip,l.knee)-config.model.upperLeg)<1e-6);assert.ok(Math.abs(dist(l.knee,l.ankle)-config.model.lowerLeg)<1e-6);assert.ok(l.ankle[1]>=.065);}for(const arm of p.arms){assert.ok(Math.abs(dist(arm.shoulder,arm.elbow)-config.model.upperArm)<1e-6);assert.ok(Math.abs(dist(arm.elbow,arm.wrist)-config.model.lowerArm)<1e-6);}}
 }
});
test('residents keep both prop grips stable relative to the carried basket, flags or parcel',()=>{
 for(const c of config.characters.filter(c=>c.role==='resident'))for(const direction of Object.keys(DIRECTION_ANGLES)){
  const first=rig.pose({character:c.id,direction,phase:0}),grips=first.arms.map(a=>dist(a.wrist,first.propCenter));
  for(let i=0;i<32;i++){const p=rig.pose({character:c.id,direction,phase:i/32});for(let j=0;j<2;j++)assert.ok(Math.abs(dist(p.arms[j].wrist,p.propCenter)-grips[j])<1e-6);}
 }
});
test('planted walk feet cancel root travel and projected stride matches every screen direction',()=>{
 for(const direction of Object.keys(DIRECTION_ANGLES)){const p=rig.pose({direction}),sx=config.cameraGroundScale[0],sy=config.cameraGroundScale[1],project=v=>[(v[0]-v[2])*sx,(v[0]+v[2])*sy];const step=project(p.aimF).map(v=>v*config.walk.stride);assert.ok(Math.abs(Math.hypot(...step)-streetProjectedStride(config,direction))<1e-9);}
 for(const phase of [.01,.12,.25,.40])assert.ok(Math.abs(config.walk.stride*phase+footCycle(phase,config.walk).forward-config.walk.stride*config.walk.stanceFraction/2)<1e-9);
});
test('N2B merchant stays idle until interaction; repeated interaction cannot restart the greeting',()=>{
 const actor=new MerchantInteraction(config.merchant,{x:12,y:8});assert.equal(actor.update(9000).action,'idle');assert.equal(actor.interact(),true);actor.update(400);assert.equal(actor.interact(),false);assert.equal(actor.snapshot().timeMs,400);const before=actor.snapshot();actor.update(500,{paused:true});assert.deepEqual(actor.snapshot(),before);actor.update(800);assert.deepEqual(actor.snapshot(),{action:'idle',timeMs:0,x:12,y:8});assert.equal(actor.interact(),true);
});
test('merchant feet, root, right-hand case remain fixed while the empty left hand waves',()=>{
 assert.equal(config.merchant.selectedConcept,'N2B');assert.equal(config.merchant.greetingHand,'left');assert.equal(config.merchant.propHand,'right');
 for(const direction of Object.keys(DIRECTION_ANGLES)){const idle=rig.pose({character:'bolt',direction,action:'idle'});let moved=false;for(let i=0;i<=60;i++){const p=rig.pose({character:'bolt',direction,action:'greeting',timeMs:i*20});assert.deepEqual(p.legs,idle.legs);assert.deepEqual(p.root,[0,0,0]);assert.deepEqual(p.propCenter,idle.propCenter);assert.deepEqual(p.arms[0],idle.arms[0]);if(dist(p.arms[1].wrist,idle.arms[1].wrist)>.05)moved=true;}assert.ok(moved);}
 assert.throws(()=>rig.pose({character:'bolt',action:'walk'}),/stationary/);
});
