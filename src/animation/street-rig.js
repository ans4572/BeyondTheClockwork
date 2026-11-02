import {PixelPaint,footCycle,kneeJoint,DIRECTION_ANGLES} from './f2-rig.js';
const TAU=Math.PI*2,add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),norm=a=>mul(a,1/(Math.hypot(...a)||1));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const shade=(hex,k)=>'#'+hex.slice(1).match(/../g).map(v=>clamp(Math.round(parseInt(v,16)*k),0,255).toString(16).padStart(2,'0')).join('');
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
// Hand targets per prop, relative to the hips, so a walking resident's grip never slips.
const FREE_HAND=[-.22,.02,.08],RESIDENT_GRIPS={joined_hands:[[.035,.14,.23],[-.035,.14,.23]],balloon:[[.21,.3,.2],FREE_HAND],lollipop:[[.26,.2,.16],FREE_HAND],bouquet:[[.06,.14,.25],[-.06,.14,.25]],drum:[[.2,.16,.2],[-.2,.16,.2]]};
export function streetProjectedStride(config,direction){const angle=DIRECTION_ANGLES[direction],[sx,sy]=config.cameraGroundScale,f=norm([Math.cos(angle)/(2*sx)+Math.sin(angle)/(2*sy),0,-Math.cos(angle)/(2*sx)+Math.sin(angle)/(2*sy)]);return config.walk.stride*Math.hypot((f[0]-f[2])*sx,(f[0]+f[2])*sy);}

/** Stationary merchant response. Interaction never starts a locomotion state. */
export class MerchantInteraction {
 constructor(config,position={x:0,y:0}){this.config=config;this.position=Object.freeze({...position});this.action='idle';this.elapsedMs=0;}
 interact(){if(this.action==='greeting')return false;this.action='greeting';this.elapsedMs=0;return true;}
 update(dtMs,{paused=false}={}){if(!paused&&this.action==='greeting'){this.elapsedMs=Math.min(this.config.greetingDurationMs,this.elapsedMs+Math.max(0,dtMs));if(this.elapsedMs>=this.config.greetingDurationMs){this.action='idle';this.elapsedMs=0;}}return this.snapshot();}
 snapshot(){return {action:this.action,timeMs:this.elapsedMs,x:this.position.x,y:this.position.y};}
}

