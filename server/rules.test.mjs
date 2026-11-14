import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, chooseEchoes } from './game.mjs';
import { RULES as R, PHASES } from '../shared/rules.js';
import { TICK } from '../shared/sim.js';
import { LAYOUT, BOXES, MAPS, MAP_RADIUS, EXTRACT, height, inBox, setMap } from '../shared/layout.js';
import { resolveClaw } from './combat.mjs';
import { think as thinkBot } from './bots.mjs';

function setup(send = () => {}) {
  setMap('foundry');
  const game = new Game(send);
  const players = Array.from({ length: 6 }, (_, i) => game.addPlayer('Player ' + i));
  game.start();
  game.think = () => {};
  for (const [i, p] of players.entries()) {
    p.role = i < 2 ? 'echo' : 'operative';
    p.partner = i < 2 ? players[1 - i].id : null;
  }
  return { game, players, echo: players[0], ally: players[2], other: players[3] };
}
function advance(game, seconds) {
  const full = Math.floor(seconds / TICK);
  for (let i = 0; i < full; i++) game.tick(TICK);
  const remainder = seconds - full * TICK;
  if (remainder > 1e-9) game.tick(remainder);
}
function move(p, x, z) {
  Object.assign(p.s, { x, y: height(x, z), z, vx: 0, vy: 0, vz: 0, grounded: true });
  p.inp = { mx: 0, mz: 0, use: false, target: null };
}
function phase(game, id) { game.enterPhase(PHASES.findIndex(p => p.id === id)); }
function focus(p, kind, id) { p.inp = { mx: 0, mz: 0, use: true, target: { kind, id } }; }
function closeTo(p, point, xOffset = 1) { move(p, point.x + xOffset, point.z); }

// These cases exercise authoritative rules. Six-person usability and balance require human playtests.
test('01 completed relays cannot advance the guaranteed 300-second first day', () => {
  const { game } = setup();
  advance(game, 20);
  assert.equal(game.phase, 'day1');
  for (const tx of game.tx) tx.on = true;
  advance(game, 299);
  assert.equal(game.phase, 'day1');
  advance(game, 1);
  assert.equal(game.phase, 'night1');
  assert.ok(Math.abs(game.matchT - 300) < TICK + 1e-6);
});

test('02 zero completed relays also reaches night1 after five minutes', () => {
  const { game } = setup();
  advance(game, 320);
  assert.equal(game.phase, 'night1');
  assert.equal(game.tx.filter(t => t.on).length, 0);
});

test('03 Fisher–Yates selects two distinct Echoes uniformly across 200,000 deterministic draws', () => {
  let seed = 473221;
  const next = max => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * max);
  };
  const slots = [0, 1, 2, 3, 4, 5], counts = slots.map(() => 0), rounds = 200000;
  for (let i = 0; i < rounds; i++) {
    const echoes = chooseEchoes(slots, next);
    assert.equal(new Set(echoes).size, 2);
    for (const slot of echoes) counts[slot]++;
  }
  for (const count of counts) assert.ok(Math.abs(count - rounds / 3) < 1200, String(count));
});

test('04 passive power is 36 after day1 and one six-second drain contributes 30', () => {
  const { game, echo } = setup();
  advance(game, 320);
  assert.ok(Math.abs(echo.energy - 36) < .01);
  game.act(echo, { a: 'transform' });
  assert.equal(echo.form, 0);
  phase(game, 'day1');
  echo.energy = 0;
  const blood = game.blood[0];
  closeTo(echo, blood);
  focus(echo, 'blood', blood.id);
  advance(game, 6 + TICK);
  assert.equal(blood.used, true);
  assert.ok(echo.energy > 30 && echo.energy < 31);
  assert.equal(game.metrics.drains, 1);
  echo.inp.use = false;
  phase(game, 'night1');
  echo.energy += 36;
  game.act(echo, { a: 'transform' });
  assert.equal(echo.form, 1);
});

test('05 only one transformation is possible in a night and toggling cannot reset monster HP', () => {
  const { game, echo } = setup();
  phase(game, 'night1');
  echo.energy = 100;
  game.act(echo, { a: 'transform' });
  assert.equal(echo.energy, 85);
  echo.mhp = 45;
  game.act(echo, { a: 'transform' });
  assert.equal(echo.form, 0);
  game.act(echo, { a: 'transform' });
  assert.equal(echo.form, 0);
  assert.equal(echo.mhp, 45);
  phase(game, 'night2');
  game.act(echo, { a: 'transform' });
  assert.equal(echo.form, 1);
  assert.equal(echo.mhp, R.monsterHp);
});

