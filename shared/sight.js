import { BOXES, LAYOUT, height } from './layout.js';

function entry(origin, delta, bounds) {
  let lo = 0, hi = 1;
  for (const [axis, low, high] of bounds) {
    const start = origin[axis], step = delta[axis];
    if (Math.abs(step) < 1e-8) {
      if (start < low || start > high) return Infinity;
    } else {
      const a = (low - start) / step, b = (high - start) / step;
      lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}

export function rayCircle(a, d, x, z, radius) {
  const fx = a.x - x, fz = a.z - z, k = d.x * d.x + d.z * d.z;
  if (k < 1e-9) return Infinity;
  const c = fx * fx + fz * fz - radius * radius;
  if (c < 0) return 0;
  const b = fx * d.x + fz * d.z, disc = b * b - k * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / k;
  return t >= 0 && t <= 1 ? t : Infinity;
}

export function obstacle(a, b, includeProps = true, anyHit = false) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  let best = 1;
  for (const box of BOXES) {
    const t = entry(a, d, [
      ['x', box.x - box.w / 2, box.x + box.w / 2], ['z', box.z - box.d / 2, box.z + box.d / 2],
      ['y', box.gy - .1, box.gy + box.h + .06],
    ]);
    if (t >= .0001 && t < best) {if(anyHit&&t<.995)return t;best = t;}
  }
  if (includeProps) for (const c of LAYOUT.colliders) {
    const t = rayCircle(a, d, c.x, c.z, c.r);
    if (t > .0001 && t < best && a.y + d.y * t < height(c.x, c.z) + c.h) {if(anyHit&&t<.995)return t;best = t;}
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(d.x, d.y, d.z) / .28));
  for (let i = 1; i <= steps && i / steps < best; i++) {
    const t = i / steps, x = a.x + d.x * t, z = a.z + d.z * t;
    if (a.y + d.y * t < height(x, z) - .025) return t;
  }
  return best;
}

export function playerHit(a, b, p) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ground = p.y, h = p.form ? 2.3 : p.st === 1 ? .6 : p.cr ? 1.32 : 1.85;
  const radius = p.form ? .82 : .42;
  const t = rayCircle(a, d, p.x, p.z, radius);
  if (t <= 1 && a.y + d.y * t >= ground - .1 && a.y + d.y * t <= ground + h) return t;
  const yEdge = d.y < 0 ? ground + h : ground - .1;
  const edge = (yEdge - a.y) / d.y;
  if (edge >= 0 && edge <= 1 && Math.hypot(a.x + d.x * edge - p.x, a.z + d.z * edge - p.z) <= radius) return edge;
  return Infinity;
}

export const eye = (s, crouch = false) => ({ x: s.x, y: s.y + (crouch ? 1.05 : 1.45), z: s.z });
