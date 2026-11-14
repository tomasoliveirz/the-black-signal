// Full rounds use six active bots and a separate human spectator for network privacy checks.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game } from './game.mjs';
import { TICK } from '../shared/sim.js';
import { PHASES } from '../shared/rules.js';
import { MAPS, setMap } from '../shared/layout.js';

const acceptance = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('./rules.test.mjs', import.meta.url))], { stdio: 'inherit' });
if (acceptance.status !== 0) process.exit(acceptance.status ?? 1);
const rounds = Math.max(1, Number(process.argv[2]) || 8), only = process.argv[3];
const maxTime = PHASES.reduce((total, phase) => total + phase.duration, 0) + 2;
const elapsed = (events, kind) => events.find(event => event.kind === kind)?.t;
const average = values => values.length ? (values.reduce((total, n) => total + n, 0) / values.length).toFixed(1) : '—';
let leaks = 0, stuck = 0, ticksTotal = 0, earlyBlackouts = 0;
const began = performance.now();
for (const map of Object.keys(MAPS).filter(id => !only || id === only)) {
  const wins = {}, durations = [], deaths = [], transforms = [];
  let objectives = 0, drains = 0, revives = 0;
  for (let round = 0; round < rounds; round++) {
    setMap(map);
    const sent = [];
    const game = new Game((recipient, message) => sent.push([recipient, message]));
    for (let slot = 0; slot < 6; slot++) game.addPlayer('BOT ' + (slot + 1), true);
    game.start();
    const observer = game.addPlayer('Network auditor');
    if (!observer.spectator || game.active().length !== 6 || game.active().some(p => !p.bot)) throw new Error('Simulation requires six active bots and a spectator');
    let ticks = 0;
    while (game.phase !== 'end' && ticks * TICK <= maxTime) {
      game.tick(TICK);
      ticks++;
      for (const [recipient, message] of sent) {
        if (message.t === 'snap') {
          for (const p of message.players) if ('role' in p || 'energy' in p || 'hp' in p || 'partner' in p) leaks++;
          if (recipient === observer && message.you !== null) leaks++;
        }
        if (message.t === 'role') leaks++;
      }
      sent.length = 0;
    }
    ticksTotal += ticks;
    if (game.phase !== 'end') stuck++;
    const firstNight = game.events.find(event => event.kind === 'phase' && event.phase === 'night1');
    if (firstNight && firstNight.t < 300 - TICK) earlyBlackouts++;
    wins[game.result ?? 'timeout'] = (wins[game.result ?? 'timeout'] ?? 0) + 1;
    durations.push(game.matchT);
    const firstDeath = elapsed(game.events, 'death'), firstTransform = elapsed(game.events, 'transform');
    if (firstDeath !== undefined) deaths.push(firstDeath);
    if (firstTransform !== undefined) transforms.push(firstTransform);
    objectives += game.tx.filter(tx => tx.on).length;
    drains += game.metrics.drains;
    revives += game.metrics.revives;
  }
  console.log(`${map.padEnd(10)} ${JSON.stringify(wins)} · duração média ${average(durations)} s · primeira morte ${average(deaths)} s · transformação ${average(transforms)} s · transmissores ${(objectives / rounds).toFixed(1)}/3 · sangue ${drains} · reanimações ${revives}`);
}
console.log(`fugas de informação: ${leaks} | partidas presas: ${stuck} | blackouts antecipados: ${earlyBlackouts}`);
console.log(`custo do servidor: ${((performance.now() - began) / ticksTotal * 1000).toFixed(1)} µs por tick (${ticksTotal} ticks)`);
console.log('Amostra de simulação com seis bots. A validação com seis jogadores humanos continua pendente.');
process.exit(leaks || stuck || earlyBlackouts ? 1 : 0);
