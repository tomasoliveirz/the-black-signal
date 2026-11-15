// Figures in both styles: dabs are pinned to each bone (paint), lit meshes cast shadows (normal).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { DabSet, FLAG, dabMaterial, underMaterial, stdMaterial, styledMesh, registerStyled, toDisplay, pruneDetached } from './paint.js';
import { loadModel, litMaterial, palOf, rigOf, boneDabs, isModelGeometry } from './models.js';

function disposeParts(root){
  const geometries=new Set(),skeletons=new Set();
  root.traverse(o=>{if(o.geometry&&!isModelGeometry(o.geometry))geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton)});
  for(const skeleton of skeletons)skeleton.dispose();
  for(const geometry of geometries)geometry.dispose();
  root.removeFromParent();root.clear();pruneDetached();
}

let mat;
function part(parent, geo, pal, count, size, at = [0, 0, 0], flag = FLAG.SOLID) {
  mat ??= dabMaterial();
  const pivot = new THREE.Object3D(); pivot.position.set(...at); parent.add(pivot);
  pivot.add(styledMesh(geo, underMaterial(pal, pal === 14 ? 1 : 2, 0.9, { side: THREE.DoubleSide }), stdMaterial(pal, { key: 'fig', side: THREE.DoubleSide })));
  pivot.add(new DabSet().add(geo, { count, pal, size, flag }).build(mat));
  return pivot;
}
const limb = (r, len, r2 = r) => new THREE.CylinderGeometry(r, r2, len, 8, 3).translate(0, -len / 2, 0);
const blob = (rx, ry, rz, y = 0) => new THREE.SphereGeometry(1, 12, 9).scale(rx, ry, rz).translate(0, y, 0);

// ---------- survivors: six rigged characters (tomy_studios), one per slot, so players are told apart at a glance
const CHARS = ['dana', 'eli', 'maya', 'porter', 'vale', 'member_a'];
export function buildPlayer(scene, slot = 0) {
  const root = new THREE.Object3D(); scene.add(root);
  const lampPos = new THREE.Vector3();
  const fallback = proceduralPlayer(root, slot, lampPos);
  let anim = fallback.update, disposed=false;
  loadModel(`./assets/chars/${CHARS[slot % CHARS.length]}.glb`).then((src) => {
    if(disposed)return;
    mat ??= dabMaterial();
    const model = cloneSkinned(src), holder = new THREE.Object3D();
    holder.add(model); root.add(holder);disposeParts(fallback.group);
    const meshes = []; model.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const pal = palOf(o.material);
      o.castShadow = true; o.receiveShadow = true;
      registerStyled(o, underMaterial(pal, 1, 0.95, { side: THREE.DoubleSide }), litMaterial(o.material));
      o.geometry.computeBoundingBox();
      const s = o.geometry.boundingBox.getSize(new THREE.Vector3()), area = (s.x * s.y + s.y * s.z + s.x * s.z) * 2;
      if (area > 0.02) o.add(new DabSet().add(o.geometry, { count: Math.min(110, Math.round(area * 420)), pal, size: [0.04, 0.075] }).build(mat));
    }
    const rig = rigOf(model), side = (n) => Math.sign(rig.bones[n]?.x || 1);
    const lamp = part(rig.anchor('handL'), new THREE.IcosahedronGeometry(0.06, 1).translate(0, -0.15, 0.03), 14, 36, [0.05, 0.08], undefined, FLAG.EMISSIVE);
    part(rig.anchor('handR'), new THREE.BoxGeometry(0.045, 0.21, 0.08).translate(0, -0.1, 0.05), 22, 26, [0.035, 0.06]);
    const st = { phase: 0, lean: 0, crouch: 0, aim: 0 };
    anim = (dt, speed, grounded, vy, crouching, accel, aiming = false) => {
      const run = THREE.MathUtils.clamp(speed / 5.4, 0, 1), moving = speed > 0.15;
      st.phase += dt * (moving ? 5.2 + speed * 1.5 : 0);
      if (!moving) st.phase += (Math.round(st.phase / Math.PI) * Math.PI - st.phase) * Math.min(1, dt * 8);
      st.crouch += ((crouching ? 1 : 0) - st.crouch) * Math.min(1, dt * 10);
      st.aim += ((aiming ? 1 : 0) - st.aim) * Math.min(1, dt * 14);
      st.lean += (THREE.MathUtils.clamp(accel * 0.012, -0.2, 0.2) + run * 0.2 - st.lean) * Math.min(1, dt * 8);
      const p = st.phase, A = moving ? 0.35 + run * 0.6 : 0, air = grounded ? 0 : 1, k = st.crouch, idle = 1 - Math.min(1, speed);
      holder.position.y = -k * 0.3 + (moving && grounded ? Math.abs(Math.sin(p)) * 0.045 * (0.5 + run) : 0);
      rig.rot('hips', st.lean + k * 0.35, Math.sin(p) * 0.08 * A);
      rig.rot('spine', st.lean * 0.3 + k * 0.12, -Math.sin(p) * 0.1 * A);
      rig.rot('chest', st.lean * 0.3 + k * 0.13 + Math.sin(st.t = (st.t || 0) + dt * 1.6) * 0.015 * idle, -Math.sin(p) * 0.1 * A);
      rig.rot('head', -st.lean * 0.9 - k * 0.5);
      for (const [S, ph] of [['L', p], ['R', p + Math.PI]]) {
        rig.rot('thigh' + S, -Math.sin(ph) * A * (1 - air) - k * 1.1 - air * 0.5 - st.lean);
        rig.rot('shin' + S, Math.max(0, Math.cos(ph)) * A * 1.5 * (1 - air) + 0.06 + k * 1.7 + air * 0.9);
        rig.rot('foot' + S, -k * 0.55 - Math.max(0, Math.cos(ph)) * A * 0.3 * (1 - air));
      }
      // right arm carries the pistol (raised to aim), left arm holds the lantern forward
      rig.rot('upperarmR', THREE.MathUtils.lerp(Math.sin(p) * A * 0.9 - air * 0.6, -1.35, st.aim), 0, side('upperarmR') * 0.1);
      rig.rot('forearmR', THREE.MathUtils.lerp(-0.25 - run * 0.9 - air * 0.4, -0.2, st.aim));
      rig.rot('upperarmL', -Math.sin(p) * A * 0.35 - 0.35, 0, side('upperarmL') * 0.12);
      rig.rot('forearmL', -0.75);
      lamp.getWorldPosition(lampPos); lampPos.y -= 0.3;
    };
  }).catch((e) => console.warn('personagem não carregou; a usar a figura procedural', e));
  return { root, update: (...a) => anim(...a), lampPos,dispose(){if(disposed)return;disposed=true;anim=()=>{};disposeParts(root);} };
}

