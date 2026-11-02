import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
const require=createRequire(import.meta.url),sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const root='art/animations/player/skills/fusion/pixellab',variant='frostCrosscut-curved-v3',dir=root+'/'+variant;
const read=async p=>JSON.parse(await readFile(p,'utf8')),save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
// Representative importers must not overwrite the completed directional package.
if((await read(root+'/manifest.json')).allEightDirections)throw Error('Eight-direction package exists. Import a new revision separately and revalidate the expansion.');
const revision=await read(root+'/frost-curved-revision.json');
await mkdir(dir+'/frames',{recursive:true});
if(!process.argv.includes('--apply')){
 const count=revision.requestedFrames+1,images=[];
 for(let i=0;i<count;i++){
  const url=`https://api.pixellab.ai/mcp/images/${revision.jobId}/download?index=${i}`,r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status+' frame '+i);
  const bytes=Buffer.from(await r.arrayBuffer()),meta=await sharp(bytes).metadata();if(meta.width!==256||meta.height!==256||!meta.hasAlpha)throw Error('Invalid PNG');
  await writeFile(`${dir}/frames/${String(i).padStart(3,'0')}.png`,bytes);images.push({bytes,raw:await sharp(bytes).ensureAlpha().raw().toBuffer()});
 }
 const columns=4,rows=Math.ceil(count/columns),durationMs=1200,sampleTimesMs=Array.from({length:count},(_,i)=>Math.round(i*durationMs/count/10)*10),frameDurationsMs=sampleTimesMs.map((t,i)=>(sampleTimesMs[i+1]??durationMs)-t);
 await sharp({create:{width:columns*256,height:rows*256,channels:4,background:'#00000000'}}).composite(images.map((im,i)=>({input:im.bytes,left:i%columns*256,top:Math.floor(i/columns)*256}))).png().toFile(dir+'/sheet.png');
 const delay=[...frameDurationsMs];delay[count-1]+=400;
 await sharp(Buffer.concat(images.map(im=>im.raw)),{raw:{width:256,height:256*count,channels:4,pageHeight:256}}).gif({delay,loop:0,dither:0,effort:4}).toFile(dir+'/preview.gif');
 await save(dir+'/frames.json',{provider:'pixellab',model:'pixminimax',jobId:revision.jobId,assetId:revision.assetId,direction:'south-east',noSyntheticInbetweenFrames:true,files:images.map((_,i)=>`frames/${String(i).padStart(3,'0')}.png`)});
 Object.assign(revision,{status:'downloaded_for_review',returnedFrames:count,durationMs,sampleTimesMs,frameDurationsMs,columns,rows});await save(root+'/frost-curved-revision.json',revision);
 console.log(JSON.stringify({variant,frames:count,jobId:revision.jobId}));
}else{
 if(!revision.returnedFrames)throw Error('Download and review first');
 const manifest=await read(root+'/manifest.json'),clip=manifest.clips.find(c=>c.id==='frostCrosscut');
 clip.previousVersion='frostCrosscut/sheet.png';Object.assign(clip,{jobId:revision.jobId,assetId:revision.assetId,frameCount:revision.returnedFrames,generatedFrameCount:revision.requestedFrames,columns:revision.columns,rows:revision.rows,sheet:variant+'/sheet.png',gif:variant+'/preview.gif',framesManifest:variant+'/frames.json',durationMs:revision.durationMs,sampleTimesMs:revision.sampleTimesMs,frameDurationsMs:revision.frameDurationsMs,artRevision:'curved-v3',qaStatus:'art_review_draft',qaNotes:['픽셀랩 AI 재생성: 휘어진 초승달 두 개가 동시에 세로 X로 발사','칼날 네 끝을 가늘게 정리한 검토본; 본편 타격 시점·레이어·8방향은 후속 작업']});
 await save(root+'/manifest.json',manifest);
 const jobs=await read(root+'/jobs.json'),old=jobs.jobs.find(j=>j.id==='frostCrosscut');jobs.history??=[];if(!jobs.history.some(j=>j.jobId===old.jobId))jobs.history.push({...old,revision:'original-v2'});
 Object.assign(old,{jobId:revision.jobId,assetId:revision.assetId,status:'downloaded',requestedFrames:revision.requestedFrames,returnedFrames:revision.returnedFrames,seed:revision.seed,generations:revision.generations,revision:'curved-v3'});
 jobs.generationConstraint='Original six trial clips preserved; frostCrosscut regenerated after user subscription activation';jobs.currentSubscription='active';await save(root+'/jobs.json',jobs);
 const prompts=await read(root+'/prompts.json'),prompt=prompts.items.find(p=>p.id==='frostCrosscut');prompts.history??=[];if(!prompts.history.some(p=>p.seed===prompt.seed))prompts.history.push({...prompt});Object.assign(prompt,{description:revision.prompt,frames:revision.requestedFrames,seed:revision.seed,revision:'curved-v3'});await save(root+'/prompts.json',prompts);
 revision.status='applied_to_art_review';await save(root+'/frost-curved-revision.json',revision);
 for(const p of ['art/animations/player/character.json','art/player-f2/fusion-concepts/manifest.json']){const data=await read(p),upgrade=data.fusionPixelLabUpgrade??data.pixelLabQualityUpgrade;if(upgrade){upgrade.sourceFrames=manifest.clips.reduce((s,c)=>s+c.frameCount,0);if('generatedFrames'in upgrade)upgrade.generatedFrames=manifest.clips.reduce((s,c)=>s+c.generatedFrameCount,0);}await save(p,data);}
 console.log('Applied curved AI revision to art review; previous source files preserved.');
}
