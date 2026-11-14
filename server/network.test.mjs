import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { Rooms } from './rooms.mjs';
import { TICK } from '../shared/sim.js';

const project = fileURLToPath(new URL('../', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function availablePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function until(condition, description, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = condition();
    if (result) return result;
    await pause(20);
  }
  throw new Error('Timeout waiting for ' + description);
}
function request(base, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const req = http.request({ hostname: url.hostname, port: url.port, path: pathname, method: options.method || 'GET', headers: options.headers || {} }, res => {
      const chunks = [];
      res.on('data', data => chunks.push(data));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
async function connect(base, cookie) {
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin: base, headers: cookie ? { Cookie: cookie } : {} });
  const client = { socket, messages: [], frames: [] };
  socket.on('message', (data, binary) => binary ? client.frames.push(data) : client.messages.push(JSON.parse(data)));
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  client.send = message => socket.send(JSON.stringify(message));
  client.close = () => new Promise(resolve => {
    if (socket.readyState === WebSocket.CLOSED) return resolve();
    socket.once('close', resolve); socket.close();
  });
  return client;
}
async function refusedOrigin(base) {
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin: 'https://attacker.invalid' });
  return new Promise((resolve, reject) => {
    socket.once('unexpected-response', (_, response) => { response.resume(); socket.terminate(); resolve(response.statusCode); });
    socket.once('open', () => { socket.close(); reject(new Error('Foreign WebSocket origin was accepted')); });
    socket.on('error', () => {});
  });
}