// stand-in used until the character model has loaded (or if it fails to load)
function proceduralPlayer(parent, slot, lampPos) {
  const cloakPal = 16 + (slot % 6);
  const root = new THREE.Object3D(); parent.add(root);
  const pelvis = new THREE.Object3D(); pelvis.position.y = 0.95; root.add(pelvis);
  part(pelvis, blob(0.17, 0.14, 0.13), 12, 90, [0.05, 0.09]);
  const torso = part(pelvis, blob(0.2, 0.3, 0.14, 0.3), 11, 200, [0.05, 0.09]);
  const head = part(torso, blob(0.115, 0.13, 0.12, 0.1), 11, 90, [0.04, 0.07]); head.position.set(0, 0.62, 0.02);
  part(head, blob(0.15, 0.16, 0.16, 0.12).translate(0, 0, -0.035), cloakPal, 150, [0.05, 0.085]);
  const mk = (side) => {
    const sh = part(torso, limb(0.06, 0.3, 0.05), 11, 60, [0.045, 0.08]); sh.position.set(side * 0.24, 0.5, 0);
    const fore = part(sh, limb(0.05, 0.28, 0.04), 11, 55, [0.04, 0.07]); fore.position.y = -0.3;
    const th = part(pelvis, limb(0.085, 0.45, 0.065), 12, 90, [0.05, 0.09]); th.position.set(side * 0.1, -0.02, 0);
    const shin = part(th, limb(0.065, 0.44, 0.05), 12, 80, [0.045, 0.08]); shin.position.y = -0.45;
    part(shin, new THREE.BoxGeometry(0.11, 0.09, 0.26).translate(0, -0.45, 0.06), 5, 40, [0.04, 0.07]);
    return { sh, fore, th, shin };
  };
  const L = mk(-1), R = mk(1);
  const cloak = []; let cp = torso;
  for (let i = 0; i < 3; i++) {
    // a curved panel wrapping the back, flaring toward the hem
    const arc = 2.5 + i * 0.25, r0 = 0.215 + i * 0.045, g = new THREE.CylinderGeometry(r0, r0 + 0.055, 0.4, 14, 3, true, Math.PI - arc / 2, arc).scale(1, 1, 0.82).translate(0, -0.2, 0);
    const seg = part(cp, g, cloakPal, 190, [0.06, 0.11]);
    seg.children[0].material = seg.children[0].material; // (materials are shared; double-sided set below)
    seg.position.set(0, i === 0 ? 0.56 : -0.36, 0);
    cloak.push({ seg, rot: 0, vel: 0 }); cp = seg;
  }
  const lamp = part(R.fore, new THREE.IcosahedronGeometry(0.07, 1).translate(0, -0.42, 0.02), 14, 40, [0.05, 0.08], undefined, FLAG.EMISSIVE);
  // pistol in the left hand, pointing forward when the forearm is raised
  part(L.fore, new THREE.BoxGeometry(0.05, 0.22, 0.09).translate(0, -0.36, 0.05), 22, 30, [0.035, 0.06]);
  const st = { phase: 0, lean: 0, crouch: 0, aim: 0 };
  function update(dt, speed, grounded, vy, crouching, accel, aiming = false) {
    const run = THREE.MathUtils.clamp(speed / 5.4, 0, 1), moving = speed > 0.15;
    st.phase += dt * (moving ? 5.2 + speed * 1.5 : 0);
    if (!moving) st.phase += (Math.round(st.phase / Math.PI) * Math.PI - st.phase) * Math.min(1, dt * 8);
    st.crouch += ((crouching ? 1 : 0) - st.crouch) * Math.min(1, dt * 10);
    st.aim += ((aiming ? 1 : 0) - st.aim) * Math.min(1, dt * 14);
    st.lean += (THREE.MathUtils.clamp(accel * 0.012, -0.2, 0.2) + run * 0.2 - st.lean) * Math.min(1, dt * 8);
    const p = st.phase, A = moving ? 0.35 + run * 0.6 : 0, air = grounded ? 0 : 1, k = st.crouch;
    pelvis.position.y = 0.95 - k * 0.32 + (moving && grounded ? Math.abs(Math.sin(p)) * 0.045 * (0.5 + run) : 0);
    pelvis.rotation.x = st.lean + k * 0.35;
    torso.rotation.x = st.lean * 0.6 + k * 0.25;
    torso.rotation.y = Math.sin(p) * 0.12 * A;
    head.rotation.x = -st.lean * 0.9 - k * 0.5;
    const leg = (o, ph) => {
      o.th.rotation.x = -Math.sin(ph) * A * (1 - air) - k * 1.1 - air * 0.5 - st.lean;
      o.shin.rotation.x = Math.max(0, Math.cos(ph)) * A * 1.5 * (1 - air) + 0.06 + k * 1.7 + air * 0.9;
    };
    leg(L, p); leg(R, p + Math.PI);
    L.sh.rotation.x = THREE.MathUtils.lerp(Math.sin(p) * A * 0.9 - air * 0.6, -1.35, st.aim); L.sh.rotation.z = -0.1;
    L.fore.rotation.x = THREE.MathUtils.lerp(-0.25 - run * 0.9 - air * 0.4, -0.2, st.aim);
    R.sh.rotation.x = -Math.sin(p) * A * 0.35 - 0.35; R.sh.rotation.z = 0.12;
    R.fore.rotation.x = -0.75;
    cloak.forEach((c, i) => {
      const target = 0.12 + run * (0.32 + i * 0.1) + Math.max(0, -vy) * 0.12 + Math.sin(p * 2 + i) * 0.05 * A - st.lean * 0.6;
      c.vel += ((target - c.rot) * 60 - c.vel * 9) * dt; c.rot += c.vel * dt;
      c.seg.rotation.x = i === 0 ? c.rot : c.rot * 0.5;
    });
    lamp.getWorldPosition(lampPos); lampPos.y -= 0.3;
  }
  return { group: root, update };
}

