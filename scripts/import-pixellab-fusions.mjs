import {createRequire} from 'node:module';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {fusionTimeline} from '../src/animation/f2-fusions.js';
const require=createRequire(import.meta.url),sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const dir='art/animations/player/skills/fusion/pixellab',read=async p=>JSON.parse(await readFile(p,'utf8'));
// Representative importers must not overwrite the completed directional package.
if((await read(dir+'/manifest.json')).allEightDirections)throw Error('Eight-direction package exists. Import a new revision separately and revalidate the expansion.');
const [jobs,concepts,defs,combat,slice]=await Promise.all([dir+'/jobs.json','art/player-f2/fusion-concepts/manifest.json','art/animations/player/fusions.json','src/data/combat.json','src/data/slice.json'].map(read));
const id=process.argv.find(a=>a.startsWith('--id='))?.slice(5);if(!id)throw Error('Pass --id=fusionId');const job=jobs.jobs.find(j=>j.id===id);if(!job?.jobId)throw Error('No submitted job '+id);
const rawDir=dir+'/'+id+'/frames';await mkdir(rawDir,{recursive:true});const count=job.returnedFrames||job.requestedFrames+1;
const cached=process.argv.includes('--cached');if(cached){const prior=await read(dir+'/'+id+'/frames.json');if(prior.jobId!==job.jobId)throw Error('Cached frames belong to a different job');}
const images=[];for(let i=0;i<count;i++){
 const file=rawDir+'/'+String(i).padStart(3,'0')+'.png';let bytes;if(cached)bytes=await readFile(file);else{const url=`https://api.pixellab.ai/mcp/images/${job.jobId}/download?index=${i}`;const r=await fetch(url);if(!r.ok)throw Error('Frame '+i+' HTTP '+r.status);bytes=Buffer.from(await r.arrayBuffer());}
 const meta=await sharp(bytes).metadata();if(meta.width!==256||meta.height!==256)throw Error('Unexpected canvas '+JSON.stringify(meta));
 await writeFile(rawDir+'/'+String(i).padStart(3,'0')+'.png',bytes);images.push({bytes,meta,raw:await sharp(bytes).ensureAlpha().raw().toBuffer()});
}
const timeline=fusionTimeline(id,defs,combat,slice),durationMs=Math.round(Math.max(900,Math.min(timeline.durationMs,count*100))/10)*10;
const columns=4,rows=Math.ceil(count/columns),sampleTimesMs=Array.from({length:count},(_,i)=>Math.round(i*durationMs/count/10)*10),frameDurationsMs=sampleTimesMs.map((t,i)=>(sampleTimesMs[i+1]??durationMs)-t);
const sheet=sharp({create:{width:columns*256,height:rows*256,channels:4,background:'#00000000'}}).composite(images.map((im,i)=>({input:im.bytes,left:(i%columns)*256,top:Math.floor(i/columns)*256})));
await sheet.png().toFile(dir+'/'+id+'/sheet.png');const delays=frameDurationsMs.map(t=>Math.round(t/10)*10);delays[delays.length-1]+=400;
await sharp(Buffer.concat(images.map(im=>im.raw)),{raw:{width:256,height:256*count,channels:4,pageHeight:256}}).gif({delay:delays,loop:0,dither:0,effort:4}).toFile(dir+'/'+id+'/preview.gif');
const hasAlpha=images.every(im=>im.meta.hasAlpha),emptyFrames=images.map((im,i)=>im.raw.every((v,j)=>j%4!==3||v===0)?i:-1).filter(i=>i>=0);
if(emptyFrames.length)throw Error('Empty frames '+emptyFrames);const gif=await sharp(dir+'/'+id+'/preview.gif',{animated:true}).metadata();if(gif.pages!==count)throw Error('GIF pages '+gif.pages+' != '+count);if(gif.delay.reduce((s,d)=>s+d,0)!==durationMs+400)throw Error('GIF duration');
const framesManifest={provider:'pixellab',model:'pixminimax',jobId:job.jobId,assetId:job.assetId,direction:'south-east',noSyntheticInbetweenFrames:true,files:Array.from({length:count},(_,i)=>'frames/'+String(i).padStart(3,'0')+'.png')};
await writeFile(dir+'/'+id+'/frames.json',JSON.stringify(framesManifest,null,2)+'\n');
let manifest;try{manifest=await read(dir+'/manifest.json');}catch{manifest={schemaVersion:1,producer:'pixellab_pixminimax',pixelLabGeneration:true,sourceConceptManifest:'../../fusion-concepts/manifest.json',directions:['south-east'],approvedScope:'six_representative_clips',allEightDirections:false,layerSeparation:false,appliedToGame:false,gameplayChanged:false,clips:[]};}
const clip={id,name:concepts.concepts.find(c=>c.id===id).name,direction:'south-east',provider:'pixellab',model:'pixminimax',jobId:job.jobId,assetId:job.assetId,frameWidth:256,frameHeight:256,frameCount:count,generatedFrameCount:job.requestedFrames,includesInputFrame:true,columns,rows,sheet:id+'/sheet.png',gif:id+'/preview.gif',framesManifest:id+'/frames.json',sampleTimesMs,frameDurationsMs,durationMs,gameplayEffectDurationMs:timeline.durationMs,hasAlpha,rootMotionBaked:'AI-composite-unverified',timingMode:'art_review_only_not_damage_event_alignment',qaStatus:'needs_visual_review',qaNotes:[]};
manifest.clips=manifest.clips.filter(c=>c.id!==id);manifest.clips.push(clip);manifest.clips.sort((a,b)=>concepts.concepts.findIndex(c=>c.id===a.id)-concepts.concepts.findIndex(c=>c.id===b.id));manifest.status=manifest.clips.length===6?'six_representative_clips_generated':'partial_generation';
await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');Object.assign(job,{status:'downloaded',returnedFrames:count});await writeFile(dir+'/jobs.json',JSON.stringify(jobs,null,2)+'\n');
console.log(JSON.stringify({id,frames:count,hasAlpha,gifPages:gif.pages,emptyFrames,provider:'pixellab',durationMs}));
