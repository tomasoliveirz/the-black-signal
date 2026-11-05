// glTF models (rust-to-riches props, characters, the Knocker) adapted to both visual styles.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DabSet, FLAG, dabMaterial, underMaterial, paletteFor, toDisplay, registerStyled } from './paint.js';

const loader = new GLTFLoader(), cache = new Map();
export const loadModel = (url) => {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).then((g) => { g.scene.updateMatrixWorld(true); return g.scene; }));
  return cache.get(url);
};
export const R2R = (key) => loadModel(`./assets/r2r/${key}.gltf`);
export const STUD = 0.3; // rust-to-riches models are authored in studs

// One lit material per source material, colours moved to display space.
const litCache = new Map();
export function litMaterial(src, variant = '') {
  const key = `${src.name}|${src.color.getHexString()}|${variant}`;
  if (litCache.has(key)) return litCache.get(key);
  const color = toDisplay(src.color);
  const m = new THREE.MeshStandardMaterial({ color, roughness: Math.max(0.45, src.roughness ?? 0.85), metalness: Math.min(0.3, src.metalness ?? 0), side: THREE.DoubleSide });
  if (variant === 'item') { m.emissive = color.clone().multiplyScalar(0.3); }
  if (/glass/i.test(src.name)) { m.roughness = 0.25; m.metalness = 0.3; }
  if (src.transparent && src.opacity < 1) { m.transparent = true; m.opacity = Math.max(0.3, src.opacity); m.depthWrite = false; }
  litCache.set(key, m);
  return m;
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
export async function buildStatic(scene, placements) {
  const buckets = new Map(), M = new THREE.Matrix4(), T = new THREE.Matrix4(), box = new THREE.Box3();
  const srcs = await Promise.all(placements.map((p) => (p.url ? loadModel(p.url) : R2R(p.key)).catch((e) => { console.warn('modelo em falta', p.key, e); return null; })));
  placements.forEach((p, i) => {
    const src = srcs[i]; if (!src) return;
    box.setFromObject(src);
    const k = p.scale ?? STUD * (p.s ?? 1);
    M.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot ?? 0), new THREE.Vector3(k, k, k));
    T.makeTranslation(p.center ? -(box.min.x + box.max.x) / 2 : 0, p.keepY ? 0 : -box.min.y, p.center ? -(box.min.z + box.max.z) / 2 : 0);
    M.multiply(T);
    src.traverse((o) => {
      if (!o.isMesh) return;
      if (p.skip) for (let q = o; q; q = q.parent) if (p.skip.test(q.name)) return;
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld));
      const key = `${o.material.name}|${o.material.color.getHexString()}|${p.big ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, big: !!p.big, geos: [] });
      buckets.get(key).geos.push(g);
    });
  });
  const dabs = new DabSet();
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos), pal = palOf(b.mat);
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
}
