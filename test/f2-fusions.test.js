import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {F2FusionRig,fusionTimeline,fusionEffectState,fusionFrameSchedule} from '../src/animation/f2-fusions.js';
import {DIRECTION_ANGLES} from '../src/animation/f2-rig.js';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const [config,states,data,combat,slice]=await Promise.all(['art/animations/player/rig.json','art/animations/player/states.json','art/animations/player/fusions.json','src/data/combat.json','src/data/slice.json'].map(read));
const rig=new F2FusionRig(config,null,states,data,combat,slice),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('frost emits one simultaneous X from the empty left wrist in all eight directions',()=>{
 const tl=rig.timeline('frostCrosscut');assert.deepEqual(tl.gameplayPulsesMs,[180,180]);assert.equal(tl.pulsesMs[0],tl.pulsesMs[1]);
 for(const direction of Object.keys(DIRECTION_ANGLES)){
  const wrist=rig.pose({action:tl.id,direction,timeMs:tl.pulsesMs[0]}).arms.find(a=>a.side===-1).wrist;
  for(let index=0;index<2;index++)for(const p of rig.crosscutBladePoints(direction,index,0))assert.deepEqual(p,wrist);
  for(const q of [.15,.5,.85]){
   const a=rig.crosscutBladePoints(direction,0,q),b=rig.crosscutBladePoints(direction,1,q);assert.deepEqual(a[16],b[16]);
   const project=p=>[(p[0]-p[2])*.8660254,(p[0]+p[2])*.5-p[1]],pa=a.map(project),pb=b.map(project);
   assert.ok(pa.at(-1)[0]-pa[0][0]>.5);assert.ok(pb.at(-1)[0]-pb[0][0]>.5);
   const all=[...pa,...pb],width=Math.max(...all.map(p=>p[0]))-Math.min(...all.map(p=>p[0])),height=Math.max(...all.map(p=>p[1]))-Math.min(...all.map(p=>p[1]));assert.ok(height>width*1.4,'upright X must be taller than it is wide');
   assert.ok(Math.min(...[...a,...b].map(p=>p[1]))>0,'upright blade stays above ground');
   assert.ok((pa.at(-1)[1]-pa[0][1])*(pb.at(-1)[1]-pb[0][1])<0,'opposing visible diagonal slopes');
  }
 }
 const before=fusionEffectState(tl,tl.pulsesMs[0]-1),at=fusionEffectState(tl,tl.pulsesMs[0]);assert.equal(before.hitsEmitted,0);assert.equal(at.hitsEmitted,2);assert.equal(at.cuts[0].ageMs,at.cuts[1].ageMs);
});
test('fire cyclone forms ahead of the caster before release and keeps its existing forward speed',()=>{
 const tl=rig.timeline('fireCyclone'),options={origin:{x:4,y:7},angle:Math.PI/2};
 const before=fusionEffectState(tl,0,options),release=fusionEffectState(tl,tl.releaseMs,options),later=fusionEffectState(tl,tl.releaseMs+500,options);
 assert.deepEqual(before.center,release.center);assert.ok(Math.abs(release.center.y-9.6)<1e-8);
 assert.ok(Math.abs(later.center.y-release.center.y-1.1)<1e-8);assert.equal(later.center.x,4);
});
test('all six fusion timelines retain gameplay pulse counts/delays/intervals and distinguish preview lead-in',()=>{
 assert.deepEqual(data.fusions.map(f=>f.id).sort(),combat.fusions.map(f=>f.id).sort());assert.equal(data.gameplayActionLockAddedMs,0);
 for(const f of combat.fusions){const tl=fusionTimeline(f.id,data,combat,slice),b=slice.fusionBehavior[f.id];assert.equal(tl.pulsesMs.length,f.hits);assert.equal(tl.gameplayPulsesMs[0],b.delay*1000);for(let i=0;i<f.hits;i++){assert.equal(tl.pulsesMs[i]-tl.releaseMs,tl.gameplayPulsesMs[i]);assert.equal(tl.gameplayPulsesMs[i],Math.round((b.delay+i*b.interval)*1000));}assert.ok(tl.visualEndMs>tl.pulsesMs.at(-1));const schedule=fusionFrameSchedule(tl.durationMs,data.frameDurationMs,[tl.releaseMs,...tl.pulsesMs,tl.bodyReadyMs]);assert.equal(schedule.durationsMs.reduce((a,b)=>a+b,0),tl.durationMs);for(const t of tl.pulsesMs)assert.ok(schedule.timesMs.includes(t));}
});
test('every facing preserves empty-left-hand casting, right-hand wrench length, bones and neutral return',()=>{
 for(const def of data.fusions)for(const direction of Object.keys(DIRECTION_ANGLES)){const tl=rig.timeline(def.id);const start=rig.pose({action:def.id,direction,timeMs:0}),end=rig.pose({action:def.id,direction,timeMs:tl.durationMs});assert.deepEqual(start.arms,end.arms);assert.deepEqual(start.legs,end.legs);assert.deepEqual(start.head,end.head);
  for(let i=0;i<=32;i++){const p=rig.pose({action:def.id,direction,timeMs:tl.bodyReadyMs*i/32}),right=p.arms.find(a=>a.side===1),left=p.arms.find(a=>a.side===-1);assert.equal(p.stateDefinition.castHand,'left');assert.equal(p.stateDefinition.usesWeapon,false);if(p.castOrigin){assert.deepEqual(p.castOrigin,left.wrist);assert.ok(Math.abs(distance(right.wrist,p.weaponTip)-config.model.wrenchLength)<1e-7);}for(const a of p.arms){assert.ok(Math.abs(distance(a.shoulder,a.elbow)-config.model.upperArm)<1e-6);assert.ok(Math.abs(distance(a.elbow,a.wrist)-config.model.lowerArm)<1e-6);}for(const l of p.legs){assert.ok(l.knee[1]>=.065-1e-8);assert.ok(Math.abs(distance(l.hip,l.knee)-config.model.upperLeg)<1e-6);assert.ok(Math.abs(distance(l.knee,l.ankle)-config.model.lowerLeg)<1e-6);assert.deepEqual(l.ankle,start.legs.find(v=>v.side===l.side).ankle);}}
 }
});
test('world effects retain self/target/moving/cone semantics and stop after visual tail',()=>{
 for(const def of data.fusions){const tl=rig.timeline(def.id),options={origin:{x:4,y:7},target:{x:24,y:7},angle:Math.PI/2},t=tl.releaseMs+500,fx=fusionEffectState(tl,t,options);if(tl.behavior.shape==='self'||tl.behavior.shape==='cone')assert.deepEqual(fx.center,options.origin);if(tl.behavior.shape==='target')assert.deepEqual(fx.center,{x:11,y:7});if(tl.behavior.shape==='moving'){assert.ok(Math.abs(fx.center.x-4)<1e-8);assert.ok(Math.abs(fx.center.y-(7+(tl.behavior.startDistance||0)+tl.behavior.speed*.5))<1e-8);}if(tl.behavior.shape==='cone'){assert.equal(fx.range,5);assert.equal(fx.arc,100);}assert.equal(fusionEffectState(tl,tl.durationMs,options).phase,'ended');}

});
test('a returned actor does not truncate remaining pulses or persistent effects',()=>{
 for(const id of ['steamShatter','arcFurnace','fireCyclone','magneticIceClamp']){const tl=rig.timeline(id);assert.ok(tl.lastPulseMs>tl.bodyReadyMs);const effect=fusionEffectState(tl,tl.lastPulseMs);assert.equal(effect.phase,'active');assert.equal(effect.hitsEmitted,tl.skill.hits);assert.equal(effect.pulseActive,true);}
});