test('06 walls and large vertical separation block claw damage', () => {
  const { game, echo, ally } = setup();
  phase(game, 'night1');
  echo.form = 1;
  move(echo, -12, -25.2); move(ally, -12, -26.8);
  echo.face = Math.PI;
  resolveClaw(game, echo);
  assert.equal(ally.hp, 100);
  move(echo, 0, -5); move(ally, 0, -6);
  ally.s.y = echo.s.y + 3;
  resolveClaw(game, echo);
  assert.equal(ally.hp, 100);
});

test('07 stunned human and bot monsters use the same action guard', () => {
  const { game, echo, ally } = setup();
  phase(game, 'night1');
  echo.form = 1; echo.stun = 2;
  for (const bot of [false, true]) {
    echo.bot = bot;
    game.act(echo, { a: 'attack', d: [0, 0, -1] });
    assert.equal(echo.windup, 0);
    thinkBot(game, echo, TICK);
    assert.equal(echo.windup, 0);
  }
  assert.equal(ally.hp, 100);
});

test('08 crouched shooting at a near reticle target hits from the correct muzzle height', () => {
  const { game, ally, other } = setup();
  phase(game, 'night1');
  move(ally, 0, -5); move(other, 0, -7);
  ally.inp.crouch = true;
  const camera = [.55, ally.s.y + 1.7, -1.5];
  const point = { x: other.s.x, y: other.s.y + .95, z: other.s.z };
  game.act(ally, { a: 'fire', c: camera, d: [point.x - camera[0], point.y - camera[1], point.z - camera[2]] });
  assert.equal(other.hp, 100 - R.bulletDmg);
});

test('09 revive returns 50 HP and two-second monster protection blocks offensive actions', () => {
  const { game, echo, ally, other } = setup();
  phase(game, 'night1');
  move(ally, 0, -5); move(other, 1, -5); move(echo, 0, -6);
  other.st = 1; other.hp = 0; other.bleed = 40;
  focus(ally, 'player', other.id);
  advance(game, 5 + TICK);
  assert.equal(other.st, 0);
  assert.equal(other.hp, 50);
  assert.ok(other.protect > 1.9);
  echo.form = 1;
  game.hurt(other, 30, echo);
  assert.equal(other.hp, 50);
  const ammo = other.ammo;
  game.act(other, { a: 'fire', d: [0, 0, -1] });
  assert.equal(other.ammo, ammo);
});

test('10 two simultaneous cell requests result in a single authoritative pickup', () => {
  const { game, ally, other } = setup();
  phase(game, 'day1');
  const cell = game.items.find(i => i.type === 'cell' && i.zone === 0);
  closeTo(ally, cell); closeTo(other, cell, -1);
  focus(ally, 'item', cell.id); focus(other, 'item', cell.id);
  game.tick(TICK);
  assert.equal(ally.cell + other.cell, 1);
  assert.equal(cell.available, false);
  assert.equal(game.metrics.pickups, 1);
});

test('11 invalid mission-cell drops recover to an accessible sector location', () => {
  const { game, ally } = setup();
  const building = BOXES[0];
  move(ally, building.x, building.z); ally.cell = 1;
  game.dropCell(ally);
  const drop = game.items.find(i => i.dropped && i.available);
  assert.equal(ally.cell, 0);
  assert.ok(drop);
  assert.equal(inBox(drop.x, drop.z, .35), false);
  assert.ok(Math.hypot(drop.x, drop.z) < MAP_RADIUS);
});

test('12 sectors unlock on day2 and day3 despite unfinished earlier relays', () => {
  const { game, ally } = setup();
  phase(game, 'day1');
  const later = game.items.find(i => i.zone === 1);
  closeTo(ally, later);
  assert.equal(game.interactionPoint(ally, {kind:'item',id:later.id}), null);
  advance(game, 360);
  assert.equal(game.phase, 'day2');
  assert.equal(game.unlocked, 1);
  assert.ok(game.interactionPoint(ally, {kind:'item',id:later.id}));
  advance(game, 280);
  assert.equal(game.phase, 'day3');
  assert.equal(game.unlocked, 2);
  assert.ok(game.interactionPoint(ally, {kind:'tx',id:0}));
});

