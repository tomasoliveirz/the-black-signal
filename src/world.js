// Amberwood visuals, built from the shared layout: terrain, forest, cabin, lanterns, mast, props, sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DabSet, FLAG, TEX, PALETTE, dabMaterial, underMaterial, stdMaterial, styledMesh, uniforms, isNormal, pruneDetached } from './paint.js';
import { LAYOUT, MAP, BOXES, CABIN, MAST, EXTRACT, STRUCTS, height, pathX, pathDist, rng } from '../shared/layout.js';
import { buildStatic, styledClone, R2R } from './models.js';
import { buildEnvironment, colorGround } from './environment.js';

export function buildWorld(parent) {
  const scene = new THREE.Group(); parent.add(scene);
  const bd = MAP.data?.bounds;
  const environment = buildEnvironment(scene);
  const theme = MAP.theme || {}, indoor = MAP.kind === 'factory' || MAP.kind === 'mesh';
  const rnd = rng(77), rr = (a, b) => a + rnd() * (b - a);
  const flora = new DabSet(), solid = new DabSet(), ground = new DabSet(), far = new DabSet();
  const under = {}; // palette index -> geometries
  const put = (geo, pal) => (under[pal] ??= []).push(geo.index ? geo.toNonIndexed() : geo);
  const canopies = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  const place = (geo, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) =>
    geo.clone().applyMatrix4(M.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const ico = new THREE.IcosahedronGeometry(1, 2), cone = new THREE.ConeGeometry(1, 1, 9, 3), cyl = new THREE.CylinderGeometry(0.72, 1, 1, 8, 3), box = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);

  // ---------- trees
  for (const t of LAYOUT.trees) {
    const { x, z, y, tr } = t;
    const shape = t.seed % 6, th = t.th * [1.15, 1, .85, 1.23, 1.02, .91][shape];
    const trunk = place(cyl, x, y + th / 2 - 0.2, z, tr, th + 0.4, tr, rnd() * 6, rr(-0.05, 0.05), rr(-0.05, 0.05));
    put(trunk, 5); solid.add(trunk, { count: Math.round(70 * th / 4), pal: 5, size: [0.16, 0.3] });
    if (t.dead) { // bare tree: a few crooked branches, no canopy
      for (let k = 0; k < 4; k++) {
        const len = rr(1.2, 2.4), a = rnd() * 6.283, tilt = rr(0.6, 1.1), by = y + th * rr(0.55, 0.95);
        const br = place(cyl, x + Math.sin(a) * Math.sin(tilt) * len / 2, by + Math.cos(tilt) * len / 2, z + Math.cos(a) * Math.sin(tilt) * len / 2, tr * 0.32, len, tr * 0.32, a, tilt, 0);
        put(br, 5); solid.add(br, { count: 26, pal: 5, size: [0.12, 0.22] });
      }
    } else if (t.pine) {
      for (let k = 0; k < 4; k++) {
        const r2 = (2.24 - k * 0.42) * (shape % 2 ? .88 : 1.08), cy = y + th * 0.78 + k * (shape % 3 === 0 ? 1.75 : 1.35);
        put(place(cone, x, cy, z, r2 * 0.7, 2.1, r2 * 0.7), 4);
        flora.add(place(cone, x, cy, z, r2, 2.6, r2, rnd() * 6), { count: 260, pal: 4, size: [0.3, 0.52], flag: FLAG.FOLIAGE, lift: 0.25 });
        canopies.push({ x, y: cy, z, r: r2 * 0.8 });
      }
    } else {
      const palA = rnd() < 0.62 ? 2 : 3, blobs = [4, 3, 5, 4, 6, 3][shape];
      for (let k = 0; k < blobs; k++) {
        const spread = [1.3,.7,1.5,1.04,1.28,.8][shape];
        const loft = [.8,1.23,.64,1.13,.9,1.22][shape];
        const r = rr(1.45, 2.55), bx = x + rr(-spread, spread), by = y + th + rr(-.16, 1.84) * loft, bz = z + rr(-spread, spread);
        put(place(ico, bx, by, bz, r * .7, r * .61 * loft, r * .7, rr(-.6,.6)), palA);
        const palB = rnd() < 0.25 ? (palA === 2 ? 3 : 2) : palA;
        flora.add(place(ico, bx, by, bz, r, r * rr(0.7, 0.9), r, rnd() * 6), { count: Math.round(170 * r), pal: () => (rnd() < 0.82 ? palA : palB), size: [0.3, 0.56], flag: FLAG.FOLIAGE, lift: 0.4 });
        canopies.push({ x: bx, y: by, z: bz, r: r * 0.92 });
      }
    }
  }
  for (const k of LAYOUT.rocks) {
    const g = place(new THREE.IcosahedronGeometry(1, 1), k.x, k.y + k.s * 0.25, k.z, k.s * rr(0.9, 1.5), k.s * 0.75, k.s, rnd() * 6, rr(-0.3, 0.3));
    put(g, 8); solid.add(g, { count: Math.round(90 * k.s * k.s), pal: 8, size: [0.2, 0.42] });
  }

  // ---------- cabin
  const lit = new DabSet(), litGeo = []; // things that go dark in a blackout: windows and path lanterns
  const { x: cx, z: cz, w, d, h } = CABIN || { x: 0, z: 0, w: 1, d: 1, h: 1 }, cy = CABIN ? CABIN.gy : 0;
  if (CABIN) {
  const walls = place(box, cx, cy + h / 2, cz, w, h, d);
  put(walls, 6); solid.add(walls, { count: 4200, pal: 6, size: [0.24, 0.42] });
  const roof = place(new THREE.CylinderGeometry(1, 1, 1, 3, 2).rotateY(Math.PI / 2), cx, cy + h + 0.74, cz, 1.5, w + 1, 3.7, 0, 0, Math.PI / 2);
  put(roof, 7); solid.add(roof, { count: 2300, pal: 7, size: [0.24, 0.44] });
  const chim = place(box, cx + 2.2, cy + h + 1.6, cz - 1.2, 0.7, 2.2, 0.7);
  put(chim, 8); solid.add(chim, { count: 260, pal: 8, size: [0.16, 0.26] });
  const door = place(box, cx - 1.2, cy + 1.05, cz - d / 2 - 0.03, 1.1, 2.1, 0.08);
  put(door, 12); solid.add(door, { count: 160, pal: 12, size: [0.16, 0.26] });
  const porch = place(box, cx - 1.2, cy + 0.08, cz - d / 2 - 1, 3, 0.16, 2);
  put(porch, 6); solid.add(porch, { count: 420, pal: 6, size: [0.2, 0.34] });
  for (const [ox, oz, rot] of [[1.4, -d / 2 - 0.04, 0], [-w / 2 - 0.04, 0.4, Math.PI / 2], [1, d / 2 + 0.04, 0]]) {
    const win = place(box, cx + ox, cy + 1.7, cz + oz, 1.2, 0.95, 0.06, rot);
    litGeo.push(win.toNonIndexed()); lit.add(win, { count: 150, pal: 14, size: [0.14, 0.22], flag: FLAG.EMISSIVE });
  }

  }

  // ---------- lantern posts
  const lampPos = [];
  for (const l of LAYOUT.lanterns) {
    if (MAP.kind === 'factory' || MAP.kind === 'mesh' || MAP.kind === 'city') {
      put(place(box,l.x,l.y+.04,l.z,.45,.08,.45),12);
      put(place(box,l.x,l.y+1.2,l.z,.07,2.4,.07),12);
      put(place(box,l.x,l.y+2.3,l.z,.42,.22,.23),22);
      litGeo.push(place(box,l.x,l.y+2.3,l.z+.125,.30,.13,.02).toNonIndexed());
      lampPos.push(new THREE.Vector3(l.x,l.y+2.3,l.z+.15));
    } else {
      put(place(box,l.x,l.y+1.25,l.z,.14,2.5,.14),5);
      put(place(box,l.x-.3,l.y+2.45,l.z,.7,.10,.10),5);
      for(const y of [2.04,2.36])put(place(box,l.x-.6,l.y+y,l.z,.29,.06,.29),12);
      for(const x of [-.73,-.47])for(const z of [-.13,.13])put(place(box,l.x+x,l.y+2.2,l.z+z,.025,.28,.025),12);
      litGeo.push(place(box,l.x-.6,l.y+2.2,l.z,.18,.24,.18).toNonIndexed());
      lampPos.push(new THREE.Vector3(l.x-.6,l.y+2.2,l.z));
    }
  }

  // ---------- radio mast
  const my = height(MAST.x, MAST.z), MH = MAP.mastH ?? 18;
  for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = place(box, MAST.x + ox * 0.75, my + MH / 2, MAST.z + oz * 0.75, 0.16, MH, 0.16, 0, oz * 0.05 * 18 / MH, -ox * 0.05 * 18 / MH);
    put(leg, 12); solid.add(leg, { count: 330, pal: 12, size: [0.14, 0.24] });
  }
  for (let k = 1; k < 7; k++) {
    const ring = place(new THREE.TorusGeometry((1.9 - k * 0.2) * 0.72, 0.06, 4, 4), MAST.x, my + k * MH / 7, MAST.z, 1, 1, 1, 0, Math.PI / 2, Math.PI / 4);
    put(ring, 12); solid.add(ring, { count: 110, pal: 12, size: [0.12, 0.2] });
  }
  if (MAP.kind !== 'mesh') { const hut = place(box, MAST.x + 3.2, my + 1.1, MAST.z, 2.6, 2.2, 2.6); put(hut, indoor ? 22 : 6); solid.add(hut, { count: 700, pal: indoor ? 22 : 6, size: [0.2, 0.36] }); }

  // Structural walls retain the shared collision footprint.
  for (const b of BOXES) {
    if (b.kind !== 'wall') continue;
    const wall = place(box, b.x, b.h / 2, b.z, b.w, b.h, b.d);
    put(wall, 22); solid.add(wall, { count: Math.min(6000, Math.round((b.w + b.d) * b.h * 22)), pal:22, size:[.22,.42] });
  }

  // ---------- transmitters (console + antenna; the status lamp is separate)
  const txLamps = LAYOUT.tx.map((t) => {
    put(place(box,t.x+.33,t.y+.43,t.z,.045,.86,.045),12);
    put(place(box,t.x+.33,t.y+.96,t.z,.26,.32,.08),22);
    const antenna=place(box,t.x+.25,t.y+1.19,t.z,.025,.65,.025);
    put(antenna,12);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0x424a4c}));
    lamp.position.set(t.x+.33,t.y+.99,t.z+.055);scene.add(lamp);return lamp;
  });

  // ---------- terrain
  const N = 150, SIZE = 200, tg = new THREE.PlaneGeometry(SIZE, SIZE, N, N); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, height(tp.getX(i), tp.getZ(i)) - (bd ? .09 : 0));
  colorGround(tg);
  tg.computeVertexNormals();
  const terrainPaint = new THREE.MeshBasicMaterial({ color:0xffffff, vertexColors:true });
  const terrain = styledMesh(tg, terrainPaint, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.96 }), false);
  terrain.receiveShadow = true;
  scene.add(terrain);

  if (MAP.kind === 'wild' && !theme.snow) {
    ground.add(tg, {
      count:46000, pal:() => rnd() < .64 ? 0 : 2, size:[.08,.16], flag:FLAG.GROUND, lift:.032,
      filter: p => {
        const density = Math.sin(p.x * .46 + Math.sin(p.z * .42)) * Math.cos(p.z * .35);
        return density > .28 && Math.hypot(p.x,p.z) < 68 && pathDist(p.x,p.z) > 3.6
          && canopies.some(k => (k.x-p.x)**2 + (k.z-p.z)**2 < k.r*k.r*1.4);
      },
    });
  }

  // ---------- distant mountains
  const mgeo = [];
  const peaks = theme.mountains === false || MAP.kind === 'mesh' ? 0 : 16;
  for (let i = 0; i < peaks; i++) {
    const a = (i / 16) * 6.283 + rr(-0.12, 0.12), rad = rr(230, 300), hgt = rr(55, 120), wd = rr(70, 120);
    const base = new THREE.ConeGeometry(1, 1, 13, 7), bp = base.attributes.position;
    for (let v = 0; v < bp.count; v++) { // rugged silhouette: push each ring vertex in and out
      const y = bp.getY(v), k = 1 + (Math.sin(bp.getX(v) * 37 + y * 11 + i) * 0.5 + Math.sin(bp.getZ(v) * 23 + i * 3)) * 0.16 * (0.5 - y);
      bp.setXYZ(v, bp.getX(v) * k, y + Math.sin(bp.getX(v) * 9 + bp.getZ(v) * 7 + i) * 0.03, bp.getZ(v) * k);
    }
    const g = place(base, Math.cos(a) * rad, hgt / 2 - 8, Math.sin(a) * rad, wd, hgt, wd, rnd() * 6);
    const ng = g.toNonIndexed(), np = ng.attributes.position, col = new Float32Array(np.count * 3);
    for (let v = 0; v < np.count; v += 3) { // per-face colour: snow near the top, hazy rock below
      const fy = (np.getY(v) + np.getY(v + 1) + np.getY(v + 2)) / 3 / hgt, snow = fy > 0.5 + rnd() * 0.18;
      const cc = snow ? [0.93, 0.9, 0.9] : [0.56 + rnd() * 0.06, 0.55 + rnd() * 0.05, 0.63];
      for (let q = 0; q < 3; q++) col.set(cc, (v + q) * 3);
    }
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals();
    mgeo.push(ng); far.add(g, { count: 1500, pal: 9, size: [2.2, 4] });
  }
  const mountainMat = underMaterial(9, 1, 0.95, { fog: false });
  if (peaks) scene.add(styledMesh(mergeGeometries(mgeo), mountainMat, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }), false));

  // Supplies sit on field cases; blood is stored in sealed medical lockers.
  for (const supply of [...LAYOUT.items, ...LAYOUT.blood.map(source => ({ ...source, type: 'blood' }))]) {
    const { x, y, z, type } = supply;
    const blood = type === 'blood';
    const body = place(box, x, y + .37, z, blood ? .7 : .8, .74, blood ? .48 : .58);
    put(body, blood ? 22 : 5);
    put(place(box, x, y + .77, z, blood ? .73 : .86, .07, blood ? .51 : .64), 22);
    put(place(box, x, y + .14, z, blood ? .71 : .81, .09, blood ? .49 : .59), 12);
    if (blood) {
      put(place(box, x, y + .49, z + .247, .49, .48, .024), 21);
      put(place(box, x + .19, y + .48, z + .276, .045, .18, .025), 12);
      put(place(box, x - .1, y + .48, z + .265, .18, .06, .01), 23);
      put(place(box, x - .1, y + .48, z + .267, .06, .18, .01), 23);
    }
  }

  // ---------- merged static meshes, one per palette
  const texFor = { 5: TEX.bark(3), 6: TEX.planks(2), 7: TEX.planks(4) };
  for (const k of Object.keys(under)) {
    const foliage = k === '2' || k === '3' || k === '4';
    const normal = stdMaterial(+k, { key: 'world', ...(texFor[k] && { map:texFor[k] }), tone: foliage ? 0.1 : 0.5, flatShading: k === '8', metalness: k === '22' || k === '12' ? 0.35 : 0, roughness: k === '22' ? 0.6 : 0.92 });
    scene.add(styledMesh(mergeGeometries(under[k]), underMaterial(+k, 2, foliage ? 0.8 : 0.85), normal));
  }
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffd070 });
  scene.add(new THREE.Mesh(mergeGeometries(litGeo), litMat));

  const mat = dabMaterial();
  const meshes = [ground.build(mat), solid.build(mat), flora.build(mat, true), far.build(dabMaterial(0.42))];
  const litDabs = lit.build(mat);
  meshes[3].userData.fixed = true;
  for (const m of [...meshes, litDabs]) scene.add(m);

  // ---------- glows
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gx = gc.getContext('2d'), grad = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = grad; gx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(gc);
  const glow = (pos, s, color = 0xffb060) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color }));
    sp.position.copy(pos); sp.scale.setScalar(s); sp.userData.s = s; scene.add(sp); return sp;
  };
  const powerGlows = [...lampPos.map((p) => glow(p, 2.6)), ...(CABIN ? [glow(new THREE.Vector3(cx + 1.4, cy + 1.7, cz - d / 2 - 0.3), 3.2)] : [])];

  // ---------- items
  const prim = (geo, pal, tone = 0.5) => styledMesh(geo, underMaterial(pal, 1, 1), stdMaterial(pal, { key: 'item' + tone, tone, emissive: new THREE.Color(PALETTE[pal][1]).multiplyScalar(0.3) }), false);
  const itemModel = {
    cell: (g) => {
      g.add(prim(new THREE.BoxGeometry(.22,.33,.15), 22), prim(new THREE.BoxGeometry(.23,.06,.16).translate(0,.16,0), 21));
      g.add(prim(new THREE.BoxGeometry(.12,.13,.013).translate(0,.015,.082), 17));
      for (const x of [-.06,.06]) g.add(prim(new THREE.CylinderGeometry(.025,.025,.045,6).translate(x,.21,0), 19));
    },
    ammo: (g) => { // ammunition can: body, lid, handle, stencilled band
      g.add(prim(new THREE.BoxGeometry(0.3, 0.17, 0.15), 18, 0.2), prim(new THREE.BoxGeometry(0.32, 0.035, 0.17).translate(0, 0.1, 0), 18, 0.5),
        prim(new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI).translate(0, 0.118, 0), 22), prim(new THREE.BoxGeometry(0.302, 0.05, 0.152).translate(0, 0.01, 0), 19, 0.6));
    },
    med: (g) => R2R('steel_toolbox').then((src) => { // field kit: the red toolbox with a white cross plate
      const m = styledClone(src, 'item'); m.scale.setScalar(0.13); m.position.y = -0.1; g.add(m);
      for (const z of [0.1, -0.1]) g.add(prim(new THREE.BoxGeometry(0.11, 0.035, 0.012).translate(0, -0.02, z), 21, 1), prim(new THREE.BoxGeometry(0.035, 0.11, 0.012).translate(0, -0.02, z), 21, 1));
    }),
    flare: (g) => { // road flare: red tube, striker cap, fuse tip
      const f = new THREE.Group(); f.rotation.z = 1.1;
      f.add(prim(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), 23, 0.3), prim(new THREE.CylinderGeometry(0.036, 0.036, 0.07, 8).translate(0, 0.17, 0), 21, 0.6), prim(new THREE.CylinderGeometry(0.012, 0.02, 0.05, 6).translate(0, -0.17, 0), 14));
      g.add(f);
    },
  };
  function supplyModel(it, raised = true) {
    const g = new THREE.Group();
    itemModel[it.type](g);
    g.position.set(it.x, (it.y ?? height(it.x,it.z)) + (raised ? .94 : .2), it.z);
    scene.add(g);
    return g;
  }
  const items = LAYOUT.items.map(it => supplyModel(it));
  const droppedCells = new Map();
  const bloodClues = LAYOUT.blood.map(source => {
    const clue = new THREE.Mesh(new THREE.PlaneGeometry(.18,.07), new THREE.MeshBasicMaterial({ color:0x79372d, transparent:true, opacity:0, depthWrite:false }));
    clue.position.set(source.x+.08, source.y+.64, source.z+.266);
    scene.add(clue);
    return clue;
  });

  // ---------- buildings, wrecks and props (rust-to-riches models), baked once they have loaded
  const placements = [
    ...STRUCTS.filter((b) => b.key).map((b) => ({ key: b.key, x: b.x, y: b.gy - 0.05, z: b.z, rot: b.rot, big: b.key !== 'env_derelict_car', center: true })),
    ...(MAP.kind === 'mesh' ? [{ url: MAP.data.model, x: MAP.data.offset.x, y: MAP.data.offset.y, z: MAP.data.offset.z, scale: 1, big: true, keepY: true }] : []),
    ...LAYOUT.props.map((p) => ({ ...p, y: p.y - 0.03, big: p.key === 'env_water_tower' })),
    ...LAYOUT.tx.flatMap((t) => [{ key: 'portable_generator', x: t.x, y: t.y - 0.03, z: t.z, rot: t.id * 1.3 }, { key: 'portable_radio', x: t.x - 0.08, y: t.y + 0.69, z: t.z, rot: t.id * 1.3 + 0.3, s: 0.9 }]),
  ];
  const loading = { loaded: 0, total: 0 };
  const ready = buildStatic(scene, placements, (loaded, total) => Object.assign(loading, { loaded, total })).then(m => { meshes.push(m); });

  // ---------- extraction zone
  const extract = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x8cffc0, transparent: true, opacity: 0.8, fog: false, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(EXTRACT.r - 0.25, EXTRACT.r, 48).rotateX(-Math.PI / 2), ringMat);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(EXTRACT.r, EXTRACT.r, 14, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x8cffc0, transparent: true, opacity: 0.08, fog: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 7; extract.add(ring, beam);
  extract.position.set(EXTRACT.x, height(EXTRACT.x, EXTRACT.z) + 0.25, EXTRACT.z); extract.visible = false; scene.add(extract);

  // ---------- flares and tracers (pooled)
  const flares = [0, 1, 2, 3].map(() => { const s = glow(new THREE.Vector3(), 4.5, 0xff4030); s.visible = false; return s; });
  const tracers = [0, 1, 2, 3, 4, 5].map(() => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, fog: false }));
    l.frustumCulled = false; l.visible = false; l.userData.t = 0; scene.add(l); return l;
  });
  let tracerN = 0;
  const tracer = (a, b) => {
    const l = tracers[tracerN++ % tracers.length];
    l.geometry.setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]); l.userData.t = 0.12; l.visible = true;
  };

  const TXCOL = [new THREE.Color(0x424a4c), new THREE.Color(0xc9984c), new THREE.Color(0x79bf94), new THREE.Color(0x6c7378)];
  function update(dt, t, night, state) {
    environment.update(night);
    // power: path lanterns and windows die in a blackout
    const power = 1 - night;
    litMat.color.setRGB(1 * (0.12 + 0.88 * power), 0.82 * (0.1 + 0.9 * power), 0.44 * (0.1 + 0.9 * power));
    litDabs.visible = !isNormal() && power > 0.5;
    for (const g of powerGlows) g.scale.setScalar(g.userData.s * power * (0.6 + 0.05 * Math.sin(t * 9)));
    for (const l of tracers) if (l.visible) { l.userData.t -= dt; l.material.opacity = Math.max(0, l.userData.t / 0.12); if (l.userData.t <= 0) l.visible = false; }
    txLamps.forEach((lamp, i) => {
      const status = state?.tx[i], locked = state && LAYOUT.tx[i].zone > (state.unlocked ?? 0);
      lamp.material.color.copy(TXCOL[locked ? 3 : status?.on ? 2 : status?.fuse ? 1 : 0]);
      lamp.scale.setScalar(1);
    });
    for (let i = 0; i < items.length; i++) {
      const unlocked = !state || LAYOUT.items[i].zone <= (state.unlocked ?? 0);
      items[i].visible = unlocked && (!state || state.items[i] === '1');
    }
    for (const [i, clue] of bloodClues.entries()) clue.material.opacity = (state?.blood?.[i] ?? 0) > 0 ? .78 : 0;
    const activeDrops = new Set();
    for (const cell of state?.extraDrops ?? []) {
      activeDrops.add(cell.id);
      let model = droppedCells.get(cell.id);
      if (!model) {
        model = supplyModel({ ...cell, type: 'cell' }, false);
        droppedCells.set(cell.id, model);
      }
      model.position.set(cell.x, (cell.y ?? height(cell.x,cell.z)) + .2, cell.z);
    }
    for (const [id, model] of droppedCells) if (!activeDrops.has(id)) {
      scene.remove(model);
      model.traverse(o => o.geometry?.dispose());
      droppedCells.delete(id);
    }
    flares.forEach((f, i) => {
      const s = state?.flares[i]; f.visible = !!s;
      if (s) { f.position.set(s[0], height(s[0], s[1]) + 0.3, s[1]); f.scale.setScalar(4.5 + Math.sin(t * 30 + i) * 0.7); }
    });
    extract.visible = Boolean(state?.extractionOpen);
    ringMat.opacity = 0.55 + 0.3 * Math.sin(t * 3);
  }
  const powerLights = lampPos;
  const dispose = () => {
    for (const clue of bloodClues) clue.material.dispose();
    environment.dispose();
    parent.remove(scene);
    scene.traverse((o) => { o.geometry?.dispose(); });
    pruneDetached();
  };
  return { dispose, meshes, ready, loading, practicals:environment.practicals, litDabs, glow, tracer, update, powerLights, terrain, terrainPaint, mountainMat, dabCount: meshes.reduce((s, m) => s + m.userData.fullCount, 0) };
}

