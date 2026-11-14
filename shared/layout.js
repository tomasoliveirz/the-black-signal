// Amberwood layout, shared by client and server. Pure JS, deterministic.
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const vnoise = (x, z) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
};


// ---------- maps: one generator, several environments. `kind` is wild (terrain + forest), city, factory (walled hall) or mesh (imported set).
const DIM = { // rust-to-riches footprints in metres: [w, d, h]
  env_barn_old: [12.9, 16.5, 7.9], env_house_boarded: [14.7, 13.5, 6], env_trailer_abandoned: [12.9, 5.3, 3.1], env_derelict_car: [2.5, 4.6, 1.5],
  env_storefront_old: [18, 10.7, 5.4], env_motel_closed: [21, 7.9, 3.9], env_garage_detached: [7.2, 7.2, 3.8], env_warehouse_salvage: [21.3, 16.5, 7.5],
  env_house_ranch_a: [15.3, 14.7, 6.1], env_house_ranch_b: [13.5, 14.1, 7.2], env_storage_office: [6.6, 5.4, 3.1],
};
const Q = Math.PI / 2;
const S = (key, x, z, rot = 0) => { const [w, d, h] = DIM[key], side = Math.abs(Math.abs(rot) - Q) < 0.1; return { key, x, z, rot, w: side ? d : w, d: side ? w : d, h }; };
const wall = (x, z, w, d, h = 7) => ({ x, z, w, d, h, kind: 'wall' });
const machine = (x, z, w, d, h = 3) => ({ x, z, w, d, h, kind: 'machine' });
const FARM = ['prop_crate_wood_a', 'prop_metal_barrel', 'prop_pallet_wood_a', 'prop_jerry_can'], YARD = ['prop_metal_barrel', 'prop_metal_barrel', 'prop_tire_stack_a', 'prop_pallet_wood_a', 'prop_crate_wood_a', 'prop_cinder_blocks'];

