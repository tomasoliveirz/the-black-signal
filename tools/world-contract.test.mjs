import assert from 'node:assert/strict';import {tab} from './browser-harness.mjs';
const page=await tab(1024,576);
try{
 for(const map of ['amberwood','hollow','frost','ashfall','foundry','mall']){
  await page.go((process.env.TEST_ORIGIN||'http://localhost:5173')+'/?free&map='+map);await page.front();
  await page.until('Boolean(window.__bs?.world) && document.querySelector("#stats").textContent.includes("draw calls")',35000);await page.ev('window.__bs.world.ready');
  const result=await page.ev(`({drawCalls:__bs.renderer.info.render.calls,practicals:__bs.world.practicals.every(p=>p.mesh?.geometry&&p.mesh.parent&&['work','street','egress'].includes(p.kind)),style:document.querySelector('#visual')===null})`);
  assert.ok(result.drawCalls>0,map);assert.equal(result.practicals,true,map);assert.equal(result.style,true,map);console.log(map,result);
 }
 assert.deepEqual(page.errors,[]);assert.deepEqual(page.failed,[]);console.log('PASS all six actual WebGL worlds, fixture contracts and required requests');
}finally{await page.close()}
