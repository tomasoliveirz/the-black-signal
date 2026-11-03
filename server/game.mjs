// Authoritative match logic. The server owns roles, movement, damage, items and results.
// Clients only ever receive what they are allowed to know.
import { LAYOUT, BOXES, EXTRACT, MAPS, MAP_ID, setMap, height } from '../shared/layout.js';
import { navStep } from '../shared/nav.js';
import '../shared/maps/index.js';
import { stepMove, newMove, RULES as R, TICK } from '../shared/sim.js';

const BOT_NAMES = ['Ada', 'Bram', 'Cleo', 'Dov', 'Esme', 'Finn'];
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rand = Math.random;

export class Game {
  constructor(send = () => {}) {
    this.send = send;            // send(player, msg) for human players
    this.players = new Map();
    this.nextId = 1;
    this.reset();
  }
  reset() {
    this.phase = 'lobby'; this.phaseT = 0; this.zone = 0; this.matchT = 0; this.tickN = 0;
    this.tx = LAYOUT.tx.map((t) => ({ ...t, p: 0, fuse: false, on: false }));
    this.items = LAYOUT.items.map(() => true);
    this.flares = []; this.result = null;
    for (const [id, p] of this.players) if (p.bot) this.players.delete(id);
    const seats = LAYOUT.spawns.length;
    const occupied = new Set([...this.players.values()].map(p => p.slot));
    for (const p of this.players.values()) {
      if (p.slot >= seats) {
        const free = LAYOUT.spawns.findIndex((_, slot) => !occupied.has(slot));
        if (free >= 0) { p.slot = free; occupied.add(free); }
      }
      p.spectator = p.slot >= seats;
    }
  }
  get mapId() { return MAP_ID; }
  get night() { return this.phase === 'blackout' || this.phase === 'extract'; }
  get running() { return this.phase !== 'lobby' && this.phase !== 'end'; }

