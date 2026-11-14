import { RULES as R } from '../shared/rules.js';
import { eye, obstacle, playerHit } from '../shared/sight.js';
import { height, EXTRACT } from '../shared/layout.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function attackReady(game, p) {
  return game.running && game.combatOpen && !p.spectator && p.st === 0 && p.stun <= 0 && p.protect <= 0;
}
export function revert(game, p, forced) {
  p.form = 0; p.windup = 0; p.executing = null;
  if (forced) { p.energy = 0; p.stun = 3; p.hp = Math.min(p.hp, 40); }
  game.broadcast({ t: 'ev', k: 'revert', id: p.id });
}
export function hurt(game, q, damage, by) {
  if (!game.combatOpen || q.st !== 0 || (by.form && q.protect > 0)) return;
  q.damageVersion++; q.executing = null;
  if (q.form) { q.mhp -= damage; if (q.mhp <= 0) revert(game, q, true); return; }
  q.hp = Math.max(0, q.hp - damage);
  if (!q.bot) game.send(q, { t: 'ev', k: 'hurt' });
  if (!q.hp) {
    q.st = 1; q.bleed = R.bleedTime; q.rv = 0; q.interaction = null; q.windup = 0;
    game.broadcast({ t: 'ev', k: 'down', id: q.id });
    game.record('down', { id: q.id, by: by.id });
  }
}
export function kill(game, q) {
  if (q.st >= 2) return;
  q.st = 2; q.form = 0; q.windup = 0; q.interaction = null; q.executing = null;
  game.dropCell(q);
  game.record('death', { id: q.id });
  game.broadcast({ t: 'ev', k: 'dead', id: q.id });
}
export function claw(game, p) {
  if (!attackReady(game, p) || !p.form || p.cdAtk > 0 || p.windup > 0) return;
  p.windup = R.clawWindup; p.cdAtk = R.attackCd;
  game.broadcast({ t: 'ev', k: 'claw', id: p.id });
}
export function resolveClaw(game, p) {
  if (!attackReady(game, p) || !p.form) return;
  for (const q of game.active()) {
    if (q === p || q.st !== 0 || q.form || q.protect > 0) continue;
    const dx = q.s.x - p.s.x, dz = q.s.z - p.s.z, d = Math.hypot(dx, dz);
    if (d > R.clawRange || Math.abs(p.s.y - q.s.y) > 1.65 || (d > .5 && (dx * Math.sin(p.face) + dz * Math.cos(p.face)) / d < .55)) continue;
    if (!game.visible(eye(p.s), eye(q.s, q.inp.crouch))) { game.metrics.wallBlocks++; continue; }
    hurt(game, q, R.clawDmg, p);
  }
}
export function fire(game, p, d, camera) {
  if (!attackReady(game, p) || p.form || p.cdFire > 0 || !Array.isArray(d) || d.length !== 3 || !d.every(Number.isFinite)) return;
  if (p.ammo <= 0) {
    if (!p.bot && p.cdEmpty <= 0) { p.cdEmpty = .5; game.send(p, { t: 'ev', k: 'empty' }); }
    return;
  }
  const magnitude = Math.hypot(...d);
  if (!(magnitude > .1 && magnitude < 1000)) return;
  const direction = { x: d[0] / magnitude, y: d[1] / magnitude, z: d[2] / magnitude };
  const origin = eye(p.s, p.inp.crouch);
  let aimOrigin = origin;
  if (Array.isArray(camera) && camera.length === 3 && camera.every(Number.isFinite)) {
    const proposed = { x: camera[0], y: camera[1], z: camera[2] };
    if (Math.hypot(proposed.x - origin.x, proposed.y - origin.y, proposed.z - origin.z) <= 10 && obstacle(origin, proposed, false) > .97) aimOrigin = proposed;
  }
  let endpoint = { x: aimOrigin.x + direction.x * 60, y: aimOrigin.y + direction.y * 60, z: aimOrigin.z + direction.z * 60 };
  let t = obstacle(aimOrigin, endpoint);
  for (const q of game.active()) {
    if (q === p || q.st !== 0) continue;
    t = Math.min(t, playerHit(aimOrigin, endpoint, { ...q.s, form: q.form, st: q.st, cr: q.inp.crouch }));
  }
  endpoint = { x: aimOrigin.x + (endpoint.x - aimOrigin.x) * t, y: aimOrigin.y + (endpoint.y - aimOrigin.y) * t, z: aimOrigin.z + (endpoint.z - aimOrigin.z) * t };
  const len = Math.hypot(endpoint.x - origin.x, endpoint.y - origin.y, endpoint.z - origin.z);
  if (len < .01) return;
  const scale = Math.min(1, 60 / len);
  endpoint = { x: origin.x + (endpoint.x - origin.x) * scale, y: origin.y + (endpoint.y - origin.y) * scale, z: origin.z + (endpoint.z - origin.z) * scale };
  let best = obstacle(origin, endpoint), hit = null;
  for (const q of game.active()) {
    if (q === p || q.st !== 0) continue;
    const k = playerHit(origin, endpoint, { ...q.s, form: q.form, st: q.st, cr: q.inp.crouch });
    if (k <= best) { best = k; hit = q; }
  }
  p.cdFire = R.fireCd; p.ammo--;
  p.face = Math.atan2(endpoint.x - origin.x, endpoint.z - origin.z);
  const end = [origin.x + (endpoint.x - origin.x) * best, origin.y + (endpoint.y - origin.y) * best, origin.z + (endpoint.z - origin.z) * best];
  game.broadcast({ t: 'ev', k: 'shot', id: p.id, a: [origin.x, origin.y, origin.z], b: end, hit: hit?.id ?? 0 });
  if (hit) hurt(game, hit, hit.form ? R.bulletDmgMonster : R.bulletDmg, p);
}