export class StreetRig {
 constructor(config){this.config=config;}
 character(id){const c=this.config.characters.find(c=>c.id===id);if(!c)throw new Error('Unknown street character: '+id);return c;}
 pose({character='C1',direction='south-east',action='walk',phase=0,timeMs=0,motionWeight=1}={}){
  const c=this.config,m=c.model,def=this.character(character),angle=DIRECTION_ANGLES[direction];if(angle===undefined)throw new Error('Unknown direction');
  if(def.role==='merchant'&&action==='walk')throw new Error('Bolt is stationary');
  const moving=action==='walk'&&def.role==='resident',q=((phase%1)+1)%1,weight=moving?clamp(motionWeight,0,1):0;
  const aimF=norm([Math.cos(angle)/(2*c.cameraGroundScale[0])+Math.sin(angle)/(2*c.cameraGroundScale[1]),0,-Math.cos(angle)/(2*c.cameraGroundScale[0])+Math.sin(angle)/(2*c.cameraGroundScale[1])]),aimR=[-aimF[2],0,aimF[0]];
  const yaw=Math.sin(q*TAU)*.035*weight,f=add(mul(aimF,Math.cos(yaw)),mul(aimR,Math.sin(yaw))),r=[-f[2],0,f[0]];
  const gait={...c.walk,stride:c.walk.stride*weight,lift:c.walk.lift*weight},cycles=[footCycle(q,gait),footCycle(q+.5,gait)];
  let hipY=m.hipHeight-Math.cos(q*TAU*2)*c.walk.bob*weight;const reach=m.upperLeg+m.lowerLeg-.008;
  for(const foot of cycles)hipY=Math.min(hipY,.065+foot.lift+foot.roll*.022+Math.sqrt(Math.max(.001,reach*reach-foot.forward*foot.forward)));
  const local=(u,h,v=0)=>add(add(mul(r,u),mul(f,v)),[0,h,0]),legLocal=(u,h,v=0)=>add(add(mul(aimR,u),mul(aimF,v)),[0,h,0]);
  const legs=[1,-1].map((side,i)=>{const foot=cycles[i],hip=legLocal(side*m.hipWidth/2,hipY),ankle=legLocal(side*m.hipWidth/2,.065+foot.lift+foot.roll*.022,foot.forward);return {side,hip,ankle,knee:kneeJoint(hip,ankle,aimF,m.upperLeg,m.lowerLeg),cycle:foot};});
  const greeting=def.role==='merchant'&&action==='greeting',t=clamp(timeMs/c.merchant.greetingDurationMs,0,1),envelope=greeting?smooth(t/.2)*smooth((1-t)/.2):0,wave=Math.sin(t*TAU*3)*.045*envelope;
  const handTargets=def.role==='merchant'?[[.245,.12,.15],[-.29-wave,.27+envelope*.28,.18]]:RESIDENT_GRIPS[def.prop]||[[.19,.14,.22],[-.19,.14,.22]];
  const arms=[1,-1].map((side,i)=>{const shoulder=local(side*m.shoulderWidth/2,hipY+.29),h=handTargets[i],target=local(h[0],hipY+h[1],h[2]),delta=sub(target,shoulder),wrist=add(shoulder,mul(norm(delta),Math.min(Math.hypot(...delta),m.upperArm+m.lowerArm-.001)));return {side,shoulder,wrist,elbow:kneeJoint(shoulder,wrist,norm(add(mul(r,side),mul(f,-.4))),m.upperArm,m.lowerArm)};});
  const head=local(0,hipY+m.headAboveHip+(m.hipHeight-hipY)*.65-(greeting?Math.sin(t*Math.PI)*.014:0));
  const propCenter=def.role==='merchant'?local(.26,hipY+.005,.18):local(0,hipY+.12,.29);
  return {def,direction,action,q,f,r,aimF,aimR,local,hipY,head,legs,arms,propCenter,handTargets,greetingWeight:envelope,root:[0,0,0]};
 }
 render(ctx,state={},options={}){
  const c=this.config,m=c.model,p=this.pose(state),d=p.def,col=d.colors,paint=new PixelPaint(ctx),queue=[],scale=options.scale||c.pixelsPerUnit,origin=options.origin||c.origin;
  const project=v=>[origin[0]+(v[0]-v[2])*c.cameraGroundScale[0]*scale,origin[1]+((v[0]+v[2])*c.cameraGroundScale[1]-v[1])*scale],depth=v=>v[0]+v[2]+v[1]*.9;
  const poly=(vertices,color,bias=0)=>{const center=vertices.reduce((a,v)=>add(a,mul(v,1/vertices.length)),[0,0,0]);queue.push({depth:depth(center)+bias,draw:()=>paint.polygon(vertices.map(project),color)});};
  const disk=(center,rx,ry,color,bias=0)=>queue.push({depth:depth(center)+bias,draw:()=>{const v=project(center);paint.ellipse(v[0],v[1],rx*scale,ry*scale,color);}});
  const bone=(a,b,radius,color,bias=0)=>queue.push({depth:(depth(a)+depth(b))/2+bias,draw:()=>{const aa=project(a),bb=project(b);paint.segment(aa,bb,radius*scale+.7,'#3b352b');paint.segment(aa,bb,radius*scale,shade(color,.8));paint.segment([aa[0]-.4,aa[1]-.5],[bb[0]-.4,bb[1]-.5],radius*scale*.6,color);}});
  const box=(center,width,height,length,color,bias=0,pitch=0)=>{const at=(u,h,v)=>add(center,add(add(mul(p.r,u),mul(p.f,v*Math.cos(pitch)+h*Math.sin(pitch))),[0,h*Math.cos(pitch)-v*Math.sin(pitch),0])),vs=[-1,1].flatMap(h=>[-1,1].flatMap(v=>[-1,1].map(u=>at(u*width/2,h*height/2,v*length/2))));for(const [ids,light]of [[[4,5,7,6],1.08],[[0,1,5,4],.68],[[2,3,7,6],1],[[0,2,6,4],.81],[[1,3,7,5],.91]])poly(ids.map(i=>vs[i]),shade(color,light),bias);};
  const plane=(center,w,h,color,bias=0)=>{const at=(u,v)=>add(center,add(mul(p.r,u),[0,v,0]));poly([at(-w/2,h/2),at(w/2,h/2),at(w/2,-h/2),at(-w/2,-h/2)],color,bias);};
  const shell=(center,radii,color,bias=0)=>{const vertex=(lat,lon)=>add(center,[Math.sin(lat)*Math.cos(lon)*radii[0],Math.cos(lat)*radii[1],Math.sin(lat)*Math.sin(lon)*radii[2]]);for(let a=0;a<6;a++)for(let b=0;b<14;b++){const lat=(a+.5)/6*Math.PI,lon=(b+.5)/14*TAU,normal=[Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)];if(dot(normal,norm([1,1.6,1]))<-.04)continue;const light=.94+dot(normal,norm([-.5,1,-.4]))*.1;poly([vertex(a/6*Math.PI,b/14*TAU),vertex((a+1)/6*Math.PI,b/14*TAU),vertex((a+1)/6*Math.PI,(b+1)/14*TAU),vertex(a/6*Math.PI,(b+1)/14*TAU)],shade(color,light),bias);}};
  const body=(u,h,v=0)=>p.local(u,p.hipY+h,v),front=p.f[0]+p.f[2]>-.2;
  if(options.shadow!==false){const v=project([0,0,0]);paint.ellipse(v[0],v[1]+1,.23*scale,.07*scale,'#b8b49e');}
  for(const leg of p.legs){bone(leg.hip,leg.knee,.061,col.legs);bone(leg.knee,leg.ankle,.052,col.cloth);disk(leg.knee,.055,.043,col.metal,.01);const foot=add(leg.ankle,add(mul(p.aimF,.028),[0,-.025,0])),pitch=Math.atan2(leg.cycle.roll*.022,m.footLength/2);box(foot,m.footWidth,.075,m.footLength,'#4c3d2d',0,pitch);box(add(foot,[0,.04,0]),m.footWidth*.95,.075,m.footLength*.92,col.boots,0,pitch);}
  box(body(0,.02),.27,.13,.19,col.legs);box(body(0,.19),m.torsoWidth,m.torsoHeight,m.torsoDepth,col.cloth);
  if(d.body==='dress'||d.body==='coat'){box(body(0,.04),.43,.18,.25,col.accent);if(d.body==='coat')plane(body(0,.04,.136),.055,.18,col.legs,.03);}
  else box(body(0,.19),m.torsoWidth*1.02,m.torsoHeight*.92,m.torsoDepth*1.05,col.accent,.01);
  for(const arm of p.arms){disk(arm.shoulder,.065,.055,col.accent);bone(arm.shoulder,arm.elbow,.057,col.cloth);disk(arm.elbow,.039,.035,col.metal,.01);bone(arm.elbow,arm.wrist,.049,col.cloth);disk(arm.wrist,.057,.046,'#4b3c2d',.03);disk(add(arm.wrist,[0,.008,0]),.047,.038,d.role==='merchant'?'#e7d1aa':col.headSide,.04);if(d.role==='merchant'&&arm.side===-1){for(const u of [-.025,0,.025])bone(add(arm.wrist,mul(p.r,u)),add(arm.wrist,add(mul(p.r,u*1.5),[0,.075,0])),.010,'#e7d1aa',.05);}}
  if(front){
   const faceV=m.torsoDepth/2+.018;
   if(d.body==='apron'){plane(body(0,.13,faceV),.26,.32,col.accent,.03);for(const side of [-1,1])plane(body(side*.095,.29,faceV),.035,.15,col.accent,.04);plane(body(0,-.025,faceV),.31,.035,col.trim,.04);}
   if(d.body==='vest'){plane(body(0,.20,faceV),.045,.31,col.cloth,.03);for(const side of [-1,1])plane(body(side*.04,.30,faceV+.01),.06,.045,col.trim,.05);}
   if(d.body==='jacket'){plane(body(0,.15,faceV),.022,.3,col.trim,.03);for(const h of [.25,.16,.07])plane(body(.04,h,faceV+.01),.022,.022,col.metal,.05);}
   if(d.body==='dress'){plane(body(0,.30,faceV),.25,.075,col.trim,.04);plane(body(0,-.02,.14),.43,.035,col.trim,.04);}
   if(d.body==='coat'){plane(body(0,.19,faceV),.075,.32,col.cloth,.04);for(const side of [-1,1])plane(body(side*.04,.30,faceV+.01),.065,.055,'#638b71',.05);bone(body(.13,.29,faceV+.03),body(-.13,.02,faceV+.03),.018,'#9e673b',.06);plane(body(-.16,.005,faceV+.02),.12,.15,'#974b48',.06);}
   if(d.role==='resident'){plane(body(0,.347,faceV),.11,.035,'#334450',.05);plane(body(0,.347,faceV+.01),.04,.013,'#a9567d',.07);}
  }
  else {plane(body(0,.18,-.12),.2,.22,col.accent,.01);for(const h of [.24,.16,.08])plane(body(0,h,-.13),.13,.008,shade(col.accent,.8),.02);}