export const MAPS = {
  amberwood: {
    zoneNames: ['Cabana', 'Celeiro', 'Torre'],
    name: 'Amberwood', sub: 'Floresta de outono', kind: 'wild', seed: 20260114, pa: 7, pb: 3, amp: 1, trees: 120, pine: 0.2, dead: 0, rocks: 34, cabin: true, tower: [-20, -10],
    structs: (px) => [S('env_barn_old', -28, -36), S('env_house_boarded', 27, -20), S('env_trailer_abandoned', 22, -54), S('env_derelict_car', px(-25) + 5.2, -25, 0.25)],
    clusters: [[-20, -36, 3, YARD], [18.5, -20, 2.5, FARM], [22, -49.5, 3, YARD]],
    theme: {},
  },
  hollow: {
    zoneNames: ['Trilho Sul', 'Bosque', 'Antena'],
    name: 'Hollow Mire', sub: 'Floresta assombrada', kind: 'wild', seed: 666013, pa: 9, pb: 4, amp: 1.25, trees: 230, pine: 0.3, dead: 0.5, rocks: 55, cabin: true, tower: null,
    structs: (px) => [S('env_house_boarded', -27, -26), S('env_barn_old', 29, -46), S('env_trailer_abandoned', -24, -58), S('env_derelict_car', px(-40) - 5, -40, -0.4), S('env_garage_detached', 24, -12)],
    clusters: [[-18, -26, 2.5, FARM], [20, -44, 3, YARD], [-22, -53, 3, YARD]],
    theme: {
      minNight: 0.31, fog: [12, 69], tuft: 0.8, mountains: false, fogDay: '#5f6f6a', fogNight: '#0c1418', zenith: '#3c4f58', grass: '#3f4a32', path: '#4a4038',
      pal: { 0: ['#6f7a4c', '#4a5638', '#2a3530'], 1: ['#7a6a58', '#54463c', '#30282a'], 2: ['#7c8a5a', '#4e5f48', '#283a36'], 3: ['#8a6a74', '#5c4258', '#33263c'], 4: ['#55705a', '#34503e', '#1c302c'], 15: ['#8a8058', '#5e5a40', '#3a3830'], 9: ['#7a8890', '#56646e', '#3a4650'] },
    },
  },
  frost: {
    zoneNames: ['Abrigo', 'Crista', 'Torre'],
    name: 'Frostpeak', sub: 'Montanhas nevadas', kind: 'wild', seed: 90210, pa: 6, pb: 4, amp: 2.4, trees: 95, pine: 1, dead: 0.15, rocks: 60, cabin: true, tower: [-20, -10],
    structs: (px) => [S('env_trailer_abandoned', 21, -22), S('env_house_ranch_a', -29, -42), S('env_garage_detached', 24, -55), S('env_derelict_car', px(-12) - 5, -12, 0.5)],
    clusters: [[15, -18, 2.5, FARM], [-20, -40, 3, YARD], [19, -52, 2.5, FARM]],
    theme: {
      fog: [14, 110], tuft: 0.3, fogDay: '#cfdbe8', fogNight: '#101a2c', zenith: '#6c9ccc', grass: '#dfe6ee', path: '#a9b6c6', snow: true,
      pal: { 0: ['#ffffff', '#dfe8f2', '#a8b8d0'], 1: ['#d4dce8', '#a4b2c6', '#74849e'], 4: ['#b8d0c4', '#4e7260', '#28443c'], 15: ['#f4f8ff', '#ccd8e8', '#98a8c0'], 8: ['#d8dce4', '#8c94a0', '#4c5664'], 9: ['#f4f6fa', '#b4c0d4', '#7c8cac'] },
    },
  },
  ashfall: {
    zoneNames: ['Lavandaria', 'Loja 24H', 'Armazém'],
    name: 'Ashfall', sub: 'Cidade apocalíptica', kind: 'city', seed: 4517, pa: 1.5, pb: 0, amp: 0.12, trees: 22, pine: 0, dead: 1, rocks: 14, cabin: false, tower: [30, 6], treeMin: 11,
    structs: (px) => [
      S('env_storefront_old', -17, -14, Q), S('env_motel_closed', -15.5, -40, Q), S('env_garage_detached', -15, 8, Q),
      S('env_house_ranch_b', 18.5, -12, -Q), S('env_storage_office', 14.5, -30, -Q), S('env_house_boarded', 18, -46, -Q), S('env_warehouse_salvage', 20, -68, -Q),
      S('env_house_ranch_a', -38, -64, Q), S('env_trailer_abandoned', -36, -24, 0), S('env_barn_old', 42, -34, 0),
      ...[[5.4, -12, 0.2], [-5, -24, -0.3], [5.5, -28, 2.9], [4.6, -41, 0.1], [-4.4, -54, 0.6], [5.2, -60, -0.15], [-7.5, -10, 1.4]].map(([x, z, r]) => S('env_derelict_car', px(z) + x, z, r > 1 && r < 2 ? Q : r)),
    ],
    clusters: [[-9, -14, 2, YARD], [9, -12, 2, FARM], [9, -30, 2, YARD], [-9, -40, 2.5, YARD], [9.5, -46, 2, FARM], [9, -62, 2.5, YARD], [-8, -30, 2, ['prop_cinder_blocks', 'prop_cinder_blocks', 'prop_tire_stack_a']]],
    theme: {
      minNight: 0.08, fog: [19, 112], tuft: 0, litter: 0.025, mountains: false, fogDay: '#a9a598', fogNight: '#141a22', zenith: '#758591', grass: '#6a6258', path: '#4a4a4e',
      pal: { 0: ['#a09484', '#746a5e', '#46403c'], 1: ['#7c7c82', '#55565c', '#33343a'], 15: ['#b4a48c', '#8a7a66', '#5a5048'], 9: ['#a89c94', '#7c7470', '#565258'] },
    },
  },
  foundry: {
    zoneNames: ['Receção', 'Fornos', 'Manutenção'],
    name: 'Fundição 9', sub: 'Fábrica abandonada', kind: 'factory', seed: 9009, pa: 0, pb: 0, amp: 0, trees: 0, pine: 0, dead: 0, rocks: 0, cabin: false, tower: null, mastH: 9, radius: 92,
    structs: () => [
      wall(0, 10.5, 54, 1), wall(0, -82.5, 54, 1), wall(-26.5, -36, 1, 94), wall(26.5, -36, 1, 94),
      // two partitions split the hall into three zones; each has a central gate and a side door
      wall(-14.5, -26, 23, 0.6), wall(8.5, -26, 11, 0.6), wall(22, -26, 8, 0.6), wall(-22, -56, 8, 0.6), wall(-8.5, -56, 11, 0.6), wall(14.5, -56, 23, 0.6),
      machine(14, -10, 6, 4), machine(-17, -12, 5, 8, 4), machine(15, -40, 7, 5), machine(-18, -40, 6, 6, 5), machine(17, -68, 5, 7, 4), machine(-21.5, -74, 5, 6), machine(-14, 5, 8, 3, 2.2), machine(8, -74.5, 6, 4, 2.5),
      S('env_storage_office', 21, -19.5, -Q), S('env_storage_office', -21.5, -50, Q), S('env_derelict_car', 9, 4, Q),
    ],
    pillars: [[-13, -4], [13, -4], [-13, -18], [13, -18], [-13, -34], [13, -32], [-13, -48], [13, -48], [-13, -64], [13, -62], [-13, -78], [13, -78]],
    clusters: [[20, -4, 3, YARD], [-21, 2, 3, FARM], [-21, -30, 2.5, YARD], [21, -33, 3, YARD], [21, -50, 2.5, FARM], [-20, -62, 3, YARD], [21, -78, 2.5, YARD], [0, -80, 3, FARM], [-6, -22, 2, ['prop_pallet_wood_a', 'prop_crate_wood_a', 'prop_crate_wood_a']], [6, -52, 2, ['prop_pallet_wood_a', 'prop_metal_barrel', 'prop_crate_wood_a']]],
    theme: {
      minNight: 0.12, fog: [13, 78], tuft: 0, litter: 0.012, mountains: false, fogDay: '#8b918b', fogNight: '#121c24', zenith: '#6a7078', grass: '#6c6a64', path: '#585a5c',
      pal: { 0: ['#9a968c', '#6e6c66', '#42434a'], 1: ['#8a8c90', '#5e6064', '#383a40'], 15: ['#a08c70', '#74624c', '#4a3e36'], 8: ['#c4c0b4', '#8e8e86', '#54575e'] },
    },
  },
};
// imported sets register here: registerMesh('mall', { name, sub, theme, data }) with data = { boxes, spawn, goal, route, open, bounds, model, offset }
export function registerMesh(id, def) { MAPS[id] = { kind: 'mesh', seed: 7, pa: 0, pb: 0, amp: 0, trees: 0, rocks: 0, cabin: false, tower: null, mastH: 5, clusters: [], ...def }; }

