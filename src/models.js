// glTF models (rust-to-riches props, characters, the Knocker) adapted to both visual styles.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DabSet, FLAG, dabMaterial, underMaterial, paletteFor, toDisplay, registerStyled } from './paint.js';

const loader = new GLTFLoader(), cache = new Map(), modelGeometries=new WeakSet();
export const isModelGeometry=geometry=>modelGeometries.has(geometry);
export const loadModel = (url) => {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => { g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.geometry)modelGeometries.add(o.geometry)}); return g.scene; }));
  return cache.get(url);
};
export const R2R = (key) => loadModel(`./assets/r2r/${key}.gltf`);
export const STUD = 0.3; // rust-to-riches models are authored in studs

// One lit material per source material, colours moved to display space.
const litCache = new WeakMap(), materialSignatures = new WeakMap();
export function litMaterial(src, variant = '') {
  let variants = litCache.get(src);
  if (!variants) { variants = new Map(); litCache.set(src, variants); }
  if (variants.has(variant)) return variants.get(variant);
  const material = src.clone();
  if (src.color) material.color.copy(toDisplay(src.color));
  if (variant === 'item' && material.emissive && material.color) material.emissive.add(material.color.clone().multiplyScalar(.3));
  variants.set(variant, material);
  return material;
}
export const palOf = (src) => paletteFor(toDisplay(src.color));

// A movable copy of a model that follows the style switch (flat tone in paint mode, lit in normal mode).
export function styledClone(src, variant = '', tone = 1) {
  const model = src.clone(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = variant !== 'item'; o.receiveShadow = true;
    registerStyled(o, underMaterial(palOf(o.material), tone, 1, { side: THREE.DoubleSide }), litMaterial(o.material, variant));
  });
  return model;
}

const triArea = (geo) => {
  const p = geo.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let s = 0;
  for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); s += b.sub(a).cross(c.sub(a)).length() * 0.5; }
  return s;
};

