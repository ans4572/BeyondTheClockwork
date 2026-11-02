import {F2StateRig} from './f2-states.js';
import {DIRECTION_ANGLES,PixelPaint} from './f2-rig.js';
import {crosscutSegment,clampCorners} from '../engine/fusion-geometry.js';
const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,n)=>a.map(v=>v*n);

/** Gameplay timestamps remain relative to cast start; the lead-in is preview art only. */
export function fusionTimeline(id,data,combat,slice){
 const def=data.fusions.find(f=>f.id===id),skill=combat.fusions.find(f=>f.id===id),behavior=slice.fusionBehavior[id];
 if(!def||!skill||!behavior)throw Error('Unknown fusion: '+id);
 const releaseMs=data.previewLeadInMs,gameplayPulsesMs=Array.from({length:skill.hits},(_,i)=>Math.round((behavior.delay+i*behavior.interval)*1000));
 const pulsesMs=gameplayPulsesMs.map(t=>releaseMs+t),lastPulseMs=pulsesMs.at(-1),bodyReadyMs=def.bodyReadyMs||lastPulseMs+def.bodyAfterLastPulseMs;
 const activeEndMs=lastPulseMs+def.pulseVisualMs,visualEndMs=activeEndMs+def.fadeMs,durationMs=Math.max(bodyReadyMs,visualEndMs);
 return {id,def,skill,behavior,releaseMs,pulsesMs,gameplayPulsesMs,lastPulseMs,bodyReadyMs,activeEndMs,visualEndMs,durationMs};
}

export function fusionFrameSchedule(durationMs,dt,eventTimes=[]){
 const timesMs=[...new Set([0,...Array.from({length:Math.ceil(durationMs/dt)},(_,i)=>i*dt),...eventTimes].filter(t=>t>=0&&t<durationMs))].sort((a,b)=>a-b);
 return {timesMs,durationsMs:timesMs.map((t,i)=>(timesMs[i+1]??durationMs)-t)};
}

function motionDefinition(tl){
 const d=tl.bodyReadyMs,release=tl.releaseMs/d,hold=Math.max(release+.03,(d-200)/d),lower=tl.def.pose==='contract',scoop=tl.def.pose==='scoop';
 const left=lower?[-.17,.09,.31]:[-.18,.32,.33];
 const def={id:tl.id,category:'skill',castHand:'left',usesWeapon:false,durationMs:d,endBehavior:'idle',events:{release:tl.releaseMs},keys:[
  {t:0},
  {t:release*.55,drop:.025,yaw:scoop?-.14:.07,lean:-.025,left:[-.19,scoop?.07:.18,.06],right:[.23,-.02,-.01],weapon:[.25,-1.35]},
  {t:release,drop:.035,lean:.035,yaw:scoop?.04:-.04,left,right:[.23,-.01,-.015],weapon:[.3,-1.32]},
  {t:Math.min(hold,release+.12),drop:.02,lean:.018,yaw:-.02,left:[left[0],left[1]-.015,left[2]-.02],right:[.23,-.01,-.015],weapon:[.3,-1.32]},
  {t:hold,drop:.012,lean:.012,left:[left[0],left[1]-.025,left[2]-.03],right:[.23,-.015,-.01],weapon:[.25,-1.35]},
  {t:1}
 ]};
 if(tl.def.pose==='crosscut')def.keys=[{t:0},{t:release*.55,drop:.025,yaw:-.12,left:[-.18,.18,.08]},{t:release,drop:.02,yaw:-.09,left:[-.18,.32,.3],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:tl.pulsesMs[0]/d,drop:.025,yaw:.04,lean:.035,left:[-.16,.31,.37],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:.66,drop:.02,yaw:.04,lean:.02,left:[-.16,.3,.36],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:.85,drop:.01,left:[-.22,.18,.15]},{t:1}];
 if(tl.def.pose==='orb')def.keys=[{t:0},{t:release*.55,drop:.03,lean:-.02,left:[-.17,.1,.1]},{t:release,drop:.02,left:[-.16,.35,.25],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:.5,drop:.015,lean:.02,left:[-.2,.3,.34],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:.75,drop:.008,left:[-.2,.15,.15]},{t:1}];
 if(tl.def.pose==='clamp')def.keys=[{t:0},{t:release*.5,drop:.025,yaw:-.08,left:[-.19,.14,.08]},{t:release,drop:.02,yaw:-.03,left:[-.19,.31,.32],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:.6,drop:.018,left:[-.18,.3,.33],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:tl.pulsesMs[0]/d,drop:.03,yaw:.06,lean:.035,left:[-.14,.26,.37],right:[.23,-.01,-.015],weapon:[.3,-1.32]},{t:.91,drop:.012,left:[-.2,.15,.16]},{t:1}];
 return def;
}

