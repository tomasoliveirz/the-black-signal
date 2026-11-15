import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {tab} from './browser-harness.mjs';const page=await tab(1024,576);
try{
 await page.go((process.env.TEST_ORIGIN||'http://127.0.0.1:5173')+'/?free&map=foundry');await page.front();await page.until('Boolean(window.__bs?.world)',35000);await page.ev('__bs.world.ready');
 const results=await page.ev(`(async()=>{
 const {buildPlayer,buildEcho}=await import('/src/figures.js'),{loadModel}=await import('/src/models.js');await Promise.all(['./assets/chars/dana.glb','./assets/chars/eli.glb','./assets/knocker_hd.glb'].map(loadModel));
 const scene=await new Promise(resolve=>{const render=__bs.renderer.render.bind(__bs.renderer);__bs.renderer.render=(scene,camera)=>{const result=render(scene,camera);__bs.renderer.render=render;resolve(scene);return result}});
 const settle=()=>new Promise(resolve=>{requestAnimationFrame(()=>requestAnimationFrame(resolve))});
 const alive=buildPlayer(scene,0);alive.root.position.set(__bs.game.me.s.x-.7,0,__bs.game.me.s.z);await settle();
 const source=await loadModel('./assets/chars/dana.glb');let sourceGeometryDisposals=0;source.traverse(o=>o.geometry?.addEventListener('dispose',()=>sourceGeometryDisposals++));
 const samples=[];for(let cycle=0;cycle<5;cycle++){
  const figures=[buildPlayer(scene,0),buildPlayer(scene,1),buildEcho(scene)];figures.forEach((f,i)=>f.root.position.set(__bs.game.me.s.x+(i-1)*.7,0,__bs.game.me.s.z+.4));await settle();
  figures.forEach(f=>f.dispose?f.dispose():f.root.removeFromParent());await settle();samples.push({cycle,...__bs.renderer.info.memory});
 }
 const premature=buildPlayer(scene,1);if(premature.dispose){premature.dispose();await Promise.resolve();await settle()}
 const result={samples,sourceGeometryDisposals,survivorStillAttached:alive.root.parent===scene,prematureDisposed:typeof premature.dispose==='function'&&!premature.root.parent&&premature.root.children.length===0,disposalAPI:typeof alive.dispose==='function'};
 if(alive.dispose)alive.dispose();else alive.root.removeFromParent();return result;
})()`);
 if(process.env.QA_EVIDENCE_FILE)await fs.writeFile(process.env.QA_EVIDENCE_FILE,JSON.stringify(results,null,2));console.log(results);
 assert.equal(results.disposalAPI,true);assert.equal(results.prematureDisposed,true);assert.equal(results.survivorStillAttached,true);assert.equal(results.sourceGeometryDisposals,0);
 const warm=results.samples[0];for(const sample of results.samples.slice(1)){assert.equal(sample.geometries,warm.geometries,'Repeated figures retain GPU geometries');assert.equal(sample.textures,warm.textures,'Repeated figures retain skeleton textures')}
 assert.deepEqual(page.errors,[]);assert.deepEqual(page.failed,[]);console.log('PASS bounded figure geometry/skeleton lifetime and safe shared source reuse');
}finally{await page.close()}
