/** Shared palm launch and crossed cutting paths in engine x/y units. */
export function crosscutSegment(origin,angle,behavior,index){
 const f={x:Math.cos(angle),y:Math.sin(angle)},r={x:-f.y,y:f.x},side=index%2===0?1:-1;
 const point=(d,s)=>({x:origin.x+f.x*d+r.x*s,y:origin.y+f.y*d+r.y*s});
 const start=point(behavior.startDistance,behavior.startSide??0),split=point(behavior.splitDistance??behavior.startDistance,side*behavior.spread),end=point(behavior.range,-side*behavior.spread);
 return {start,split,end,points:[start,split,end],halfWidth:behavior.halfWidth};
}

/** Ground footprint shared by the targeted jaws, combat and preview. */
export function clampContains(point,center,angle,behavior,radius=0){
 const dx=point.x-center.x,dy=point.y-center.y,forward=dx*Math.cos(angle)+dy*Math.sin(angle),side=-dx*Math.sin(angle)+dy*Math.cos(angle);
 return Math.abs(forward)<=behavior.halfLength+radius&&Math.abs(side)<=behavior.halfWidth+radius;
}
export function clampCorners(center,angle,behavior){
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:center.x+Math.cos(angle)*u*behavior.halfLength-Math.sin(angle)*v*behavior.halfWidth,y:center.y+Math.sin(angle)*u*behavior.halfLength+Math.cos(angle)*v*behavior.halfWidth}));
}
