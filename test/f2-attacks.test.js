import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {F2AttackRig,attackDuration,sampleAttack} from '../src/animation/f2-attacks.js';
import {DIRECTION_ANGLES} from '../src/animation/f2-rig.js';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const [config,data,combat]=await Promise.all([json('../art/animations/player/rig.json'),json('../art/animations/player/attacks.json'),json('../src/data/combat.json')]);
const rig=new F2AttackRig(config,null,data,combat),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('attack stages follow authoritative combat timings, including exact boundaries',()=>{
 for(const def of data.attacks){const t=combat.player.combo[def.comboIndex];assert.equal(sampleAttack(def,t,t.windup-1e-7).stage,'windup');assert.equal(sampleAttack(def,t,t.windup).stage,'active');assert.equal(sampleAttack(def,t,t.windup+t.active).stage,'recovery');assert.ok(Math.abs(attackDuration(t)*1000/data.frameDurationMs-Math.round(attackDuration(t)*1000/data.frameDurationMs))<1e-8);}
});
test('all attacks in eight directions retain bone lengths, grip length and planted feet',()=>{
 for(const direction of Object.keys(DIRECTION_ANGLES))for(const def of data.attacks){const duration=attackDuration(combat.player.combo[def.comboIndex]);for(let i=0;i<=60;i++){
  const p=rig.pose({direction,attack:def.id,attackTime:duration*i/60});
  for(const leg of p.legs){assert.ok(Math.abs(dist(leg.hip,leg.knee)-config.model.upperLeg)<1e-6);assert.ok(Math.abs(dist(leg.knee,leg.ankle)-config.model.lowerLeg)<1e-6);assert.ok(Math.abs(leg.ankle[1]-.065)<1e-8);}
  for(const arm of p.arms){assert.ok(Math.abs(dist(arm.shoulder,arm.elbow)-config.model.upperArm)<1e-6);assert.ok(Math.abs(dist(arm.elbow,arm.wrist)-config.model.lowerArm)<1e-6);}
  if(p.weaponDirection)assert.ok(Math.abs(Math.hypot(...p.weaponDirection)-1)<1e-8);
 }}
});
test('every combo link returns to the exact same idle pose without changing hand identity',()=>{
 for(const direction of Object.keys(DIRECTION_ANGLES))for(const def of data.attacks){const a=rig.pose({direction,attack:def.id,attackTime:0}),b=rig.pose({direction,attack:def.id,attackTime:attackDuration(combat.player.combo[def.comboIndex])});assert.deepEqual(a.arms,b.arms);assert.deepEqual(a.legs,b.legs);assert.deepEqual(a.head,b.head);assert.equal(a.arms[0].side,1);}
});
