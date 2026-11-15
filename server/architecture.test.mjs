import test from 'node:test';import assert from 'node:assert/strict';
import {setMap,LAYOUT,MAP,captureLayout,activateLayout} from '../shared/layout.js';
import '../shared/maps/index.js';
import {obstacle} from '../shared/sight.js';import {collide} from '../shared/sim.js';
test('Foundry ceiling blocks overhead camera/shot rays while preserving the floor route',()=>{
 const saved=captureLayout();try{
  setMap('foundry');assert.ok(LAYOUT.overhead.length>=1);assert.ok(MAP.mastH<LAYOUT.overhead[0].gy);
  assert.ok(obstacle({x:0,y:1.5,z:-5},{x:0,y:12,z:-5},false)<1);
  assert.equal(obstacle({x:0,y:1.5,z:-5},{x:0,y:1.5,z:-10},false),1);
  const p={x:0,z:-5};collide(p,.42);assert.deepEqual(p,{x:0,z:-5},'Ceiling must not become a 2D floor blocker');
 }finally{activateLayout(saved)}
});

test('Mall includes authored ceiling triangles and prevents rays escaping the main hall roof',()=>{
 const saved=captureLayout();try{
  setMap('mall');assert.ok(LAYOUT.ceilingTriangles?.length>0,'Imported ceiling geometry must be shared with ray queries');
  assert.ok(obstacle({x:-9.75,y:1.5,z:20},{x:-9.75,y:12,z:20},false)<1,'Main hall roof blocks upward rays');
  assert.equal(obstacle({x:-9.75,y:1.5,z:20},{x:-9.75,y:1.5,z:21},false),1,'Floor route remains clear');
 }finally{activateLayout(saved)}
});
