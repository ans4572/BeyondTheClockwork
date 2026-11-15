/** Crossed cutting paths in engine x/y units (자성 빙쇄's box went 2026-11-16: its jaws now close on a round reach). */
export function crosscutSegment(origin,angle,behavior,index){
 const f={x:Math.cos(angle),y:Math.sin(angle)},r={x:-f.y,y:f.x},side=index%2===0?1:-1;
 const point=(d,s)=>({x:origin.x+f.x*d+r.x*s,y:origin.y+f.y*d+r.y*s});
 const start=point(behavior.startDistance,behavior.startSide??0),split=point(behavior.splitDistance??behavior.startDistance,side*behavior.spread),end=point(behavior.range,-side*behavior.spread);
 return {start,split,end,points:[start,split,end],halfWidth:behavior.halfWidth};
}
