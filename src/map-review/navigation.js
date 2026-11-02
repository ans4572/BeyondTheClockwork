const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
export function isReviewWalkable(layout,p,radius=.36){
 for(let i=-1;i<16;i++){const a=i/16*Math.PI*2,q=i===-1?p:{x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius};if(!layout.walkRects.some(r=>inside(q,r)))return false;}
 for(const o of layout.obstacles){if(o.shape==='ellipse'){if(((p.x-o.x)/(o.rx+radius))**2+((p.y-o.y)/(o.ry+radius))**2<=1)return false;}else{const x=Math.max(o.x,Math.min(o.x+o.w,p.x)),y=Math.max(o.y,Math.min(o.y+o.h,p.y));if(Math.hypot(p.x-x,p.y-y)<=radius)return false;}}
 return true;
}
export function moveReviewPlayer(layout,position,input,dt,{speed=5.5,radius=.36}={}){const length=Math.hypot(input.x,input.y),factor=Math.max(1,length),dx=input.x/factor*speed*Math.min(.1,Math.max(0,dt)),dy=input.y/factor*speed*Math.min(.1,Math.max(0,dt)),steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(radius/2))),p={...position};for(let i=0;i<steps;i++){const nextX={x:p.x+dx/steps,y:p.y};if(isReviewWalkable(layout,nextX,radius))p.x=nextX.x;const nextY={x:p.x,y:p.y+dy/steps};if(isReviewWalkable(layout,nextY,radius))p.y=nextY.y;}return p;}
function clearLine(layout,a,b,radius){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.05));for(let i=0;i<=n;i++)if(!isReviewWalkable(layout,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},radius+(i>0&&i<n?.035:0)))return false;return true;}
export function findReviewPath(layout,start,end,{radius=.36,grid=.4}={}){
 if(!isReviewWalkable(layout,start,radius)||!isReviewWalkable(layout,end,radius))return null;if(clearLine(layout,start,end,radius))return [{...start},{...end}];
 const width=Math.ceil(layout.width/grid),height=Math.ceil(layout.height/grid),point=index=>({x:(index%width+.5)*grid,y:(Math.floor(index/width)+.5)*grid}),walk=new Uint8Array(width*height);for(let i=0;i<walk.length;i++)walk[i]=isReviewWalkable(layout,point(i),radius)?1:0;
 const nearest=p=>{let result=-1,distance=Infinity;for(let i=0;i<walk.length;i++){if(!walk[i])continue;const q=point(i),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance&&clearLine(layout,p,q,radius)){distance=d;result=i;}}return result;},from=nearest(start),to=nearest(end);if(from<0||to<0)return null;
 const parents=new Int32Array(walk.length).fill(-1),queue=[from];parents[from]=from;for(let head=0;head<queue.length&&parents[to]===-1;head++){const cur=queue[head],x=cur%width,y=Math.floor(cur/width);for(const [xx,yy]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||xx>=width||yy<0||yy>=height)continue;const next=yy*width+xx;if(!walk[next]||parents[next]!==-1||!clearLine(layout,point(cur),point(next),radius))continue;parents[next]=cur;queue.push(next);}}
 if(parents[to]===-1)return null;const chain=[];for(let i=to;;i=parents[i]){chain.push(point(i));if(i===from)break;}chain.reverse();const raw=[{...start},...chain,{...end}],result=[raw[0]];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!clearLine(layout,raw[i],raw[j],radius))j--;result.push(raw[j]);i=j;}return result;
}
export const oppositeDirection={north:'south',south:'north',east:'west',west:'east'};
export function routeDirections(route){return route.steps.slice(1).map((step,i)=>{const p=route.steps[i].position,dx=step.position.x-p.x,dy=step.position.y-p.y;if((dx===0)===(dy===0))throw new Error('Route edge must use one cardinal direction');return dx>0?'east':dx<0?'west':dy>0?'south':'north';});}