test('13 extraction waits for three relays, 45 seconds warmup and five seconds inside', () => {
  const { game, ally } = setup();
  phase(game, 'final');
  move(ally, EXTRACT.x, EXTRACT.z);
  advance(game, 46);
  assert.equal(game.extractionOpen, false);
  assert.equal(ally.extT, 0);
  for (const tx of game.tx) tx.on = true;
  assert.equal(game.extractionOpen, true);
  advance(game, 4);
  assert.equal(ally.st, 0);
  advance(game, 1);
  assert.equal(ally.st, 3);
  assert.equal(game.result, 'operatives');
});

test('14 valid evacuation on the timeout tick wins before timeout is evaluated', () => {
  const { game, ally } = setup();
  phase(game, 'final');
  for (const tx of game.tx) tx.on = true;
  game.time = game.phaseEndsAt - TICK;
  move(ally, EXTRACT.x, EXTRACT.z);
  ally.extT = R.extractTime - TICK;
  game.tick(TICK);
  assert.equal(game.result, 'operatives');
  game.finish('echoes');
  assert.equal(game.result, 'operatives');
});

test('15 dead-player text and public snapshots cannot reveal private state to living players', () => {
  const sent = [];
  const { game, echo, ally, other } = setup((p,msg) => sent.push([p,msg]));
  phase(game, 'night1');
  sent.length = 0;
  other.st = 2;
  game.chat(other, 'hidden position', 'prox');
  assert.ok(sent.every(([p]) => p.st >= 2 || p.spectator));
  sent.length = 0; game.snapshot();
  for (const [recipient,msg] of sent) {
    for (const p of msg.players) for (const key of ['role','hp','energy','partner']) assert.equal(key in p, false);
    if (recipient.role !== 'echo') {
      assert.equal(msg.you.energy, undefined);
      assert.equal(msg.you.bloodUsed, undefined);
    }
  }
  assert.equal(ally.role, 'operative'); assert.equal(echo.role, 'echo');
});

test('16 first-day combat guard is enforced independently of the client HUD', () => {
  const { game, echo, ally } = setup();
  phase(game, 'day1');
  move(echo, 0, -5); move(ally, 0, -6);
  const ammo = echo.ammo;
  game.act(echo, { a:'fire', d:[0,0,-1] });
  echo.form = 1; game.attack(echo); game.hurt(ally,100,echo);
  assert.equal(echo.ammo,ammo);
  assert.equal(echo.windup,0);
  assert.equal(ally.hp,100);
  game.snapshot();
  assert.equal(game.combatOpen,false);
});

test('17 each map has the same bounded resource budget and valid playable positions', () => {
  for (const id of Object.keys(MAPS)) {
    setMap(id);
    assert.equal(LAYOUT.tx.length,3,id);
    assert.equal(LAYOUT.items.length,18,id);
    assert.equal(LAYOUT.blood.length,12,id);
    for (let zone=0;zone<3;zone++) {
      assert.equal(LAYOUT.items.filter(i=>i.zone===zone && i.type==='cell').length,2,id);
      assert.equal(LAYOUT.blood.filter(i=>i.zone===zone).length,4,id);
    }
    for(const p of [...LAYOUT.tx,...LAYOUT.items,...LAYOUT.blood]) {
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z),id);
      assert.equal(inBox(p.x,p.z,.15),false,id + ' '+JSON.stringify(p));
    }
  }
});

test('18 execution is interrupted by damage and ordinary hits never kill a downed player', () => {
  const { game, echo, ally, other } = setup();
  phase(game, 'night1');
  move(echo,0,-5); move(ally,0,-6); move(other,2,-5);
  echo.form=1; echo.mhp=150; echo.energy=100; ally.st=1; ally.hp=0; ally.bleed=40;
  game.hurt(ally,30,echo);
  assert.equal(ally.st,1);
  focus(echo,'player',ally.id);
  advance(game,1.5);
  assert.equal(ally.st,1);
  game.hurt(echo,25,other);
  game.tick(TICK);
  assert.ok(echo.interaction.progress<.1);
  assert.equal(ally.st,1);
  echo.inp.use=false;
  advance(game,1.2);
  assert.equal(ally.st,1);
  assert.equal(game.events.some(event=>event.kind==='death'),false);
});
