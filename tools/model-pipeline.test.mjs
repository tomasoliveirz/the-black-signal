import assert from 'node:assert/strict';
import {tab} from './browser-harness.mjs';
const page=await tab(1024,720);
try {
 await page.go((process.env.TEST_ORIGIN||'http://localhost:5173')+'/?free&map=foundry');await page.front();
 await page.until('Boolean(window.__bs?.world)',35000);
 const result=await page.ev(`(async()=>{
  const THREE=await import('three'),m=await import('/src/models.js');
  const source=await m.loadModel('/assets/qa/checker.gltf');
  const originals=[];source.traverse(o=>{if(o.isMesh)originals.push(o.material)});
  originals[0].normalMap=originals[1].map;originals[0].roughnessMap=originals[1].map;originals[0].metalnessMap=originals[1].map;originals[0].alphaMap=originals[1].map;
  const lit=m.litMaterial(originals[0]), other=m.litMaterial(originals[1]);
  const scene=new THREE.Scene();
  await m.buildStatic(scene,[{url:'/assets/qa/checker.gltf',x:0,y:0,z:0,scale:1,keepY:true}]);
  const batches=scene.children.filter(o=>o.isMesh&&!o.geometry.isInstancedBufferGeometry);
  const attributes=batches.map(o=>Object.keys(o.geometry.attributes).sort());
  const sourceGeometry=new THREE.BufferGeometry();
  sourceGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,2,0,0,3,0,0,2,1,0],3));sourceGeometry.computeVertexNormals();
  sourceGeometry.addGroup(0,3,0);sourceGeometry.addGroup(3,3,1);
  const grouped=new THREE.Mesh(sourceGeometry,originals);source.add(grouped);
  window.__pipelineScene=scene;
  const groupedScene=new THREE.Scene();let groupError=null;try {await m.buildStatic(groupedScene,[{url:'/assets/qa/checker.gltf',x:0,y:0,z:0,scale:1,keepY:true}]);}catch(error){groupError=error.message;}
  const groupBatches=groupedScene.children.filter(o=>o.isMesh&&!o.geometry.isInstancedBufferGeometry);
  return {normalKept:lit.normalMap===originals[0].normalMap,roughnessMapKept:lit.roughnessMap===originals[0].roughnessMap,metalnessMapKept:lit.metalnessMap===originals[0].metalnessMap,alphaMapKept:lit.alphaMap===originals[0].alphaMap,groupError,sourceMaps:originals.map(o=>Boolean(o.map)),mapKept:lit.map===originals[0].map,roughnessKept:lit.roughness===originals[0].roughness,metalnessKept:lit.metalness===originals[0].metalness,alphaKept:lit.alphaTest===originals[0].alphaTest,vertexColorsKept:lit.vertexColors,distinct:lit!==other,batches:batches.length,attributes,allBatchMaps:batches.every(o=>!!o.material.map),groupTriangles:groupBatches.reduce((sum,o)=>sum+o.geometry.attributes.position.count/3,0)};
 })()`);
 if(process.env.TEST_CAPTURE){
  await page.ev('window.requestAnimationFrame=()=>0');await new Promise(resolve=>setTimeout(resolve,150));
  await page.ev(`(async()=>{const T=await import('three');const scene=__pipelineScene;scene.background=new T.Color(0x333c42);scene.add(new T.HemisphereLight(0xffffff,0x333333,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(1,3,4);scene.add(light);const camera=new T.PerspectiveCamera(45,1024/720,.1,100);camera.position.set(1.5,1.1,8);camera.lookAt(1.5,1,0);document.querySelectorAll('.hud,.vignette').forEach(n=>n.style.visibility='hidden');__bs.renderer.render(scene,camera)})()`);
  await page.capture(process.env.TEST_CAPTURE);
 }
 console.log(result);
 assert.equal(result.groupError,null);
 assert.deepEqual(result.sourceMaps,[true,true]);
 for(const key of ['normalKept','roughnessMapKept','metalnessMapKept','alphaMapKept','mapKept','roughnessKept','metalnessKept','alphaKept','vertexColorsKept','distinct','allBatchMaps'])assert.equal(result[key],true,key);
 assert.equal(result.batches,2,'Different maps must not collapse into one bucket');
 for(const names of result.attributes)for(const name of ['position','normal','uv','color','tangent'])assert.ok(names.includes(name),name);
 assert.equal(result.groupTriangles,6,'Four glTF triangles plus two grouped triangles; no duplicated faces');
 assert.deepEqual(page.errors,[]);assert.deepEqual(page.failed,[]);console.log('PASS real glTF loader → material conversion → static batches',result);
} finally {await page.close()}
