import { F2Rig, kneeJoint } from './f2-rig.js';
const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,k) => a.map(v=>v*k);
const norm = a => mul(a,1/(Math.hypot(...a)||1));
const mix = (a,b,t) => a+(b-a)*t;
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const smooth = t => t*t*(3-2*t);
export const attackDuration = timing => timing.windup+timing.active+timing.recovery;
const keyTime = (k,t) => k.phase==='windup' ? k.at*t.windup : k.phase==='active' ? t.windup+k.at*t.active : t.windup+t.active+k.at*t.recovery;

export function sampleAttack(definition,timing,seconds) {
  const time=clamp(seconds,0,attackDuration(timing)),keys=definition.keys;
  let index=keys.findIndex(k=>keyTime(k,timing)>=time); if(index<1)index=1;
  const a=keys[index-1],b=keys[index],t=smooth(clamp((time-keyTime(a,timing))/(keyTime(b,timing)-keyTime(a,timing)),0,1));
  const result={};
  for(const k of ['yaw','drop','lean','step'])result[k]=mix(a[k],b[k],t);
  for(const k of ['right','left','weapon'])result[k]=a[k].map((v,i)=>mix(v,b[k][i],t));
  return {...result,time,stage:time<timing.windup?'windup':time<timing.windup+timing.active?'active':'recovery'};
}

/** Pure pose sampling: combat timings come from JSON; this never deals damage. */
export class F2AttackRig extends F2Rig {
  constructor(config,face,attackData,combat){super(config,face);this.attackData=attackData;this.combat=combat;}
  pose(state={}){
    if(!state.attack)return super.pose(state);
    const definition=this.attackData.attacks.find(a=>a.id===state.attack);
    if(!definition)throw new Error('Unknown attack');
    const timing=this.combat.player.combo[definition.comboIndex],duration=attackDuration(timing);
    const base=super.pose({gait:'idle',direction:state.direction||'south-east',time:0});
    const seconds=clamp(state.attackTime||0,0,duration),s=sampleAttack(definition,timing,seconds);
    // Exact idle endpoints keep repeated clips and combo links free of pose pops.
    if(seconds===0||seconds===duration)return {...base,attack:definition.id,attackSample:s};
    const m=this.config.model,aimF=base.f,aimR=base.r;
    const f=add(mul(aimF,Math.cos(s.yaw)),mul(aimR,Math.sin(s.yaw))),r=[-f[2],0,f[0]];
    const root=mul(aimF,s.step*0.16),footLocals=[{u:m.hipWidth/2,v:-s.step*.25},{u:-m.hipWidth/2,v:s.step*.65}];
    const ankles=footLocals.map(k=>add(add(mul(aimR,k.u),mul(aimF,k.v)),[0,.065,0]));
    let hipY=m.hipHeight-s.drop;
    const reach=m.upperLeg+m.lowerLeg-.008;
    for(let i=0;i<2;i++){
      const hipXZ=add(root,mul(aimR,(i===0?1:-1)*m.hipWidth/2)),d=Math.hypot(hipXZ[0]-ankles[i][0],hipXZ[2]-ankles[i][2]);
      hipY=Math.min(hipY,.065+Math.sqrt(Math.max(.001,reach*reach-d*d)));
    }
    const local=(u,h,v=0)=>add(root,add(add(mul(r,u),mul(f,v)),[0,h,0]));
    const body=(u,h,v=0)=>add(local(u,h,v),mul(aimF,s.lean*clamp((h-hipY)/.7,0,1)));
    const legs=[1,-1].map((side,i)=>{const hip=add(root,add(mul(aimR,side*m.hipWidth/2),[0,hipY,0])),ankle=ankles[i];return {side,hip,ankle,knee:kneeJoint(hip,ankle,aimF,m.upperLeg,m.lowerLeg),cycle:{forward:0,lift:0,roll:0,contact:true}};});
    const arms=[1,-1].map(side=>{
      const shoulder=body(side*m.shoulderWidth/2,hipY+.315),hand=side===1?s.right:s.left,target=body(hand[0],hipY+hand[1],hand[2]);
      const delta=sub(target,shoulder),distance=Math.hypot(...delta),wrist=add(shoulder,mul(norm(delta),Math.min(distance,m.upperArm+m.lowerArm-.001)));
      // An outward bend gives a readable elbow instead of crossing through the torso.
      const bend=norm(add(mul(r,side),mul(aimF,-.55)));
      return {side,shoulder,wrist,elbow:kneeJoint(shoulder,wrist,bend,m.upperArm,m.lowerArm)};
    });
    const [yaw,elevation]=s.weapon,weaponDirection=norm(add(add(mul(f,Math.cos(yaw)*Math.cos(elevation)),mul(r,Math.sin(yaw)*Math.cos(elevation))),[0,Math.sin(elevation),0]));
    // Fork plane stays perpendicular to the shaft and visible to the camera.
    const camera=norm([1,1.6,1]),weaponAcross=norm([weaponDirection[1]*camera[2]-weaponDirection[2]*camera[1],weaponDirection[2]*camera[0]-weaponDirection[0]*camera[2],weaponDirection[0]*camera[1]-weaponDirection[1]*camera[0]]);
    return {...base,f,r,hipY,local,body,legs,arms,head:body(0,hipY+m.headHeightAboveHip),faceVisible:f[0]+f[2]>-.28,weaponDirection,weaponAcross,phase:seconds/duration,time:seconds,motionWeight:.9,attack:definition.id,attackSample:s};
  }
}