export function act(game, p, m) {
  if (!game.running || game.phase === 'prep' || p.spectator || p.st !== 0 || p.stun > 0) return;
  if (Array.isArray(m.d) && m.d.length === 3 && m.d.every(Number.isFinite) && Math.hypot(m.d[0], m.d[2]) > .1) {
    p.face = Math.atan2(m.d[0], m.d[2]);
  }
  if (m.a === 'fire') return fire(game, p, m.d, m.c);
  if (m.a === 'attack') return claw(game, p);
  if (m.a === 'drop') return game.dropCell(p);
  if (m.a === 'heal' && !p.form && p.med > 0 && p.hp < 100) {
    p.med--; p.hp = Math.min(100, p.hp + 50);
    if (!p.bot) game.send(p, { t: 'ev', k: 'heal' });
  } else if (m.a === 'flare' && !p.form && p.flare > 0 && game.combatOpen) {
    p.flare--;
    const origin = eye(p.s), target = { x: p.s.x + Math.sin(p.face) * 2.5, y: origin.y, z: p.s.z + Math.cos(p.face) * 2.5 };
    const ray = obstacle(origin, target), k = Math.max(0, ray - .1);
    const x = p.s.x + (target.x - p.s.x) * k, z = p.s.z + (target.z - p.s.z) * k;
    game.flares.push({ x, z, t: R.flareTime });
    for (const q of game.active()) if (q.form && distance(q.s, {x,z}) < R.flareRadius && game.visible(eye(q.s), {x,y:height(x,z)+.3,z})) {
      q.stun = R.flareStun; q.windup = 0; q.executing = null;
    }
    game.broadcast({ t: 'ev', k: 'flare', x, z });
  } else if (m.a === 'transform' && p.role === 'echo' && p.protect <= 0) {
    if (p.form) return revert(game, p, false);
    if (game.night && p.energy >= R.transformThreshold && p.nightUsed !== game.nightIndex) {
      p.nightUsed = game.nightIndex; p.energy -= R.transformCost; p.form = 1; p.mhp = R.monsterHp;
      game.record('transform', {id:p.id});
      game.broadcast({ t: 'ev', k: 'transform', id: p.id });
    }
  }
}
