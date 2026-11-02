import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
const require=createRequire(import.meta.url),sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const dir='art/animations/player/skills/fusion/pixellab',read=async p=>JSON.parse(await readFile(p,'utf8')),m=await read(dir+'/manifest.json'),results=[];
if(m.allEightDirections){const check=spawnSync(process.execPath,['scripts/validate-fusion-expansion.mjs'],{stdio:'inherit'});process.exit(check.status??1);}
for(const c of m.clips){const raw=await read(dir+'/'+c.framesManifest),touches=[];if(raw.files.length!==c.frameCount)throw Error('Frame count '+c.id);
 for(const [i,file]of raw.files.entries()){const p=path.join(dir,path.dirname(c.framesManifest),file),im=sharp(p),meta=await im.metadata(),buf=await im.ensureAlpha().raw().toBuffer();if(meta.width!==256||meta.height!==256||!meta.hasAlpha)throw Error('Frame format '+p);
  const sides=[];for(const side of ['left','right','top','bottom']){let count=0;for(let j=0;j<256;j++){const x=side==='left'?0:side==='right'?255:j,y=side==='top'?0:side==='bottom'?255:j;if(buf[(y*256+x)*4+3]>32)count++;}if(count)sides.push({side,pixels:count});}if(sides.length)touches.push({frame:i,sides});
 }
 const gif=await sharp(dir+'/'+c.gif,{animated:true}).metadata(),duration=gif.delay.reduce((s,d)=>s+d,0);if(gif.pages!==c.frameCount||duration!==c.durationMs+400)throw Error('GIF timing '+c.id);
 results.push({id:c.id,frameCount:c.frameCount,generatedFrameCount:c.generatedFrameCount,alpha:true,gifPages:gif.pages,gifDurationMs:duration,boundaryTouchFrames:touches,sourceJobId:c.jobId});
}
const report={schemaVersion:1,pixelLabGeneration:true,clips:results.length,totalSourceFrames:results.reduce((s,r)=>s+r.frameCount,0),totalGeneratedFrames:results.reduce((s,r)=>s+r.generatedFrameCount,0),artApproval:'review_drafts_only',boundaryTouchesAreReviewFlagsNotAutoAcceptance:true,results};await writeFile(dir+'/validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({clips:report.clips,sourceFrames:report.totalSourceFrames,generatedFrames:report.totalGeneratedFrames,boundaryTouchCounts:results.map(r=>({id:r.id,frames:r.boundaryTouchFrames.length}))}));