  // The prop stays attached to the torso; the hands solve toward its grip points.
  const prop=p.propCenter;
  if(d.prop==='bread_basket'){
   box(prop,.40,.17,.22,'#a67b45',.07);for(let i=0;i<6;i++)plane(add(prop,add(mul(p.r,(i-2.5)*.055),mul(p.f,.118))),.012,.16,'#74522f',.08);for(const h of [-.045,0,.045])plane(add(prop,add(mul(p.f,.12),[0,h,0])),.39,.012,'#d3aa6a',.09);
   for(const [u,v,h,rx]of [[-.105,0,.12,.08],[.02,-.01,.13,.075],[.115,-.015,.15,.055]])shell(add(prop,add(add(mul(p.r,u),mul(p.f,v)),[0,h,0])),[rx,.07,.07],'#d2a05a',.09);disk(add(prop,add(mul(p.f,.045),[0,.17,0])),.027,.015,'#b35562',.12);
  }
  if(d.prop==='parcel'){box(prop,.34,.23,.22,'#e8d6ad',.07);plane(add(prop,mul(p.f,.12)),.028,.23,'#a47d50',.09);box(add(prop,[0,.12,0]),.34,.012,.025,'#a47d50',.10);plane(add(prop,add(mul(p.r,.075),mul(p.f,.123))),.10,.07,'#d8cbaa',.10);for(const h of [-.005,-.022])plane(add(prop,add(add(mul(p.r,.075),mul(p.f,.13)),[0,h,0])),.065,.007,'#8d927f',.11);disk(add(prop,add(add(mul(p.r,-.09),mul(p.f,.13)),[0,.06,0])),.035,.033,'#ae6760',.12);}
  if(d.prop==='bunting'){bone(add(prop,mul(p.r,-.23)),add(prop,mul(p.r,.23)),.017,'#8c6642',.08);for(let i=0;i<4;i++){const u=(i-1.5)*.115,at=(a,h)=>add(prop,add(add(mul(p.r,u+a),mul(p.f,.035)),[0,h,0]));poly([at(-.052,0),at(.052,0),at(0,-.19)],['#b97064','#90b5a5','#e5d8b9','#b97064'][i],.10);bone(at(-.03,-.015),at(0,-.14),.004,'#e8debc',.11);}}
  if(d.prop==='parts_case'){
   box(prop,.31,.23,.24,'#82572f',.07);box(add(prop,[0,.125,0]),.32,.025,.25,'#b08a4e',.08);
   for(const side of [-1,1])plane(add(prop,add(mul(p.r,side*.125),mul(p.f,.132))),.025,.23,col.metal,.10);
   for(const [u,v]of [[-.08,-.05],[.04,-.055],[.09,.035]]){const center=add(prop,add(add(mul(p.r,u),mul(p.f,v)),[0,.16,0]));disk(center,.04,.024,'#454d4c',.10);disk(add(center,[0,.003,0]),.018,.011,'#b2b1a0',.12);}
   bone(add(prop,add(mul(p.r,-.05),[0,.16,0])),add(prop,add(mul(p.r,.05),[0,.16,0])),.012,'#684b2d',.14);
  }

