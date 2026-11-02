import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import os from 'node:os';import path from 'node:path';
const root='art/animations/player/movement/locomotion',p=JSON.parse(await readFile(root+'/production.json','utf8'));
const require=createRequire(import.meta.url),deps=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'),sharp=require(path.join(deps,'sharp')),JSZip=require(path.join(deps,'jszip'));
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer());};
if(process.argv.includes('--rotations')){
 const source=await readFile(root+'/character-source.txt','utf8'),matches=[...source.matchAll(/^  ([\w-]+): (https:\/\/\S+\.png\?\S+)$/gm)];if(matches.length!==8)throw Error('Expected 8 rotations');await mkdir(root+'/rotations',{recursive:true});
 const images=[];for(const[,direction,url]of matches){const actualUrl=direction==='west'&&p.westRotationEditJobId?`https://api.pixellab.ai/mcp/images/${p.westRotationEditJobId}/download`:url;const bytes=await get(actualUrl);await writeFile(root+'/rotations/'+direction+'.png',bytes);images.push(bytes);}
 await writeFile(root+'/reference.png',await get(`https://api.pixellab.ai/mcp/images/${p.referenceEditJobId}/download`));
 await sharp({create:{width:96*4,height:96*2,channels:4,background:'#00000000'}}).composite(images.map((input,i)=>({input,left:i%4*96,top:Math.floor(i/4)*96}))).png().toFile(root+'/rotations.png');console.log('Downloaded 8 native rotations and reference.');
}else{
 const bytes=await get(`https://api.pixellab.ai/mcp/characters/${p.characterId}/download`);await writeFile(root+'/source-character.zip',bytes);const zip=await JSZip.loadAsync(bytes),entries=Object.values(zip.files).filter(e=>!e.dir).map(e=>e.name);await writeFile(root+'/source-zip-entries.json',JSON.stringify(entries,null,2)+'\n');console.log(JSON.stringify(entries));
}