// The preload only creates far/dead participants in this isolated child. Production has no test endpoints.
test('HTTP, authenticated accounts, separate rooms and authoritative voice routing', { timeout: 30000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'black-signal-network-'));
  const port = await availablePort(), base = 'http://127.0.0.1:' + port;
  const preload = path.join(directory, 'fixture.mjs');
  const gameURL = pathToFileURL(path.join(project, 'server/game.mjs')).href;
  await writeFile(preload, `import { Game } from ${JSON.stringify(gameURL)};
const original = Game.prototype.snapshot;
Game.prototype.snapshot = function () {
  for (const p of this.players.values()) {
    if (p.name === 'Guest FixtureFar') { p.s.x = 40; p.s.z = 0; }
    if (p.name === 'Guest FixtureDead') p.st = 2;
  }
  original.call(this);
};\n`);
  let output = '';
  const child = spawn(process.execPath, ['--import', preload, path.join(project, 'server/server.mjs')], {
    cwd: project, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: directory, BASE_PATH: '', TRUST_PROXY: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const clients = [];
  const open = async cookie => { const client = await connect(base, cookie); clients.push(client); return client; };
  const post = (pathname, body, cookie, origin = base) => request(base, pathname, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: JSON.stringify(body),
  });
  let cookie, accountId, host, member, publicHost, privateCode, publicCode, near, far, dead;
  try {
    await until(() => output.includes('0.5.0 http://'), 'child server startup');
    await t.test('HTTP health, headers, HEAD, malformed paths and traversal', async () => {
      const health = await request(base, '/api/health');
      assert.equal(health.status, 200); assert.equal(JSON.parse(health.body).ok, true);
      assert.equal(health.headers['x-content-type-options'], 'nosniff');
      const page = await request(base, '/');
      assert.equal(page.status, 200); assert.match(page.body, /The Black Signal/);
      const head = await request(base, '/assets/audio/shot.ogg', { method: 'HEAD' });
      assert.equal(head.status, 200); assert.equal(head.body, ''); assert.equal(head.headers['content-type'], 'audio/ogg');
      for (const route of ['/server/server.mjs', '/assets/../../server/server.mjs', '/assets/%2e%2e/%2e%2e/server/server.mjs', '/assets/%00']) {
        assert.equal((await request(base, route)).status, 404, route);
      }
      assert.equal((await request(base, '/assets/%ZZ')).status, 400);
    });
    await t.test('HTTP credentials and WebSocket upgrades reject foreign origins', async () => {
      const res = await post('/api/register', { username: 'BadOrigin', password: 'test-password-7841' }, null, 'https://attacker.invalid');
      assert.equal(res.status, 403);
      assert.equal(await refusedOrigin(base), 403);
    });
    await t.test('registration and login use private persistent sessions and validated usernames', async () => {
      const credentials = { username: 'NetworkAlice', password: 'test-password-7841' };
      const registered = await post('/api/register', credentials);
      assert.equal(registered.status, 201);
      const identity = JSON.parse(registered.body).user;
      accountId = identity.id;
      const setCookie = registered.headers['set-cookie'][0];
      assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
      cookie = setCookie.split(';')[0];
      const session = await request(base, '/api/session', { headers: { Cookie: cookie } });
      assert.deepEqual(JSON.parse(session.body).user, identity);
      assert.equal((await post('/api/register', credentials)).status, 409);
      assert.equal((await post('/api/login', { ...credentials, password: 'wrong-password-7841' })).status, 401);
      assert.equal((await post('/api/register', { username: "x'; DROP TABLE users;--", password: credentials.password })).status, 400);
      const logged = await post('/api/login', { ...credentials, username: 'networkalice' }, cookie);
      assert.equal(logged.status, 200);
      cookie = logged.headers['set-cookie'][0].split(';')[0];
      const db = await readFile(path.join(directory, 'auth.sqlite'));
      assert.equal(db.includes(Buffer.from(credentials.password)), false);
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
      assert.equal((await stat(path.join(directory, 'auth.sqlite'))).mode & 0o777, 0o600);
    });
    await t.test('private rooms stay unlisted and account identity overrides the supplied display name', async () => {
      host = await open(cookie);
      host.send({ t: 'join', create: true, private: true, title: 'Private fixture', name: 'Spoofed name' });
      const welcome = await until(() => host.messages.find(m => m.t === 'welcome'), 'private room welcome');
      privateCode = welcome.room;
      const lobby = await until(() => host.messages.find(m => m.t === 'lobby'), 'account lobby');
      assert.equal(lobby.players.find(p => p.id === welcome.id).name, 'NetworkAlice');
      publicHost = await open();
      publicHost.send({ t: 'join', create: true, title: 'Public fixture', name: 'Public host' });
      publicCode = (await until(() => publicHost.messages.find(m => m.t === 'welcome'), 'public room welcome')).room;
      const rooms = JSON.parse((await request(base, '/api/rooms')).body).rooms;
      assert.ok(rooms.some(r => r.code === publicCode));
      assert.equal(rooms.some(r => r.code === privateCode), false);
    });
    await t.test('only a room host can change its map or start it', async () => {
      member = await open(); member.send({ t: 'join', room: privateCode, name: 'Private member' });
      await until(() => member.messages.find(m => m.t === 'welcome'), 'member welcome');
      member.send({ t: 'map', id: 'frost' });
      await until(() => member.messages.find(m => m.t === 'error'), 'map permission error');
      member.messages.length = 0; member.send({ t: 'start' });
      await until(() => member.messages.find(m => m.t === 'error'), 'start permission error');
      host.send({ t: 'map', id: 'mall' }); publicHost.send({ t: 'map', id: 'frost' });
      await until(() => host.messages.find(m => m.t === 'lobby' && m.map === 'mall'), 'host map');
      await until(() => publicHost.messages.find(m => m.t === 'lobby' && m.map === 'frost'), 'second host map');
    });
    await t.test('room text carries plain text with no room-to-room delivery', async () => {
      await pause(900);
      const text = '<img src=x onerror=alert(1)> & raw text';
      member.messages.length = 0; publicHost.messages.length = 0;
      host.send({ t: 'chat', ch: 'room', text });
      const got = await until(() => member.messages.find(m => m.k === 'chat'), 'room text');
      assert.equal(got.text, text);
      await pause(100);
      assert.equal(publicHost.messages.some(m => m.k === 'chat'), false);
    });
    await t.test('two active maps keep distinct authoritative spawns and timers', async () => {
      near = await open(); near.send({ t: 'join', room: privateCode, name: 'FixtureNear' });
      far = await open(); far.send({ t: 'join', room: privateCode, name: 'FixtureFar' });
      dead = await open(); dead.send({ t: 'join', room: privateCode, name: 'FixtureDead' });
      for (const client of [near, far, dead]) await until(() => client.messages.find(m => m.t === 'welcome'), 'voice participant');
      host.send({ t: 'start' }); publicHost.send({ t: 'start' });
      const a = await until(() => host.messages.find(m => m.t === 'snap' && m.phase === 'prep'), 'private snapshot');
      const b = await until(() => publicHost.messages.find(m => m.t === 'snap' && m.phase === 'prep'), 'public snapshot');
      assert.ok(a.you.z > 20, 'Mall spawn stays in mall');
      assert.ok(b.you.z < 0 && b.you.z > -10, 'Frost spawn stays in frost');
      await pause(180);
      const rooms = JSON.parse((await request(base, '/api/rooms')).body).rooms;
      assert.equal(rooms.find(r => r.code === publicCode).map, 'frost');
      assert.equal(rooms.find(r => r.code === publicCode).running, true);
      assert.ok(host.messages.filter(m => m.t === 'snap').every(m => m.you === null || m.you.z > 20));
    });
    await t.test('voice is routed only to near living participants in the same room', async () => {
      for (const c of clients) c.frames.length = 0;
      await until(() => dead.messages.find(m => m.t === 'snap' && m.players.some(p => p.id === dead.messages.find(m => m.t === 'welcome').id && p.st === 2)), 'dead voice fixture');
      const bytes = Buffer.alloc(1280); bytes.writeInt16LE(8123, 12);
      host.socket.send(Buffer.alloc(12)); host.socket.send(bytes);
      await until(() => near.frames.length === 1, 'near voice');
      await pause(100);
      assert.equal(far.frames.length, 0); assert.equal(dead.frames.length, 0); assert.equal(publicHost.frames.length, 0);
      const senderId = host.messages.find(m => m.t === 'welcome').id;
      assert.equal(near.frames[0].readUInt32LE(0), senderId);
      assert.equal(near.frames[0].readInt16LE(16), 8123);
      const count = near.frames.length;
      dead.socket.send(bytes);
      await pause(100);
      assert.equal(near.frames.length, count);
    });
    await t.test('authenticated reconnect preserves player id, token and private role', async () => {
      const original = host.messages.find(m => m.t === 'welcome');
      const role = host.messages.find(m => m.t === 'role');
      await host.close();
      await pause(70);
      const unauthorized = await open();
      unauthorized.send({ t: 'join', room: privateCode, resume: original.resume });
      const guest = await until(() => unauthorized.messages.find(m => m.t === 'welcome'), 'guest token rejection');
      assert.notEqual(guest.id, original.id);
      const resumed = await open(cookie);
      resumed.send({ t: 'join', room: privateCode, resume: original.resume });
      const welcome = await until(() => resumed.messages.find(m => m.t === 'welcome'), 'resumed welcome');
      assert.equal(welcome.id, original.id); assert.equal(welcome.resume, original.resume);
      const restored = await until(() => resumed.messages.find(m => m.t === 'role'), 'resumed role');
      assert.deepEqual(restored, role);
    });
    await t.test('logout invalidates the persisted session cookie', async () => {
      const response = await post('/api/logout', {}, cookie);
      assert.equal(response.status, 200); assert.match(response.headers['set-cookie'][0], /Max-Age=0/);
      const session = await request(base, '/api/session', { headers: { Cookie: cookie } });
      assert.equal(JSON.parse(session.body).user, null);
      assert.ok(Number.isSafeInteger(accountId));
    });
  } finally {
    for (const client of clients) await client.close();
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2200).unref(); });
    await rm(directory, { recursive: true, force: true });
  }
});

test('a disconnected player keeps the same role before grace expires and is removed after 45 seconds', () => {
  const send = () => {};
  const rooms = new Rooms(send);
  const socket = { readyState: 1, bufferedAmount: 0, send() {} };
  const member = rooms.join(socket, { create: true, private: true, name: 'Grace player' }, null);
  const { room, player } = member;
  room.game.start();
  const id = player.id, role = player.role, resume = player.resume;
  rooms.disconnect(room, player);
  player.disconnectAt = Date.now() - 44900;
  rooms.tick(TICK);
  assert.equal(room.game.players.get(id).role, role);
  const back = rooms.join(socket, { room: room.code, resume }, null);
  assert.equal(back.player.id, id);
  assert.equal(back.player.role, role);
  rooms.disconnect(room, back.player);
  back.player.disconnectAt = Date.now() - 45100;
  rooms.tick(TICK);
  assert.equal(room.game.players.has(id), false);
});