  if(d.prop==='balloon'){
   const top=p.local(.3,p.hipY+.68,.1),ball=add(top,[0,.14,0]),color=col.prop||col.accent;bone(p.arms[0].wrist,top,.006,'#7c7364',.12);disk(top,.03,.025,shade(color,.75),.13);shell(ball,[.15,.17,.15],color,.14);
   if(front){const face=(u,h)=>add(ball,add(add(mul(p.r,u),mul(p.f,.145)),[0,h,0]));for(const side of [-1,1])disk(face(side*.06,.035),.012,.024,'#3b3d31',.3);for(let i=0;i<=4;i++)disk(face((i/4-.5)*.11,-.035-Math.sin(i/4*Math.PI)*.02),.009,.008,'#3b3d31',.3);}
  }
  if(d.prop==='lollipop'){
   const grip=p.arms[0].wrist,tip=add(grip,add(mul(p.r,.1),[0,.4,0])),candy=add(tip,[0,.11,0]),color=col.prop||col.accent;bone(grip,tip,.012,'#e8debc',.1);
   for(const [i,[radius,ring]]of [[.165,'#5f5140'],[.15,color],[.105,'#f4ead4'],[.07,color],[.03,'#f4ead4']].entries())disk(candy,radius,radius,ring,.12+i*.01);
  }
  if(d.prop==='bouquet'){
   const at=(u,h)=>add(prop,add(add(mul(p.r,u),mul(p.f,.05)),[0,h,0]));for(const [u,h]of [[-.13,.2],[.13,.2],[0,.27]])disk(at(u,h),.05,.04,'#6f9a72',.08);
   for(const [u,h,color]of [[-.09,.15,col.prop||'#d08b96'],[.09,.15,'#e8c15c'],[0,.2,'#f1e5cd'],[-.05,.25,'#b97064'],[.06,.25,col.prop||'#d08b96']]){disk(at(u,h),.06,.055,color,.09);disk(at(u,h),.02,.018,'#e8c15c',.1);}
   poly([at(-.13,.13),at(.13,.13),at(0,-.15)],col.trim,.12);poly([at(-.13,.13),at(0,.05),at(0,-.15)],shade(col.trim,.88),.13);
  }
  if(d.prop==='drum'){
   const center=add(prop,[0,-.1,.02]),color=col.prop||col.accent;for(const [i,h]of [-.1,-.06,-.02,.02,.06].entries())disk(add(center,[0,h,0]),.2,.11,i%4?color:col.metal,.07+i*.005);
   disk(add(center,[0,.09,0]),.2,.11,col.metal,.1);disk(add(center,[0,.1,0]),.175,.095,'#f1e5cd',.11);for(const [i,arm]of p.arms.entries())bone(arm.wrist,add(center,add(mul(p.r,(i?-1:1)*.06),[0,.11,0])),.01,'#9e673b',.12);
  }