export let MAP_ID = '', MAP = null, LAYOUT = null, BOXES = [], STRUCTS = [], CABIN = null, MAST = null, EXTRACT = null, TOWER = null, MAP_RADIUS = 84;
export function captureLayout() {
  return {MAP_ID,MAP,LAYOUT,BOXES,STRUCTS,CABIN,MAST,EXTRACT,TOWER,MAP_RADIUS};
}
export function activateLayout(context) {
  ({MAP_ID,MAP,LAYOUT,BOXES,STRUCTS,CABIN,MAST,EXTRACT,TOWER,MAP_RADIUS}=context);
}

const segDist = (x, z, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t); };
export function pathX(z) { return MAP.pa * Math.sin(z * 0.07) + MAP.pb * Math.sin(z * 0.19 + 1); }
export function pathDist(x, z) {
  if (MAP.kind === 'mesh') { const r = MAP.data.route; let d = 99; for (let i = 1; i < r.length; i++) d = Math.min(d, segDist(x, z, r[i - 1], r[i])); return d; }
  return z > 6 || z < -78 ? 99 : Math.abs(x - pathX(z));
}
export function height(x, z) {
  if (!MAP.amp) return 0;
  const r = Math.hypot(x, z);
  let h = 2.2 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05) + 1.4 * Math.sin(x * 0.11 + z * 0.08);
  h += (vnoise(x * 0.18, z * 0.18) - 0.5) * 1.3 + (vnoise(x * 0.6, z * 0.6) - 0.5) * 0.25;
  h *= smooth(r, 9, 30) * MAP.amp;
  h *= 0.35 + 0.65 * smooth(pathDist(x, z), 1, 7);
  for (const b of BOXES) { // level the ground under buildings
    const e = Math.max(Math.abs(x - b.x) - b.w / 2, Math.abs(z - b.z) - b.d / 2);
    if (e < 4) h = b.gy + (h - b.gy) * smooth(e, 0, 4);
  }
  h += Math.max(0, r - 85) * 0.35;
  return h;
}
export const inBox = (x, z, m = 0) => BOXES.some((b) => Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m);

