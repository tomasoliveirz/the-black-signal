// Two visual styles over one scene.
//  - Paint: world-anchored brush dabs (instanced quads), three palette tones per material.
//  - Normal: lit PBR-style meshes with shadows; the same instanced points become grass and leaf cards.
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

export const FLAG = { SOLID: 0, FOLIAGE: 1, EMISSIVE: 2, GROUND: 3 };
export const NLIGHTS = 8;

// [light, mid, shadow] per material
export const PALETTE = [
  ['#cfae5c', '#93883f', '#525c38'], // 0 meadow
  ['#cfa878', '#987250', '#5c4436'], // 1 dirt path
  ['#f4c040', '#d6882a', '#8c4c22'], // 2 gold foliage
  ['#ec8a3c', '#bd5428', '#702c22'], // 3 red foliage
  ['#86a25c', '#516e4a', '#2c403a'], // 4 pine
  ['#a07a54', '#624a38', '#352a2a'], // 5 trunk
  ['#c8986a', '#8c6242', '#5c4032'], // 6 cabin wood
  ['#9c6450', '#6c4440', '#44303a'], // 7 roof
  ['#bab2a0', '#80827e', '#484f58'], // 8 rock
  ['#d6c8c4', '#969ab0', '#6c7694'], // 9 mountain
  ['#bc564c', '#823238', '#48202c'], // 10 cloak (unused default)
  ['#ead6b4', '#bc9c76', '#70584a'], // 11 skin / linen
  ['#5e6a76', '#384654', '#202c38'], // 12 dark cloth / metal
  ['#93a4a2', '#4c5c62', '#1c2428'], // 13 echo hide
  ['#fff0c0', '#ffd070', '#f0a040'], // 14 emissive
  ['#e8c070', '#c89040', '#8a5c2c'], // 15 fallen leaves
  ['#c45a4e', '#863438', '#4a222e'], // 16 cloak red
  ['#5c86b8', '#385a8a', '#22365a'], // 17 cloak blue
  ['#7fa868', '#4c7448', '#2a4630'], // 18 cloak green
  ['#dcb450', '#a8802c', '#6a4c20'], // 19 cloak ochre
  ['#9a70b0', '#684880', '#3c2a52'], // 20 cloak violet
  ['#d8d4c8', '#9c9a94', '#5c5e64'], // 21 cloak ash
  ['#7a8894', '#4c5862', '#2a323a'], // 22 steel
  ['#e05040', '#a02c28', '#601c20'], // 23 signal red
];
const PAL_MAX = 256;
// The palette lives in a 256x3 texture (row 0 light, 1 mid, 2 shadow) so models can add their own colours at load time.
const palData = new Uint8Array(PAL_MAX * 3 * 4);
const palTex = new THREE.DataTexture(palData, PAL_MAX, 3, THREE.RGBAFormat);
palTex.minFilter = palTex.magFilter = THREE.NearestFilter; palTex.generateMipmaps = false;
function writePal(i) {
  for (let row = 0; row < 3; row++) { const c = new THREE.Color(PALETTE[i][row]); palData.set([c.r * 255, c.g * 255, c.b * 255, 255], (row * PAL_MAX + i) * 4); }
  palTex.needsUpdate = true;
}
PALETTE.forEach((_, i) => writePal(i));
const palCache = new Map();
// Palette index for an arbitrary display-space colour: light and shadow tones are derived (warm lights, cool shadows).
export function paletteFor(color) {
  const key = color.getHexString();
  if (palCache.has(key)) return palCache.get(key);
  if (PALETTE.length >= PAL_MAX) return 12;
  const hsl = color.getHSL({});
  const tone = (dl, ds, dh) => '#' + new THREE.Color().setHSL((hsl.h + dh + 1) % 1, Math.min(1, hsl.s * ds), Math.min(0.95, Math.max(0.03, hsl.l + dl))).getHexString();
  PALETTE.push([tone(0.13, 0.95, 0.012), tone(-0.02, 1, 0), tone(-0.16 - hsl.l * 0.12, 1.1, -0.03)]);
  writePal(PALETTE.length - 1);
  palCache.set(key, PALETTE.length - 1);
  return PALETTE.length - 1;
}
// glTF colours are linear; this project works directly in display space.
export const toDisplay = (c) => new THREE.Color().setRGB(...[c.r, c.g, c.b].map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
export const SUN = new THREE.Vector3(0.55, 0.6, 0.38).normalize();

function atlas(draw) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S * 2, S * 2);
  for (let cell = 0; cell < 4; cell++) { // cell 0,1 = bottom row in UV space
    g.save(); g.translate((cell % 2) * S, (1 - Math.floor(cell / 2)) * S);
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    draw(g, cell, S); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}
const R = Math.random;
const brushAtlas = () => atlas((g, cell, S) => {
  g.lineCap = 'round';
  const cy = S / 2, hh = S * (0.26 + 0.06 * R());
  for (let i = 0; i < 150; i++) {
    const y = cy + (R() * 2 - 1) * hh, k = Math.sqrt(Math.max(0, 1 - ((y - cy) / hh) ** 2)), half = k * S * 0.4;
    const x0 = S / 2 - half + R() * 26, x1 = S / 2 + half - R() * 34;
    if (x1 <= x0) continue;
    g.strokeStyle = `rgb(255,${90 + Math.floor(R() * 165)},0)`; g.lineWidth = 3 + R() * 6;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y + (R() - 0.5) * 6); g.stroke();
  }
});
// cells 0,1: grass tufts (root at the bottom edge); cells 2,3: leaf clusters
const detailAtlas = () => atlas((g, cell, S) => {
  if (cell < 2) {
    for (let i = 0; i < 13; i++) {
      const x0 = S * (0.3 + R() * 0.4), lean = (R() - 0.5) * S * 0.75, h = S * (0.5 + R() * 0.45), w = 7 + R() * 7;
      const grad = g.createLinearGradient(0, S, 0, S - h);
      const v = 120 + Math.floor(R() * 90);
      grad.addColorStop(0, 'rgb(255,60,0)'); grad.addColorStop(1, `rgb(255,${v + 40},0)`);
      g.fillStyle = grad; g.beginPath();
      g.moveTo(x0 - w, S); g.quadraticCurveTo(x0 + lean * 0.3, S - h * 0.6, x0 + lean, S - h);
      g.quadraticCurveTo(x0 + lean * 0.5 + w, S - h * 0.5, x0 + w, S); g.fill();
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const x = S * (0.2 + R() * 0.6), y = S * (0.2 + R() * 0.6), a = R() * 6.28, l = S * (0.13 + R() * 0.07);
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `rgb(255,${110 + Math.floor(R() * 140)},0)`;
      g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * 0.62, l, 0); g.quadraticCurveTo(0, l * 0.62, -l, 0); g.fill();
      g.strokeStyle = 'rgb(255,70,0)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke();
      g.restore();
    }
  }
});