// ---------- sky (painted bands in paint mode, smooth gradient in normal mode)
export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uNight: uniforms.uNight, uTime: uniforms.uTime, uSun: uniforms.uSun, uFogDay: uniforms.uFogDay, uFogNight: uniforms.uFogNight, uStyle: uniforms.uStyle, uZenith: uniforms.uZenith },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uNight, uTime, uStyle; uniform vec3 uSun, uFogDay, uFogNight, uZenith;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
      float strokes(vec2 p){ return n(p*vec2(3.,16.))*.6 + n(p*vec2(7.,40.)+9.)*.4; }
      float fbm(vec2 p){ return n(p)*.5 + n(p*2.1+3.)*.3 + n(p*4.3+7.)*.2; }
      void main(){
        vec3 d = normalize(vDir); float az = atan(d.z, d.x), el = d.y;
        vec2 p = vec2(az*1.6, el*3.2);
        bool paint = uStyle < .5;
        float s = paint ? strokes(p + vec2(el*1.5, 0.)) : .5;
        float t = clamp(el*1.5 + (s-.5)*.3, 0., 1.);
        if (paint) t = floor(t*9. + s*.9)/9.;
        vec3 day = mix(uFogDay, uZenith, smoothstep(0., .85, t));
        float cl = paint ? smoothstep(.56, .7, n(p*vec2(1.2,3.)+3.)*.6 + s*.5) : smoothstep(.5, .78, fbm(vec2(az*2.2 + uTime*.004, el*7.)));
        cl *= smoothstep(.02,.3,el);
        day = mix(day, vec3(.99,.92,.80), cl*.8);
        float sd = max(dot(d, uSun), 0.);
        day += vec3(1.,.72,.38) * (pow(sd, 6.)*.4 + smoothstep(.9975,.9985,sd));
        vec3 night = mix(uFogNight, vec3(.03,.05,.11), smoothstep(0., .7, t));
        night += step(.9975, h(floor(vec2(az*130., el*130.)))) * smoothstep(.05,.3,el) * vec3(.9,.92,1.);
        float band = sin(az*2.2 + n(vec2(az*1.5, uTime*.04))*4. + uTime*.03);
        float au = smoothstep(.45, 1., band) * smoothstep(.12,.3,el) * smoothstep(.85,.4,el) * (.5 + .5*strokes(p*vec2(6.,.6)+uTime*.02));
        night += vec3(.12,.34,.40) * au * .40 + vec3(.7,.75,.9) * smoothstep(.9982,.9988,sd);
        gl_FragColor = vec4(mix(day, night, uNight), 1.);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);
}
export { pathX };