/** Visual effects use engine x/y units. No damage, pulls, movement or cooldown changes. */
export function fusionEffectState(tl,timeMs,{origin={x:0,y:0},target={x:4,y:0},angle=0}={}){
 const t=Math.max(0,timeMs),age=Math.max(0,t-tl.releaseMs)/1000,b=tl.behavior;
 const first=tl.pulsesMs[0],pulseIndex=tl.pulsesMs.findLastIndex(ms=>t>=ms),since=pulseIndex<0?Infinity:t-tl.pulsesMs[pulseIndex];
 const pulseActive=since<tl.def.pulseVisualMs&&t<tl.activeEndMs;
 let center={...origin};
 if(['target','orb','clamp'].includes(b.shape)){
  const dx=target.x-origin.x,dy=target.y-origin.y,length=Math.hypot(dx,dy),distance=Math.min(b.range,length);
  center={x:origin.x+(length?dx/length:0)*distance,y:origin.y+(length?dy/length:0)*distance};
 }
 if(b.shape==='moving'){const distance=(b.startDistance||0)+b.speed*Math.min(age,Math.max(0,(tl.lastPulseMs-tl.releaseMs)/1000));center={x:origin.x+Math.cos(angle)*distance,y:origin.y+Math.sin(angle)*distance};}
 const phase=t>=tl.visualEndMs?'ended':t<tl.releaseMs?'prepare':t<first?'tell':t<tl.activeEndMs?'active':'fade';
 return {phase,center,angle,radius:tl.skill.radius,range:b.range||0,arc:b.arc||0,age,pulseIndex,pulseActive,pulseProgress:pulseActive?since/tl.def.pulseVisualMs:1,fade:phase==='fade'?clamp((t-tl.activeEndMs)/tl.def.fadeMs):phase==='ended'?1:0,
  cuts:b.shape==='crosscut'?tl.pulsesMs.map((ms,i)=>({...crosscutSegment(origin,angle,b,i),index:i,ageMs:t-ms})):[],
  jawGrowth:b.shape==='clamp'?clamp((t-tl.releaseMs)/b.riseMs):0,
  jawGap:b.shape==='clamp'?b.jawOpenDistance+(b.jawClosedDistance-b.jawOpenDistance)*clamp((t-(first-b.closeMs))/b.closeMs):0,
  footprint:b.shape==='clamp'?clampCorners(center,angle,b):null,
  hitsEmitted:tl.pulsesMs.filter(ms=>t>=ms).length};
}

// Same inverse projection used by F2Rig: screen-facing direction, world units preserved.
export function fusionBasis(direction){const a=DIRECTION_ANGLES[direction],raw=[Math.cos(a)/1.7320508+Math.sin(a),0,-Math.cos(a)/1.7320508+Math.sin(a)],n=Math.hypot(...raw),f=raw.map(v=>v/n);return {f,r:[-f[2],0,f[0]]};}
export function fusionEffectAnchor(tl,direction,data){
 const {f}=fusionBasis(direction),distance=['target','orb','clamp'].includes(tl.behavior.shape)?data.previewTargetDistance:tl.behavior.shape==='moving'?(tl.behavior.startDistance||0)+tl.behavior.speed*(tl.lastPulseMs-tl.releaseMs)/1000:['cone','crosscut'].includes(tl.behavior.shape)?tl.behavior.range*.45:0;
 const p=mul(f,distance*.5),scale=data.effectPixelsPerUnit;
 return [Math.round(data.effectBaseOrigin[0]-(p[0]-p[2])*.8660254*scale),Math.round(data.effectBaseOrigin[1]-(p[0]+p[2])*.5*scale)];
}