test('selected replacement effects use crossed segments and a locked orb with a single delayed pulse',()=>{
 const cut=rig.timeline('frostCrosscut');assert.deepEqual(cut.gameplayPulsesMs,[180,180]);const p=fusionEffectState(cut,cut.pulsesMs[1],{origin:{x:4,y:7},angle:Math.PI/2});assert.equal(p.cuts.length,2);assert.ok(Math.abs(p.cuts[0].start.x-4.2)<1e-8);assert.ok(Math.abs(p.cuts[0].start.y-7.32)<1e-8);assert.ok(Math.abs(p.cuts[0].end.x-5.6)<1e-8);assert.ok(Math.abs(p.cuts[0].end.y-12)<1e-8);assert.equal(p.cuts[0].halfWidth,.45);
 const orb=rig.timeline('stormFloat');assert.deepEqual(orb.gameplayPulsesMs,[850]);assert.ok(orb.bodyReadyMs<orb.pulsesMs[0]);const before=fusionEffectState(orb,orb.pulsesMs[0]-1,{origin:{x:4,y:7},target:{x:24,y:7}}),impact=fusionEffectState(orb,orb.pulsesMs[0],{origin:{x:4,y:7},target:{x:24,y:7}});assert.deepEqual(before.center,{x:10,y:7});assert.deepEqual(before.center,impact.center);assert.equal(before.hitsEmitted,0);assert.equal(impact.hitsEmitted,1);assert.equal(impact.pulseActive,true);
});

test('magnetic ice clamp locks a target, closes before its first hit, and keeps three distinct pulses',()=>{
 const tl=rig.timeline('magneticIceClamp'),options={origin:{x:4,y:7},target:{x:4,y:30},angle:Math.PI/2};assert.deepEqual(tl.gameplayPulsesMs,[600,780,960]);
 const start=fusionEffectState(tl,tl.releaseMs,options),open=fusionEffectState(tl,tl.pulsesMs[0]-120,options),closed=fusionEffectState(tl,tl.pulsesMs[0],options);
 assert.deepEqual(start.center,{x:4,y:13});assert.deepEqual(start.center,closed.center);assert.equal(start.hitsEmitted,0);assert.equal(open.hitsEmitted,0);assert.ok(open.jawGap>closed.jawGap);assert.equal(closed.jawGap,tl.behavior.jawClosedDistance);assert.equal(closed.jawGrowth,1);
 assert.equal(closed.footprint.length,4);assert.ok(tl.bodyReadyMs<tl.lastPulseMs);assert.equal(fusionEffectState(tl,tl.lastPulseMs).hitsEmitted,3);
});