// Bakes many placed models into one mesh per material (plus one dab mesh), so scenery costs a handful of draw calls.
// placements: [{ key, x, y, z, rot, s, big, center }]
export async function buildStatic(scene, placements, onProgress = () => {}) {
  const buckets = new Map(), M = new THREE.Matrix4(), T = new THREE.Matrix4(), box = new THREE.Box3();
  const urls = [...new Set(placements.map(p => p.url || `./assets/r2r/${p.key}.gltf`))];
  let loaded = 0;
  onProgress(0, urls.length);
  const sources = new Map(await Promise.all(urls.map(async url => {
    try {
      const source = await loadModel(url);
      onProgress(++loaded, urls.length);
      return [url, source];
    } catch (cause) { throw new Error(`Required model failed: ${url}`, { cause }); }
  })));
  const srcs = placements.map(p => sources.get(p.url || `./assets/r2r/${p.key}.gltf`));
  placements.forEach((p, i) => {
    const src = srcs[i];
    box.setFromObject(src);
    const k = p.scale ?? STUD * (p.s ?? 1);
    M.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot ?? 0), new THREE.Vector3(k, k, k));
    T.makeTranslation(p.center ? -(box.min.x + box.max.x) / 2 : 0, p.keepY ? 0 : -box.min.y, p.center ? -(box.min.z + box.max.z) / 2 : 0);
    M.multiply(T);
    src.traverse((o) => {
      if (!o.isMesh) return;
      if (p.skip) for (let q = o; q; q = q.parent) if (p.skip.test(q.name)) return;
      const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      const groups = Array.isArray(o.material) ? geometry.groups : [{ start: 0, count: geometry.attributes.position.count, materialIndex: 0 }];
      const first = geometry.drawRange.start, last = Math.min(geometry.attributes.position.count, first + geometry.drawRange.count);
      const transform = new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld);
      for (const group of groups) {
        const material = materials[group.materialIndex];
        if (!material) throw new Error(`Missing material group on ${o.name || p.key || p.url}`);
        const start = Math.max(first, group.start), count = Math.min(last, group.start + group.count) - start;
        if (count <= 0) continue;
        const part = new THREE.BufferGeometry();
        for (const [name, attribute] of Object.entries(geometry.attributes)) {
          const source = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
          const stride = attribute.isInterleavedBufferAttribute ? attribute.data.stride : attribute.itemSize;
          const offset = attribute.isInterleavedBufferAttribute ? attribute.offset : 0;
          const values = new source.constructor(count * attribute.itemSize);
          for (let vertex = 0; vertex < count; vertex++) for (let component = 0; component < attribute.itemSize; component++) {
            values[vertex * attribute.itemSize + component] = source[(start + vertex) * stride + offset + component];
          }
          part.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
        }
        part.applyMatrix4(transform);
        const format = Object.entries(part.attributes).sort(([a], [b]) => a.localeCompare(b))
          .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`).join('|');
        let signature = materialSignatures.get(material);
        if (!signature) {
          const properties = material.toJSON();
          for (const field of ['metadata', 'uuid', 'name', 'userData', 'textures', 'images']) delete properties[field];
          signature = JSON.stringify(properties) + material.customProgramCacheKey();
          materialSignatures.set(material, signature);
        }
        const key = `${signature}|${Number(!!p.big)}|${format}`;
        if (!buckets.has(key)) buckets.set(key, { mat: material, big: !!p.big, geos: [] });
        buckets.get(key).geos.push(part);
      }
      geometry.dispose();
    });
  });
  const dabs = new DabSet();
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos), pal = palOf(b.mat);
    if (!geo) throw new Error(`Incompatible geometry for ${b.mat.name || b.mat.uuid}`);
    for (const geometry of b.geos) geometry.dispose();
    const mesh = new THREE.Mesh(geo, null); mesh.castShadow = true; mesh.receiveShadow = true;
    registerStyled(mesh, underMaterial(pal, 2, 0.9, { side: THREE.DoubleSide }), litMaterial(b.mat));
    scene.add(mesh);
    const count = Math.min(b.big ? 45000 : 9000, Math.round(triArea(geo) * (b.big ? 26 : 85)));
    dabs.add(geo, { count, pal, size: b.big ? [0.22, 0.42] : [0.09, 0.18], flag: FLAG.SOLID });
  }
  const dabMesh = dabs.build(dabMaterial());
  dabMesh.userData.fixed = true;
  scene.add(dabMesh);
  return dabMesh;
}

// ---------- rigs: pose bones with angles given in model space, whatever each bone's own axes are
const E = new THREE.Euler(), Rq = new THREE.Quaternion(), Tq = new THREE.Quaternion();
export function rigOf(model) {
  model.updateMatrixWorld(true);
  const inv = model.getWorldQuaternion(new THREE.Quaternion()).invert(), bones = {};
  model.traverse((o) => {
    if (!o.name || o.isMesh) return;
    const w = o.getWorldQuaternion(new THREE.Quaternion()).premultiply(inv);
    bones[o.name] = { o, rest: o.quaternion.clone(), w, wi: w.clone().invert(), x: o.getWorldPosition(new THREE.Vector3()).x };
  });
  const rot = (name, x = 0, y = 0, z = 0) => {
    const b = bones[name]; if (!b) return;
    Rq.setFromEuler(E.set(x, y, z));
    b.o.quaternion.copy(b.rest).multiply(Tq.copy(b.wi).multiply(Rq).multiply(b.w));
  };
  // an attachment point on a bone whose axes match the model's (so offsets read as right/up/forward)
  const anchor = (name) => { const a = new THREE.Object3D(), b = bones[name]; if (b) { a.quaternion.copy(b.wi); b.o.add(a); } return a; };
  return { bones, rot, anchor };
}

// Dabs for a skinned mesh: each dab is stored in the space of the bone that owns its surface point, so it follows the pose.
export function boneDabs(meshes, total, palFn, size) {
  const skinned = meshes[0], sets = new Map(), bind = skinned.bindMatrix, inv = skinned.skeleton.boneInverses;
  const prims = [];
  let all = 0;
  meshes.forEach((o) => { { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; const area = triArea(g); prims.push({ o, g, area }); all += area; } });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), p = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const pr of prims) {
    const pos = pr.g.attributes.position, si = pr.g.attributes.skinIndex, sw = pr.g.attributes.skinWeight, tris = pos.count / 3;
    const cum = new Float32Array(tris); let acc = 0;
    for (let t = 0; t < tris; t++) { a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2); acc += b.sub(a).cross(c.sub(a)).length(); cum[t] = acc; }
    const pal = palFn(pr.o.material), count = Math.max(2, Math.round(total * pr.area / all));
    for (let i = 0; i < count; i++) {
      const r = Math.random() * acc; let lo = 0, hi = tris - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      a.fromBufferAttribute(pos, lo * 3); b.fromBufferAttribute(pos, lo * 3 + 1); c.fromBufferAttribute(pos, lo * 3 + 2);
      let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      p.copy(a).addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
      const vert = lo * 3 + (u + v < 0.34 ? 0 : u > v ? 1 : 2);
      let bone = si.getX(vert), best = sw.getX(vert);
      for (const [gi, gw] of [[si.getY(vert), sw.getY(vert)], [si.getZ(vert), sw.getZ(vert)], [si.getW(vert), sw.getW(vert)]]) if (gw > best) { best = gw; bone = gi; }
      m.multiplyMatrices(inv[bone], bind);
      p.applyMatrix4(m); n.transformDirection(m);
      if (!sets.has(bone)) sets.set(bone, new DabSet());
      const s = sets.get(bone);
      s.pos.push(p.x, p.y, p.z); s.nrm.push(n.x, n.y, n.z);
      s.a.push(size[0] + Math.random() * (size[1] - size[0]), 0, Math.random(), pal);
      s.b.push(0, pal === 14 ? FLAG.EMISSIVE : FLAG.SOLID);
    }
  }
  const mat = dabMaterial();
  for (const [bone, s] of sets) skinned.skeleton.bones[bone].add(s.build(mat));
  return mat;
}
