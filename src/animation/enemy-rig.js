import {footCycle,kneeJoint,DIRECTION_ANGLES} from './f2-rig.js';
import {PixelScene,V,shade} from './pixel-scene.js';
const {add,sub,mul,norm,dot,cross}=V,TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
export function enemyTimeline(id,slice){
 const e=slice.enemies[id];if(!e)throw new Error('Unknown enemy');const primary=e.tell*1000,followup=e.attack==='doubleWave'?primary+e.followupDelay*1000:null;
 const durationMs=e.attack==='doubleWave'?followup+e.recovery*1000:primary+Math.max(e.recovery,e.dashDuration||0)*1000;
 const events=e.attack==='dash'?[{id:'dashStart',timeMs:primary},{id:'dashEnd',timeMs:primary+e.dashDuration*1000}]:[{id:e.attack==='shot'?'projectile':'impact',timeMs:primary},...(followup===null?[]:[{id:'followup',timeMs:followup}])];
 return {tellMs:primary,primaryMs:primary,followupMs:followup,dashEndMs:e.attack==='dash'?primary+e.dashDuration*1000:null,durationMs,events,rootMotionDistanceUnits:e.dashDistance||0,damageWindowMs:e.attack==='dash'?[primary,primary+e.dashDuration*1000]:null};
}
export function enemyFrameSchedule(timeline,step=20){const times=new Set([0,timeline.durationMs,...timeline.events.map(e=>e.timeMs)]);for(let t=step;t<timeline.durationMs;t+=step)times.add(t);const sorted=[...times].sort((a,b)=>a-b);return {timesMs:sorted.slice(0,-1),durationsMs:sorted.slice(1).map((t,i)=>t-sorted[i])};}
const eventTime=(key,t)=>({start:0,primary:t.primaryMs,followup:t.followupMs,end:t.durationMs}[key.event])+key.offsetMs;
function sampleKeys(config,def,timeline,time){const keys=def.attackKeys,t=clamp(time,0,timeline.durationMs);let i=keys.findIndex(k=>eventTime(k,timeline)>=t);if(i<1)i=t<=0?1:keys.length-1;const a={...config.defaults,...keys[i-1]},b={...config.defaults,...keys[i]},u=smooth((t-eventTime(a,timeline))/(eventTime(b,timeline)-eventTime(a,timeline))),s={};for(const k of Object.keys(config.defaults))s[k]=Array.isArray(a[k])?a[k].map((v,j)=>v+(b[k][j]-v)*u):a[k]+(b[k]-a[k])*u;return s;}
export function enemyProjectedStride(config,id,direction){const d=config.enemies.find(e=>e.id===id),a=DIRECTION_ANGLES[direction],[sx,sy]=config.cameraGroundScale,f=norm([Math.cos(a)/(2*sx)+Math.sin(a)/(2*sy),0,-Math.cos(a)/(2*sx)+Math.sin(a)/(2*sy)]);return d.walk.stride*Math.hypot((f[0]-f[2])*sx,(f[0]+f[2])*sy);}

