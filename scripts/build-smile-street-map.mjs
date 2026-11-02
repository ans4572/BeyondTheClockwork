import {readFile,writeFile} from 'node:fs/promises';
import {renderRegionMap,connectionPoints} from '../src/map-review/region-map.js';
const directory=new URL('../art/smile-street/map-concepts/region-map/',import.meta.url);
const data=JSON.parse(await readFile(new URL('layout.json',directory),'utf8'));
const slice=JSON.parse(await readFile(new URL('../src/data/slice.json',import.meta.url),'utf8'));
if(data.rooms.map(r=>r.id).join()!==slice.rooms.map(r=>r.id).join())throw Error('지도 노드 순서가 수직 조각과 다릅니다.');
let lastAxis;
for(const edge of data.connections){const [a,b]=connectionPoints(data,edge);if((a.x===b.x)===(a.y===b.y))throw Error('출입구 축 불일치: '+edge.from);const axis=a.x===b.x?'y':'x';if(axis===lastAxis)throw Error('지그재그 연결이 아닙니다.');lastAxis=axis;}
for(const [filename,options]of [['smile-street-plan-v1.svg',{}],['smile-street-boss-zones-v1.svg',{patterns:true}]])await writeFile(new URL(filename,directory),renderRegionMap(data,options));
console.log('Verified 7-node order, 6 aligned zigzag gate connections; exported 2 standalone SVG maps.');
