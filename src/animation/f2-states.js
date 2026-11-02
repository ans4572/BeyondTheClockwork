import {F2Rig,kneeJoint} from './f2-rig.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,n)=>a.map(v=>v*n);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>mul(a,1/(Math.hypot(...a)||1));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const stateDurationMs=(def,combat)=>def.durationSource?combat.player.dodge.duration*1000:def.durationMs;
export const stateInvulnerabilityMs=(def,combat)=>def.invulnerabilitySource?combat.player.dodge.invincibility*1000:(def.invulnerabilityMs||0);
export const stateRootDistance=(def,combat)=>def.rootMotionSource?combat.player.dodge.distance:def.rootMotionSkill?combat.skills.find(s=>s.id===def.rootMotionSkill).range:0;

/** Preview lead-in is separate from gameplay delay/interval; no damage is applied here. */
export function stateEffectEvents(def,combat){
 if(!def.effectSchedule)return null;
 const skill=combat.skills.find(s=>s.id===def.id),schedule=def.effectSchedule,release=def.events.release;
 const pulses=Array.from({length:skill.hits},(_,i)=>release+schedule.delayMs+i*schedule.intervalMs);
 return {pulses,finisher:schedule.hasFinisher?release+schedule.delayMs+skill.hits*schedule.intervalMs:null,previewLeadInMs:release,gameplayDelayMs:schedule.delayMs,gameplayIntervalMs:schedule.intervalMs};
}

export function sampleState(data,def,combat,timeMs){
 const duration=stateDurationMs(def,combat),progress=clamp(timeMs/duration,0,1),keys=def.keys;
 let index=keys.findIndex(k=>k.t>=progress);if(index<1)index=progress<=0?1:keys.length-1;
 const a={...data.defaults,...keys[index-1]},b={...data.defaults,...keys[index]},t=smooth(clamp((progress-a.t)/(b.t-a.t),0,1)),sample={};
 for(const key of Object.keys(data.defaults))sample[key]=Array.isArray(a[key])?a[key].map((v,i)=>mix(v,b[key][i],t)):mix(a[key],b[key],t);
 return {...sample,progress,timeMs:clamp(timeMs,0,duration),durationMs:duration};
}

// Keep a folded mechanical knee above the floor without changing either bone length.
function floorKnee(hip,ankle,forward,upper,lower){
 const knee=kneeJoint(hip,ankle,forward,upper,lower);if(knee[1]>=.065)return knee;
 const delta=sub(ankle,hip),distance=Math.hypot(...delta),axis=norm(delta),along=(upper*upper-lower*lower+distance*distance)/(2*distance),center=add(hip,mul(axis,along)),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
 const up=norm(sub([0,1,0],mul(axis,axis[1]))),side=norm(cross(axis,up)),q=clamp((.065-center[1])/Math.max(.000001,radius*up[1]),-1,1);
 const sign=dot(side,forward)>=0?1:-1;return add(center,mul(add(mul(up,q),mul(side,sign*Math.sqrt(1-q*q))),radius));
}