export function setMap(id) {
  if (!MAPS[id]) id = 'amberwood';
  MAP_ID = id; MAP = MAPS[id]; BOXES = [];
  MAP_RADIUS = MAP.radius ?? 84;
  if (MAP.kind === 'mesh') {
    const d = MAP.data;
    STRUCTS = []; CABIN = null; TOWER = null;
    BOXES = d.boxes.map((b) => ({ ...b, gy: 0 }));
    MAST = { x: d.goal.x, z: d.goal.z };
    MAP_RADIUS = Math.max(...[d.bounds.minX, d.bounds.maxX, d.bounds.minZ, d.bounds.maxZ].map(Math.abs)) * 1.45 + 2;
    LAYOUT = buildMesh(d);
    return LAYOUT;
  }
  CABIN = MAP.cabin ? { x: 7, z: 5, w: 7, d: 5.4, h: 3 } : null;
  STRUCTS = MAP.structs(pathX);
  const list = [...(CABIN ? [CABIN] : []), ...STRUCTS];
  for (const b of list) b.gy = 0;
  for (const b of list) b.gy = height(b.x, b.z);   // BOXES is still empty here, so this is the natural ground
  BOXES = list;
  MAST = { x: pathX(-70), z: -70 };
  EXTRACT = { x: MAST.x - 9, z: MAST.z + 4, r: 4.5 };
  TOWER = MAP.tower ? { key: 'env_water_tower', x: MAP.tower[0], z: MAP.tower[1], r: 3.2 } : null;
  LAYOUT = build();
  return LAYOUT;
}

