import {StreetRig,MerchantInteraction,streetProjectedStride} from '/src/animation/street-rig.js';
import {DIRECTION_ANGLES} from '/src/animation/f2-rig.js';import {Locomotion} from '/src/animation/locomotion.js';
const $=id=>document.getElementById(id),config=await (await fetch('characters.json')).json(),rig=new StreetRig(config),residents=config.characters.filter(c=>c.role==='resident'&&!c.variantOf),merchant=new MerchantInteraction(config.merchant),canvas=$('residents'),ctx=canvas.getContext('2d'),mc=$('merchant').getContext('2d');
const puppet=document.createElement('canvas');puppet.width=config.nativeSize;puppet.height=config.nativeSize;const pc=puppet.getContext('2d');
const playback={strideLengthUnits:.7,accelerationResponseSeconds:.07,decelerationResponseSeconds:.045,directionHysteresisDegrees:8,movingThreshold:.02,idleThreshold:.01,maxDeltaSeconds:.05,idleFramesPerSecond:1},controller=new Locomotion(playback);controller.direction='south-east';
let direction='south-east',walking=true,residentPaused=false,hiddenPaused=false,speed=1,last=performance.now(),auto=false,autoTime=0,speechTime=0;
const dirs=Object.keys(DIRECTION_ANGLES);
function setDirection(value){direction=value;document.querySelectorAll('[data-direction]').forEach(b=>b.classList.toggle('active',b.dataset.direction===direction));}
document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>{auto=false;$('auto').classList.remove('active');setDirection(b.dataset.direction);}));
$('walk-toggle').addEventListener('click',()=>walking=!walking);$('resident-pause').addEventListener('click',()=>residentPaused=!residentPaused);$('speed').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-label').textContent=speed.toFixed(2)+'×';});$('auto').addEventListener('click',()=>{auto=!auto;$('auto').classList.toggle('active',auto);});
$('talk').addEventListener('click',()=>{if(merchant.interact()){speechTime=2400;$('speech').textContent='아직 쓸 만한 부품이 많지.';}});
document.addEventListener('visibilitychange',()=>{hiddenPaused=document.hidden;last=performance.now();});
function floor(ctx,width,height,scale,x,y,phase){ctx.fillStyle='#e4e7d4';ctx.fillRect(x,y,width,height);ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.strokeStyle='#d0d8be';ctx.lineWidth=1;const ox=-controller.x*config.pixelsPerUnit*scale,oy=-controller.y*config.pixelsPerUnit*scale;for(const slope of [-.57735,.57735])for(let i=-20;i<30;i++){const c=i*32+(oy-slope*ox)%32;ctx.beginPath();ctx.moveTo(x,y+c);ctx.lineTo(x+width,y+c+slope*width);ctx.stroke();}ctx.restore();}
function drawPuppet(target,state,x,y,scale){pc.clearRect(0,0,puppet.width,puppet.height);rig.render(pc,state);target.imageSmoothingEnabled=false;target.drawImage(puppet,Math.round(x-config.origin[0]*scale),Math.round(y-config.origin[1]*scale),puppet.width*scale,puppet.height*scale);}
function frame(now){const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;
 const paused=residentPaused||hiddenPaused;if(!paused){autoTime+=dt*speed;if(auto)setDirection(dirs[Math.floor(autoTime/2.4)%8]);}
 const stride=streetProjectedStride(config,direction),angle=DIRECTION_ANGLES[direction];controller.config.strideLengthUnits=stride;
 const state=controller.update(dt*speed,walking?{x:Math.cos(angle),y:Math.sin(angle)}:{x:0,y:0},stride/(config.walk.cycleMs/1000),{paused});
 const moving=state.moving||state.motionWeight>.001;
 for(const [i,c]of residents.entries()){const x=i%2*320,y=Math.floor(i/2)*240;floor(ctx,320,240,2,x,y,state.phase);drawPuppet(ctx,{character:c.id,direction:state.direction,action:moving?'walk':'idle',phase:state.phase,motionWeight:state.motionWeight},x+160,y+220,2);ctx.fillStyle='#58785d';ctx.font='12px "Malgun Gothic",sans-serif';ctx.fillText(c.id+' · '+c.name,x+16,y+22);}
 $('walk-toggle').textContent=walking?'멈추기':'걷기';$('resident-pause').textContent=residentPaused?'주민 재생 계속':'주민 재생 일시정지';$('resident-status').textContent=`${residentPaused?'일시정지':moving?'걷는 중':'대기'} · ${state.direction} · 네 주민이 같은 걸음 주기를 유지합니다.`;
 const ms=merchant.update(dt*1000,{paused:hiddenPaused});mc.fillStyle='#e4e7d4';mc.fillRect(0,0,320,320);mc.strokeStyle='#d0d8be';for(let i=-7;i<14;i++){mc.beginPath();mc.moveTo(0,i*35);mc.lineTo(320,i*35+185);mc.stroke();mc.beginPath();mc.moveTo(0,i*35);mc.lineTo(320,i*35-185);mc.stroke();}
 drawPuppet(mc,{character:'bolt',direction:'south-east',action:ms.action,timeMs:ms.timeMs},160,278,3);mc.fillStyle='#58785d';mc.font='11px sans-serif';mc.fillText('N2B · BOLT · FIXED POSITION',15,23);
 $('talk').disabled=ms.action==='greeting';$('talk').textContent=ms.action==='greeting'?'인사하는 중…':'볼트에게 말 걸기';$('merchant-status').textContent=ms.action==='greeting'?'짧은 손 인사 · 위치 고정':'대기 중 · 말을 걸면 인사합니다.';
 if(!hiddenPaused&&speechTime>0){speechTime-=dt*1000;if(speechTime<=0)$('speech').textContent='말을 걸어 인사를 다시 확인할 수 있습니다.';}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
