import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
import {F2StateRig,stateDurationMs,stateInvulnerabilityMs,stateRootDistance,stateEffectEvents} from '../src/animation/f2-states.js';
import {extractF2Face,DIRECTION_ANGLES} from '../src/animation/f2-rig.js';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'art/animations/player'),require=createRequire(import.meta.url),deps=process.env.ANIMATION_NODE_MODULES||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {createCanvas,loadImage}=require(path.join(deps,'@napi-rs/canvas')),sharp=require(path.join(deps,'sharp'));
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const [config,data,combat]=await Promise.all([json(path.join(dir,'rig.json')),json(path.join(dir,'states.json')),json(path.join(root,'src/data/combat.json'))]);
data.states=data.states.filter(d=>d.category!=='skill'||d.group==='secondary');
const source=createCanvas(64,64);source.getContext('2d').drawImage(await loadImage(path.join(dir,'base.png')),0,0);
const rig=new F2StateRig(config,extractF2Face(source.getContext('2d').getImageData(0,0,64,64)),data,combat),n=config.nativeSize,directions=Object.keys(DIRECTION_ANGLES);
for(const folder of ['movement/reactions/clips','skills/basic/clips'])await mkdir(path.join(dir,folder),{recursive:true});
function render(def,direction,timeMs,{effects=false,onlyEffects=false,shadow=false}={}){const c=createCanvas(n,n),ctx=c.getContext('2d'),s={action:def.id,direction,timeMs};if(!onlyEffects)rig.render(ctx,s,{shadow});if(effects||onlyEffects)rig.renderEffects(ctx,s);return c;}
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
function edgePixels(raw){let count=0;for(let i=0;i<n;i++)for(const [x,y]of [[i,0],[i,n-1],[0,i],[n-1,i]])if(raw[(y*n+x)*4+3])count++;return count;}
async function gif(name,frames,width,height,delay){await sharp(Buffer.concat(frames),{raw:{width,height:height*frames.length,channels:4,pageHeight:height}}).gif({delay:Array.isArray(delay)?delay:Array(frames.length).fill(delay),loop:0,dither:0,effort:7}).toFile(path.join(dir,name));}
const cellHeight=n+14,contact=createCanvas(n*6,cellHeight*data.states.length),cc=contact.getContext('2d');cc.fillStyle='#f5f0e3';cc.fillRect(0,0,contact.width,contact.height);
for(const [row,def]of data.states.entries())for(let col=0;col<6;col++){cc.drawImage(render(def,'south-east',stateDurationMs(def,combat)*col/5,{effects:true,shadow:true}),col*n,row*cellHeight+14);cc.fillStyle='#355a50';cc.font='7px sans-serif';cc.fillText(def.id,col*n+3,row*cellHeight+9);}
await writeFile(path.join(dir,'skills/basic/state-contact-sheet.png'),await sharp(contact.toBuffer('image/png')).resize({width:n*12,kernel:'nearest'}).png().toBuffer());
const secondaryDefs=data.states.filter(d=>d.group==='secondary'),secondaryContact=createCanvas(n*6,cellHeight*secondaryDefs.length),scc=secondaryContact.getContext('2d');scc.fillStyle='#f5f0e3';scc.fillRect(0,0,secondaryContact.width,secondaryContact.height);
for(const [row,def]of secondaryDefs.entries())for(const [col,time]of [0,def.events.release,...stateEffectEvents(def,combat).pulses.slice(0,3),stateDurationMs(def,combat)].entries()){scc.drawImage(render(def,'south-east',time+((col>1&&col<5)?40:0),{effects:true,shadow:true}),col*n,row*cellHeight+14);scc.fillStyle='#355a50';scc.font='7px sans-serif';scc.fillText(def.id,col*n+3,row*cellHeight+9);}
await writeFile(path.join(dir,'skills/basic/secondary-skills-contact-sheet.png'),await sharp(secondaryContact.toBuffer('image/png')).resize({width:n*12,kernel:'nearest'}).png().toBuffer());
if(process.argv.includes('--preview'))process.exit(0);
const clips=[];
const onlySecondary=process.argv.includes('--secondary-only');
for(const def of data.states.filter(d=>!onlySecondary||d.group==='secondary')){
 const duration=stateDurationMs(def,combat),dt=def.frameDurationMs||data.frameDurationMs,count=Math.round(duration/dt);
 for(const direction of directions){
  const columns=def.group==='secondary'?Math.min(16,count):count,rows=Math.ceil(count/columns),body=createCanvas(n*columns,n*rows),bc=body.getContext('2d'),fx=createCanvas(n*columns,n*rows),fc=fx.getContext('2d'),frames=[];
  for(let i=0;i<count;i++){const t=i*dt,b=render(def,direction,t),f=render(def,direction,t,{onlyEffects:true});if(edgePixels(pixels(b))||edgePixels(pixels(f)))throw new Error(`Clipped ${def.id}/${direction}/${i}`);bc.drawImage(b,i%columns*n,Math.floor(i/columns)*n);fc.drawImage(f,i%columns*n,Math.floor(i/columns)*n);frames.push(pixels(render(def,direction,t,{effects:true})));}
  const base=`${def.category==='skill'?'skills/basic/clips':'movement/reactions/clips'}/${def.id}-${direction}`,hold=def.id==='death'?1000:400,delays=Array(count).fill(dt);delays[count-1]+=hold;
  await writeFile(path.join(dir,base+'.png'),body.toBuffer('image/png'));if(def.effect)await writeFile(path.join(dir,base+'-effects.png'),fx.toBuffer('image/png'));
  await gif(base+'.gif',frames,n,n,delays);
  const terminal=base+'-end.png';await writeFile(path.join(dir,terminal),render(def,direction,duration).toBuffer('image/png'));
  clips.push({id:def.id,label:def.label,concept:def.concept,category:def.category,direction,image:base+'.png',effectImage:def.effect?base+'-effects.png':null,gif:base+'.gif',gifPreviewHoldMs:hold,terminalImage:terminal,frameWidth:n,frameHeight:n,columns,rows,frameCount:count,frameDurationMs:dt,durationMs:duration,loop:false,endBehavior:def.endBehavior,anchor:(def.origin||config.origin).map(v=>v/n),castHand:def.castHand||null,weaponHand:'right',effectOrigin:def.effectAttachment||(def.castHand==='left'?'left_wrist':def.castHand==='right'?'right_wrench_tip':null),eventsMs:{...def.events,...(stateEffectEvents(def,combat)||{})},rootMotionBaked:false,rootMotionDistanceUnits:stateRootDistance(def,combat),invulnerabilityMs:stateInvulnerabilityMs(def,combat)});
 }
 console.log(`${def.id}: ${directions.length} directions × ${count} frames`);
}
// Composited review loops use real clip time plus a clearly separated end hold.
for(const [name,defs]of [['reactions-preview',data.states.filter(d=>d.category!=='skill')],['secondary-skills-preview',secondaryDefs]]){
 if(onlySecondary&&name!=='secondary-skills-preview')continue;
 const max=Math.max(...defs.map(d=>stateDurationMs(d,combat))),dt=20,count=Math.ceil((max+600)/dt),frames=[],cols=name==='secondary-skills-preview'?2:defs.length,rows=Math.ceil(defs.length/cols),header=name==='secondary-skills-preview'?14:0,height=n+header;
 for(let i=0;i<count;i++){const c=createCanvas(n*cols*3,height*rows*3),ctx=c.getContext('2d');ctx.scale(3,3);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#f5f0e3';ctx.fillRect(0,0,n*cols,height*rows);
  for(const [j,def]of defs.entries()){const x=j%cols*n,y=Math.floor(j/cols)*height;ctx.drawImage(render(def,'south-east',Math.max(0,i*dt-100),{effects:true,shadow:true}),x,y+header);ctx.font='7px sans-serif';ctx.fillStyle='#355a50';ctx.textAlign='center';ctx.fillText(`${def.concept} / ${def.id}`,x+n/2,y+9);}
  frames.push(pixels(c));
 }
 await gif((name==='reactions-preview'?'movement/reactions/':'skills/basic/')+name+'.gif',frames,n*cols*3,height*rows*3,dt);
}
const previous=onlySecondary?await json(path.join(dir,'state-clips.json')):null,allClips=previous?[...previous.clips.filter(c=>!secondaryDefs.some(d=>d.id===c.id)),...clips]:clips;
await writeFile(path.join(dir,'state-clips.json'),JSON.stringify({schemaVersion:1,character:'F2',producer:data.producer,pixelLabGeneration:false,appliedToGame:false,appliedToGameClips:['hit','death','dodge','exhaustBurst','coolingField','capacitorStrike','vortexIntake'],selection:data.selection,castingPolicy:data.castingPolicy,skillTimings:'Art preview lead-in separate from gameplay delay/interval; no gameplay cast locks added',clips:allClips},null,2)+'\n');
for(const clip of clips){const b=await sharp(path.join(dir,clip.image)).metadata(),g=await sharp(path.join(dir,clip.gif),{animated:true}).metadata();if(b.width!==n*clip.columns||b.height!==n*clip.rows||!b.hasAlpha||g.pages<2||g.delay.reduce((s,d)=>s+d,0)!==clip.durationMs+clip.gifPreviewHoldMs)throw new Error('Invalid output '+clip.image);}
console.log(`Verified ${clips.length} clips / ${clips.reduce((sum,c)=>sum+c.frameCount,0)} body frames, effect layers, GIF timing and no clipping.`);