  const head=p.head,radii=m.headRadii;
  if(d.headShape==='box')box(head,.50,.45,.42,'#42392c',-.35);
  else {const v=project(head);queue.push({depth:depth(head)-.35,draw:()=>paint.ellipse(v[0],v[1],radii[0]*1.225*scale+.8,radii[1]*1.19*scale+.8,'#42392c')});}
  if(d.hat==='hood')shell(head,radii.map(v=>v*1.10),col.accent);
  else if(d.headShape==='box')box(head,.48,.43,.40,col.headSide);
  else shell(head,radii,col.head);
  // Buttons/ears stay on their anatomical sides as the character turns.
  for(const side of [-1,1]){const ear=add(head,mul(p.r,side*.25));disk(ear,.043,.054,col.headSide,.015);disk(add(ear,mul(p.r,side*.006)),.030,.041,col.metal,.025);}
  if(d.headShape==='box')for(const side of [-1,1])for(const h of [-.15,.15])disk(add(head,add(add(mul(p.r,side*.19),mul(p.f,.21)),[0,h,0])),.012,.012,col.metal,.03);
  const hatAt=(u,h,v=0)=>add(head,add(add(mul(p.r,u),mul(p.f,v)),[0,h,0]));
  if(d.hat==='chef'){const crown=hatAt(0,.34);const v=project(crown);queue.push({depth:depth(crown)-.18,draw:()=>paint.ellipse(v[0],v[1],.30*scale,.13*scale,'#6e6046')});box(hatAt(0,.245),.50,.075,.42,col.accent,.02);for(const [u,v,h]of [[-.14,0,.34],[0,0,.37],[.14,0,.34],[0,-.09,.34]])shell(hatAt(u,h,v),[.13,.09,.15],col.trim,.03);}
  if(d.hat==='courier'||d.hat==='merchant'){
   const hatColor=d.hat==='courier'?col.trim:col.trim;box(hatAt(0,.235),.52,.065,.43,shade(hatColor,.8),.02);shell(hatAt(0,.285,-.015),[.25,.09,.21],hatColor,.03);box(hatAt(0,.225,.19),.48,.03,.20,shade(hatColor,.73),.04);if(front)plane(hatAt(0,.29,.215),.10,.06,col.metal,.06);
   if(d.hat==='merchant')for(const u of [-.12,0,.12])bone(hatAt(u,.29,.16),hatAt(u*.65,.35,.02),.006,'#e5c49a',.07);
  }
  if(d.hat==='tophat'){box(hatAt(0,.235),.52,.035,.46,col.trim,.03);box(hatAt(0,.40),.31,.30,.29,col.trim,.04);box(hatAt(0,.285),.32,.06,.30,col.accent,.05);}
  if(d.hat==='straw'){disk(hatAt(0,.235),.40,.15,'#d9bd7a',.9);disk(hatAt(0,.25),.215,.085,col.trim,.91);shell(hatAt(0,.285),[.2,.11,.2],'#e3cb8d',.92);}
  if(d.hat==='party'){const apex=hatAt(0,.6),base=a=>hatAt(Math.cos(a)*.21,.2,Math.sin(a)*.21);for(let i=0;i<8;i++)poly([base(i/8*TAU),base((i+1)/8*TAU),apex],i%2?col.trim:col.accent,.03);disk(apex,.06,.055,col.metal,.1);}
  if(d.hat==='beret'){shell(hatAt(.03,.255),[.30,.09,.27],col.trim,.03);disk(hatAt(.03,.345),.022,.02,shade(col.trim,.75),.05);}
  if(d.hat==='paper'){const a=hatAt(-.28,.21,.21),b=hatAt(.28,.21,.21),top=hatAt(-.06,.40,.01),back=hatAt(.26,.24,-.22);poly([a,b,top],col.trim,.03);poly([b,back,top],shade(col.trim,.8),.03);poly([a,hatAt(-.25,.25,-.20),top],shade(col.trim,.9),.03);}
  if(d.hat==='hood'){const knot=hatAt(.20,-.08,-.14);disk(knot,.065,.05,shade(col.accent,.8),.04);bone(knot,hatAt(.24,-.28,-.18),.04,col.accent,.03);bone(knot,hatAt(.12,-.27,-.22),.035,shade(col.accent,.9),.03);}
  if(d.role==='merchant'){const key=hatAt(.17,.05,-.28);bone(key,add(key,[0,.17,0]),.02,col.metal);for(const side of [-1,1]){const center=add(key,add(mul(p.r,side*.06),[0,.19,0]));disk(center,.043,.037,col.metal,.02);disk(center,.017,.015,'#5e5340',.03);}}

