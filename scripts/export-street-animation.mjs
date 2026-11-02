import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
import {StreetRig,streetProjectedStride} from '../src/animation/street-rig.js';import {DIRECTION_ANGLES} from '../src/animation/f2-rig.js';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'art/animations/npc'),require=createRequire(import.meta.url),deps=process.env.ANIMATION_NODE_MODULES||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {createCanvas}=require(path.join(deps,'@napi-rs/canvas')),sharp=require(path.join(deps,'sharp')),config=JSON.parse(await readFile(path.join(dir,'characters.json'),'utf8')),rig=new StreetRig(config),n=config.nativeSize,dirs=Object.keys(DIRECTION_ANGLES),residents=config.characters.filter(c=>c.role==='resident'),concepts=residents.filter(c=>!c.variantOf);
await mkdir(path.join(dir,'clips'),{recursive:true});
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
function render(character,direction,action,phase,timeMs=0,shadow=false){const c=createCanvas(n,n);rig.render(c.getContext('2d'),{character,direction,action,phase,timeMs},{shadow});return c;}
function edge(raw){let found=0;for(let i=0;i<n;i++)for(const [x,y]of [[i,0],[i,n-1],[0,i],[n-1,i]])if(raw[(y*n+x)*4+3])found++;return found;}
async function gif(file,frames,width,height,delay){await sharp(Buffer.concat(frames),{raw:{width,height:height*frames.length,channels:4,pageHeight:height}}).gif({delay:Array.isArray(delay)?delay:Array(frames.length).fill(delay),loop:0,dither:0,effort:7}).toFile(path.join(dir,file));}
const contact=createCanvas(n*8,(n+14)*config.characters.length),cc=contact.getContext('2d');cc.fillStyle='#f5f0e3';cc.fillRect(0,0,contact.width,contact.height);
for(const [row,c]of config.characters.entries())for(const [i,direction]of dirs.entries()){cc.drawImage(render(c.id,direction,'idle',0),i*n,row*(n+14)+14);cc.fillStyle='#355a50';cc.font='7px sans-serif';cc.fillText(c.id+' '+direction,i*n+2,row*(n+14)+9);}
await writeFile(path.join(dir,'directions-preview.png'),await sharp(contact.toBuffer('image/png')).resize({width:n*16,kernel:'nearest'}).png().toBuffer());if(process.argv.includes('--preview'))process.exit(0);
const clips=[];
for(const c of config.characters){
 const actions=c.role==='merchant'?['idle','greeting']:['idle','walk'];
 for(const action of actions)for(const direction of dirs){
  const count=action==='walk'?config.walk.frameCount:action==='greeting'?config.merchant.greetingFrameCount:1,dt=action==='walk'?config.walk.frameDurationMs:action==='greeting'?config.merchant.frameDurationMs:0,sheet=createCanvas(n*count,n),sc=sheet.getContext('2d'),frames=[];
  for(let i=0;i<count;i++){const frame=render(c.id,direction,action,i/count,i*dt),raw=pixels(frame);if(edge(raw))throw new Error(`Clipped ${c.id}/${direction}/${action}/${i}`);sc.drawImage(frame,i*n,0);frames.push(raw);}
  const base=`clips/${c.id}-${action}-${direction}`;await writeFile(path.join(dir,base+'.png'),sheet.toBuffer('image/png'));
  const hasGif=count>1&&!c.variantOf;if(hasGif)await gif(base+'.gif',frames,n,n,dt);
  clips.push({character:c.id,concept:c.id==='bolt'?'N2B':c.id,role:c.role,action,direction,image:base+'.png',gif:hasGif?base+'.gif':null,frameWidth:n,frameHeight:n,frameCount:count,columns:count,rows:1,frameDurationMs:dt,durationMs:count*dt,loop:action==='walk',onComplete:action==='greeting'?'idle':null,trigger:action==='greeting'?'interaction_only':null,rootMotionBaked:false,rootMotionDistanceUnits:0,projectedStrideUnits:action==='walk'?streetProjectedStride(config,direction):0,anchor:config.origin.map(v=>v/n)});
 }
 console.log(`${c.id}: ${c.role==='merchant'?'stationary idle + interaction greeting':'eight-direction idle + walk'}`);
}
const labelHeight=14;
const residentFrames=[];
for(let i=0;i<config.walk.frameCount;i++){const c=createCanvas(n*6,(n+labelHeight)*6),ctx=c.getContext('2d');ctx.scale(3,3);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#f5f0e3';ctx.fillRect(0,0,n*2,(n+labelHeight)*2);for(const [j,r]of concepts.entries()){const x=j%2*n,y=Math.floor(j/2)*(n+labelHeight);ctx.drawImage(render(r.id,'south-east','walk',i/config.walk.frameCount,0,true),x,y+labelHeight);ctx.fillStyle='#355a50';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText(r.id+' / WALK',x+n/2,y+9);}residentFrames.push(pixels(c));}
await gif('residents-walk.gif',residentFrames,n*6,(n+labelHeight)*6,config.walk.frameDurationMs);
for(const r of concepts){const frames=[];for(let i=0;i<config.walk.frameCount;i++){const c=createCanvas(n*12,(n+labelHeight)*6),ctx=c.getContext('2d');ctx.scale(3,3);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#f5f0e3';ctx.fillRect(0,0,n*4,(n+labelHeight)*2);for(const [j,direction]of dirs.entries()){const x=j%4*n,y=Math.floor(j/4)*(n+labelHeight);ctx.drawImage(render(r.id,direction,'walk',i/config.walk.frameCount,0,true),x,y+labelHeight);ctx.fillStyle='#355a50';ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillText(direction,x+n/2,y+9);}frames.push(pixels(c));}await gif(`${r.id}-walk-8-directions.gif`,frames,n*12,(n+labelHeight)*6,config.walk.frameDurationMs);}
const greetingFrames=[],greetingCount=52;
for(let i=0;i<greetingCount;i++){const c=createCanvas(n*4,(n+labelHeight)*4),ctx=c.getContext('2d'),t=i*50-400;ctx.scale(4,4);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#f5f0e3';ctx.fillRect(0,0,n,n+labelHeight);ctx.drawImage(render('bolt','south-east',t>=0&&t<1200?'greeting':'idle',0,Math.max(0,t),true),0,labelHeight);ctx.fillStyle='#355a50';ctx.font='6px sans-serif';ctx.textAlign='center';ctx.fillText(t>=0&&t<1200?'INTERACTION / GREETING':'BOLT N2B / IDLE',n/2,8);greetingFrames.push(pixels(c));}
await gif('bolt-greeting.gif',greetingFrames,n*4,(n+labelHeight)*4,50);
await writeFile(path.join(dir,'clips.json'),JSON.stringify({schemaVersion:1,producer:config.producer,pixelLabGeneration:false,appliedToGame:true,merchant:config.merchant,residentConcepts:concepts.map(r=>r.id),residentVariants:residents.filter(r=>r.variantOf).map(r=>r.id),nativeSize:n,clips},null,2)+'\n');
for(const clip of clips){const png=await sharp(path.join(dir,clip.image)).metadata();if(png.width!==n*clip.frameCount||png.height!==n||!png.hasAlpha)throw new Error('Invalid PNG '+clip.image);if(clip.gif){const g=await sharp(path.join(dir,clip.gif),{animated:true}).metadata();if(g.pages<2||g.delay.reduce((s,d)=>s+d,0)!==clip.durationMs)throw new Error('Invalid GIF '+clip.gif);}}
console.log(`Verified ${clips.length} clips / ${clips.reduce((s,c)=>s+c.frameCount,0)} frames, alpha, GIF timing and canvas bounds.`);
