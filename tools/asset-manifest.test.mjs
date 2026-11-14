import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {inspectModel} from './validate-assets.mjs';
const fixture=new URL('../assets/qa/checker.gltf',import.meta.url);
test('a real textured model validates and missing UVs are rejected',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'bs-assets-'));
 try{
  const original=JSON.parse(await fs.readFile(fixture,'utf8'));
  for(const name of ['checker.bin','checker.png','checker-alt.png'])await fs.copyFile(new URL('../assets/qa/'+name,import.meta.url),path.join(root,name));
  const file=path.join(root,'checker.gltf');await fs.writeFile(file,JSON.stringify(original));assert.ok((await inspectModel(file,root)).texturedPrimitives>0);
  delete original.meshes[0].primitives[0].attributes.TEXCOORD_0;await fs.writeFile(file,JSON.stringify(original));await assert.rejects(inspectModel(file,root),/lacks UV0/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('missing local resources and unbundled remote resources fail closed',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'bs-assets-'));
 try{const file=path.join(root,'bad.gltf'),base={asset:{version:'2.0'},buffers:[{uri:'missing.bin',byteLength:12}]};
 await fs.writeFile(file,JSON.stringify(base));await assert.rejects(inspectModel(file,root),{code:'ENOENT'});
 base.buffers[0].uri='https://example.invalid/tracker.bin';await fs.writeFile(file,JSON.stringify(base));await assert.rejects(inspectModel(file,root),/not bundled/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
