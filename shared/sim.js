// Movement simulation shared by server (authority) and client (prediction).
import { LAYOUT, BOXES, MAP_RADIUS, height } from './layout.js';

export const SPEED = { walk: 3.6, sprint: 5.4, crouch: 1.8, monster: 6.6, downed: 0.7 };
export const TICK = 1 / 30;
export const RULES = {
  prep: 12, explore: 95, blackout: 40, extract: 75, matchLimit: 14 * 60,
  repairTime: 7, reviveTime: 4, bleedTime: 35, useRange: 2.6, pickupRange: 1.3,
  transformCost: 50, energyDrain: 2.6, monsterHp: 220, fireCd: 0.38, attackCd: 1.3,
  bulletDmg: 34, bulletDmgMonster: 25, clawDmg: 34, flareTime: 15, flareRadius: 6,
};

export const newMove = (x, z) => ({ x, y: height(x, z), z, vx: 0, vy: 0, vz: 0, grounded: true, stam: 1 });

export function collide(p, radius) {
  for (const c of LAYOUT.colliders) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
    if (d < min && d > 1e-4) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
  }
  for (const b of BOXES) {
    const hx = b.w / 2 + radius, hz = b.d / 2 + radius, dx = p.x - b.x, dz = p.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = b.x + Math.sign(dx || 1) * hx; else p.z = b.z + Math.sign(dz || 1) * hz;
    }
  }
  const r = Math.hypot(p.x, p.z);
  if (r > MAP_RADIUS) { p.x *= MAP_RADIUS / r; p.z *= MAP_RADIUS / r; }
}

// inp: { mx, mz (world-space wish direction), sprint, crouch, jump }
// mode: 'human' | 'monster' | 'downed' | 'frozen'; slow multiplies the top speed
export function stepMove(s, inp, dt, mode = 'human', slow = 1) {
  let mx = inp.mx || 0, mz = inp.mz || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const moving = len > 0.05;
  let max = 0;
  if (mode === 'monster') max = SPEED.monster;
  else if (mode === 'downed') max = SPEED.downed;
  else if (mode === 'human') {
    const sprinting = inp.sprint && !inp.crouch && moving && s.stam > 0.03;
    max = inp.crouch ? SPEED.crouch : sprinting ? SPEED.sprint : SPEED.walk;
    s.stam = Math.min(1, Math.max(0, s.stam + (sprinting ? -dt / 7 : dt / 5)));
  }
  max *= slow;
  const k = 1 - Math.exp(-(s.grounded ? 14 : 2.5) * dt);
  s.vx += (mx * max - s.vx) * k; s.vz += (mz * max - s.vz) * k;
  if (s.grounded && inp.jump && !inp.crouch && (mode === 'human' || mode === 'monster')) { s.vy = mode === 'monster' ? 6 : 4.8; s.grounded = false; }
  s.vy -= 13 * dt;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  collide(s, mode === 'monster' ? 0.6 : 0.35);
  const gy = height(s.x, s.z);
  if (s.y <= gy) { s.y = gy; s.vy = 0; s.grounded = true; } else if (s.y > gy + 0.08) s.grounded = false;
  return s;
}