// ---------- the Echo's monster form: THE KNOCKER (tomy_studios asset), animated through its FK pivots
let knockerSrc = null;
const waiting = [];
loadModel('./assets/knocker_hd.glb').then((src) => {
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
  src.userData.scale = 2.5 / size.y;
  src.userData.offset = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, 0);
  const oetf = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  src.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material, skin = m.name === 'kn_skin';
    // the export carries the skin tone as linear vertex colours (black on every other part) and a face map on a bad UV channel
    if (skin) {
      const c = o.geometry.attributes.color, out = new Float32Array(c.count * 3);
      for (let i = 0; i < c.count; i++) out.set([oetf(c.getX(i)), oetf(c.getY(i)), oetf(c.getZ(i))], i * 3);
      o.geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
      m.color.setScalar(1.75); // the detail map averages mid-grey
    }
    m.vertexColors = skin;
    if (m.map) { m.map.colorSpace = THREE.NoColorSpace; if (!skin) { m.map.channel = 0; m.color.setScalar(1.5); } } // textures are authored in display space
    else m.color.copy(toDisplay(m.color));
    m.normalMap = m.roughnessMap = m.metalnessMap = null; m.metalness = 0; m.roughness = Math.max(m.roughness, skin ? 0.8 : 0.45);
    if (m.name === 'kn_glint') m.emissive.setRGB(0.95, 0.96, 0.92);
    m.needsUpdate = true;
  });
  knockerSrc = src;
  waiting.splice(0).forEach((fn) => fn());
}).catch((e) => console.warn('Knocker não carregou; a usar a forma procedural', e));

