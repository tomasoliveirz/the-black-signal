import test from 'node:test';import assert from 'node:assert/strict';
import {setMap,LAYOUT,EXTRACT,BOXES,MAP,MAP_RADIUS,captureLayout,activateLayout,inBox} from '../shared/layout.js';
import {collide,newMove,stepMove} from '../shared/sim.js';import {navStep} from '../shared/nav.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function travel(from,to,arrival=1){const p={x:from.x,z:from.z},start={...p};let length=0,stalled=0;for(let i=0;i<5000&&distance(p,to)>arrival;i++){const target=navStep(p,to),before={...p},dx=target.x-p.x,dz=target.z-p.z,norm=Math.max(.12,Math.hypot(dx,dz));p.x+=dx/norm*.12;p.z+=dz/norm*.12;collide(p,.42);const moved=distance(p,before);length+=moved;stalled=moved<.001?stalled+1:0;if(stalled>50)return {reached:false,length,at:p,start};}return {reached:distance(p,to)<=arrival,length,at:p,start};}
for(const id of ['foundry','ashfall'])test(id+' authored routes are actually traversable and keep the final relay away from extraction',()=>{
 const saved=captureLayout();try{
 setMap(id);const reference=LAYOUT.reference;assert.ok(reference);assert.equal(LAYOUT.items.length,18);assert.equal(LAYOUT.blood.length,12);assert.equal(LAYOUT.spawns.length,6);assert.ok(distance(LAYOUT.tx[2],EXTRACT)>30);
 const problems=[];
 for(const route of reference.routes)for(let n=1;n<route.points.length;n++){
  const a=route.points[n-1],b=route.points[n],length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(length/.25);
  for(let step=0;step<=steps;step++){const t=step/steps,point={x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t};for(const radius of [.42,.82]){const moved={...point};collide(moved,radius);if(distance(moved,point)>.001){problems.push({route:route.id,radius,point,moved,near:LAYOUT.colliders.filter(c=>distance(c,point)<c.r+radius+.05)});break}}if(problems.length>8)break;
  }
 }
 assert.equal(problems.length,0,'Authored path capsule intersects a collider '+JSON.stringify(problems));
 for(const p of [...LAYOUT.spawns,...LAYOUT.items,...LAYOUT.blood])assert.ok(!inBox(p.x,p.z,.4)&&Math.hypot(p.x,p.z)<MAP_RADIUS-1,'Placed object must be in playable space');
 for(const target of LAYOUT.tx){const result=travel(LAYOUT.spawns[0],target,2);assert.equal(result.reached,true,JSON.stringify({target,result}))}
 const result=travel({x:LAYOUT.tx[2].x+2,z:LAYOUT.tx[2].z},EXTRACT,EXTRACT.r-1);assert.equal(result.reached,true,JSON.stringify(result));assert.ok(result.length>25,JSON.stringify(result));console.log(id,{lastRelayStraight:distance(LAYOUT.tx[2],EXTRACT),finalTravelMetres:result.length});
 }finally{activateLayout(saved)}
});
test('Foundry evacuation stays reachable through either real rear door',()=>{
 const saved=captureLayout();try{setMap('foundry');const base=captureLayout(),from={x:LAYOUT.tx[2].x+2,z:LAYOUT.tx[2].z};for(const [x,w] of [[-15,4],[19,10]]){activateLayout({...base,BOXES:[...base.BOXES,{x,z:-82.5,w,d:1,h:7,gy:0}],LAYOUT:{...base.LAYOUT}});const result=travel(from,EXTRACT,EXTRACT.r-1);assert.equal(result.reached,true,JSON.stringify({blocked:x,result}))}}finally{activateLayout(saved)}
});

test('Ashfall pavement uses the same authored surface heights for movement and rendering',()=>{
 const saved=captureLayout();try{setMap('ashfall');for(const surface of MAP.reference.surfaces)assert.equal(newMove(surface.x,surface.z).y,surface.h);
 const player=newMove(6,-40);for(let i=0;i<30;i++)stepMove(player,{mx:1,mz:0},1/30);assert.equal(player.y,.08);assert.equal(player.grounded,true);
 }finally{activateLayout(saved)}
});
