const $=id=>document.getElementById(id),labels={idle:'대기',walk:'걷기',run:'달리기'},directions={north:'북','north-east':'북동',east:'동','south-east':'남동',south:'남','south-west':'남서',west:'서','north-west':'북서'};
try{
 const r=await fetch('manifest.json');if(!r.ok)throw Error('생성 결과 준비 중입니다.');const manifest=await r.json(),images=new Map();
 await Promise.all(manifest.clips.map(async c=>{const im=new Image();im.src=c.sheet;await im.decode();images.set(c.gait+'/'+c.direction,im);}));
 let gait=new URL(location.href).searchParams.get('gait')||'walk',direction=new URL(location.href).searchParams.get('direction')||'south-east',elapsed=0,paused=false,speed=1,last=performance.now();
 if(!labels[gait])gait='walk';if(!directions[direction])direction='south-east';
 const get=(d=direction)=>manifest.clips.find(c=>c.gait===gait&&c.direction===d),ctx=$('hero').getContext('2d'),thumbs=new Map();
 for(const d of ['north-west','north','north-east','west',null,'east','south-west','south','south-east']){
  if(!d){const center=document.createElement('p');center.textContent='F2';center.style.textAlign='center';$('compass').append(center);continue;}
  const b=document.createElement('button'),cv=document.createElement('canvas'),span=document.createElement('span');cv.width=cv.height=128;cv.setAttribute('aria-label',directions[d]+' 방향');span.textContent=directions[d];b.append(cv,span);b.dataset.direction=d;b.addEventListener('click',()=>{direction=d;update();});$('compass').append(b);thumbs.set(d,cv.getContext('2d'));
 }
 function update(){const c=get();if(!c)throw Error('클립 누락: '+gait+'/'+direction);$('title').textContent=`${labels[gait]} · ${directions[direction]} · PixelLab`;$('info').textContent=`${c.frameCount}프레임 · ${c.frameWidth}×${c.frameHeight} · ${c.durationMs}ms · 투명 PNG`;$('gif').href=c.gif;$('sheet').href=c.sheet;$('qa').textContent=manifest.reviewNotes.join(' · ');$('scrub').max=c.durationMs;for(const b of $('gaits').children)b.setAttribute('aria-pressed',String(b.dataset.gait===gait));for(const b of $('compass').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.direction===direction));const u=new URL(location.href);u.searchParams.set('gait',gait);u.searchParams.set('direction',direction);history.replaceState(null,'',u);}
 for(const b of $('gaits').children)b.addEventListener('click',()=>{gait=b.dataset.gait;elapsed=0;update();});
 for(const c of manifest.clips){const tr=document.createElement('tr');for(const v of [labels[c.gait],directions[c.direction],c.frameCount,c.durationMs+'ms']){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('clips').append(tr);}
 $('pause').addEventListener('click',()=>paused=!paused);$('restart').addEventListener('click',()=>{elapsed=0;paused=false;});$('speed').addEventListener('change',e=>speed=+e.target.value);$('scrub').addEventListener('input',e=>{elapsed=+e.target.value;paused=true;});
 const index=(c,t)=>Math.max(0,c.sampleTimesMs.findLastIndex(ms=>ms<=t%c.durationMs));
 const step=delta=>{const c=get(),i=index(c,elapsed);elapsed=c.sampleTimesMs[(i+delta+c.frameCount)%c.frameCount];paused=true;};$('next').addEventListener('click',()=>step(1));$('back').addEventListener('click',()=>step(-1));
 function draw(context,c,t){const i=index(c,t),w=context.canvas.width,h=context.canvas.height;context.imageSmoothingEnabled=false;context.clearRect(0,0,w,h);const scale=Math.max(1,Math.floor(Math.min(w/c.frameWidth,h/c.frameHeight))),dw=c.frameWidth*scale,dh=c.frameHeight*scale;context.drawImage(images.get(c.gait+'/'+c.direction),i%c.columns*c.frameWidth,Math.floor(i/c.columns)*c.frameHeight,c.frameWidth,c.frameHeight,Math.floor((w-dw)/2),Math.floor((h-dh)/2),dw,dh);}
 function render(now){if(!paused)elapsed+=Math.min(80,now-last)*speed;last=now;const c=get();draw(ctx,c,elapsed);for(const[d,context]of thumbs)draw(context,get(d),elapsed);$('time').textContent=`${index(c,elapsed)+1} / ${c.frameCount}프레임`;$('scrub').value=elapsed%c.durationMs;$('pause').textContent=paused?'재생':'일시정지';requestAnimationFrame(render);}
 update();requestAnimationFrame(render);
}catch(error){$('error').textContent=error.message;}
