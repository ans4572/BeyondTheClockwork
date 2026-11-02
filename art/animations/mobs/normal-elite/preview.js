import {EnemyRig,enemyTimeline,enemyFrameSchedule,enemyProjectedStride} from '/src/animation/enemy-rig.js';
import {DIRECTION_ANGLES} from '/src/animation/f2-rig.js';
const $=id=>document.getElementById(id);
const [config,slice]=await Promise.all([fetch('enemies.json').then(r=>r.json()),fetch('/src/data/slice.json').then(r=>r.json())]);
const rig=new EnemyRig(config,slice),canvas=$('stage'),ctx=canvas.getContext('2d'),puppet=document.createElement('canvas');
puppet.width=puppet.height=config.nativeSize;const pc=puppet.getContext('2d'),dirs=Object.keys(DIRECTION_ANGLES);
const eventLabels={impact:'강타',projectile:'발사',dashStart:'돌진 시작',dashEnd:'돌진 종료',followup:'추가 파동'};
const descriptions={guard:'몸을 비틀어 예고한 뒤 곤봉을 수평으로 휘두릅니다.',rabbit:'네 코일 다리를 압축하고 귀를 눕힌 뒤 앞으로 튀어나갑니다.',trumpet:'양손으로 나팔을 잡고 조준한 뒤 반동과 함께 발사합니다.',elite:'곤봉을 내려친 뒤 자세를 낮게 유지하고 추가 파동을 냅니다.'};
const stages={idle:'대기',move:'이동',tell:'공격 예고',dash:'돌진 중',followupTell:'추가 파동 예고',recovery:'공격 후 회복'};
let enemy='guard',direction='south-east',action='move',timeMs=0,paused=false,speed=1,rotate=false,rotateTime=0,last=performance.now();
let timeline,duration,schedule;
function reset(){timeMs=0;paused=false;updateControls();}
function updateControls(){const def=rig.definition(enemy);timeline=enemyTimeline(enemy,slice);duration=action==='attack'?timeline.durationMs:action==='move'?def.walk.cycleMs:1;schedule=action==='attack'?enemyFrameSchedule(timeline):{timesMs:Array.from({length:def.walk.frameCount},(_,i)=>i*def.walk.cycleMs/def.walk.frameCount)};
 $('title').textContent=def.concept+' · '+def.name;$('description').textContent=descriptions[enemy];$('scrub').max=duration;$('scrub').disabled=action==='idle';$('step').disabled=action==='idle';
 document.querySelectorAll('[data-enemy]').forEach(b=>b.classList.toggle('active',b.dataset.enemy===enemy));document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===action));
 $('track').querySelectorAll('.marker,.followup-tell').forEach(e=>e.remove());$('tell').style.width=action==='attack'?timeline.tellMs/duration*100+'%':'0';
 if(action==='attack'&&timeline.followupMs!==null){const region=document.createElement('div');region.className='tell followup-tell';region.style.left=timeline.primaryMs/duration*100+'%';region.style.width=(timeline.followupMs-timeline.primaryMs)/duration*100+'%';region.style.opacity='.65';region.title='추가 파동 예고';$('track').insertBefore(region,$('cursor'));}
 for(const e of action==='attack'?timeline.events:[]){const marker=document.createElement('div');marker.className='marker';marker.style.left=e.timeMs/duration*100+'%';marker.title=eventLabels[e.id]+' '+e.timeMs+'ms';$('track').append(marker);}
 $('events').replaceChildren();for(const e of timeline.events){const tag=document.createElement('span');tag.className='tag';tag.textContent=eventLabels[e.id]+' '+e.timeMs+'ms';$('events').append(tag);}
 const recovery=slice.enemies[enemy].recovery*1000;$('timing').textContent=`예고 ${timeline.tellMs}ms · 회복 ${recovery}ms · 이동 주기 ${def.walk.cycleMs}ms`+(enemy==='rabbit'?' · 돌진 중에도 회복 시간 진행':enemy==='elite'?' · 첫 타 800ms 뒤 추가 파동':'');
}
for(const def of config.enemies){const b=document.createElement('button');b.dataset.enemy=def.id;b.textContent=def.concept+' · '+def.name;b.addEventListener('click',()=>{enemy=def.id;reset();});$('enemies').append(b);}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{action=b.dataset.action;reset();}));
function setDirection(d){direction=d;document.querySelectorAll('[data-direction]').forEach(b=>b.classList.toggle('active',b.dataset.direction===d));}
document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>{rotate=false;$('rotate').classList.remove('active');setDirection(b.dataset.direction);}));
$('pause').addEventListener('click',()=>paused=!paused);$('restart').addEventListener('click',reset);
$('step').addEventListener('click',()=>{paused=true;timeMs=schedule.timesMs.find(t=>t>timeMs+.01)??duration;});
$('scrub').addEventListener('input',e=>{paused=true;timeMs=Number(e.target.value);});
$('speed').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-label').textContent=speed.toFixed(2)+'×';});
$('rotate').addEventListener('click',()=>{rotate=!rotate;$('rotate').classList.toggle('active',rotate);});
document.addEventListener('visibilitychange',()=>last=performance.now());
function floor(dx,dy){ctx.fillStyle='#e4e7d4';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#cdd6bb';ctx.lineWidth=1;for(const slope of [-.57735,.57735])for(let i=-14;i<25;i++){const offset=i*42+(-dy+slope*dx)%42;ctx.beginPath();ctx.moveTo(0,offset);ctx.lineTo(canvas.width,offset+slope*canvas.width);ctx.stroke();}}
function frame(now){const dt=Math.min(50,Math.max(0,now-last));last=now;if(!paused&&!document.hidden){timeMs+=dt*speed;rotateTime+=dt*speed;if(rotate)setDirection(dirs[Math.floor(rotateTime/2200)%8]);if(action==='idle')timeMs=0;if(action==='attack'&&$('repeat').checked&&timeMs>duration+400)timeMs%=duration+400;else if(action==='attack'&&!$('repeat').checked)timeMs=Math.min(timeMs,duration);}
 const t=action==='move'?timeMs%duration:Math.min(timeMs,duration),def=rig.definition(enemy),angle=DIRECTION_ANGLES[direction],phase=action==='move'?t/duration:0;
 let travel=action==='move'?timeMs/duration*enemyProjectedStride(config,enemy,direction):0;if(action==='attack'&&timeline.dashEndMs)travel=timeline.rootMotionDistanceUnits*Math.max(0,Math.min(1,(t-timeline.primaryMs)/(timeline.dashEndMs-timeline.primaryMs)))*enemyProjectedStride(config,enemy,direction)/def.walk.stride;
 const scale=3;floor(Math.cos(angle)*travel*config.pixelsPerUnit*scale,Math.sin(angle)*travel*config.pixelsPerUnit*scale);
 const state={enemy,direction,action,phase,timeMs:t};pc.clearRect(0,0,puppet.width,puppet.height);if($('effects').checked)rig.renderEffects(pc,state);const pose=rig.render(pc,state);ctx.imageSmoothingEnabled=false;ctx.drawImage(puppet,Math.round(320-config.origin[0]*scale),Math.round(335-config.origin[1]*scale),puppet.width*scale,puppet.height*scale);
 $('pause').textContent=paused?'재생 계속':'일시정지';$('status').textContent=`${paused?'일시정지 · ':''}${stages[pose.stage]} · ${direction} · ${Math.round(t)} / ${action==='idle'?0:duration}ms`;
 $('time').textContent=Math.round(t)+'ms';$('scrub').value=t;$('cursor').style.left=Math.min(99.8,t/duration*100)+'%';
 ctx.fillStyle='#6c8165';ctx.font='12px "Malgun Gothic",sans-serif';ctx.fillText('8 DIRECTIONS / '+(action==='attack'?'ATTACK':action==='move'?'MOVE':'IDLE'),24,30);requestAnimationFrame(frame);
}
updateControls();requestAnimationFrame(frame);
