// Dedicated server: serves the client and runs one authoritative match room over WebSocket.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game } from './game.mjs';
import { TICK } from '../shared/sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 5173;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
const PUBLIC = ['index.html', 'src', 'shared', 'assets']; // nothing else is served (server code stays private)

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.includes(rel.split('/')[0])) { res.writeHead(404).end('not found'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(data);
  });
});

const game = new Game((p, msg) => { if (p.conn?.readyState === 1) p.conn.send(JSON.stringify(msg)); });
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const num = (v) => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);

wss.on('connection', (ws) => {
  let me = null, budget = 120;
  const refill = setInterval(() => (budget = 120), 1000); // simple per-connection rate limit
  ws.on('message', (raw) => {
    if (--budget < 0) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join' && !me) {
      me = game.addPlayer(m.name, false, ws);
      ws.send(JSON.stringify({ t: 'welcome', map: game.mapId, id: me.id, slot: me.slot, spectator: me.spectator }));
      game.lobby();
    } else if (!me) return;
    else if (m.t === 'start') game.start();
    else if (m.t === 'map') game.setMap(String(m.id));
    else if (m.t === 'in') me.inp = { mx: num(m.mx), mz: num(m.mz), sprint: !!m.sprint, crouch: !!m.crouch, jump: !!m.jump, use: !!m.use };
    else if (m.t === 'act') game.act(me, m);
    else if (m.t === 'chat') game.chat(me, m.text, m.ch);
  });
  ws.on('close', () => { clearInterval(refill); if (me) game.removePlayer(me.id); });
});

let last = performance.now(), acc = 0;
setInterval(() => {
  const now = performance.now(); acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= TICK) { game.tick(TICK); acc -= TICK; }
}, 1000 / 60);

server.listen(PORT, () => console.log(`THE BLACK SIGNAL em http://localhost:${PORT}`));
