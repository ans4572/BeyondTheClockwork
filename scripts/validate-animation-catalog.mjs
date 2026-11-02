import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),base='art/animations',player=base+'/player';
const sets=[
 [player+'/movement/locomotion/manifest.json',24],
 [player+'/movement/attacks/manifest.json',24],
 [player+'/state-clips.json',56],
 [player+'/skills/basic/pixellab/manifest.json',32],
 [player+'/skills/fusion/pixellab/manifest.json',48],
 [player+'/skills/fusion/eight-direction-prototype/manifest.json',48],
 [base+'/npc/clips.json',400],
 [base+'/npc/pixellab/clips.json',408],
 [base+'/mobs/normal-elite/enemy-clips.json',96],
 [base+'/mobs/bosses/boss-clips.json',72]
];
// Concept sheets and packed bundles are not in the repository, so preview pages may link to files a fresh clone lacks.
const LOCAL_ONLY=/\.zip$|concepts\//;
let clips=0,assets=0;
function exists(file){assert.ok(fs.existsSync(file),'Missing asset: '+file);assets++;}
for(const [file,count]of sets){const data=read(file),dir=path.dirname(file);assert.equal(data.clips.length,count,file);clips+=count;for(const clip of [...data.clips,...(data.effects||[])]){
 for(const key of ['image','terminalImage','effectImage','effectBackImage','effectFrontImage','sheet','gif','framesManifest'])if(clip[key])exists(path.resolve(dir,clip[key]));
 for(const key of ['files','sourceFiles'])for(const name of clip[key]||[])exists(path.resolve(dir,name));
 if(clip.framesManifest){const raw=path.resolve(dir,clip.framesManifest);for(const name of read(raw).files)exists(path.resolve(path.dirname(raw),name));}
 }}
for(const bundle of read(base+'/catalog.json').bundles)exists(base+'/'+bundle.preview);
for(const folder of ['movement/reactions','skills/basic']){const dir=player+'/'+folder,html=fs.readFileSync(dir+'/index.html','utf8'),config=read(player+'/states.json'),allowed=new Set(config.states.filter(s=>folder==='skills/basic'?(s.category==='skill'&&s.group==='secondary'):s.category!=='skill').map(s=>s.id));for(const match of html.matchAll(/data-action="([^"]+)"/g))assert.ok(allowed.has(match[1]),'Wrong category button '+match[1]);assert.equal([...html.matchAll(/data-action="/g)].length,allowed.size);}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
for(const file of walk(base).filter(f=>f.endsWith('.html')))for(const match of fs.readFileSync(file,'utf8').matchAll(/(?:src|href)="([^"]+)"/g)){const link=match[1].split(/[?#]/)[0];if(!link||/^(https?:|data:)/.test(link)||LOCAL_ONLY.test(link))continue;exists(link.startsWith('/')?link.slice(1):path.resolve(path.dirname(file),link));}
console.log(JSON.stringify({manifests:sets.length,bodyClips:clips,bossProjectiles:8,verifiedReferences:assets,categoryButtons:'verified'}));
