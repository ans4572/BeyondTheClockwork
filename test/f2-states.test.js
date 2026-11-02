import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {F2StateRig,stateDurationMs,stateInvulnerabilityMs,stateRootDistance,stateEffectEvents} from '../src/animation/f2-states.js';
import {DIRECTION_ANGLES} from '../src/animation/f2-rig.js';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const [config,data,combat]=await Promise.all([json('../art/animations/player/rig.json'),json('../art/animations/player/states.json'),json('../src/data/combat.json')]);
const rig=new F2StateRig(config,null,data,combat),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('selected H1/D1/E2 clips and dodge metadata retain combat duration/distance/invulnerability',()=>{
 assert.deepEqual(data.selection,{hit:'H1',death:'D1',dodge:'E2'});const dodge=rig.definition('dodge');assert.equal(stateDurationMs(dodge,combat),180);assert.equal(stateRootDistance(dodge,combat),3);assert.equal(stateInvulnerabilityMs(dodge,combat),160);assert.equal(stateInvulnerabilityMs(rig.definition('pressureDash'),combat),0);assert.equal(stateDurationMs(rig.definition('pressureDash'),combat),200);
});
test('all eight directions cast weapon skills from right-hand wrench and frost from empty left hand',()=>{
 for(const direction of Object.keys(DIRECTION_ANGLES))for(const def of data.states.filter(d=>d.category==='skill')){
  const p=rig.pose({action:def.id,timeMs:def.events.release+20,direction}),right=p.arms.find(a=>a.side===1),left=p.arms.find(a=>a.side===-1);
  assert.equal(def.castHand,def.usesWeapon?'right':'left');
  if(def.usesWeapon){assert.deepEqual(p.castOrigin,p.weaponTip);assert.ok(Math.abs(dist(p.castOrigin,right.wrist)-config.model.wrenchLength)<1e-8);}else{assert.deepEqual(p.castOrigin,left.wrist);assert.ok(dist(p.castOrigin,right.wrist)>.2);}
 }
});
test('all states keep arm/leg bone lengths and knees above ground throughout motion',()=>{
 for(const direction of Object.keys(DIRECTION_ANGLES))for(const def of data.states)for(let i=0;i<=80;i++){
  const p=rig.pose({action:def.id,timeMs:stateDurationMs(def,combat)*i/80,direction});
  for(const leg of p.legs){assert.ok(Math.abs(dist(leg.hip,leg.knee)-config.model.upperLeg)<1e-6,def.id+' thigh');assert.ok(Math.abs(dist(leg.knee,leg.ankle)-config.model.lowerLeg)<1e-6,def.id+' shin');assert.ok(leg.knee[1]>=.065-1e-8);assert.ok(leg.ankle[1]>=.065-1e-8);}
  for(const arm of p.arms){assert.ok(Math.abs(dist(arm.shoulder,arm.elbow)-config.model.upperArm)<1e-6);assert.ok(Math.abs(dist(arm.elbow,arm.wrist)-config.model.lowerArm)<1e-6);}
 }
});
test('S5–S8 preserve skill pulse counts, authored combat intervals and vortex finisher',async()=>{
 const slice=await json('../src/data/slice.json');
 for(const id of ['exhaustBurst','coolingField','capacitorStrike','vortexIntake']){
  const def=rig.definition(id),skill=combat.skills.find(s=>s.id===id),events=stateEffectEvents(def,combat),behavior=slice.skillBehavior[id];
  assert.equal(def.castHand,'left');assert.equal(def.usesWeapon,false);assert.equal(events.pulses.length,skill.hits);assert.equal(events.gameplayDelayMs,behavior.delay*1000);assert.equal(events.gameplayIntervalMs,behavior.interval*1000);
  assert.equal(events.pulses[0],def.events.release+behavior.delay*1000);
  for(let i=1;i<events.pulses.length;i++)assert.equal(events.pulses[i]-events.pulses[i-1],behavior.interval*1000);
  assert.ok(events.pulses.at(-1)+def.effectSchedule.pulseDurationMs<=def.effectWindowMs[1]);
  assert.ok(def.effectWindowMs[1]<stateDurationMs(def,combat));
  assert.equal(events.finisher,id==='vortexIntake'?def.events.release+skill.hits*behavior.interval*1000:null);
 }
});
test('D1 kneels, bows and dims its face, then holds the terminal pose indefinitely',()=>{
 const a=rig.pose({action:'death',timeMs:0}),b=rig.pose({action:'death',timeMs:800}),c=rig.pose({action:'death',timeMs:8000});assert.ok(b.hipY<a.hipY-.2);assert.ok(b.head[1]<a.head[1]-.3);assert.ok(b.facePower<=.1);assert.equal(b.stateDefinition.endBehavior,'hold');assert.deepEqual(b.legs,c.legs);assert.deepEqual(b.head,c.head);assert.deepEqual(b.arms,c.arms);
});
test('nonterminal states return to exactly the same neutral pose and never swap hand identities',()=>{
 for(const def of data.states.filter(d=>d.endBehavior==='idle'))for(const direction of Object.keys(DIRECTION_ANGLES)){const a=rig.pose({action:def.id,timeMs:0,direction}),b=rig.pose({action:def.id,timeMs:stateDurationMs(def,combat),direction});assert.deepEqual(a.arms,b.arms);assert.deepEqual(a.legs,b.legs);assert.deepEqual(a.head,b.head);assert.equal(a.arms[0].side,1);}
});