export class F2FusionRig extends F2StateRig{
 constructor(config,face,states,data,combat,slice){
  const timelines=data.fusions.map(d=>fusionTimeline(d.id,data,combat,slice));
  super(config,face,{defaults:states.defaults,states:timelines.map(motionDefinition)},combat);
  this.fusionData=data;this.timelines=timelines;
 }
 timeline(id){const tl=this.timelines.find(t=>t.id===id);if(!tl)throw Error('Unknown fusion '+id);return tl;}
 // A tall upright pair of crescents stays legible in every facing.
 // Both crescents share one palm emission, progress and crossing point.
 crosscutBladePoints(direction,index,progress){
  const tl=this.timeline('frostCrosscut'),{f}=fusionBasis(direction),q=clamp(progress),growth=clamp(q/.28);
  const hand=this.pose({action:tl.id,direction,timeMs:tl.pulsesMs[0]}).castOrigin;
  const center=add(hand,add(mul(f,(tl.behavior.range-tl.behavior.startDistance)*q),[0,tl.def.bladeLift*growth,0]));
  const horizontal=[.57735027,0,-.57735027],side=index===0?1:-1;
  return Array.from({length:33},(_,j)=>{const v=j/16-1;return add(center,add(mul(horizontal,v*tl.def.bladeHalfWidth*growth),[0,(side*v*tl.def.bladeHalfHeight+tl.def.bladeBow*(1-v*v))*growth,0]));});
 }
 effectState(state){const tl=this.timeline(state.action),{f}=fusionBasis(state.direction||'south-east'),distance=this.fusionData.previewTargetDistance;return fusionEffectState(tl,state.timeMs,{angle:0,target:{x:distance,y:0}});}
 renderFusionEffects(ctx,state,{layer='all',origin,scale}={}){
  const tl=this.timeline(state.action),data=this.fusionData,direction=state.direction||'south-east',time=state.timeMs||0;
  const fx=this.effectState(state);if(fx.phase==='ended')return;
  ctx.save();ctx.globalAlpha*=1-fx.fade;
  const {f,r}=fusionBasis(direction),anchor=origin||fusionEffectAnchor(tl,direction,data),ppu=scale||data.effectPixelsPerUnit;
  const project=p=>[anchor[0]+(p[0]-p[2])*.8660254*ppu,anchor[1]+((p[0]+p[2])*.5-p[1])*ppu];
  const paint=new PixelPaint(ctx);
  const polygon=(points,color,alpha=1)=>{ctx.save();ctx.globalAlpha*=alpha;paint.polygon(points.map(project),color);ctx.restore();};
  const cloud=(p,rx,ry,color,alpha=1)=>{ctx.save();ctx.globalAlpha*=alpha;const [x,y]=project(p);paint.ellipse(x,y,rx*ppu,ry*ppu,color);ctx.restore();};
  const pixel=(p,color,size=1)=>{const [x,y]=project(p);ctx.fillStyle=color;ctx.fillRect(Math.round(x)-Math.floor(size/2),Math.round(y)-Math.floor(size/2),size,size);};
  const line=(a,b,color,width=1)=>{const count=Math.max(1,Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))*ppu*1.5));for(let j=0;j<=count;j++)pixel(a.map((v,i)=>v+(b[i]-v)*j/count),color,width);};
  const at=(forward,side=0,height=0)=>add(add(mul(f,forward),mul(r,side)),[0,height,0]);
  const c=at(fx.center.x,fx.center.y,.025),fade=fx.fade;
  const drawBack=layer!=='front',drawFront=layer!=='back',active=fx.phase==='active',tell=fx.phase==='prepare'||fx.phase==='tell';
  const ring=(center,radius,color,width=1,phase=0,arc=TAU)=>{let last;const n=Math.max(24,Math.ceil(Math.abs(radius)*ppu*3));for(let i=0;i<=n;i++){const a=phase+i/n*arc,p=add(center,at(Math.cos(a)*radius,Math.sin(a)*radius));if(last)line(last,p,color,width);last=p;}};
  const crystal=(p,height,width,color)=>polygon([add(p,mul(r,-width)),add(p,[0,height,0]),add(p,mul(r,width)),add(p,[0,-height*.15,0])],color);
  const spark=(p,color,size=1)=>{pixel(p,color,size);line(add(p,at(-.07,0)),add(p,at(.07,0)),color);line(add(p,at(0,-.07)),add(p,at(0,.07)),color);};
  if(tl.id==='frostCrosscut'){
   for(const cut of fx.cuts){const q=clamp(cut.ageMs/tl.def.pulseVisualMs),visible=cut.ageMs>=0&&cut.ageMs<tl.def.pulseVisualMs+80;
    if(drawFront&&visible){ctx.save();ctx.globalAlpha*=1-clamp((cut.ageMs-tl.def.pulseVisualMs)/80);
     const blade=this.crosscutBladePoints(direction,cut.index,q);
     for(let echo=3;echo>=0;echo--){const ghost=echo?this.crosscutBladePoints(direction,cut.index,Math.max(0,q-echo*.045)):blade;for(let j=1;j<ghost.length;j++){const a=ghost[j-1],b=ghost[j];if(echo)polygon([a,b,add(b,mul(f,-.12)),add(a,mul(f,-.12))],'#a6d8d9',.24/echo);else{polygon([a,b,add(b,mul(f,-.12)),add(a,mul(f,-.12))],'#74c4e4');line(a,b,'#579fca',3);line(a,b,'#edfff8',1);}}}
     if(q>.2&&q<1)for(let j=0;j<4;j++){const p=blade[(j*9+cut.index*4)%blade.length];crystal(add(p,at(Math.sin(j*3)*.2,0,.08)),.13,.04,'#b8e7f2');}
     ctx.restore();
    }
   }
  }
  if(tl.id==='stormFloat'){
   const charge=clamp((time-tl.releaseMs)/(tl.pulsesMs[0]-tl.releaseMs)),q=fx.pulseProgress,height=tl.behavior.hoverHeight,bob=tell?Math.sin(time*.006)*.05:0,center=add(c,[0,height+bob,0]);
   if(drawBack){for(let j=0;j<12;j++)ring(c,fx.radius,tell?'#c3d0aa':'#a9c7a9',1,j/12*TAU,.22);cloud(c,.32,.1,'#bdc6a9',.6);if(fx.pulseActive)ring(c,fx.radius*(.2+q*.8),'#dfcf76',2);}
   if(drawFront&&tell){const radius=.28+charge*.48;cloud(center,radius*.48,radius*.4,'#e8d378',.7);for(let band=-1;band<=1;band++){let previous;for(let j=0;j<=60;j++){const a=j/60*TAU+time*.004+band*.9,p=add(center,at(Math.cos(a)*radius,Math.sin(a)*radius*.35,band*.12+Math.sin(a)*radius*.85));if(previous&&j%13!==0){line(previous,p,band===0?'#8fb7a3':'#c4ddbd',2);}previous=p;}}for(let j=0;j<6;j++){const a=j*1.7+time*.009,p=add(center,at(Math.cos(a)*radius*.6,Math.sin(a)*radius*.5,Math.sin(a*2)*.2)),end=add(center,at(Math.cos(a+.8)*radius*.5,Math.sin(a+.8)*radius*.3,.1));line(p,add(p,at(.08,-.06,.07)),'#f4d469',2);line(add(p,at(.08,-.06,.07)),end,'#f8e7a4');}}
   if(drawFront&&!tell){for(let j=0;j<12;j++){const a=j/12*TAU+q*.3,radius=.55+q*1.6,p=add(center,at(Math.cos(a)*radius,Math.sin(a)*radius*.7,Math.sin(a*2)*.35));if(j%2===0){ring(p,.25*(1-q*.3),'#a8cdb5',2,a,1.8);}else{const end=add(p,at(Math.cos(a)*.5,Math.sin(a)*.4,.18)),mid=add(p,at(-.1,.1,.08));line(p,mid,'#f5d66f',2);line(mid,end,'#efe1a5');}}}
  }
  if(drawFront&&tell&&time<tl.bodyReadyMs){const p=this.pose({action:state.action,direction,timeMs:Math.min(time,tl.bodyReadyMs-1)});if(p.castOrigin){for(let j=0;j<5;j++){const a=j/5*TAU+time*.007;pixel(add(p.castOrigin,at(Math.cos(a)*.12,Math.sin(a)*.12,.02)),['steamShatter','fireCyclone','arcFurnace'].includes(tl.id)?'#edac62':'#a9dce2',1);}}}
  if(tl.id==='steamShatter'){
   if(drawBack){if(tell)for(let j=0;j<8;j++)ring(c,fx.radius,'#d9bb8b',1,j/8*TAU,.35);else if(fx.pulseActive){const q=fx.pulseProgress,radius=fx.radius*(.18+q*.82);for(let j=0;j<12;j++)ring(c,radius,j%2?'#a3deef':'#ed9850',q<.65?2:1,j/12*TAU,.38);}else if(fade)ring(c,fx.radius*(1+fade*.04),'#d2d2bd',1);}
   if(drawFront&&!tell)for(let j=0;j<24*(1-fade);j++){const a=j*2.4+fx.pulseIndex*.27,q=fx.pulseProgress,radius=fx.radius*(.35+.6*((j*.13+q)%1)),h=.1+Math.sin(j+time*.01)**2*.55,p=add(c,at(Math.cos(a)*radius,Math.sin(a)*radius,h));if(j%3===0){cloud(p,.17+q*.15,.12+q*.15,'#eeeadd',.8);cloud(add(p,[0,.12,0]),.12,.1,'#f7f3df',.8);}else if(j%2)crystal(p,.2+Math.sin(j)**2*.2,.06,'#a9dff0');else if(fx.pulseActive){crystal(p,.3*(1-q)+.08,.1,'#ed9850');crystal(p,.18*(1-q),.045,'#f8dda0');}else pixel(p,'#d8cbb1',1);}
  }
  if(tl.id==='arcFurnace'){
   if(drawBack){ring(c,fx.radius*(tell?.4:.75),'#ce9e56',1);if(fx.pulseActive){ring(c,fx.radius*(.35+fx.pulseProgress*.65),'#f3bb55',2);ring(c,fx.radius*(.25+fx.pulseProgress*.5),'#f9e5a5',1);}for(const a of [0,Math.PI/2])line(add(c,at(Math.cos(a)*.3,Math.sin(a)*.3)),add(c,at(-Math.cos(a)*.3,-Math.sin(a)*.3)),'#d3b16c');}
   if(drawFront&&active&&fx.pulseActive){const q=fx.pulseProgress;for(let j=0;j<11;j++){const a=j/11*TAU,base=add(c,at(Math.cos(a)*fx.radius*.5,Math.sin(a)*fx.radius*.5));crystal(base,(.8+Math.sin(j*2)**2*.8)*(1-q*.75),.24,'#ee8c3c');crystal(add(base,[0,.1,0]),(.6+Math.sin(j*2)**2*.7)*(1-q*.8),.12,'#f4c260');cloud(base,.25,.12,'#f4ba5c',.6);}for(let j=0;j<8;j++){const a=j/8*TAU,base=add(c,at(Math.cos(a)*fx.radius*.65,Math.sin(a)*fx.radius*.65));let last=base;for(let k=1;k<=5;k++){const p=add(base,at(Math.sin(j+k*2+fx.pulseIndex)*.12,Math.cos(k*2)*.08,k*.3*(1-q*.5)));line(last,p,k%2?'#fff0b1':'#f4c453',k<3?2:1);last=p;}}}
   if(drawFront&&fade)for(let j=0;j<10*(1-fade);j++)pixel(add(c,at(Math.sin(j*2)*fx.radius*.7,Math.cos(j*3)*fx.radius*.7,.2+fade*.5)),'#d8c397');
  }
  if(tl.id==='fireCyclone'){
   const strength=tell?clamp(time/tl.releaseMs)*.2:1-fade;
   if(drawBack){ring(c,fx.radius*.72*strength,'#b8c5a0',1);for(let j=0;j<6;j++){const a=j/6*TAU+fx.age*3;line(add(c,at(Math.cos(a)*fx.radius*.9,Math.sin(a)*fx.radius*.9)),add(c,at(Math.cos(a+.3)*fx.radius*.55,Math.sin(a+.3)*fx.radius*.55)),'#b5c29c');}}
   if(drawFront)for(let band=0;band<5;band++){let last;for(let j=0;j<=46;j++){const u=j/46,a=u*TAU+fx.age*9+band*.9,radius=(.45+band*.29)*strength*(1+fade*.4),p=add(c,at(Math.cos(a)*radius,Math.sin(a)*radius,band*.43+.12));if(last&&j%8!==0){polygon([last,p,add(p,[0,.16*strength,0]),add(last,[0,.16*strength,0])],(j+band)%4?'#ec9840':'#f8d985',.9);line(last,p,'#f4bd65',1);}last=p;}}
  }
  if(tl.id==='magneticIceClamp'){
   const b=tl.behavior,farSide=r[0]+r[2]>=0?-1:1,growth=fx.jawGrowth*(1-fade*.8);
   if(drawBack&&time>=tl.releaseMs){
    for(let i=0;i<4;i++){const a=fx.footprint[i],next=fx.footprint[(i+1)%4],last=fx.footprint[(i+3)%4],p=at(a.x,a.y,.03);for(const e of [next,last])line(p,add(p,at((e.x-a.x)*.22,(e.y-a.y)*.22)),tell?'#95babd':'#bbd5d1');}
    for(const side of [-1,1])cloud(add(c,at(0,side*fx.jawGap)),b.halfLength*.6,.12,'#809ba3',.25);
   }
   const jaw=side=>{for(const j of [-1,0,1]){
    const base=add(c,at(j*.85,side*fx.jawGap)),height=(j===0?1.8:1.25)*growth;
    const a=add(base,at(-.43,side*.24)),d=add(base,at(.43,side*.24)),tip=add(base,at(j*.08,-side*.35,height)),shoulder=add(base,at(-j*.1,side*.28,height*.58)),inner=add(base,at(.25,-side*.22,height*.3));
    polygon([a,d,inner,tip,shoulder],'#448fb7');polygon([a,tip,shoulder],'#94d9e8');polygon([d,tip,inner],'#c5eef1');line(a,tip,'#dff9f1');line(tip,inner,'#edf9f3');
    if(fx.pulseActive&&j===0)line(add(base,at(-.12,0,.3*growth)),tip,'#d2b1ee',2);
   }};
   if(time>=tl.releaseMs&&growth>0){if(drawBack)jaw(farSide);if(drawFront)jaw(-farSide);}
   if(drawFront&&time>=tl.pulsesMs[0]&&time<tl.activeEndMs){
    const intensity=fx.pulseActive?1:.3;ctx.save();ctx.globalAlpha*=intensity;
    for(const offset of [-.55,.35]){let last;for(let j=0;j<=10;j++){const u=j/10,side=-fx.jawGap+2*fx.jawGap*u,p=add(c,at(offset+(j===0||j===10?0:Math.sin(j*2.7+fx.pulseIndex)*.12),side,.72+(j===0||j===10?0:Math.cos(j*2.2+fx.pulseIndex)*.13)));if(last){line(last,p,'#ad86d3',3);line(last,p,'#f1e4fc');}last=p;}}
    ctx.restore();
   }
   if(drawFront&&fade>0)for(let j=0;j<14;j++){const side=j%2?1:-1,p=add(c,at(Math.sin(j*2)*1.4,side*(fx.jawGap+fade*.9),(.4+Math.sin(j)**2*.7)*(1-fade)));crystal(p,.18*(1-fade),.08*(1-fade),j%3?'#b4dfec':'#aa96ce');}
  }
  if(tl.behavior.shape==='cone'){
   const half=tl.behavior.arc*Math.PI/360,length=tl.behavior.range,icy=tl.id==='blizzardFan',strength=tell?.16:1-fade;
   if(drawBack){for(const angle of [-half,half])line(at(.3,0,.02),at(Math.cos(angle)*length,Math.sin(angle)*length,.02),icy?'#c4e0df':'#bfcda6');ring([0,.025,0],length,icy?'#cee5e2':'#c7d2b0',1,-half,half*2);}
   if(drawFront){const emitter=this.pose({action:state.action,direction,timeMs:tl.releaseMs+60}).castOrigin||at(.25,-.15,.8);for(let j=0;j<13;j++){const angle=-half+(j+.5)/13*half*2,wave=(fx.age*(icy?1.7:2.4)+j*.17)%1,start=.15+wave*.5,end=length*(tell?.35:1),color=icy?(j%3?'#b5dfeb':'#edf6e7'):(j%3?'#a7cbb0':'#d5ddb1');let last;for(let k=0;k<=22;k++){const u=k/22,d=start+(end-start)*u,p=add(mul(emitter,1-u),at(Math.cos(angle)*d,Math.sin(angle)*d+Math.sin(u*6+fx.age*8+j)*.1,u*.2));if(last&&((j+k)%9!==0||icy)){if(!tell)polygon([last,p,add(p,[0,(icy?.1:.06)*(1+u),0]),add(last,[0,(icy?.1:.06)*(1+u),0])],color,icy?.65:.8);line(last,p,color,icy&&active&&j%3===0?2:1);}last=p;}}
    for(let j=0;j<Math.floor((icy?55:24)*strength);j++){const angle=-half+((j*.618)%1)*half*2,d=.7+((j*.37+fx.age*(icy?.7:1.3))%1)*(length-.7),p=at(Math.cos(angle)*d,Math.sin(angle)*d,.34+Math.sin(j*3)*.12);if(icy){if(j%4===0)spark(p,'#edf7ee',2);else if(j%5===0)crystal(p,.16,.055,'#addbe9');else pixel(p,j%3?'#a8d8e8':'#eaf7ed',2);}else{const b=add(p,at(.45,Math.sin(j*3)*.35,.14)),m=add(p,at(.2,-.18,.05));line(p,m,fx.pulseActive?'#f3d464':'#d9cc78',2);line(m,b,'#f5dd79',1);}}
   }
  }
  ctx.restore();
 }
}
