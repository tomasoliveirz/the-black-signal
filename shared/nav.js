// Grid navigation for bots: straight line when it is clear, otherwise follow a flood-fill distance field to the target.
import { LAYOUT, BOXES, MAP_RADIUS } from './layout.js';

const CELL = 0.5, PAD = 0.42;
let grid = null, owner = null;
function build() {
  const R = Math.ceil(MAP_RADIUS), n = Math.ceil((R * 2) / CELL), block = new Uint8Array(n * n);
  const mark = (x0, x1, z0, z1, test) => {
    for (let j = Math.max(0, Math.floor((z0 + R) / CELL)); j <= Math.min(n - 1, Math.floor((z1 + R) / CELL)); j++)
      for (let i = Math.max(0, Math.floor((x0 + R) / CELL)); i <= Math.min(n - 1, Math.floor((x1 + R) / CELL)); i++)
        if (!test || test(-R + (i + 0.5) * CELL, -R + (j + 0.5) * CELL)) block[j * n + i] = 1;
  };
  for (const b of BOXES) mark(b.x - b.w / 2 - PAD, b.x + b.w / 2 + PAD, b.z - b.d / 2 - PAD, b.z + b.d / 2 + PAD);
  for (const c of LAYOUT.colliders) { const r = c.r + PAD; mark(c.x - r, c.x + r, c.z - r, c.z + r, (x, z) => Math.hypot(x - c.x, z - c.z) < r); }
  for (const t of LAYOUT.tx) { const r = 0.6 + PAD; mark(t.x - r, t.x + r, t.z - r, t.z + r, () => false); } // (transmitters are already in colliders)
  grid = { R, n, block, fields: new Map() }; owner = LAYOUT;
}
const cellOf = (x, z) => { const i = Math.floor((x + grid.R) / CELL), j = Math.floor((z + grid.R) / CELL); return i < 0 || j < 0 || i >= grid.n || j >= grid.n ? -1 : j * grid.n + i; };
function freeNear(c) { // nearest unblocked cell (targets usually sit on a collider)
  if (c < 0) return -1;
  if (!grid.block[c]) return c;
  const n = grid.n, ci = c % n, cj = (c / n) | 0;
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue;
    if (!grid.block[j * n + i]) return j * n + i;
  }
  return -1;
}
function clearLine(ax, az, bx, bz) {
  const distance = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(distance / (CELL * .5)));
  let previous = cellOf(ax, az);
  if (previous < 0) return false;
  for (let step = 1; step <= steps; step++) {
    const cell = cellOf(ax + (bx - ax) * step / steps, az + (bz - az) * step / steps);
    if (cell < 0 || grid.block[cell]) return false;
    if (cell !== previous && !navigationNeighbours(previous, grid.n, grid.block, true).includes(cell)) return false;
    previous = cell;
  }
  return true;
}
export function navigationNeighbours(cell, size, blocked, diagonal = false) {
  if (cell < 0 || cell >= size * size) return [];
  const column = cell % size, row = Math.floor(cell / size), result = [];
  for (const [dx, dz] of diagonal ? [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]] : [[0,-1],[0,1],[-1,0],[1,0]]) {
    const x = column + dx, z = row + dz;
    if (x < 0 || z < 0 || x >= size || z >= size) continue;
    const next = z * size + x;
    if (blocked[next] || (dx && dz && (blocked[row * size + x] || blocked[z * size + column]))) continue;
    result.push(next);
  }
  return result;
}
function field(target) {
  let f = grid.fields.get(target);
  if (f) return f;
  const n = grid.n; f = new Uint16Array(n * n).fill(65535);
  const q = new Int32Array(n * n); let h = 0, t = 0;
  f[target] = 0; q[t++] = target;
  while (h < t) {
    const c = q[h++], d = f[c] + 1;
    for (const nb of navigationNeighbours(c, n, grid.block)) if (f[nb] > d) { f[nb] = d; q[t++] = nb; }
  }
  if (grid.fields.size > 48) grid.fields.delete(grid.fields.keys().next().value);
  grid.fields.set(target, f);
  return f;
}
// Where to walk right now to get from `from` to `to`.
export function navStep(from, to) {
  if (owner !== LAYOUT) build();
  const a = freeNear(cellOf(from.x, from.z)), b = freeNear(cellOf(to.x, to.z));
  if (a < 0 || b < 0) return {x:from.x,z:from.z};
  const n = grid.n, pos = (c) => ({ x: -grid.R + ((c % n) + 0.5) * CELL, z: -grid.R + (((c / n) | 0) + 0.5) * CELL });
  const end = pos(b);
  if (clearLine(from.x, from.z, end.x, end.z)) return to;
  const f = field(b);
  if (f[a] === 65535) return {x:from.x,z:from.z};
  let c = a, best = pos(a);
  for (let k = 0; k < 12 && f[c] > 0; k++) { // walk down the field, keeping the farthest cell still in straight sight
    let nx = c, nd = f[c];
    for (const nb of navigationNeighbours(c, n, grid.block, true)) if (f[nb] < nd) { nd = f[nb]; nx = nb; }
    if (nx === c) break;
    c = nx; const p = pos(c);
    if (!clearLine(from.x, from.z, p.x, p.z)) break;
    best = p;
  }
  return best;
}