const knockerPal = (m) => { const n = m.name; return /tooth|nail/.test(n) ? 11 : /glint/.test(n) ? 14 : /void|lip|hair/.test(n) ? 12 : 13; };
export function buildEcho(scene) {
  const root = new THREE.Object3D(); scene.add(root);
  const fallback = proceduralEcho(root);
  let anim = fallback.update,disposed=false,boneMaterial=null;
  const attach = () => {
    if(disposed)return;
    const model = cloneSkinned(knockerSrc), holder = new THREE.Object3D();
    holder.scale.setScalar(knockerSrc.userData.scale);
    model.position.copy(knockerSrc.userData.offset);
    holder.add(model); root.add(holder);disposeParts(fallback.group);
    const meshes = []; model.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const o of meshes) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const pal = knockerPal(o.material);
      registerStyled(o, underMaterial(pal, pal === 14 ? 0 : 2, pal === 13 ? 0.8 : 0.9), o.material);
    }
    if (meshes.length) boneMaterial=boneDabs(meshes, 1500, knockerPal, [0.05, 0.1]);
    const rig = rigOf(model);
    let t = 0;
    anim = (dt, speed, attack = 0) => {
      const g = Math.min(1, speed / 6), s = Math.sin(t += dt * (2.5 + speed * 1.3)), c = Math.cos(t), idle = Math.sin(t * 0.6) * (1 - g);
      holder.position.y = Math.abs(s) * 0.07 * g;
      holder.rotation.x = g * 0.16 + attack * 0.22;
      holder.rotation.z = s * 0.04 * g;
      rig.rot('spine1', 0.06 + idle * 0.02, s * 0.1 * g); rig.rot('spine2', 0.08 + idle * 0.03 + attack * 0.15, s * 0.08 * g);
      rig.rot('neck1', -0.1 - g * 0.1, 0, idle * 0.05); rig.rot('head', Math.sin(t * 0.7) * 0.07 - attack * 0.25, idle * 0.12);
      rig.rot('jaw', 0.08 + attack * 0.55 + Math.max(0, idle) * 0.08);
      for (const [S, k] of [['L', 1], ['R', -1]]) {
        rig.rot('upper_arm' + S, k * s * 0.5 * g - attack * 1.25 - 0.08, 0, 0);
        rig.rot('forearm' + S, -Math.max(0, k * c) * 0.4 * g - 0.18 - attack * 0.5 + idle * 0.04);
        rig.rot('thigh' + S, -k * s * 0.5 * g);
        rig.rot('shin' + S, Math.max(0, -k * c) * 0.7 * g + 0.05);
      }
    };
  };
  if (knockerSrc) attach(); else waiting.push(attach);
  return { root, update: (dt, speed, attack) => anim(dt, speed, attack),dispose(){if(disposed)return;disposed=true;const index=waiting.indexOf(attach);if(index>=0)waiting.splice(index,1);anim=()=>{};disposeParts(root);boneMaterial?.dispose();} };
}

// simple stand-in used until the Knocker model has loaded (or if it fails to load)
function proceduralEcho(root) {
  const group = new THREE.Object3D(); root.add(group);
  const body = new THREE.Object3D(); body.position.y = 1.55; group.add(body);
  part(body, blob(0.36, 0.34, 0.95), 13, 520, [0.09, 0.17]);
  const legs = [];
  for (const [sx, sz, ph] of [[-1, 0.72, 0], [1, 0.72, 0.5], [-1, -0.7, 2.6], [1, -0.7, 3.1]]) {
    const up = part(body, limb(0.11, 0.85, 0.07), 13, 130, [0.07, 0.13]); up.position.set(sx * 0.3, -0.05, sz);
    const lo = part(up, limb(0.07, 0.95, 0.035), 13, 110, [0.06, 0.1]); lo.position.y = -0.85;
    legs.push({ up, lo, ph });
  }
  let t = 0;
  return {
    group,
    update(dt, speed) {
      t += dt * (3 + speed * 1.15); const g = Math.min(1, speed / 6);
      body.position.y = 1.55 + Math.sin(t * 2) * 0.1 * g;
      for (const l of legs) { const a = t * 2 + l.ph; l.up.rotation.x = -Math.sin(a) * (0.75 * g + 0.12); l.lo.rotation.x = 0.35 + Math.max(0, Math.cos(a)) * g; }
    },
  };
}
