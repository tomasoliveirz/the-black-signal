import { LAYOUT, EXTRACT } from '../shared/layout.js';
import { navStep } from '../shared/nav.js';
import { eye } from '../shared/sight.js';
import { RULES as R } from '../shared/rules.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const nearest = (from, list, point = value => value.s ?? value) => list.reduce((best, value) =>
  !best || distance(from, point(value)) < distance(from, point(best)) ? value : best, null);
const head = p => ({ x: p.s.x, y: p.s.y + (p.st === 1 ? .4 : p.form ? 1.7 : 1.1), z: p.s.z });

export function think(game, p, dt) {
  const input = p.inp = { mx: 0, mz: 0, sprint: false, crouch: false, use: false, target: null };
  const ai = p.ai;
  if (p.spectator || p.st !== 0 || p.stun > 0 || ['lobby', 'prep', 'end'].includes(game.phase)) return;
  ai.elapsed = (ai.elapsed ?? 0) + dt;
  ai.decision = Math.max(0, (ai.decision ?? 0) - dt);
  ai.items ??= new Map();
  ai.blood ??= new Map();
  ai.revealed ??= new Set();
  ai.patrol ??= 0;
  const origin = eye(p.s, input.crouch);
  const canSee = (point, range = game.night ? 17 : 23) => distance(p.s, point) < range && game.visible(origin, point);
  const observed = game.active().filter(other => other !== p && other.st < 2 && canSee(head(other)));
  for (const other of observed) if (other.form) ai.revealed.add(other.id);
  for (const item of game.items) {
    if (item.zone <= game.unlocked && canSee({ ...item, y: item.y + .95 }, 14)) ai.items.set(item.id, item.available);
  }
  for (const station of game.blood) {
    if (station.zone <= game.unlocked && canSee({ ...station, y: station.y + .9 }, 13)) ai.blood.set(station.id, !station.used);
  }

  function go(point, sprint = false, stop = 1.4) {
    const d = distance(p.s, point);
    const clear = game.visible(origin, { x: point.x, y: (point.y ?? p.s.y) + .95, z: point.z });
    ai.wants = d > stop || !clear;
    if (!ai.wants) return d;
    const waypoint = d > 2.5 || !clear ? navStep(p.s, point) : point;
    const dx = waypoint.x - p.s.x, dz = waypoint.z - p.s.z;
    const length = Math.hypot(dx, dz) || 1;
    input.mx = dx / length; input.mz = dz / length;
    if (ai.side) {
      const x = input.mx;
      input.mx = x * .35 - input.mz * ai.side;
      input.mz = input.mz * .35 + x * ai.side;
    }
    input.sprint = sprint;
    return d;
  }

  function use(kind, target) {
    const range = kind === 'item' ? R.pickupRange : R.useRange;
    const stop = kind === 'player' ? 1.45 : kind === 'item' ? 1.1 : 1.8;
    go(target.s ?? target, false, Math.min(stop, range * .75));
    const focus = { kind, id: target.id };
    const point = game.interactionPoint(p, focus);
    if (point && game.canReach(p, point, range)) {
      input.use = true;
      input.target = focus;
      input.mx = input.mz = 0;
      ai.wants = false;
    }
  }

  function aim(target) {
    const point = head(target), source = eye(p.s, input.crouch);
    const d = [point.x - source.x, point.y - source.y, point.z - source.z];
    p.face = input.aim = Math.atan2(d[0], d[2]);
    return d;
  }

  function patrol() {
    ai.state = 'OBSERVE';
    const points = [...game.tx.filter(t => t.zone <= game.unlocked), ...LAYOUT.recovery.slice(0, game.unlocked + 1)];
    const point = points[(p.id + ai.patrol) % points.length];
    if (!point) return;
    if (go(point, false, 3.1) < 3.2) {
      ai.rest = (ai.rest ?? 0) + dt;
      if (ai.rest > 2.5 + p.slot) { ai.patrol++; ai.rest = 0; }
    } else ai.rest = 0;
  }

  ai.unstick = (ai.unstick ?? 0) + dt;
  if (ai.unstick >= 1) {
    const moved = Math.hypot(p.s.x - (ai.lastX ?? p.s.x), p.s.z - (ai.lastZ ?? p.s.z));
    ai.side = moved < .4 && ai.wants ? ((p.id + Math.floor(ai.elapsed)) % 2 ? 1 : -1) : 0;
    ai.lastX = p.s.x; ai.lastZ = p.s.z; ai.unstick = 0;
  }

  if (p.form) {
    ai.state = 'HUNT';
    const prey = nearest(p.s, observed.filter(other => other.id !== p.partner && !other.form));
    if (prey) {
      ai.lastPrey = { x: prey.s.x, y: prey.s.y, z: prey.s.z, until: ai.elapsed + 4 };
      if (prey.st === 1) use('player', prey);
      else {
        const d = go(prey.s, true, R.clawRange * .72);
        if (d <= R.clawRange && p.protect <= 0) game.act(p, { a: 'attack', d: aim(prey) });
      }
    } else if (ai.lastPrey?.until > ai.elapsed) go(ai.lastPrey, true);
    else patrol();
    return;
  }

  if (p.hp <= 50 && p.med > 0) game.act(p, { a: 'heal' });
  const enemies = observed.filter(other => other.form || ai.revealed.has(other.id));
  const enemy = nearest(p.s, enemies.filter(other => other.id !== p.partner));
  if (game.combatOpen && enemy && distance(p.s, enemy.s) < 15) {
    ai.state = 'FLEE';
    const d = distance(p.s, enemy.s);
    const direction = aim(enemy);
    if (enemy.form && d < 5.5 && p.flare > 0) game.act(p, { a: 'flare' });
    if (p.ammo > 0 && p.protect <= 0 && ai.decision <= 0) {
      ai.state = 'DEFEND';
      game.act(p, { a: 'fire', d: direction });
      ai.decision = .65 + (p.slot % 3) * .12;
    }
    const dx = p.s.x - enemy.s.x, dz = p.s.z - enemy.s.z;
    const length = Math.hypot(dx, dz) || 1;
    go({ x: p.s.x + dx / length * 8, z: p.s.z + dz / length * 8 }, true, .7);
    return;
  }

  if (p.role === 'echo' && game.night && p.energy >= R.transformThreshold && p.nightUsed !== game.nightIndex) {
    const prey = observed.find(other => other.id !== p.partner && !other.form);
    if (prey) {
      game.act(p, { a: 'transform' });
      ai.state = 'HUNT';
      return;
    }
  }

  if (game.extractionOpen && p.role === 'operative') {
    ai.state = 'EXTRACT';
    go(EXTRACT, true, EXTRACT.r * .45);
    return;
  }
  const downed = nearest(p.s, observed.filter(other => other.st === 1));
  if (downed && p.role === 'operative') {
    ai.state = 'REVIVE';
    use('player', downed);
    return;
  }

  if (p.role === 'echo' && !game.night && p.energy < 78) {
    const stations = game.blood.filter(station => station.zone <= game.unlocked && ai.blood.get(station.id) !== false);
    const privateStations = stations.filter(station => !observed.some(other =>
      other.id !== p.partner && distance(other.s, station) < 10 && game.visible(head(other), { ...station, y: station.y + .9 })));
    const station = nearest(p.s, privateStations);
    if (station) {
      ai.state = 'SEARCH_BLOOD';
      use('blood', station);
      input.crouch = distance(p.s, station) < 5 && !input.use;
      if (input.use) ai.state = 'DRAIN';
      return;
    }
  }

  const needed = game.items.filter(item => {
    if (item.zone > game.unlocked || ai.items.get(item.id) === false) return false;
    if (item.type === 'ammo') return p.ammo < 4;
    if (item.type === 'med') return p.med === 0 && p.hp < 80;
    if (item.type === 'flare') return p.flare === 0;
    return false;
  });
  const equipment = nearest(p.s, needed);
  if (equipment && distance(p.s, equipment) < 10) {
    ai.state = 'ACQUIRE_ITEM';
    use('item', equipment);
    return;
  }
  const pending = game.tx.filter(tx => tx.zone <= game.unlocked && !tx.on);
  const relay = nearest(p.s, pending);
  if (relay && p.role === 'operative') {
    if (!relay.fuse && !p.cell) {
      const cell = nearest(p.s, game.items.filter(item => item.type === 'cell' && item.zone <= game.unlocked && ai.items.get(item.id) !== false));
      if (cell) { ai.state = 'ACQUIRE_ITEM'; use('item', cell); return; }
    }
    if (relay.fuse || p.cell) {
      ai.state = 'REPAIR';
      use('tx', relay);
      return;
    }
  }
  if (relay && p.role === 'echo' && relay.fuse && distance(p.s, relay) < 8) {
    ai.state = 'PRETEND_HELP';
    use('tx', relay);
    return;
  }
  patrol();
}
