import {F2StateRig,stateDurationMs,stateInvulnerabilityMs,stateRootDistance,stateEffectEvents} from '/src/animation/f2-states.js';
import {extractF2Face,DIRECTION_ANGLES} from '/src/animation/f2-rig.js';
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
const [config,data,combat]=await Promise.all(['../../rig.json','../../states.json','/src/data/combat.json'].map(async p=>{const r=await fetch(p);if(!r.ok)throw new Error(p);return r.json();}));
data.states=data.states.filter(d=>(d.category==='skill')===false);
const source=document.createElement('canvas');source.width=64;source.height=64;const image=new Image();image.src='../../base.png';await image.decode();source.getContext('2d').drawImage(image,0,0);
const rig=new F2StateRig(config,extractF2Face(source.getContext('2d').getImageData(0,0,64,64)),data,combat),puppet=document.createElement('canvas');puppet.width=config.nativeSize;puppet.height=config.nativeSize;const pc=puppet.getContext('2d');
let action=data.states[0].id,direction='south-east',time=0,speed=1,paused=false,turn=false,last=performance.now();const directions=Object.keys(DIRECTION_ANGLES);
const definition=()=>rig.definition(action),duration=()=>stateDurationMs(definition(),combat);
function setDirection(value){direction=value;document.querySelectorAll('[data-direction]').forEach(b=>b.classList.toggle('active',b.dataset.direction===direction));}
function setAction(value){action=value;time=0;paused=false;document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===action));}
function setSpeed(value){speed=value;$('speed').value=value;$('speed-label').textContent=value.toFixed(2)+'×';}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>setAction(b.dataset.action)));
document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>{turn=false;$('turn').classList.remove('active');setDirection(b.dataset.direction);}));
$('pause').addEventListener('click',()=>paused=!paused);$('restart').addEventListener('click',()=>{time=0;paused=false;});$('slow').addEventListener('click',()=>setSpeed(speed===.5?1:.5));$('speed').addEventListener('input',e=>setSpeed(Number(e.target.value)));
$('scrub').addEventListener('input',e=>{time=Number(e.target.value);paused=true;});
function step(sign){paused=true;time=Math.max(0,Math.min(duration(),time+sign*(definition().frameDurationMs||data.frameDurationMs)));}
$('previous').addEventListener('click',()=>step(-1));$('next').addEventListener('click',()=>step(1));$('turn').addEventListener('click',()=>{turn=!turn;$('turn').classList.toggle('active',turn);});
window.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)paused=!paused;}if(e.code==='ArrowLeft'){e.preventDefault();step(-1);}if(e.code==='ArrowRight'){e.preventDefault();step(1);}});
window.addEventListener('blur',()=>paused=true);document.addEventListener('visibilitychange',()=>{if(document.hidden)paused=true;});
const requestedAction=new URLSearchParams(location.search).get('action');if(data.states.some(d=>d.id===requestedAction))setAction(requestedAction);
function frame(now){
 const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;const def=definition(),length=duration();
 if(!paused){time+=dt*1000*speed;const hold=action==='death'?1000:600;if(time>=length+hold){if(turn){setDirection(directions[(directions.indexOf(direction)+1)%8]);time=0;}else if($('repeat').checked&&action!=='death')time=0;else time=length;}}
 const sampleTime=Math.min(time,length),state={action,direction,timeMs:sampleTime},p=rig.pose(state),distance=$('travel').checked?(stateRootDistance(def,combat)||(def.previewMovingCast ? .4 : 0))*Math.min(time/length,1):0,angle=DIRECTION_ANGLES[direction],ox=-Math.cos(angle)*distance*config.pixelsPerUnit*3,oy=-Math.sin(angle)*distance*config.pixelsPerUnit*3;
 ctx.fillStyle='#e4e7d4';ctx.fillRect(0,0,480,416);ctx.strokeStyle='#d1d9c2';ctx.lineWidth=1;
 for(const slope of [-.57735,.57735])for(let i=-15;i<24;i++){const c=i*42+(oy-slope*ox)%42;ctx.beginPath();ctx.moveTo(0,c);ctx.lineTo(480,c+slope*480);ctx.stroke();}
 if(distance){ctx.strokeStyle='#94a58a';ctx.beginPath();ctx.arc(240+ox,311+oy,8,0,Math.PI*2);ctx.stroke();}
 const origin=def.origin||config.origin;pc.clearRect(0,0,puppet.width,puppet.height);rig.render(pc,state);if($('effects').checked)rig.renderEffects(pc,state);ctx.imageSmoothingEnabled=false;ctx.drawImage(puppet,240-origin[0]*3,311-origin[1]*3,puppet.width*3,puppet.height*3);
 ctx.fillStyle='#7d9375';ctx.font='11px sans-serif';ctx.fillText('QUARTER VIEW · F2 · STATE MOTION',18,25);
 $('status').textContent=`${def.label} · ${direction}${paused?' · 정지':sampleTime>=length?' · 종료 자세':''}`;$('pause').textContent=paused?'재생':'일시정지';$('scrub').max=length;$('scrub').value=sampleTime;$('time-label').textContent=`${Math.round(sampleTime)} / ${length}ms`;
 const invul=stateInvulnerabilityMs(def,combat);$('timing').textContent=def.id==='dodge'?`이동 ${length}ms · 거리 ${stateRootDistance(def,combat)}u · 무적 ${invul}ms`:def.id==='hit'?`피격 반동 ${length}ms · 피격 후 무적 ${combat.player.hurtInvulnerability*1000}ms는 별도`:def.id==='death'?`동력 정지 ${length}ms · 종료 자세 유지`:`시전 모션 ${length}ms · 방출 ${def.events.release}ms${def.id==='pressureDash'?' · 무적 없음':''}`;
 $('hand-note').textContent=def.category==='skill'?(def.castHand==='left'?'빈 왼손 시전 · 오른손은 렌치 휴대':'오른손 렌치로 시전 · 왼손은 빈 손'):'오른손 렌치 유지';
 if(def.effectSchedule){const e=stateEffectEvents(def,combat);$('timing').textContent=`연출 ${length}ms · ${e.pulses.length}회 · 간격 ${e.gameplayIntervalMs}ms${e.gameplayDelayMs?' · 예고 '+e.gameplayDelayMs+'ms':''}${e.finisher!==null?' + 마무리':''}`;$('hand-note').textContent=def.effectAttachment==='torso_seams'?'왼손 발동 → 몸체 배기 · 오른손 렌치 휴대':'왼손으로 지점 지정 · 오른손 렌치 휴대';}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
