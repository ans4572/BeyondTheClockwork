import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
const require=createRequire(import.meta.url),sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const root='art/animations/player/skills/fusion/pixellab';
const manifest=JSON.parse(await readFile('art/player-f2/fusion-concepts/manifest.json','utf8'));
await mkdir(root+'/inputs',{recursive:true});
const entries=[];
for(const c of manifest.concepts){
 const file='art/player-f2/fusion-concepts/'+c.image,meta=await sharp(file).metadata(),start=Math.round(c.panelBounds[0]*meta.width)+12,end=Math.round(c.panelBounds[1]*meta.width)-12;
 const crop={left:start,top:12,width:end-start,height:meta.height-24};
 await sharp(file).extract(crop).png().toFile(root+'/inputs/'+c.id+'-source.png');
 await sharp(file).extract(crop).resize(256,256,{fit:'contain',background:'#fbf8ea',kernel:'nearest'}).png({palette:true,colours:64}).toFile(root+'/inputs/'+c.id+'-input.png');
 entries.push({id:c.id,name:c.name,direction:'south-east',source:'../../fusion-concepts/'+c.image,crop,input:'inputs/'+c.id+'-input.png',sourceCrop:'inputs/'+c.id+'-source.png'});
}
await writeFile(root+'/preparation.json',JSON.stringify({schemaVersion:1,producer:'pixellab_reference_inputs',sourceArtProducer:'built_in_image_gen',pixelLabAnimationsCreated:false,entries},null,2)+'\n');
console.log('Prepared six concept-derived inputs; originals and current animations preserved.');