export class F2StateRig extends F2Rig {
 constructor(config,face,data,combat){super(config,face);this.data=data;this.combat=combat;}
 definition(id){const def=this.data.states.find(d=>d.id===id);if(!def)throw new Error('Unknown F2 state: '+id);return def;}
 render(ctx,state={},options={}){
  const def=state.action?this.definition(state.action):null;
  return super.render(ctx,state,{...options,origin:options.origin||def?.origin||this.config.origin});
 }
 pose(state={}){
  if(!state.action)return super.pose(state);
  const def=this.definition(state.action),s=sampleState(this.data,def,this.combat,state.timeMs||0),base=super.pose({gait:'idle',direction:state.direction||'south-east',time:0}),m=this.config.model;
  if(s.progress===0||(s.progress===1&&def.endBehavior==='idle'))return {...base,stateDefinition:def,stateSample:s,castOrigin:null};
  const aimF=base.f,aimR=base.r,f=add(mul(aimF,Math.cos(s.yaw)),mul(aimR,Math.sin(s.yaw))),r=[-f[2],0,f[0]],root=mul(aimF,s.rootForward);
  const ankles=[s.rightFoot,s.leftFoot].map(([u,h,v])=>add(add(mul(aimR,u),mul(aimF,v)),[0,h,0]));
  let hipY=m.hipHeight-s.drop;const reach=m.upperLeg+m.lowerLeg-.008;
  for(let i=0;i<2;i++){const h=add(root,mul(aimR,(i===0?1:-1)*m.hipWidth/2)),d=Math.hypot(h[0]-ankles[i][0],h[2]-ankles[i][2]);hipY=Math.min(hipY,ankles[i][1]+Math.sqrt(Math.max(.001,reach*reach-d*d)));}
  const local=(u,h,v=0)=>add(root,add(add(mul(r,u),mul(f,v)),[0,h,0]));
  const body=(u,h,v=0)=>add(local(u,h,v),mul(aimF,s.lean*clamp((h-hipY)/.7,0,1)));
  const legs=[1,-1].map((side,i)=>{const hip=add(root,add(mul(aimR,side*m.hipWidth/2),[0,hipY,0])),ankle=ankles[i];return {side,hip,ankle,knee:floorKnee(hip,ankle,aimF,m.upperLeg,m.lowerLeg),cycle:{forward:0,lift:ankle[1]-.065,roll:0,contact:ankle[1]<=.065}};});
  const arms=[1,-1].map(side=>{const shoulder=body(side*m.shoulderWidth/2,hipY+.315),hand=side===1?s.right:s.left,target=body(hand[0],hipY+hand[1],hand[2]),delta=sub(target,shoulder),wrist=add(shoulder,mul(norm(delta),Math.min(Math.hypot(...delta),m.upperArm+m.lowerArm-.001))),bend=norm(add(mul(r,side),mul(aimF,-.55)));return {side,shoulder,wrist,elbow:kneeJoint(shoulder,wrist,bend,m.upperArm,m.lowerArm)};});
  const [yaw,elevation]=s.weapon,weaponDirection=norm(add(add(mul(f,Math.cos(yaw)*Math.cos(elevation)),mul(r,Math.sin(yaw)*Math.cos(elevation))),[0,Math.sin(elevation),0])),weaponAcross=norm(cross(weaponDirection,norm([1,1.6,1])));
  const right=arms.find(a=>a.side===1),left=arms.find(a=>a.side===-1),weaponTip=add(right.wrist,mul(weaponDirection,m.wrenchLength));
  const castOrigin=def.category==='skill'?(def.castHand==='left'?left.wrist:weaponTip):null;
  return {...base,f,r,aimF,aimR,hipY,local,body,legs,arms,head:body(0,hipY+m.headHeightAboveHip-s.headDrop),faceVisible:dot(f,norm([1,0,1]))>-.2,headPitch:s.headPitch,torsoPitch:s.lean*.7,faceFlinch:s.flinch,facePower:s.power,weaponDirection,weaponAcross,weaponTip,phase:s.progress,time:s.timeMs/1000,motionWeight:def.id==='death'?1-s.progress:.7,stateDefinition:def,stateSample:s,castOrigin};
 }
 renderEffects(ctx,state,options={}){
  const p=this.pose(state),def=p.stateDefinition,s=p.stateSample;if(!def?.effect||!p.castOrigin)return;
  const [start,end]=def.effectWindowMs;if(s.timeMs<start||s.timeMs>=end)return;
  const t=(s.timeMs-start)/(end-start),scale=options.scale||this.config.pixelsPerUnit,origin=options.origin||def.origin||this.config.origin;
  const project=v=>[origin[0]+(v[0]-v[2])*this.config.cameraGroundScale[0]*scale,origin[1]+((v[0]+v[2])*this.config.cameraGroundScale[1]-v[1])*scale];
  const pixel=(point,color,size=1)=>{const [x,y]=project(point);ctx.fillStyle=color;ctx.fillRect(Math.round(x)-Math.floor(size/2),Math.round(y)-Math.floor(size/2),size,size);};
  const line=(a,b,color,width=1)=>{const d=Math.hypot(...sub(b,a)),count=Math.max(1,Math.ceil(d*scale*2));for(let i=0;i<=count;i++)pixel(add(a,mul(sub(b,a),i/count)),color,width);};
  const at=(forward,side=0,height=0)=>add(p.castOrigin,add(add(mul(p.aimF,forward),mul(p.aimR,side)),[0,height,0]));
  const schedule=stateEffectEvents(def,this.combat),pulseDuration=def.effectSchedule?.pulseDurationMs;
  const activePulse=schedule?.pulses.findIndex(ms=>s.timeMs>=ms&&s.timeMs<ms+pulseDuration)??-1;
  const pulseAge=activePulse>=0?(s.timeMs-schedule.pulses[activePulse])/pulseDuration:0;
  const target=add(mul(p.aimF,def.effectPreviewTargetDistanceUnits||.43),[0,.025,0]),radius=def.effectPreviewRadiusUnits||.23;
  const ring=(center,r,color,width=1,phase=0)=>{let previous=null;for(let i=0;i<=32;i++){const a=i/32*Math.PI*2+phase,point=add(center,add(mul(p.aimF,Math.cos(a)*r),mul(p.aimR,Math.sin(a)*r)));if(previous)line(previous,point,color,width);previous=point;}};
  if(def.effect==='exhaust'&&activePulse>=0){
   for(const side of [-1,1])for(let j=0;j<3;j++){
    const seam=p.body(side*.18,p.hipY+.15+j*.07,-.015),jet=add(seam,add(mul(p.aimR,side*(.035+pulseAge*.28)),mul(p.aimF,-.035-pulseAge*.08)));
    line(seam,jet,j%2?'#f4b257':'#e4783d',2);pixel(jet,pulseAge<.5?'#ffdc89':'#a8a18b',2);
   }
   ring([0,.08,0],.17+pulseAge*.23,'#d9a15c',1);
  }
  if(def.effect==='frost_field'){
   for(const factor of [1,.85,.7,.55,.4,.25])ring(target,radius*factor,factor===1?'#83cbdc':factor<.6?'#d5eff1':'#b6e3e9',1);
   if(activePulse>=0)ring(target,radius*(.25+pulseAge*.7),'#e5faff',1);
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2,foot=add(target,add(mul(p.aimF,Math.cos(a)*radius*.88),mul(p.aimR,Math.sin(a)*radius*.88)));line(foot,add(foot,[0,.09+Math.sin(i+t*8)*.02,0]),i%2?'#7fc8e1':'#d4f1f5',1);}
  }
  if(def.effect==='target_lightning'){
   ring(target,radius,'#cfb253',1);ring(target,radius*.55,'#ecdfa1',1);
   if(activePulse>=0){const height=Math.min(1.35,(project(target)[1]-12)/scale);let previous=add(target,[0,height,0]);for(let i=1;i<=9;i++){const point=add(target,add([0,height*(1-i/9),0],mul(p.aimR,i===9?0:Math.sin(i*2.7+activePulse)*.034)));line(previous,point,i%2?'#f3cd53':'#fff1ac',pulseAge<.5?2:1);previous=point;}ring(target,radius*(.5+pulseAge*.5),'#fff1ac',1);}
   else if(s.timeMs<schedule.pulses[0]){pixel(p.castOrigin,'#f0d66d',2);}
  }
  if(def.effect==='vortex'){
   const finish=schedule.finisher!==null&&s.timeMs>=schedule.finisher,collapse=finish?clamp((s.timeMs-schedule.finisher)/180,0,1):0;
   for(let layer=0;layer<3;layer++){const r=(.075+layer*.065)*(1-collapse*.7),center=add(target,[0,layer*.065,0]);ring(center,r,layer%2?'#a9c8bb':'#7fa99b',1,t*9+layer*.8);}
   let previous=null;for(let i=0;i<=38;i++){const u=i/38,a=t*18+u*Math.PI*3.6,r=radius*(1-u*.85)*(1-collapse*.7),point=add(target,add(add(mul(p.aimF,Math.cos(a)*r),mul(p.aimR,Math.sin(a)*r)),[0,u*.12,0]));if(previous)line(previous,point,i%4?'#b9d4c4':'#729a8a',1);previous=point;}
   for(let i=0;i<7;i++){const phase=(t*5+i/7)%1,a=i*2.4+t*7,r=radius*(1-phase),point=add(target,add(add(mul(p.aimF,Math.cos(a)*r),mul(p.aimR,Math.sin(a)*r)),[0,phase*.11,0]));pixel(point,finish?'#d6e7cc':'#acae91',1);}
   if(activePulse>=0)ring(target,radius*(1-pulseAge*.75),'#b7d4bd',1);if(finish)ring(target,radius*(1-collapse*.8),'#d2e4c8',2);
  }
  if(def.effect==='ice')for(const spread of [-1,0,1]){const d=.025+t*.28,center=at(d,spread*(.035+d*.20),spread===0?.012:0);line(add(center,mul(p.aimF,-.07)),add(center,mul(p.aimF,.045)),'#91e2f3',2);pixel(center,'#eefbff',2);}
  if(def.effect==='lightning'){let previous=at(0);for(let i=1;i<=5;i++){const point=at(i*.05,Math.sin(i*2.8+Math.floor(t*8))*.035,i%2*.018);line(previous,point,i%2?'#f6d45b':'#fff2b3',1);previous=point;}}
  if(def.effect==='fire'){let previous=null;for(let i=0;i<14;i++){const a=-1.4+i*.22+t*.35,point=at(Math.cos(a)*.13,Math.sin(a)*.14,Math.sin(a)*.015);if(previous)line(previous,point,i%3?'#ed8544':'#ffe299',2);previous=point;}}
  if(def.effect==='wind')for(const side of [-1,0,1]){const start=add(p.body(side*.18,p.hipY+.12,-.11),mul(p.aimF,-.12-t*.12));line(start,add(start,mul(p.aimF,-.16)),'#98b9a8',1);}
 }
}