export class EnemyRig {
 constructor(config,slice){this.config=config;this.slice=slice;}
 definition(id){const d=this.config.enemies.find(e=>e.id===id);if(!d)throw new Error('Unknown enemy rig');return d;}
 pose({enemy='guard',direction='south-east',action='move',phase=0,timeMs=0,motionWeight=1}={}){
  const c=this.config,def=this.definition(enemy),m={...c.model,...def.model},angle=DIRECTION_ANGLES[direction];if(angle===undefined)throw new Error('Unknown enemy direction');
  const [sx,sy]=c.cameraGroundScale,aimF=norm([Math.cos(angle)/(2*sx)+Math.sin(angle)/(2*sy),0,-Math.cos(angle)/(2*sx)+Math.sin(angle)/(2*sy)]),aimR=[-aimF[2],0,aimF[0]],q=((phase%1)+1)%1,timeline=enemyTimeline(enemy,this.slice),time=clamp(timeMs,0,timeline.durationMs),attacking=action==='attack'&&time>0&&time<timeline.durationMs,weight=action==='move'?clamp(motionWeight,0,1):0;
  const stage=action!=='attack'?action:time<timeline.primaryMs?'tell':timeline.dashEndMs!==null&&time<timeline.dashEndMs?'dash':timeline.followupMs!==null&&time<timeline.followupMs?'followupTell':time>=timeline.durationMs?'idle':'recovery';
  if(def.kind==='spring_rabbit'){
   let bodyY=.33-Math.cos(q*TAU)*.025*weight,lean=0,earLean=-.025;
   if(attacking){if(time<timeline.primaryMs){const u=smooth(time/timeline.primaryMs);bodyY=.33-u*.13;earLean=-.025-u*.07;lean=-u*.03;}else if(time<timeline.dashEndMs){const u=(time-timeline.primaryMs)/(timeline.dashEndMs-timeline.primaryMs);bodyY=.37+Math.sin(u*Math.PI)*.035;lean=.055;earLean=-.30;}else{const u=smooth((time-timeline.dashEndMs)/(timeline.durationMs-timeline.dashEndMs));bodyY=.22+u*.11;earLean=-.1+u*.075;}}
   const local=(u,h,v=0)=>add(add(mul(aimR,u),mul(aimF,v)),[0,h,0]),legs=[];
   for(const front of [false,true])for(const side of [1,-1]){const baseV=front?.23:-.23,cycle=footCycle(q+(front?.5:0),{...def.walk,stride:def.walk.stride*weight,lift:def.walk.lift*weight});let v=baseV+cycle.forward,h=.065+cycle.lift;if(stage==='dash'){v=front?.44:-.43;h=front?.12:.1;}const top=local(side*(front?.15:.19),bodyY+(front?-.02:0),baseV),ankle=local(side*(front?.17:.21),h,v);legs.push({front,side,top,ankle,cycle});}
   const head=local(0,bodyY+.20,.25+lean);return {def,m,enemy,direction,action,q,weight,f:aimF,r:aimR,aimF,aimR,local,legs,arms:[],head,bodyY,earLean,stage,timeline,timeMs:time,root:[0,0,0]};
  }
  let s={...c.defaults},recoil=0;
  if(attacking&&def.attackKeys)s=sampleKeys(c,def,timeline,time);
  if(attacking&&def.kind==='trumpeter'){recoil=time>=timeline.primaryMs?Math.exp(-(time-timeline.primaryMs)/85):0;s={...s,drop:.015*Math.sin(time/timeline.durationMs*Math.PI),lean:-recoil*.055};}
  const yaw=attacking?s.yaw:Math.sin(q*TAU)*.035*weight,f=add(mul(aimF,Math.cos(yaw)),mul(aimR,Math.sin(yaw))),r=[-f[2],0,f[0]],gait={...def.walk,stride:def.walk.stride*weight,lift:def.walk.lift*weight},cycles=[footCycle(q,gait),footCycle(q+.5,gait)];
  let hipY=m.hipHeight-s.drop-Math.cos(q*TAU*2)*def.walk.bob*weight;const reach=m.upperLeg+m.lowerLeg-.008;
  for(const foot of cycles)hipY=Math.min(hipY,.065+foot.lift+foot.roll*.02+Math.sqrt(Math.max(.001,reach*reach-foot.forward*foot.forward)));
  const local=(u,h,v=0)=>add(add(mul(r,u),mul(f,v)),[0,h,0]),body=(u,h,v=0)=>add(local(u,h,v),mul(aimF,s.lean*clamp((h-hipY)/.7,0,1))),legLocal=(u,h,v=0)=>add(add(mul(aimR,u),mul(aimF,v)),[0,h,0]);
  const legs=[1,-1].map((side,i)=>{const foot=cycles[i],hip=legLocal(side*m.hipWidth/2,hipY),ankle=legLocal(side*m.hipWidth/2,.065+foot.lift+foot.roll*.02,foot.forward);return {side,hip,ankle,knee:kneeJoint(hip,ankle,aimF,m.upperLeg,m.lowerLeg),cycle:foot};});
  const handTargets=def.kind==='trumpeter'?[[.09,.41,.28],[-.09,.41,.28]]:[s.free,s.main];
  const arms=[1,-1].map((side,i)=>{const h=[...handTargets[i]];if(!attacking&&weight&&def.kind!=='trumpeter'){h[2]+=(side===1?-.12:.025)*Math.sin(q*TAU)*weight;}const shoulder=body(side*m.shoulderWidth/2,hipY+.30),target=body(h[0],hipY+h[1],h[2]),delta=sub(target,shoulder),wrist=add(shoulder,mul(norm(delta),Math.min(Math.hypot(...delta),m.upperArm+m.lowerArm-.001)));return {side,shoulder,wrist,elbow:kneeJoint(shoulder,wrist,norm(add(mul(r,side),mul(f,-.4))),m.upperArm,m.lowerArm)};});
  const head=body(0,hipY+m.headAboveHip+(def.kind==='trumpeter'?0:(m.hipHeight-hipY)*.55));
  const [yawW,elevation]=s.weapon,weaponDirection=norm(add(add(mul(f,Math.cos(yawW)*Math.cos(elevation)),mul(r,Math.sin(yawW)*Math.cos(elevation))),[0,Math.sin(elevation),0])),mainHand=arms.find(a=>a.side===-1),weaponTip=add(mainHand.wrist,mul(weaponDirection,def.weaponLength||0));
  const hornMouth=add(head,add(mul(f,.215),[0,-.08,0])),hornBell=add(hornMouth,add(mul(f,.45),[0,-.025,0]));
  return {def,m,enemy,direction,action,q,weight,f,r,aimF,aimR,local,body,hipY,legs,arms,head,stage,timeline,timeMs:time,weaponDirection,weaponTip,weaponGrip:mainHand.wrist,hornMouth,hornBell,recoil,root:[0,0,0]};
 }
 render(ctx,state={},options={}){
  const p=this.pose(state),d=p.def,col=d.colors,c=this.config,scene=new PixelScene(ctx,c,p,options),scale=scene.scale,body=(u,h,v=0)=>p.local(u,p.def.kind==='spring_rabbit'?h:p.hipY+h,v),front=p.f[0]+p.f[2]>-.2;
  if(options.shadow!==false){const at=scene.project([0,0,0]);scene.paint.ellipse(at[0],at[1]+1,(d.kind==='spring_rabbit'?.34:.24)*scale,.075*scale,'#b5ad96');}
  if(d.kind==='spring_rabbit'){
   for(const leg of p.legs){scene.spring(leg.top,leg.ankle,.027,5,col.gold);scene.disk(leg.top,.055,.048,col.gold);const foot=add(leg.ankle,add(mul(p.f,.04),[0,-.018,0]));scene.box(foot,.145,.085,.21,col.uniform);scene.box(add(foot,add(mul(p.f,.025),[0,.035,0])),.13,.055,.18,col.cream);}
   scene.ellipsoid(p.local(0,p.bodyY,-.03),[.25,.20,.34],col.uniform);scene.disk(p.local(0,p.bodyY,-.37),.09,.075,col.cream);
   scene.ellipsoid(p.head,[.24,.22,.235],col.cream,.02);
   for(const side of [-1,1]){const base=add(p.head,add(mul(p.r,side*.13),[0,.17,0])),end=add(base,add(mul(p.f,p.earLean),[0,p.stage==='dash'?.19:.43,0]));scene.spring(base,add(base,[0,.09,0]),.026,3,col.gold);const center=add(base,mul(sub(end,base),.63)),up=norm(sub(end,base)),r=p.r,f=norm(cross(r,up));scene.ellipsoid(center,[.07,.21,.045],col.uniform,.01,{r,up,f});scene.ellipsoid(add(center,mul(p.f,.018)),[.04,.16,.018],'#b96e68',.03,{r,up,f});}
   scene.box(p.local(0,p.bodyY+.12,-.19),.23,.17,.16,col.navy,.01);scene.disk(p.local(.14,p.bodyY+.13,-.20),.04,.04,'#b14d89',.05);
   scene.segment(p.local(-.17,p.bodyY+.14,-.22),p.local(-.17,p.bodyY+.38,-.22),.017,col.gold);for(const side of [-1,1]){const key=p.local(-.17+side*.055,p.bodyY+.40,-.22);scene.disk(key,.045,.035,col.gold);scene.disk(key,.017,.013,'#514736',.03);}
  }else{
   const m=p.m;for(const leg of p.legs){scene.segment(leg.hip,leg.knee,.067,col.wood);scene.segment(leg.knee,leg.ankle,.061,col.wood);scene.disk(leg.knee,.051,.044,col.gold);const foot=add(leg.ankle,add(mul(p.aimF,.03),[0,-.024,0])),pitch=Math.atan2(leg.cycle.roll*.02,m.footLength/2);scene.box(foot,m.footWidth,.09,m.footLength,col.navy,0,pitch);scene.box(add(foot,add(mul(p.f,.025),[0,.04,0])),m.footWidth*.9,.06,m.footLength*.75,shade(col.navy,1.2),0,pitch);}
   scene.box(body(0,.02),.27,.13,.18,col.woodSide);scene.box(body(0,.19),m.torsoWidth,m.torsoHeight,m.torsoDepth,col.uniform);scene.box(body(0,.04),m.torsoWidth*1.08,.045,.25,col.navy,.02);
   for(const arm of p.arms){scene.disk(arm.shoulder,d.kind==='elite_soldier'?.09:.067,.065,col.navy);scene.segment(arm.shoulder,arm.elbow,.061,col.uniform);scene.disk(arm.elbow,.045,.038,col.gold);scene.segment(arm.elbow,arm.wrist,.055,col.wood);scene.disk(arm.wrist,.061,.050,col.woodSide,.02);}
   if(front){const fv=m.torsoDepth/2+.018;scene.plane(body(0,.17,fv),.025,.28,col.cream,.04);for(const h of [.26,.17,.08])for(const side of [-1,1])scene.plane(body(side*.095,h,fv+.015),.025,.024,col.gold,.06);for(const side of [-1,1])scene.segment(body(side*.14,.32,fv),body(-side*.04,.10,fv),.012,col.cream,.05);scene.plane(body(0,.04,fv+.018),.07,.04,col.gold,.06);}
   scene.box(body(0,.22,-.20),.24,.20,.14,col.navy);scene.disk(body(.145,.22,-.21),.047,.05,'#9e487f',.03);scene.disk(body(.148,.22,-.21),.025,.029,p.stage==='tell'||p.stage==='followupTell'?'#ed86c1':'#cd6ba5',.05);scene.segment(body(.12,.32,-.20),body(.17,.25,-.20),.014,'#a5508b',.04);
   scene.ellipsoid(p.head,m.headRadii,col.wood);
   for(const side of [-1,1]){const ear=add(p.head,mul(p.r,side*.24));scene.disk(ear,.038,.050,col.gold);}
   const crown=add(p.head,[0,d.kind==='trumpeter'?.26:.29,0]),hatColor=d.kind==='trumpeter'?col.cream:col.navy;
   scene.cylinder(crown,d.kind==='elite_soldier'?.285:.26,.23,d.kind==='trumpeter'?.18:.29,hatColor);scene.cylinder(add(p.head,[0,.19,0]),.27,.235,.045,col.uniform,.02);scene.box(add(p.head,add(mul(p.f,.19),[0,.165,0])),.43,.025,.17,col.navy,.03);
   if(d.kind==='elite_soldier')scene.box(add(p.head,[0,.50,0]),.055,.12,.07,col.gold);
   if(front){scene.plane(add(crown,add(mul(p.f,.235),[0,.025,0])),.045,.09,col.gold,.04);scene.plane(add(crown,add(mul(p.f,.24),[0,.045,0])),.10,.025,col.gold,.05);}
   if(d.kind==='trumpeter'){
    const middle=body(0,.43,.30);scene.segment(p.hornMouth,middle,.025,col.gold,.08);scene.segment(middle,add(p.hornBell,mul(p.f,-.13)),.034,col.gold,.08);
    const axis=norm(sub(p.hornBell,middle)),r=p.r,up=norm(cross(axis,r)),end=p.hornBell,neck=add(end,mul(axis,-.15)),point=(center,a,rad)=>add(center,add(mul(r,Math.cos(a)*rad),mul(up,Math.sin(a)*rad)));
    for(let i=0;i<14;i++){const a=i/14*TAU,b=(i+1)/14*TAU;scene.polygon([point(neck,a,.034),point(neck,b,.034),point(end,b,.14),point(end,a,.14)],shade(col.gold,.9+Math.sin(a)*.15),.09);}scene.polygon(Array.from({length:14},(_,i)=>point(end,i/14*TAU,.125)),shade(col.gold,.50),.10);scene.polygon(Array.from({length:14},(_,i)=>point(add(end,mul(axis,.005)),i/14*TAU,.092)),shade(col.gold,.32),.12);for(const u of [-.055,0,.055])scene.segment(body(u,.44,.29),body(u,.49,.29),.01,col.gold,.12);
   }else{
    const arm=p.arms.find(a=>a.side===-1);scene.segment(arm.wrist,p.weaponTip,.045,col.woodSide,.03);const collar=add(arm.wrist,mul(p.weaponDirection,.08));scene.disk(collar,.047,.025,col.gold,.04);if(d.kind==='elite_soldier')scene.disk(add(arm.wrist,mul(p.weaponDirection,.30)),.062,.033,col.uniform,.05);
   }
  }
  // Curved wood/cream face with the same factory smile; never mirrored as a whole sprite.
  if(front){const head=p.head,rad=d.kind==='spring_rabbit'?[.24,.22,.235]:p.m.headRadii;
   const pixel=(u,h,w,height,color)=>{const surface=(x,y)=>{const v=rad[2]*Math.sqrt(Math.max(.06,1-(x/rad[0])**2-(y/rad[1])**2))+.01;return add(head,add(add(mul(p.r,x),mul(p.f,v)),[0,y,0]));},v=rad[2]*Math.sqrt(Math.max(.06,1-(u/rad[0])**2-(h/rad[1])**2)),normal=norm(add(add(mul(p.r,u/rad[0]**2),mul(p.f,v/rad[2]**2)),[0,h/rad[1]**2,0]));if(dot(normal,norm([1,1,1]))<.03)return;const vertices=[surface(u-w/2,h+height/2),surface(u+w/2,h+height/2),surface(u+w/2,h-height/2),surface(u-w/2,h-height/2)];scene.queue.push({depth:scene.depth(head)+.9,draw:()=>scene.paint.polygon(vertices.map(v=>scene.project(v)),color)});};
   for(const side of [-1,1]){pixel(side*.075,.035,.032,.10,'#202b28');pixel(side*.142,-.035,.05,.04,'#c6766c');}
   for(let i=0;i<12;i++){const u=(i/11-.5)*.22,h=-.07-Math.sin(i/11*Math.PI)*.025;pixel(u,h,.023,.070,'#36352a');pixel(u,h+.004,.014,.043,'#f1ead6');}
   if(d.kind==='spring_rabbit')pixel(0,-.005,.04,.025,'#b46e61');else for(const u of [-.16,.015,.16])pixel(u,.13,.006,.046,'#bfa16e');
  }
  scene.flush();return p;
 }
 renderEffects(ctx,state={},options={}){
  if(state.action!=='attack')return;const p=this.pose(state),t=p.timeMs,tl=p.timeline,c=this.config,scene=new PixelScene(ctx,c,p,options),project=v=>scene.project(v),paint=scene.paint;
  const line=(a,b,color,width=1)=>{const aa=project(a),bb=project(b);paint.segment(aa,bb,Math.max(.5,width/2),color);},at=(f,u=0,h=.015)=>add(add(mul(p.aimF,f),mul(p.aimR,u)),[0,h,0]);
  const ring=(radius,color,width=1)=>{let previous=null;for(let i=0;i<=40;i++){const a=i/40*TAU,point=at(Math.cos(a)*radius,Math.sin(a)*radius);if(previous)line(previous,point,color,width);previous=point;}};
  if(t<tl.primaryMs){if(p.enemy==='rabbit'){line(at(.08,-.11),at(.80,-.11),'#c68877');line(at(.08,.11),at(.80,.11),'#c68877');line(at(.65,-.11),at(.80,0),'#c68877');line(at(.65,.11),at(.80,0),'#c68877');}else if(p.enemy==='elite')ring(.42,'#c68877');else if(p.enemy==='guard'){let prev=null;for(let i=0;i<16;i++){const a=-.85+i*1.7/15,point=at(Math.cos(a)*.55,Math.sin(a)*.55);if(prev)line(prev,point,'#c68877');prev=point;}}else line(at(.05),at(.75),'#c5a15e');}
  if(p.enemy==='elite'){for(const [event,radius]of [[tl.primaryMs,.43],[tl.followupMs,.60]]){const age=(t-event)/250;if(age>=0&&age<1)ring(radius*(.3+.7*age),age<.5?'#d78078':'#b88e80',2);}if(t>tl.primaryMs+250&&t<tl.followupMs)ring(.55,'#c68877');}
  if(p.enemy==='trumpet'){const age=(t-tl.primaryMs)/200;if(age>=0&&age<1){const start=p.hornBell,end=add(start,mul(p.aimF,.03+age*.18)),v=project(end);paint.ellipse(v[0],v[1],2,2,'#e6bc64');line(start,end,'#f1d696',1);}}
  if(p.enemy==='rabbit'&&p.stage==='dash')for(const side of [-1,1])line(at(-.40,side*.18,.18),at(-.64,side*.18,.18),'#aaa99b');
 }
}