  // ---------- membership
  addPlayer(name, bot = false, conn = null) {
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const p = { id: this.nextId++, name: String(name || 'Jogador').slice(0, 16), bot, conn, slot, spectator: this.running || slot >= LAYOUT.spawns.length };
    this.initPlayer(p);
    if (p.spectator) p.st = 2;
    this.players.set(p.id, p);
    this.lobby();
    return p;
  }
  removePlayer(id) {
    const p = this.players.get(id); if (!p) return;
    this.players.delete(id);
    if (![...this.players.values()].some((q) => !q.bot)) this.reset(); // nobody left: stop the match
    this.lobby();
  }
  initPlayer(p) {
    const sp = LAYOUT.spawns[p.slot % 6];
    Object.assign(p, {
      s: newMove(sp.x, sp.z), inp: { mx: 0, mz: 0 }, face: Math.PI, st: 0, form: 0, hp: 100, mhp: 0, role: 'operative',
      energy: 0, ammo: 6, med: 0, flare: 1, fuse: 0, cdFire: 0, cdAtk: 0, stun: 0, bleed: 0, rv: 0, extT: 0, ai: { t: 0, stuck: 0, side: 0, lx: sp.x, lz: sp.z },
    });
  }
  // any player may change the map while the room is in the lobby
  setMap(id) {
    if (this.running || !MAPS[id] || id === MAP_ID) return false;
    setMap(id); this.reset();
    for (const p of this.players.values()) this.initPlayer(p);
    this.lobby();
    return true;
  }
  lobby() {
    this.broadcast({ t: 'lobby', map: MAP_ID, phase: this.phase, players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, bot: p.bot, slot: p.slot, spectator: p.spectator })) });
  }
  broadcast(msg) { for (const p of this.players.values()) if (!p.bot) this.send(p, msg); }

  // ---------- match flow
  start() {
    if (this.running) return;
    this.reset();
    const seats = LAYOUT.spawns.length;
    let n = 0;
    while (this.players.size < seats) this.addPlayer(`BOT ${BOT_NAMES[n++]}`, true);
    const list = [...this.players.values()].filter(p => !p.spectator);
    for (const p of list) { p.spectator = false; this.initPlayer(p); }
    this.phase = 'prep'; this.lobby();       // lobby list first, so the private role message is not reset by it
    this.setPhase('prep', R.prep);
    const pool = [...list].sort(() => rand() - 0.5);
    pool[0].role = pool[1].role = 'echo';
    for (const p of list) {
      const partner = p.role === 'echo' ? pool.slice(0, 2).find((q) => q !== p) : null;
      if (!p.bot) this.send(p, { t: 'role', role: p.role, partner: partner ? partner.id : null }); // private
    }
  }
  setPhase(phase, t) { this.phase = phase; this.phaseT = t; this.broadcast({ t: 'ev', k: 'phase', phase, zone: this.zone }); }
  zoneDone() { return this.tx.filter((t) => t.zone === this.zone).every((t) => t.on); }
  finish(winner) {
    if (this.phase === 'end') return;
    this.result = winner;
    this.phase = 'end'; this.phaseT = 14;
    this.broadcast({ t: 'ev', k: 'end', winner, roles: [...this.players.values()].filter((p) => !p.spectator).map((p) => ({ id: p.id, name: p.name, role: p.role, st: p.st })) });
  }
  active() { return [...this.players.values()].filter((p) => !p.spectator); }

  // ---------- simulation
  tick(dt = TICK) {
    this.tickN++;
    if (this.phase === 'lobby') return;
    this.phaseT -= dt;
    if (this.phase === 'end') { if (this.phaseT <= 0) { this.reset(); this.lobby(); } return; }
    this.matchT += dt;
    const ps = this.active();

    if (this.phase === 'explore' && this.zoneDone() && this.phaseT > 5) this.phaseT = 5;
    if (this.phaseT <= 0) {
      if (this.phase === 'prep') this.setPhase('explore', R.explore);
      else if (this.phase === 'explore') this.setPhase('blackout', R.blackout);
      else if (this.phase === 'blackout') {
        for (const p of ps) if (p.form) this.revert(p, false);
        if (this.zoneDone()) this.zone++;
        if (this.zone > 2) this.setPhase('extract', R.extract); else this.setPhase('explore', R.explore);
      } else if (this.phase === 'extract') return this.finish(ps.some((p) => p.st === 3) ? 'operatives' : 'echoes');
    }

    for (const p of ps) {
      if (p.bot) this.think(p, dt);
      p.cdFire -= dt; p.cdAtk -= dt; p.stun -= dt;
      if (p.st >= 2) continue;
      let mode = this.phase === 'prep' ? 'frozen' : p.st === 1 ? 'downed' : p.form ? 'monster' : 'human';
      if (p.stun > 0) mode = 'frozen';
      const slow = p.form && this.flares.some((f) => dist2(f, p.s) < R.flareRadius) ? 0.5 : 1;
      stepMove(p.s, p.inp, dt, mode, slow);
      const sp = Math.hypot(p.s.vx, p.s.vz);
      if (sp > 0.4) { let d = Math.atan2(p.s.vx, p.s.vz) - p.face; d = Math.atan2(Math.sin(d), Math.cos(d)); p.face += d * Math.min(1, 12 * dt); }

      if (p.st === 1) { p.bleed -= dt; if (p.bleed <= 0) this.kill(p); continue; }
      if (p.role === 'echo') {
        p.energy = Math.min(100, p.energy + 1.0 * dt);
        if (p.form) { p.energy -= (R.energyDrain + 1.0) * dt; if (p.energy <= 0 || !this.night) this.revert(p, false); }
      }
      if (!p.form) this.pickup(p);
      if (p.inp.use && !p.form && mode === 'human') this.use(p, dt);
      if (this.phase === 'extract' && p.role === 'operative' && dist2(p.s, EXTRACT) < EXTRACT.r) {
        p.extT += dt;
        if (p.extT > 4) { p.st = 3; this.broadcast({ t: 'ev', k: 'escaped', id: p.id }); }
      } else p.extT = 0;
    }
    for (const p of ps) if (p.st === 1 && !ps.some((q) => q !== p && q.inp.use && q.st === 0 && !q.form && dist2(q.s, p.s) < 2.2)) p.rv = Math.max(0, p.rv - dt * 0.5);
    this.flares = this.flares.filter((f) => (f.t -= dt) > 0);

    // win conditions
    const ops = ps.filter((p) => p.role === 'operative'), echoes = ps.filter((p) => p.role === 'echo');
    const opsOnField = ops.filter((p) => p.st < 2).length, escaped = ops.filter((p) => p.st === 3).length;
    if (this.phase !== 'prep') {
      if (opsOnField === 0) return this.finish(escaped > 0 ? 'operatives' : 'echoes');
      if (echoes.every((p) => p.st === 2)) return this.finish('operatives');
      if (this.matchT > R.matchLimit) return this.finish('echoes');
    }
    if (this.tickN % 2 === 0) this.snapshot();
  }

  pickup(p) {
    if (p.st !== 0) return;
    LAYOUT.items.forEach((it, i) => {
      if (!this.items[i] || dist2(it, p.s) > R.pickupRange) return;
      if (it.type === 'fuse' && p.fuse >= 2) return;
      this.items[i] = false;
      if (it.type === 'fuse') p.fuse++; else if (it.type === 'ammo') p.ammo += 6; else if (it.type === 'med') p.med++; else p.flare++;
      if (!p.bot) this.send(p, { t: 'ev', k: 'pickup', type: it.type });
    });
  }
  use(p, dt) {
    const downed = this.active().find((q) => q !== p && q.st === 1 && dist2(q.s, p.s) < 2.2);
    if (downed) {
      downed.rv += dt / R.reviveTime;
      if (downed.rv >= 1) { downed.st = 0; downed.hp = 40; downed.rv = 0; this.broadcast({ t: 'ev', k: 'revive', id: downed.id, by: p.id }); }
      return;
    }
    const t = this.tx.find((t) => dist2(t, p.s) < R.useRange);
    if (!t) return;
    if (!t.fuse) { if (p.fuse > 0) { p.fuse--; t.fuse = true; this.broadcast({ t: 'ev', k: 'fuse', tx: t.id }); } return; }
    if (p.role === 'echo') {              // looks identical from outside: siphons instead of repairing
      p.energy = Math.min(100, p.energy + 12 * dt);
      if (!t.on) t.p = Math.max(0, t.p - dt / 25);
    } else if (!t.on) {
      t.p += dt / R.repairTime;
      if (t.p >= 1) { t.p = 1; t.on = true; this.broadcast({ t: 'ev', k: 'txon', tx: t.id }); }
    }
  }

  // ---------- actions
  act(p, m) {
    if (p.spectator || this.phase === 'prep' || !this.running || p.st !== 0 || p.stun > 0) return;
    if (m.a === 'fire' && !p.form) this.fire(p, m.d);
    else if (m.a === 'attack' && p.form) this.attack(p);
    else if (m.a === 'heal' && !p.form && p.med > 0 && p.hp < 100) { p.med--; p.hp = Math.min(100, p.hp + 50); }
    else if (m.a === 'flare' && !p.form && p.flare > 0) {
      p.flare--;
      const f = { x: p.s.x + Math.sin(p.face) * 2.5, z: p.s.z + Math.cos(p.face) * 2.5, t: R.flareTime };
      f.y = height(f.x, f.z); this.flares.push(f);
      for (const q of this.active()) if (q.form && dist2(q.s, f) < R.flareRadius) q.stun = 2.5;
      this.broadcast({ t: 'ev', k: 'flare', x: f.x, z: f.z });
    } else if (m.a === 'transform' && p.role === 'echo') {
      if (p.form) this.revert(p, false);
      else if (this.night && p.energy >= R.transformCost) { p.form = 1; p.mhp = R.monsterHp; this.broadcast({ t: 'ev', k: 'transform', id: p.id }); }
    }
  }
  revert(p, forced) {
    p.form = 0;
    if (forced) { p.energy = 0; p.stun = 3; p.hp = Math.min(p.hp, 40); }
    this.broadcast({ t: 'ev', k: 'revert', id: p.id });
  }
  hurt(q, dmg, by) {
    if (q.st === 1) return this.kill(q);
    if (q.form) { q.mhp -= dmg; if (q.mhp <= 0) this.revert(q, true); return; }
    q.hp -= dmg;
    if (!q.bot) this.send(q, { t: 'ev', k: 'hurt' });
    if (q.hp <= 0) {
      q.hp = 0; q.st = 1; q.bleed = R.bleedTime; q.rv = 0;
      this.broadcast({ t: 'ev', k: 'down', id: q.id });
    }
  }
  kill(q) { q.st = 2; q.form = 0; this.broadcast({ t: 'ev', k: 'dead', id: q.id }); }
  attack(p) {
    if (p.cdAtk > 0) return;
    p.cdAtk = R.attackCd;
    this.broadcast({ t: 'ev', k: 'claw', id: p.id });
    for (const q of this.active()) {
      if (q === p || q.st >= 2 || q.form) continue;
      const dx = q.s.x - p.s.x, dz = q.s.z - p.s.z, d = Math.hypot(dx, dz);
      if (d > 2.6 || Math.abs(q.s.y - p.s.y) > 2) continue;
      if (d > 0.5 && (dx * Math.sin(p.face) + dz * Math.cos(p.face)) / d < 0.3) continue;
      this.hurt(q, R.clawDmg, p);
    }
  }
  fire(p, d) {
    if (p.cdFire > 0 || p.ammo <= 0 || !Array.isArray(d)) return;
    const [a, b, c] = d.map(Number), n = Math.hypot(a, b, c);
    if (!(n > 0.5)) return;
    const dir = { x: a / n, y: b / n, z: c / n };
    p.cdFire = R.fireCd; p.ammo--;
    p.face = Math.atan2(dir.x, dir.z);
    const o = { x: p.s.x, y: p.s.y + (p.inp.crouch ? 1.05 : 1.45), z: p.s.z };
    let best = 60, hit = null;
    const circle = (cx, cz, r) => { // 2D ray vs circle, returns entry distance along the 3D ray
      const fx = o.x - cx, fz = o.z - cz, A = dir.x * dir.x + dir.z * dir.z; if (A < 1e-6) return -1;
      const B = fx * dir.x + fz * dir.z, C = fx * fx + fz * fz - r * r, disc = B * B - A * C; if (disc < 0) return -1;
      const t = (-B - Math.sqrt(disc)) / A; return t > 0 ? t : -1;
    };
    for (const c of LAYOUT.colliders) { const t = circle(c.x, c.z, c.r); if (t > 0 && t < best && o.y + dir.y * t - height(c.x, c.z) < c.h) best = t; }
    for (let t = 1; t < best; t += 1.2) {  // terrain and cabin
      const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t, gy = height(x, z);
      if (y < gy || BOXES.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2 && y < gy + b.h + 1)) { best = t; break; }
    }
    for (const q of this.active()) {
      if (q === p || q.st >= 2) continue;
      const t = circle(q.s.x, q.s.z, q.form ? 0.95 : 0.42); if (t < 0 || t > best) continue;
      const y = o.y + dir.y * t - q.s.y;
      if (y > -0.1 && y < (q.form ? 2.3 : q.st === 1 ? 0.6 : 1.85)) { best = t; hit = q; }
    }
    this.broadcast({ t: 'ev', k: 'shot', id: p.id, a: [o.x, o.y, o.z], b: [o.x + dir.x * best, o.y + dir.y * best, o.z + dir.z * best], hit: hit ? hit.id : 0 });
    if (hit) this.hurt(hit, hit.form ? R.bulletDmgMonster : R.bulletDmg, p);
  }
  chat(p, text, ch) {
    text = String(text || '').slice(0, 140).trim(); if (!text) return;
    for (const q of this.players.values()) {
      if (q.bot) continue;
      const deadTalk = p.st >= 2;
      const ok = ch === 'echo' ? p.role === 'echo' && q.role === 'echo' && this.running
        : !this.running || (deadTalk ? q.st >= 2 : q.st >= 2 || dist2(p.s, q.s) < 22);
      if (ok) this.send(q, { t: 'ev', k: 'chat', id: p.id, name: p.name, text, ch: ch === 'echo' ? 'echo' : deadTalk ? 'dead' : 'prox' });
    }
  }

  // ---------- snapshots: public state for everyone, private state only for its owner
  snapshot() {
    const r1 = (v) => Math.round(v * 100) / 100;
    const players = this.active().map((p) => ({ id: p.id, x: r1(p.s.x), y: r1(p.s.y), z: r1(p.s.z), f: r1(p.face), st: p.st, form: p.form, cr: p.inp.crouch ? 1 : 0, rv: r1(p.rv) }));
    const base = {
      t: 'snap', phase: this.phase, pt: Math.max(0, Math.ceil(this.phaseT)), zone: this.zone, night: this.night ? 1 : 0, players,
      tx: this.tx.map((t) => ({ fuse: t.fuse ? 1 : 0, on: t.on ? 1 : 0 })), items: this.items.map((v) => (v ? 1 : 0)).join(''),
      flares: this.flares.map((f) => [r1(f.x), r1(f.z)]),
    };
    for (const p of this.players.values()) {
      if (p.bot) continue;
      const near = this.tx.find((t) => dist2(t, p.s) < R.useRange + 0.5);
      this.send(p, {
        ...base,
        you: p.spectator ? null : { x: p.s.x, y: p.s.y, z: p.s.z, vy: p.s.vy, stam: r1(p.s.stam), hp: Math.round(p.form ? p.mhp : p.hp), ammo: p.ammo, med: p.med, flare: p.flare, fuse: p.fuse, energy: p.role === 'echo' ? Math.round(p.energy) : undefined, stun: p.stun > 0 ? 1 : 0, bleed: Math.ceil(p.bleed), ext: r1(p.extT / 4), txp: near && p.inp.use ? r1(near.p) : -1 },
      });
    }
  }

  // ---------- bots (labelled as bots, used to fill a match for testing)
  think(p, dt) {
    const inp = (p.inp = { mx: 0, mz: 0, sprint: false, use: false }), ai = p.ai, me = p.s;
    if (p.st !== 0 || this.phase === 'prep') return;
    const ps = this.active();
    const go = (t, sprint = false, stop = 0.6) => {
      const d = Math.hypot(t.x - me.x, t.z - me.z);
      if (d < stop) return d;
      const w = d > 2.5 ? navStep(me, t) : t, dx = w.x - me.x, dz = w.z - me.z, k = Math.hypot(dx, dz) || 1;
      let mx = dx / k, mz = dz / k;
      if (ai.side) { const s = ai.side; [mx, mz] = [mx * 0.3 - mz * s, mz * 0.3 + mx * s]; }
      inp.mx = mx; inp.mz = mz; inp.sprint = sprint;
      return d;
    };
    ai.t += dt;
    if (ai.t > 1) { // unstick: sidestep when not making progress
      const moved = Math.hypot(me.x - ai.lx, me.z - ai.lz);
      ai.side = moved < 0.5 && ai.wants ? (rand() < 0.5 ? 1 : -1) : 0;
      ai.lx = me.x; ai.lz = me.z; ai.t = 0;
    }
    ai.wants = true;
    const nearest = (list) => list.reduce((b, q) => (!b || dist2(q.s ?? q, me) < dist2(b.s ?? b, me) ? q : b), null);

    if (p.form) {
      const prey = nearest(ps.filter((q) => q.role === 'operative' && q.st < 2));
      if (!prey) return;
      const d = go(prey.s, true, 1.6);
      if (d < 2.3) { p.face = Math.atan2(prey.s.x - me.x, prey.s.z - me.z); this.attack(p); }
      return;
    }
    if (p.role === 'echo' && this.night && p.energy >= R.transformCost && rand() < dt * 0.8) return this.act(p, { a: 'transform' });
    if (p.hp < 50 && p.med > 0) this.act(p, { a: 'heal' });

    const monster = nearest(ps.filter((q) => q.form && q.st === 0));
    if (p.role === 'operative' && monster) {
      const d = dist2(monster.s, me);
      if (d < 14) {
        if (d < 5 && p.flare > 0) this.act(p, { a: 'flare' });
        if (p.ammo > 0 && d < 13 && rand() < dt * 3) {
          const e = () => (rand() - 0.5) * 0.22;
          this.fire(p, [monster.s.x - me.x + e() * d, monster.s.y - me.y - 0.3 + e() * d * 0.4, monster.s.z - me.z + e() * d]);
        }
        go({ x: me.x * 2 - monster.s.x, z: me.z * 2 - monster.s.z }, true);
        return;
      }
    }
    if (this.phase === 'extract' && p.role === 'operative') { go(EXTRACT, true, 1.5); return; }
    const down = nearest(ps.filter((q) => q !== p && q.st === 1 && dist2(q.s, me) < 20));
    if (down && p.role === 'operative') { if (go(down.s, true, 1.6) < 2) inp.use = true; return; }

    const pending = this.tx.filter((t) => t.zone === Math.min(this.zone, 2) && !t.on);
    let t = pending.length ? pending[(p.id + Math.floor(this.matchT / 40)) % pending.length] : null;
    if (p.role === 'echo' && !t) t = this.tx[(p.id + Math.floor(this.matchT / 30)) % this.tx.length];
    if (!t) { // zone finished: drift along the path toward the next zone
      ai.wants = go(LAYOUT.hint(this.zone, p.id, this.matchT), false, 2) >= 2;
      return;
    }
    if (!t.fuse && p.fuse === 0) {
      const fuse = nearest(LAYOUT.items.filter((it, i) => it.type === 'fuse' && this.items[i]));
      if (fuse) { go(fuse, dist2(fuse, me) > 10, 0.3); return; }
    }
    if (go(t, dist2(t, me) > 12, 1.7) < 2.2) { inp.use = true; ai.wants = false; }
  }
}