export const uniforms = {
  uBrush: { value: null }, uDetail: { value: null },
  uPal: { value: palTex },
  uSun: { value: SUN },
  uTime: { value: 0 }, uNight: { value: 0 }, uSizeMul: { value: 1 }, uStyle: { value: 0 }, uTuft: { value: 1 },
  uZenith: { value: new THREE.Color('#70a0cc') },
  uFogDay: { value: new THREE.Color('#e9c48e') }, uFogNight: { value: new THREE.Color('#141c2a') },
  uFog: { value: new THREE.Vector2(18, 150) },
  uLights: { value: Array.from({ length: NLIGHTS }, () => new THREE.Vector4(0, -999, 0, 1)) },
  uBlob: { value: new THREE.Vector3() },
};

const VERT = /* glsl */`
attribute vec3 iPos; attribute vec3 iNrm; attribute vec4 iA; attribute vec2 iB;
uniform sampler2D uPal;
uniform vec3 uSun, uFogDay, uFogNight, uBlob;
uniform float uTime, uNight, uSizeMul, uFogMax, uStyle, uTuft;
uniform vec2 uFog; uniform vec4 uLights[${NLIGHTS}];
varying vec3 vCol; varying vec2 vUv; varying float vSeed; varying float vMode;
float hash(float n){ return fract(sin(n*127.1)*43758.5453); }
vec3 nightify(vec3 c){ float l = dot(c, vec3(.3,.55,.15)); return mix(vec3(l), c, .5) * vec3(.3,.43,.64); }
void main(){
  float seed = iA.z; int p = int(iA.w + .5); float flag = iB.y;
  bool normal = uStyle > .5, ground = flag > 2.5, fol = flag > .5 && flag < 1.5, emis = flag > 1.5 && flag < 2.5;
  vec3 c = (modelMatrix * vec4(iPos,1.)).xyz;
  vec3 n = normalize(mat3(modelMatrix) * iNrm);
  if (fol) {
    float w = sin(uTime*1.3 + c.x*.35 + seed*40.) + .5*sin(uTime*2.9 + c.z*.5 + seed*17.);
    c += vec3(.06,.025,.045) * w;
  }
  vec3 toCam = cameraPosition - c; float dist = length(toCam); vec3 v = toCam / dist;
  float facing = dot(n, v);
  vec3 L = texelFetch(uPal, ivec2(p, 0), 0).rgb, M = texelFetch(uPal, ivec2(p, 1), 0).rgb, S = texelFetch(uPal, ivec2(p, 2), 0).rgb;
  float ndl = mix(.3, 1., dot(n, uSun)*.5 + .5) * (1. - iB.x*.62);
  float blob = 1.;
  if (ground) blob = mix(.5, 1., smoothstep(.25, 1.0, length(c.xz - uBlob.xz)));
  vec3 wp; vec3 day; vMode = 0.;

  if (normal && ground && p == 0) {                       // grass tuft, upright, wind-bent
    float fade = (1. - smoothstep(50., 80., dist)) * uTuft;
    if (fade <= 0.) { gl_Position = vec4(2.,2.,2.,1.); return; }
    vec3 side = normalize(vec3(v.z, 0., -v.x));
    float yy = position.y + .5, hgt = iA.x * (.38 + .55*hash(seed*2.3)) * fade;
    float sway = (sin(uTime*1.7 + c.x*.6 + seed*30.)*.07 + .04) * yy*yy;
    vec2 push = c.xz - uBlob.xz; float pd = length(push);
    vec2 bend = pd < 1.2 ? normalize(push + 1e-4) * (1.2 - pd) * .35 * yy : vec2(0.);
    wp = c + side*position.x*iA.x*.95 + vec3(0.,1.,0.)*yy*hgt + vec3(sway + bend.x, 0., sway*.6 + bend.y);
    day = mix(mix(S, M, .55)*.85, mix(M, L, .45 + .5*hash(seed*9.1)), yy) * (1. - iB.x*.4) * mix(.75, 1., blob);
    vMode = 1.;
  } else if (normal && (ground || fol)) {                 // leaf cards: litter lies flat, canopy faces out
    if (ground && p == 1) { gl_Position = vec4(2.,2.,2.,1.); return; }
    vec3 f = ground ? n : normalize(mix(facing < 0. ? -n : n, v, .5));
    vec3 a = normalize(vec3(sin(seed*91.7), .35*cos(seed*57.3), sin(seed*33.1 + 1.7)));
    vec3 t = normalize(cross(f, a) + 1e-4); vec3 b = cross(f, t);
    float s = iA.x * (ground ? 1.5 : 2.3) * (1. + dist*.01) * (ground ? smoothstep(.5, 2.2, dist) : smoothstep(1.2, 5., dist));
    wp = c + (t*position.x + b*position.y) * s + (ground ? n*.03 : vec3(0.));
    float tone = ndl + (hash(seed*3.1) - .5)*.2;
    day = mix(S, M, smoothstep(.25,.6,tone)); day = mix(day, L, smoothstep(.55,.95,tone));
    day *= (.86 + .28*hash(seed*7.7)) * mix(.7, 1., blob);
    vMode = 2.;
  } else {                                                // brush dab
    if (flag < .5 && facing < -.2) { gl_Position = vec4(2.,2.,2.,1.); return; }
    vec3 f = normalize(mix(facing < 0. ? -n : n, v, ground ? .28 : .55));
    vec3 a = normalize(vec3(sin(seed*91.7), .35*cos(seed*57.3), sin(seed*33.1 + 1.7)));
    vec3 t = normalize(cross(f, a) + 1e-4); vec3 b = cross(f, t);
    float s = iA.x * uSizeMul * (1. + dist*.03) * smoothstep(.5, 2.2, dist);
    wp = c + t*position.x*s*1.9 + b*position.y*s*1.15;
    float tone = ndl*blob + (hash(seed*3.1) - .5)*.24;
    day = mix(S, M, smoothstep(.37,.45,tone)); day = mix(day, L, smoothstep(.6,.68,tone));
    day *= .9 + .2*hash(seed*7.7);
  }
  vec3 col;
  if (emis) col = mix(M, L, hash(seed*5.3)) * mix(.92, 1.08, uNight);
  else {
    col = mix(day, nightify(day), uNight);
    float lit = 0.;
    for (int i=0;i<${NLIGHTS};i++){ float d = length(c - uLights[i].xyz); float k = clamp(1. - d/uLights[i].w, 0., 1.); lit = max(lit, k*k); }
    if (vMode < .5) lit *= step(hash(seed*11.3)*.35, lit);
    vec3 warm = mix(M, L, .6) * vec3(1.12,.9,.62) * (vMode > .5 && vMode < 1.5 ? mix(.6, 1., position.y + .5) : 1.);
    col = mix(col, warm, lit * mix(.12, .95, uNight));
  }
  float fog = min(smoothstep(uFog.x, uFog.y, dist), uFogMax);
  if (emis) fog *= .5;
  vCol = mix(col, mix(uFogDay, uFogNight, uNight), fog);
  vUv = uv; vSeed = seed;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;

const FRAG = /* glsl */`
uniform sampler2D uBrush, uDetail;
varying vec3 vCol; varying vec2 vUv; varying float vSeed; varying float vMode;
void main(){
  vec4 tx;
  if (vMode < .5) {
    float idx = floor(fract(vSeed*7.31)*4.);
    tx = texture2D(uBrush, vec2(mod(idx,2.), floor(idx/2.))*.5 + (vUv*.96+.02)*.5);
    if (tx.r < .5) discard;
    gl_FragColor = vec4(vCol * (.84 + .3*tx.g), 1.);
  } else {
    float col = floor(fract(vSeed*7.31)*2.), row = vMode < 1.5 ? 0. : 1.;
    tx = texture2D(uDetail, vec2(col, row)*.5 + (vUv*.96+.02)*.5);
    if (tx.r < .5) discard;
    gl_FragColor = vec4(vCol * (.66 + .5*tx.g), 1.);
  }
}`;

export function dabMaterial(fogMax = 1) {
  if (!uniforms.uBrush.value) { uniforms.uBrush.value = brushAtlas(); uniforms.uDetail.value = detailAtlas(); }
  return new THREE.ShaderMaterial({ uniforms: { ...uniforms, uFogMax: { value: fogMax } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
}

// ---------- map themes: a theme overrides some palette rows (ground, foliage, rock, mountains) and the atmosphere
const BASE = PALETTE.map((p) => [...p]), THEMED = [0, 1, 2, 3, 4, 8, 9, 15];
export function applyTheme(theme = {}) {
  for (const i of THEMED) { PALETTE[i] = [...(theme.pal?.[i] ?? BASE[i])]; writePal(i); }
  for (const cache of [underCache, stdCache]) for (const k of [...cache.keys()]) if (THEMED.includes(+k.split('|')[0])) cache.delete(k);
  uniforms.uFogDay.value.set(theme.fogDay ?? '#e9c48e'); uniforms.uFogNight.value.set(theme.fogNight ?? '#141c2a');
  uniforms.uZenith.value.set(theme.zenith ?? '#70a0cc'); uniforms.uTuft.value = theme.tuft ?? 1;
}
// after a world is torn down, forget the meshes that are no longer in a scene
export function pruneDetached() {
  const live = (o) => { while (o.parent) o = o.parent; return o.isScene; };
  for (const list of [dabMeshes, styled]) for (let i = list.length - 1; i >= 0; i--) if (!live(list[i].mesh ?? list[i])) list.splice(i, 1);
}

// ---------- style registry
const dabMeshes = [], styled = [];
let normalStyle = false;
export const isNormal = () => normalStyle;
export function setStyle(normal) {
  normalStyle = normal; uniforms.uStyle.value = normal ? 1 : 0;
  for (const s of styled) s.mesh.material = normal ? s.normal : s.paint;
  for (const d of dabMeshes) d.visible = normal ? d.userData.keepInNormal : true;
}
// A mesh that exists in both styles: flat underpainting in paint mode, lit material in normal mode.
export function styledMesh(geo, paint, normal, shadows = true) {
  const m = new THREE.Mesh(geo, normalStyle ? normal : paint);
  m.castShadow = shadows; m.receiveShadow = true;
  styled.push({ mesh: m, paint, normal });
  return m;
}
export function registerStyled(mesh, paint, normal) { styled.push({ mesh, paint, normal }); mesh.material = normalStyle ? normal : paint; }

// Collects dabs sampled from geometry surfaces, then builds one instanced mesh.
export class DabSet {
  constructor() { this.pos = []; this.nrm = []; this.a = []; this.b = []; }
  add(geometry, o) {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build();
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < o.count; i++) {
      sampler.sample(p, n);
      if (o.filter && !o.filter(p, n)) continue;
      if (o.lift) p.addScaledVector(n, o.lift * Math.random());
      const palIdx = typeof o.pal === 'function' ? o.pal(p, n) : o.pal;
      const sz = typeof o.size === 'function' ? o.size(p) : o.size[0] + Math.random() * (o.size[1] - o.size[0]);
      this.pos.push(p.x, p.y, p.z); this.nrm.push(n.x, n.y, n.z);
      this.a.push(sz, 0, Math.random(), palIdx);
      this.b.push(o.shade ? o.shade(p) : 0, o.flag ?? FLAG.SOLID);
    }
    return this;
  }
  get count() { return this.a.length / 4; }
  build(material, keepInNormal = false) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('iNrm', new THREE.InstancedBufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(this.a), 4));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(this.b), 2));
    g.instanceCount = this.count;
    const m = new THREE.Mesh(g, material);
    m.frustumCulled = false; m.userData.fullCount = this.count; m.userData.keepInNormal = keepInNormal;
    m.visible = normalStyle ? keepInNormal : true;
    dabMeshes.push(m);
    return m;
  }
}

// ---------- materials
const underMats = [], underCache = new Map(), stdCache = new Map();
export function underMaterial(palIdx, tone = 2, mul = 0.9, opts = {}) {
  const key = `${palIdx}|${tone}|${mul}|${JSON.stringify(opts)}`;
  if (underCache.has(key)) return underCache.get(key);
  const day = new THREE.Color(PALETTE[palIdx][tone]).multiplyScalar(mul);
  const m = new THREE.MeshBasicMaterial({ color: day.clone(), ...opts });
  underMats.push({ m, day, emissive: palIdx === 14 || palIdx === 23 });
  underCache.set(key, m);
  return m;
}
export function stdMaterial(palIdx, opts = {}) {
  const key = `${palIdx}|${opts.key ?? ''}`;
  if (stdCache.has(key)) return stdCache.get(key);
  const { key: _k, tone = 0.45, ...rest } = opts;
  const emissive = palIdx === 14 || palIdx === 23;
  const color = new THREE.Color(PALETTE[palIdx][1]).lerp(new THREE.Color(PALETTE[palIdx][0]), tone);
  const m = emissive ? new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE[palIdx][0]) })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...rest });
  stdCache.set(key, m);
  return m;
}
const _c = new THREE.Color();
export function nightifyColor(c, out) {
  const l = c.r * .3 + c.g * .55 + c.b * .15;
  return out.setRGB((l + (c.r - l) * .5) * .3, (l + (c.g - l) * .5) * .43, (l + (c.b - l) * .5) * .64);
}
export function updateUnder(night) {
  for (const u of underMats) if (!u.emissive) u.m.color.copy(u.day).lerp(nightifyColor(u.day, _c), night);
}

// procedural textures for normal mode
export function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  return t;
}
export const TEX = {
  noise: (repeat, base = 150, amp = 70) => canvasTexture(256, (g, S) => {
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = base + (R() - 0.5) * amp + (R() < 0.04 ? -40 : 0); img.data.set([v, v, v, 255], i * 4); }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 60; i++) { g.fillStyle = R() < 0.5 ? '#fff' : '#555'; g.beginPath(); g.arc(R() * S, R() * S, 6 + R() * 26, 0, 7); g.fill(); }
  }, repeat),
  planks: (repeat) => canvasTexture(256, (g, S) => {
    for (let i = 0; i < 8; i++) {
      const v = 150 + R() * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, i * 32, S, 32);
      g.fillStyle = 'rgba(40,30,20,.55)'; g.fillRect(0, i * 32, S, 2);
      g.strokeStyle = 'rgba(60,40,30,.25)';
      for (let k = 0; k < 7; k++) { g.beginPath(); const y = i * 32 + 4 + R() * 24; g.moveTo(0, y); g.bezierCurveTo(80, y + R() * 6 - 3, 170, y + R() * 6 - 3, S, y); g.stroke(); }
      g.fillStyle = 'rgba(40,30,20,.5)'; g.fillRect(R() * S, i * 32, 2, 32);
    }
  }, repeat),
  bark: (repeat) => canvasTexture(128, (g, S) => {
    g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) { const v = 90 + R() * 130; g.strokeStyle = `rgba(${v},${v},${v},.7)`; g.lineWidth = 1 + R() * 3; const x = R() * S; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + R() * 8 - 4, 40, x + R() * 8 - 4, 90, x, S); g.stroke(); }
  }, repeat),
};