  if(front){
   const curved=d.headShape!=='box',faceWidth=.40,faceHeight=.35,facePixel=(u,h,w,height,color)=>{
    const surface=(x,y)=>{const fwd=curved?radii[2]*Math.sqrt(Math.max(.05,1-(x/radii[0])**2-(y/radii[1])**2))+.012:.211;return add(head,add(add(mul(p.r,x),mul(p.f,fwd)),[0,y,0]));};
    const center=surface(u,h),normal=curved?norm(add(add(mul(p.r,u/radii[0]**2),mul(p.f,Math.sqrt(Math.max(.05,1-(u/radii[0])**2-(h/radii[1])**2))/radii[2])),[0,h/radii[1]**2,0])):p.f;if(dot(normal,norm([1,1,1]))<.03)return;
    const vs=[surface(u-w/2,h+height/2),surface(u+w/2,h+height/2),surface(u+w/2,h-height/2),surface(u-w/2,h-height/2)];queue.push({depth:depth(head)+.8,draw:()=>paint.polygon(vs.map(project),color)});
   };
   // Cream face mask, then painted/button eyes and the same small fixed smile.
   for(let y=0;y<18;y++)for(let x=0;x<20;x++){const u=(x/19-.5)*faceWidth,h=(.5-y/17)*faceHeight;if(d.hat==='hood'&&((u/.215)**2+(h/.20)**2)>1)continue;facePixel(u,h,.023,.023,col.head);}
   for(const side of [-1,1]){
    const eyeU=side*.082;
    if(d.face==='clock'){for(let i=0;i<16;i++){const a=i/16*TAU;facePixel(eyeU+Math.cos(a)*.056,.025+Math.sin(a)*.067,.022,.022,col.metal);}facePixel(eyeU,.025,.065,.083,'#33554e');facePixel(eyeU,.025,.038,.055,'#242e2b');facePixel(eyeU-.012,.045,.014,.019,'#f1e6c3');}
    else if(d.face==='buttons'){for(let i=0;i<12;i++){const a=i/12*TAU;facePixel(eyeU+Math.cos(a)*.032,.025+Math.sin(a)*.037,.024,.024,'#554f45');}for(const k of [-1,0,1]){facePixel(eyeU+k*.013,.025+k*.014,.011,.011,'#d9c8a6');facePixel(eyeU+k*.013,.025-k*.014,.011,.011,'#d9c8a6');}}
    else facePixel(eyeU,.028,.035,.10,'#353a32');
    facePixel(side*.147,-.065,.054,.045,'#c87e75');
   }
   for(let i=0;i<=9;i++){const u=(i/9-.5)*.13,h=-.09-Math.sin(i/9*Math.PI)*.024;facePixel(u,h,.018,.014,'#3b3d31');}
   if(d.headShape==='box'&&!d.tin)for(const u of [-.16,.0,.15])facePixel(u,.13,.006,.055,'#c2a573');
   if(d.hat==='hood')for(let i=0;i<11;i++){const a=i/10*Math.PI;facePixel(Math.cos(a)*.20,Math.sin(a)*.18,.022,.012,col.trim);}
  }
  queue.sort((a,b)=>a.depth-b.depth);for(const item of queue)item.draw();return p;
 }
}
