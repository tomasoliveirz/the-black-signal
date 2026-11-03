// Runs full bot-only matches at accelerated time and checks invariants.
import { Game } from './game.mjs';
import { TICK } from '../shared/sim.js';
import { MAPS } from '../shared/layout.js';

const N = +process.argv[2] || 8, only = process.argv[3];
let tally = {};
let leaks = 0, stuck = 0, ticksTotal = 0;
const t0 = performance.now();
for (const map of Object.keys(MAPS).filter((k) => !only || k === only)) {
tally = {}; let zones = 0, on = 0;
for (let m = 0; m < N; m++) {
  const sent = [];
  const g = new Game((p, msg) => sent.push([p, msg]));
  const human = g.addPlayer('tester', false, {}); // a non-bot observer, to capture what a client receives
  g.setMap(map); g.start();
  let ticks = 0, ev = {};
  while (g.phase !== 'end' && ticks < 30 * 60 * 16) {
    g.tick(TICK); ticks++;
    // the observer never sends input; check that nothing private about others leaks to them
    for (const [p, msg] of sent) {
      if (msg.t === 'snap') for (const q of msg.players) if ('role' in q || 'energy' in q || 'hp' in q) leaks++;
      if (msg.t === 'role' && p !== human) leaks++;
      if (msg.t === 'ev') ev[msg.k] = (ev[msg.k] || 0) + 1;
    }
    sent.length = 0;
  }
  ticksTotal += ticks;
  if (g.phase !== 'end') stuck++;
  const key = g.result || 'timeout';
  tally[key] = (tally[key] || 0) + 1;
  zones += g.zone; on += g.tx.filter((t) => t.on).length;
}
console.log(`${map.padEnd(10)} ${JSON.stringify(tally)} · zona média ${(zones / N).toFixed(1)} · transmissores ligados ${(on / N).toFixed(1)}/5`);
}
const ms = performance.now() - t0;
console.log('fugas de informação:', leaks, '| partidas presas:', stuck);
console.log(`custo do servidor: ${(ms / ticksTotal * 1000).toFixed(1)} µs por tick (${ticksTotal} ticks)`);
process.exit(leaks || stuck ? 1 : 0);