const SOLID = { prop_metal_barrel: 0.42, prop_crate_wood_a: 0.5, prop_tire_stack_a: 0.45 };
function build() {
  const rnd = rng(MAP.seed), rr = (a, b) => a + rnd() * (b - a);
  const colliders = [], trees = [], rocks = [];
  const at = (x, z) => ({ x, z, y: height(x, z) });
  const positions = MAP.kind === 'factory'
    ? [[-9, -16], [9, -38], [-11, -70]]
    : [[pathX(-14) - 5, -14], [pathX(-41) + 8, -41], [MAST.x - 4, MAST.z + 2.5]];
  const tx = positions.map(([x, z], zone) => {
    for (let radius = 0; radius < 12; radius += 1) {
      for (let i = 0; i < 16; i++) {
        const px = x + Math.cos(i * Math.PI / 8) * radius, pz = z + Math.sin(i * Math.PI / 8) * radius;
        if (!inBox(px, pz, 2)) return { id: zone, zone, ...at(px, pz) };
      }
    }
    throw new Error(`Transmissor sem acesso em ${MAP.name}`);
  });
  const spawns = [0, 1, 2, 3, 4, 5].map((i) => at(1 + Math.cos(i * 1.047) * 2.6, -5 + Math.sin(i * 1.047) * 2.6));
  const clear = [...tx.map((t) => ({ ...t, r: 3.6 })), ...spawns.map((s) => ({ ...s, r: 2 })), { ...EXTRACT, r: 6.5 }];
  const blocked = (x, z, m = 0) => clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + m);
  // scenery placed before the forest so trees and rocks keep clear of it
  const props = [];
  if (TOWER) { colliders.push({ x: TOWER.x, z: TOWER.z, r: TOWER.r, h: 17 }); props.push({ key: TOWER.key, ...at(TOWER.x, TOWER.z), rot: 0.4, s: 1 }); }
  if (MAP.kind !== 'factory') for (const z of [-2, -22, -42, -62]) { const x = pathX(z) - 3.4; colliders.push({ x, z, r: 0.3, h: 6.5 }); props.push({ key: 'env_power_pole', ...at(x, z), rot: Math.atan2(pathX(z - 1) - pathX(z + 1), -2), s: 1 }); }
  const pillars = (MAP.pillars || []).map(([x, z]) => { colliders.push({ x, z, r: 0.45, h: 7 }); return { x, z }; });
  const scatter = (cx, cz, spread, keys) => {
    for (const key of keys) for (let k = 0; k < 30; k++) {
      const x = cx + rr(-spread, spread), z = cz + rr(-spread, spread);
      if (inBox(x, z, 0.7) || blocked(x, z, -1.2) || pathDist(x, z) < 1.6 || colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.9)) continue;
      props.push({ key, ...at(x, z), rot: rnd() * 6.283, s: rr(0.9, 1.1) });
      if (SOLID[key]) colliders.push({ x, z, r: SOLID[key], h: 0.8 });
      break;
    }
  };
  if (CABIN) scatter(CABIN.x - 4.5, CABIN.z - 3, 2.2, FARM);
  for (const [cx, cz, spread, keys] of MAP.clusters) scatter(cx, cz, spread, keys);
  for (const t of tx) scatter(t.x, t.z, 3.4, ['prop_crate_wood_a', 'prop_metal_barrel', 'prop_cinder_blocks']);
  scatter(MAST.x + 3, MAST.z + 4, 3, ['prop_metal_barrel', 'prop_pallet_wood_a', 'prop_crate_wood_a']);

  let tries = 0;
  const tmin = MAP.treeMin ?? 3.2;
  while (trees.length < MAP.trees && tries++ < 9000) {
    const ang = rnd() * Math.PI * 2, rad = 9 + Math.sqrt(rnd()) * 78, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (pathDist(x, z) < tmin || Math.abs(x) < tmin && z < 8 && z > -80 || inBox(x, z, 4) || Math.hypot(x, z) < 8 || blocked(x, z) || Math.hypot(x - MAST.x, z - MAST.z) < 8) continue;
    if (colliders.some((c) => Math.hypot(c.x - x, c.z - z) < 3.4)) continue;
    const dead = rnd() < MAP.dead, pine = !dead && rnd() < MAP.pine, th = rr(3.2, 5.6) * (pine ? 0.7 : 1), tr = rr(0.22, 0.38);
    trees.push({ x, z, y: height(x, z), pine, dead, th, tr, seed: Math.floor(rnd() * 1e9) });
    colliders.push({ x, z, r: tr + 0.25, h: 6 });
  }
  for (let i = 0; i < MAP.rocks; i++) {
    const ang = rnd() * 6.283, rad = 11 + rnd() * 70, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, s = rr(0.5, 1.6);
    if (pathDist(x, z) < 2 || inBox(x, z, 2) || blocked(x, z, s) || colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + s + 0.6)) continue;
    rocks.push({ x, z, y: height(x, z), s, seed: Math.floor(rnd() * 1e9) });
    colliders.push({ x, z, r: s * 0.95, h: s * 0.9 });
  }
  const lanterns = [-9, -30, -52].map((z) => { const x = pathX(z) + 1.9; colliders.push({ x, z, r: 0.25, h: 2.5 }); return at(x, z); });
  const mh = MAP.mastH ?? 18;
  colliders.push({ x: MAST.x, z: MAST.z, r: 1.4, h: mh }, { x: MAST.x + 3.2, z: MAST.z, r: 1.9, h: 2.2 });
  for (const t of tx) colliders.push({ x: t.x, z: t.z, r: 0.6, h: 1.3 });

  const sectorDepths = [[-25, 8], [-55, -27], [-80, -57]];
  const positionsByZone = [
    [[-17,-17], [15,-18], [-11,-3], [19,-24], [-20,-7], [12,-8], [-16,3], [20,-9], [-21,-24], [11,-23], [0,-22]],
    [[-19,-37], [18,-43], [-13,-30], [21,-48], [12,-31], [-18,-47], [21,-35], [-20,-52], [15,-53], [-20,-29], [0,-49]],
    [[-16,-66], [19,-68], [-13,-59], [12,-75], [18,-58], [-12,-75], [22,-77], [-21,-73], [16,-61], [-19,-59], [0,-77]],
  ];
  const occupied = [...tx, ...spawns, EXTRACT];
  function place(near, zone) {
    const [cx, cz] = near;
    const [low, high] = sectorDepths[zone];
    for (let offset = 0; offset <= 22; offset += 1) {
      const points = Math.max(1, Math.ceil(2 * Math.PI * offset));
      for (let i = 0; i < points; i++) {
        const angle = i / points * 2 * Math.PI;
        const x = cx + offset * Math.cos(angle), z = cz + offset * Math.sin(angle);
        if (z < low || z > high || Math.abs(x) > 24 || inBox(x, z, 1) || Math.hypot(x, z) > MAP_RADIUS - 2
          || colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + .85)
          || occupied.some(p => Math.hypot(p.x - x, p.z - z) < (p.r ? p.r + 1 : 2.45))) continue;
        const point = at(x, z);
        occupied.push(point);
        return point;
      }
    }
    throw new Error(`Sem espaço para recurso em ${MAP.name}, setor ${zone + 1}: ${near}`);
  }
  const resources = sectorResources(positionsByZone, place);
  for (const p of [...resources.items, ...resources.blood]) colliders.push({ x:p.x, z:p.z, r:.43, h:.78 });
  const hint = (zone, id, t) => {
    const z = -17 - zone * 26 + Math.sin(t * .2 + id) * 4;
    return { x: pathX(z) + Math.cos(id) * 3, z };
  };
  return { trees, rocks, lanterns, colliders, tx, ...resources, spawns, props, pillars, hint, zoneNames: MAP.zoneNames };
}

