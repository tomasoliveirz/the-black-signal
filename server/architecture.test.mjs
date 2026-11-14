import test from 'node:test';import assert from 'node:assert/strict';
import {setMap,LAYOUT,MAP,captureLayout,activateLayout} from '../shared/layout.js';
import {obstacle} from '../shared/sight.js';import {collide} from '../shared/sim.js';
test('Foundry ceiling blocks overhead camera/shot rays while preserving the floor route',()=>{
 const saved=captureLayout();try{
  setMap('foundry');assert.equal(LAYOUT.overhead.length,1);assert.ok(MAP.mastH<LAYOUT.overhead[0].gy);
  assert.ok(obstacle({x:0,y:1.5,z:-5},{x:0,y:12,z:-5},false)<1);
  assert.equal(obstacle({x:0,y:1.5,z:-5},{x:0,y:1.5,z:-10},false),1);
  const p={x:0,z:-5};collide(p,.42);assert.deepEqual(p,{x:0,z:-5},'Ceiling must not become a 2D floor blocker');
 }finally{activateLayout(saved)}
});
