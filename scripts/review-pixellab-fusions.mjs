import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url),deps=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'),{createCanvas,loadImage,GlobalFonts}=require(path.join(deps,'@napi-rs/canvas')),sharp=require(path.join(deps,'sharp'));
GlobalFonts.registerFromPath('C:/Windows/Fonts/malgun.ttf','Malgun Gothic');
const dir='art/animations/player/skills/fusion/pixellab',manifest=JSON.parse(await readFile(dir+'/manifest.json','utf8')),concepts=JSON.parse(await readFile('art/player-f2/fusion-concepts/manifest.json','utf8'));
// This legacy overview displays the six preserved representative clips.
manifest.clips=manifest.clips.filter(c=>c.direction==='south-east');
const images=new Map();for(const c of manifest.clips)images.set(c.id,await loadImage(dir+'/'+c.sheet));
const draw=(ctx,c,t,x,y)=>{const i=Math.max(0,c.sampleTimesMs.findLastIndex(ms=>ms<=t));ctx.drawImage(images.get(c.id),i%c.columns*256,Math.floor(i/c.columns)*256,256,256,x,y,256,256);};
const contact=createCanvas(256*5,280*6),cc=contact.getContext('2d');cc.fillStyle='#f5f0e3';cc.fillRect(0,0,contact.width,contact.height);
for(const [row,def]of concepts.concepts.entries()){const c=manifest.clips.find(c=>c.id===def.id);cc.fillStyle='#436957';cc.font='12px "Malgun Gothic"';cc.fillText(def.name+' / '+(c?'PixelLab '+c.frameCount+' source frames':'pending'),8,row*280+16);if(c)for(let j=0;j<5;j++)draw(cc,c,j/4*(c.durationMs-1),j*256,row*280+24);}
await writeFile(dir+'/contact-sheet.png',contact.toBuffer('image/png'));
const duration=Math.max(...manifest.clips.map(c=>c.durationMs))+400,frames=[],dt=50;
for(let t=0;t<duration;t+=dt){const canvas=createCanvas(768,560),ctx=canvas.getContext('2d');ctx.fillStyle='#f5f0e3';ctx.fillRect(0,0,768,560);for(const [j,def]of concepts.concepts.entries()){const c=manifest.clips.find(c=>c.id===def.id),x=j%3*256,y=Math.floor(j/3)*280;ctx.fillStyle='#436957';ctx.font='12px "Malgun Gothic"';ctx.fillText(def.name,x+8,y+16);if(c)draw(ctx,c,Math.min(t,c.durationMs),x,y+24);}frames.push(Buffer.from(ctx.getImageData(0,0,768,560).data));}
await sharp(Buffer.concat(frames),{raw:{width:768,height:560*frames.length,channels:4,pageHeight:560}}).gif({delay:dt,dither:0,loop:0,effort:3}).toFile(dir+'/overview.gif');
console.log('Review contact sheet and six-slot overview created for '+manifest.clips.length+' completed clips.');
