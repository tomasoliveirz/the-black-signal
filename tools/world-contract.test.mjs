import assert from 'node:assert/strict';import {tab} from './browser-harness.mjs';
const page=await tab(1024,576);
try{
 for(const map of ['amberwood','hollow','frost','ashfall','foundry','mall']){
  await page.go((process.env.TEST_ORIGIN||'http://localhost:5173')+'/?free&map='+map);await page.front();
  await page.until('Boolean(window.__bs?.world) && document.querySelector("#stats").textContent.includes("draw calls")',35000);await page.ev('window.__bs.world.ready');
  const result=await page.ev(`({drawCalls:__bs.renderer.info.render.calls,practicals:__bs.world.practicals.every(p=>p.mesh?.geometry&&p.mesh.parent&&['work','street','egress'].includes(p.kind)),style:document.querySelector('#visual')===null})`);
  if(map==='ashfall'){
   const floors=await page.ev(`(async()=>{const THREE=await import('three'),{height}=await import('/shared/layout.js');const ray=new THREE.Raycaster(),root=__bs.world.meshes[0].parent;ray.camera=__bs.camera;root.updateMatrixWorld(true);return [[0,-39],[8.4,-39],[6.88,-39],[10.5,-39]].map(([x,z])=>{ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));return {x,z,movement:height(x,z),rendered:ray.intersectObject(root,true)[0]?.point.y}})})()`);
   for(const floor of floors)assert.ok(Math.abs(floor.rendered-floor.movement)<.01,'Rendered floor differs from authoritative movement: '+JSON.stringify(floor));console.log('Ashfall actual floor rays',floors);
  }
  assert.ok(result.drawCalls>0,map);assert.equal(result.practicals,true,map);assert.equal(result.style,true,map);console.log(map,result);
 }
 assert.deepEqual(page.errors,[]);assert.deepEqual(page.failed,[]);console.log('PASS all six actual WebGL worlds, fixture contracts and required requests');
}finally{await page.close()}
