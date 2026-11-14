import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

export async function inspectModel(file, root) {
  const bytes=await fs.readFile(file);
  let document;
  if(file.endsWith('.glb')) {
    assert.equal(bytes.readUInt32LE(0),0x46546c67,'Invalid GLB magic');
    assert.equal(bytes.readUInt32LE(4),2,'Unsupported GLB version');
    assert.equal(bytes.readUInt32LE(8),bytes.length,'Truncated GLB');
    assert.equal(bytes.readUInt32LE(16),0x4e4f534a,'Missing GLB JSON chunk');
    document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  }else document=JSON.parse(bytes.toString());
  assert.equal(document.asset?.version,'2.0','Unsupported glTF version');
  for(const resource of [...document.buffers??[],...document.images??[]]) {
    if(!resource.uri||resource.uri.startsWith('data:'))continue;
    assert.ok(!/^[a-z][a-z\d+.-]*:/i.test(resource.uri),'External resource URL is not bundled');
    const resolved=path.resolve(path.dirname(file),decodeURIComponent(resource.uri));
    assert.ok(resolved.startsWith(path.resolve(root)+path.sep),'Resource escapes asset root');
    const real=await fs.realpath(resolved);
    assert.ok(real.startsWith(path.resolve(root)+path.sep),'Resource symlink escapes asset root');
    const stat=await fs.stat(real);assert.ok(stat.isFile(),'Resource is not a file');
    if(resource.byteLength!==undefined)assert.ok(stat.size>=resource.byteLength,'Truncated external buffer');
  }
  function textures(value,result=[]) {
    if(!value||typeof value!=='object')return result;
    for(const [key,entry] of Object.entries(value)) {
      if(/Texture$/.test(key)&&entry&&Number.isInteger(entry.index))result.push(entry);
      else textures(entry,result);
    }
    return result;
  }
  let primitives=0,textured=0;
  for(const mesh of document.meshes??[])for(const primitive of mesh.primitives??[]) {
    primitives++;
    assert.ok(document.accessors?.[primitive.attributes?.POSITION],`${mesh.name||'mesh'}: missing POSITION accessor`);
    const material=primitive.material===undefined?{}:document.materials?.[primitive.material];
    assert.ok(material,'Missing material reference');
    const references=textures(material);
    if(references.length)textured++;
    for(const reference of references) {
      const texture=document.textures?.[reference.index];assert.ok(texture,'Missing texture reference');
      const image=texture.source??texture.extensions?.KHR_texture_basisu?.source;
      assert.ok(document.images?.[image],'Missing texture image');
      const uv=reference.extensions?.KHR_texture_transform?.texCoord??reference.texCoord??0;
      assert.ok(document.accessors?.[primitive.attributes['TEXCOORD_'+uv]],`${mesh.name||'mesh'}: textured primitive lacks UV${uv}`);
    }
  }
  return {primitives,texturedPrimitives:textured,materials:(document.materials??[]).length,textures:(document.textures??[]).length,
    ceilingNodes:(document.nodes??[]).filter(n=>/^CEIL_/.test(n.name??'')).map(n=>n.name),copyright:document.asset.copyright??null};
}
async function files(directory) {
  const result=[];
  for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())result.push(...await files(file));
    else {assert.ok(entry.isFile(),'Unexpected symlink/non-file: '+file);result.push(file);}
  }
  return result.sort();
}
export async function inventory(root) {
  const entries=[];
  for(const file of await files(path.join(root,'assets'))) {
    const data=await fs.readFile(file),model=/\.gl(?:b|tf)$/.test(file)?await inspectModel(file,path.join(root,'assets')):undefined;
    entries.push({file:path.relative(root,file),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),...(model&&{model})});
  }
  return {schema:1,rightsReview:'ASSET_LICENSES.md (unknown rights remain uncleared)',entries};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const root=fileURLToPath(new URL('../',import.meta.url)),destination=path.join(root,'docs/audit/asset-manifest.json');
  const actual=await inventory(root);
  if(process.argv.includes('--write'))await fs.writeFile(destination,JSON.stringify(actual,null,2)+'\n');
  else assert.deepEqual(actual,JSON.parse(await fs.readFile(destination,'utf8')),'Asset manifest changed: inspect the change and regenerate intentionally with --write');
  console.log(`PASS ${actual.entries.length} bundled files; ${actual.entries.filter(e=>e.model).length} models; hashes, resource references and textured UVs validated. Rights clearance is separate.`);
}