const resourceTypes = ['cell', 'cell', 'ammo', 'ammo', 'med', 'flare'];

function sectorResources(positionsByZone, place) {
  const items = [], blood = [], recovery = [];
  positionsByZone.forEach((positions, zone) => {
    const points = positions.map(near => place(near, zone));
    resourceTypes.forEach((type, i) => items.push({ ...points[i], type, zone, id: items.length }));
    for (const point of points.slice(6, 10)) blood.push({ ...point, zone, id: blood.length });
    recovery.push(points[10]);
  });
  return { items, blood, recovery };
}

// The imported mall already has navigable branches around the kiosks and into the service wing.
function buildMesh(d) {
  const colliders = [];
  const at = ([x, z]) => ({ x, z, y: 0 });
  const spawns = Array.from({ length: 6 }, (_, i) => {
    const x = d.spawn.x + Math.cos(i * Math.PI / 3) * 1.5;
    const z = d.spawn.z + Math.sin(i * Math.PI / 3) * 1.5;
    return inBox(x, z, .4) ? { ...d.spawn, y: 0 } : at([x, z]);
  });
  const tx = [[-14.7, 16.5], [1.13, 12], [7.13, -15.75]].map((p, zone) => ({ ...at(p), zone, id: zone }));
  EXTRACT = { x: -5.12, z: -28.5, r: 3 };
  const lanterns = [[-6.12, 16], [-7.87, 2.75], [-6.37, -16]].map(p => {
    const point = at(p);
    colliders.push({ ...point, r: .25, h: 2.5 });
    return point;
  });
  colliders.push({ x: MAST.x, z: MAST.z, r: .5, h: MAP.mastH });
  for (const t of tx) colliders.push({ x: t.x, z: t.z, r: .6, h: 1.3 });
  const resources = sectorResources([
    [[-15.37,21.25], [-5.87,19], [-15.37,27.25], [-4.12,21.25], [-15.37,12.75], [-4.37,27],
      [-15.37,31.5], [-4.12,31.5], [-9.37,19.5], [-11.37,13], [-7.62,23.75]],
    [[-15.12,8.5], [-1.37,15.25], [-4.12,8], [-10.62,0], [-12.62,5], [-4.12,3],
      [-15.37,5.5], [-7.37,-.5], [-7.87,11.5], [-4.12,-2.5], [-9.12,7.5]],
    [[-15.37,-19.25], [-15.37,-23], [-13.62,-6.75], [-4.87,-10.75], [-15.37,-27], [-13.12,-15.5],
      [-15.37,-9], [-12.12,-25], [-.12,-16], [-7.87,-22.25], [-12.87,-21.25]],
  ], at);
  for (const p of [...resources.items, ...resources.blood]) colliders.push({ x:p.x, z:p.z, r:.43, h:.78 });
  return {
    trees: [], rocks: [], lanterns, colliders, tx, ...resources, spawns, props: [], pillars: [],
    hint: zone => tx[Math.min(zone, 2)], zoneNames: ['Átrio', 'Galeria', 'Serviço'],
  };
}
setMap('amberwood');
