import test from 'node:test';
import assert from 'node:assert/strict';
import {navStep,navigationNeighbours} from '../shared/nav.js';
import {captureLayout,activateLayout} from '../shared/layout.js';
const saved=captureLayout();
function fixture(colliders,boxes=[]){activateLayout({...saved,MAP_RADIUS:2,BOXES:boxes,LAYOUT:{...saved.LAYOUT,colliders,tx:[]}})}
test('navigation cannot smooth a diagonal between two blocked cardinal cells',()=>{
 try {
  fixture([{x:.75,z:.25,r:.01,h:2},{x:.25,z:.75,r:.01,h:2}]);
  const start={x:.25,z:.25},goal={x:1.25,z:1.25},next=navStep(start,goal);
  assert.notDeepEqual(next,goal,'Blocked diagonal must route around the corner rather than return the direct goal');
 } finally{activateLayout(saved)}
});
test('an unreachable target does not tell the bot to walk into the separating wall',()=>{
 try {
  fixture([],[{x:0,z:0,w:.2,d:4,h:3,gy:0}]);
  const start={x:-1.25,z:.25},goal={x:1.25,z:.25};
  assert.deepEqual(navStep(start,goal),start);
 }finally{activateLayout(saved)}
});

test('neighbours never wrap across a row or leave the grid at any boundary',()=>{
 for(const size of [2,3,8,64]) {
  const blocked=new Uint8Array(size*size);
  for(let cell=0;cell<size*size;cell++)for(const next of navigationNeighbours(cell,size,blocked,true)) {
   assert.ok(next>=0&&next<size*size);
   assert.ok(Math.abs(next%size-cell%size)<=1);
   assert.ok(Math.abs(Math.floor(next/size)-Math.floor(cell/size))<=1);
  }
 }
});
test('diagonal neighbours require both cardinal neighbours to be open',()=>{
 const blocked=new Uint8Array(9);blocked[1]=1;
 assert.ok(!navigationNeighbours(0,3,blocked,true).includes(4));
 blocked[1]=0;blocked[3]=1;
 assert.ok(!navigationNeighbours(0,3,blocked,true).includes(4));
 blocked[3]=0;assert.ok(navigationNeighbours(0,3,blocked,true).includes(4));
});
