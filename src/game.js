// Client game layer: connection, prediction, remote players, HUD. The server decides everything that matters.
import * as THREE from 'three';
import { buildPlayer, buildEcho } from './figures.js';
import { LAYOUT, EXTRACT, MAP, MAP_ID, height } from '../shared/layout.js';
import { stepMove, newMove, RULES } from '../shared/sim.js';

const $ = (id) => document.getElementById(id);
const PHASE = { lobby: 'Lobby', prep: 'Preparação', explore: 'Exploração', blackout: 'Blackout', extract: 'Extração', end: 'Fim' };

export function createGame({ scene, world, view, keys, changeMap, menu }) {
  const me = { id: 0, slot: 0, role: null, partner: 0, s: newMove(LAYOUT.spawns[0].x, LAYOUT.spawns[0].z), st: 0, form: 0, you: null, spectator: false };
  const views = new Map();   // id -> { fig, mon, pos, target, face, st, form, speed, name }
  let state = null, names = new Map(), ws = null, online = false, joined = false, sandboxNight = 0, sendAcc = 0, attackT = 0, aimT = 0, spectate = 0;
  const focus = new THREE.Vector3(), tmp = new THREE.Vector3();

  const getView = (id, slot = 0) => {
    let v = views.get(id);
    if (!v) {
      v = { fig: buildPlayer(scene, slot), mon: null, pos: new THREE.Vector3(), target: new THREE.Vector3(), face: 0, st: 0, form: 0, speed: 0, cr: 0, fresh: true, atk: 0, aim: 0 };
      views.set(id, v);
    }
    return v;
  };
  const localView = getView('local', 0);

  // ---------- HUD helpers
  const feed = (text, cls = 'sys') => {
    const d = document.createElement('div'); d.className = cls; d.textContent = text; $('feed').append(d);
    while ($('feed').children.length > 7) $('feed').firstChild.remove();
    setTimeout(() => d.remove(), 14000);
  };
  const toast = (text, detail) => {
    const t = $('toast');
    t.textContent = text;
    if (detail) {
      const subtitle = document.createElement('span');
      subtitle.textContent = detail;
      t.append(subtitle);
    }
    t.style.opacity = 1;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.style.opacity = 0), 3400);
  };
  const nameOf = (id) => names.get(id)?.name ?? '???';

  // ---------- network
  function connect() {
    try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`); } catch { return offline(); }
    ws.onopen = () => { online = true; menu.connection('online'); };
    ws.onclose = offline;
    ws.onmessage = (e) => handle(JSON.parse(e.data));
  }
  function offline() {
    online = false; joined = false; me.spectator = false;
    clearMatch();
    menu.connection('offline');
  }
  const send = (m) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
  function join(name) {
    if (online && !joined) send({ t: 'join', name });
  }

  // the room's map is the server's call; offline it is ours
  function resetPosition() {
    const spawn = LAYOUT.spawns[me.slot % LAYOUT.spawns.length];
    me.s = newMove(spawn.x, spawn.z);
    localView.pos.set(me.s.x, me.s.y, me.s.z); localView.fresh = true;
  }
  function applyMap(id) {
    if (!id || id === MAP_ID) return;
    changeMap(id);
    resetPosition();
  }
  const setMap = (id) => { if (online && joined) send({ t: 'map', id }); else applyMap(id); };
  function setSlot(slot) {
    if (me.slot !== slot) {
      me.slot = slot;
      scene.remove(localView.fig.root);
      localView.fig = buildPlayer(scene, slot);
    }
    resetPosition();
  }
  function handle(m) {
    if (m.map) applyMap(m.map);
    if (m.t === 'welcome') {
      me.id = m.id; me.spectator = m.spectator; joined = true;
      setSlot(m.slot);
      menu.joined();
    }
    else if (m.t === 'lobby') {
      names = new Map(m.players.map((p) => [p.id, p]));
      const player = names.get(me.id);
      if (player) {
        if (player.slot !== me.slot) setSlot(player.slot);
        me.spectator = player.spectator;
      }
      if (m.phase === 'lobby') {
        clearMatch();
        resetPosition();
      }
      menu.lobby(m);
    } else if (m.t === 'role') {
      me.role = m.role; me.partner = m.partner;
      const r = $('role'); r.style.display = 'block'; r.className = 'hud ' + m.role;
      r.innerHTML = m.role === 'echo'
        ? `<b>ECHO</b>Impede a transmissão. Elimina os Operativos.<br>Parceiro: ${esc(nameOf(m.partner))}`
        : '<b>OPERATIVO</b>Repara os transmissores e evacua.<br>Dois de vós já não são humanos.';
      toast(MAP.name, m.role === 'echo' ? 'És um Echo' : 'És um Operativo');
    } else if (m.t === 'snap') onSnap(m);
    else if (m.t === 'ev') onEvent(m);
  }
  function resetViews() { for (const [id, v] of views) if (id !== 'local') { scene.remove(v.fig.root); if (v.mon) scene.remove(v.mon.root); views.delete(id); } }

  function clearMatch() {
    state = null;
    me.role = null; me.partner = 0; me.st = 0; me.form = 0; me.you = null;
    $('role').style.display = 'none';
    $('toast').style.opacity = 0;
    $('feed').replaceChildren();
    resetViews();
  }

  function onSnap(m) {
    state = m;
    for (const p of m.players) {
      const v = p.id === me.id ? localView : getView(p.id, names.get(p.id)?.slot ?? 0);
      v.target.set(p.x, p.y, p.z); v.tface = p.f; v.st = p.st; v.form = p.form; v.cr = p.cr; v.seen = m;
      if (v.fresh) { v.pos.copy(v.target); v.face = p.f; v.fresh = false; }
      if (p.id === me.id) { me.st = p.st; me.form = p.form; }
    }
    for (const [id, v] of views) if (id !== 'local' && v.seen !== m) { v.fig.root.visible = false; if (v.mon) v.mon.root.visible = false; }
    me.you = m.you;
    if (m.you) { // reconcile prediction with the authoritative position
      const s = me.s, dx = m.you.x - s.x, dy = m.you.y - s.y, dz = m.you.z - s.z, err = Math.hypot(dx, dz);
      if (err > 2.5 || me.st !== 0 || m.phase === 'prep') { s.x = m.you.x; s.y = m.you.y; s.z = m.you.z; s.vy = m.you.vy; }
      else { s.x += dx * 0.12; s.z += dz * 0.12; if (Math.abs(dy) > 1.5) s.y = m.you.y; }
      s.stam = m.you.stam;
    }
  }

  function onEvent(m) {
    const k = m.k;
    if (k === 'phase') {
      if (m.phase === 'prep') {
        toast(MAP.name);
        menu.matchStart();
      } else if (m.phase === 'blackout') toast('Blackout — o sinal perdeu-se');
      else if (m.phase === 'explore') toast(m.zone === 0 ? 'Recuperem a energia' : `Zona ${m.zone + 1}`);
      else if (m.phase === 'extract') toast('Extração aberta — corram para o mastro');
    } else if (k === 'shot') { world.tracer(m.a, m.b); const v = m.id === me.id ? localView : views.get(m.id); if (v) v.aim = 0.5; }
    else if (k === 'claw') { const v = m.id === me.id ? localView : views.get(m.id); if (v) v.atk = 0.45; }
    else if (k === 'hurt') { $('vignette').classList.add('hurt'); setTimeout(() => $('vignette').classList.remove('hurt'), 260); }
    else if (k === 'down') feed(`${nameOf(m.id)} foi abatido`);
    else if (k === 'dead') feed(`${nameOf(m.id)} morreu`);
    else if (k === 'revive') feed(`${nameOf(m.by)} reanimou ${nameOf(m.id)}`);
    else if (k === 'escaped') feed(`${nameOf(m.id)} evacuou`);
    else if (k === 'transform') { feed('Algo se transformou na escuridão'); }
    else if (k === 'txon') feed(`Transmissor ${m.tx + 1} online`);
    else if (k === 'fuse') feed(`Fusível instalado no transmissor ${m.tx + 1}`);
    else if (k === 'pickup') feed({ fuse: '+1 fusível', ammo: '+6 munições', med: '+1 kit médico', flare: '+1 sinalizador' }[m.type]);
    else if (k === 'chat') feed(`${m.ch === 'echo' ? '[ECHO] ' : m.ch === 'dead' ? '[MORTOS] ' : ''}${m.name}: ${m.text}`, m.ch);
    else if (k === 'end') {
      clearMatch();
      resetPosition();
      menu.matchEnd(m);
    }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- actions
  const playing = () => joined && state && state.phase !== 'lobby' && state.phase !== 'end' && !me.spectator;
  function act(a, camera) {
    if (!playing() || me.st !== 0) return;
    if (a === 'primary') {
      if (me.form) return send({ t: 'act', a: 'attack' });
      const head = tmp.set(me.s.x, me.s.y + 1.45, me.s.z);
      const dir = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(45).add(camera.position).sub(head).normalize();
      send({ t: 'act', a: 'fire', d: [dir.x, dir.y, dir.z] }); aimT = 0.6;
      localView.face = me.face = Math.atan2(dir.x, dir.z);
    } else send({ t: 'act', a });
  }
  function chat(text, ch) { if (joined) send({ t: 'chat', text, ch }); }
  function nextSpectate() { spectate++; }
  function toggleSandboxNight() { if (!playing()) { sandboxNight = 1 - sandboxNight; toast(sandboxNight ? 'Blackout — o sinal perdeu-se' : 'Sinal restaurado'); } }

  // ---------- per-frame
  const inp = { mx: 0, mz: 0, sprint: false, crouch: false, jump: false, use: false };
  me.face = Math.PI;
  function update(dt, t, active) {
    const typing = document.activeElement === $('chat') || document.activeElement === $('name');
    const f = active && !typing ? (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) : 0, s = active && !typing ? (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) : 0;
    inp.mx = -Math.sin(view.yaw) * f + Math.cos(view.yaw) * s; inp.mz = -Math.cos(view.yaw) * f - Math.sin(view.yaw) * s;
    inp.sprint = keys.has('ShiftLeft') && !typing; inp.crouch = (keys.has('KeyC') || keys.has('ControlLeft')) && !typing;
    inp.jump = keys.has('Space') && active && !typing; inp.use = keys.has('KeyE') && active && !typing;

    const inMatch = playing();
    const frozen = inMatch && (state.phase === 'prep' || me.you?.stun);
    const mode = !inMatch ? 'human' : frozen || me.st >= 2 ? 'frozen' : me.st === 1 ? 'downed' : me.form ? 'monster' : 'human';
    const before = Math.hypot(me.s.vx, me.s.vz);
    if (!joined || inMatch) stepMove(me.s, inp, dt, mode);
    const speed = Math.hypot(me.s.vx, me.s.vz);
    aimT -= dt;
    if (speed > 0.3 && aimT <= 0) { let d = Math.atan2(me.s.vx, me.s.vz) - me.face; d = Math.atan2(Math.sin(d), Math.cos(d)); me.face += d * (1 - Math.exp(-12 * dt)); }
    sendAcc += dt;
    if (inMatch && sendAcc > 1 / 30) { sendAcc = 0; send({ t: 'in', ...inp }); }

    // local figure follows the predicted state; remote figures chase their snapshots
    localView.pos.set(me.s.x, me.s.y, me.s.z); localView.face = me.face;
    for (const [id, v] of views) {
      const local = id === 'local';
      if (!local) {
        const prev = tmp.copy(v.pos);
        v.pos.lerp(v.target, 1 - Math.exp(-14 * dt));
        v.speed += (prev.distanceTo(v.pos) / Math.max(dt, 1e-3) - v.speed) * Math.min(1, dt * 10);
        let d = (v.tface ?? 0) - v.face; d = Math.atan2(Math.sin(d), Math.cos(d)); v.face += d * Math.min(1, dt * 12);
      } else v.speed = speed;
      const st = local ? (inMatch ? me.st : 0) : v.st, form = local ? (inMatch ? me.form : 0) : v.form;
      const shown = (local ? !me.spectator || !joined || !state || state.phase === 'lobby' : v.seen === state) && st !== 3;
      v.atk = Math.max(0, v.atk - dt); v.aim = Math.max(0, v.aim - dt);
      if (form && !v.mon) v.mon = buildEcho(scene);
      v.fig.root.visible = shown && !form; if (v.mon) v.mon.root.visible = shown && !!form;
      if (!shown) continue;
      if (form) { v.mon.root.position.copy(v.pos); v.mon.root.rotation.y = v.face; v.mon.update(dt, v.speed, v.atk / 0.45); }
      else {
        const lying = st >= 1;
        v.fig.root.position.copy(v.pos); if (lying) v.fig.root.position.y += 0.22;
        v.fig.root.rotation.set(lying ? -1.45 : 0, v.face, 0, 'YXZ');
        v.fig.update(dt, lying ? 0 : v.speed, local ? me.s.grounded : true, local ? me.s.vy : 0, local ? inp.crouch : !!v.cr, local ? (speed - before) / Math.max(dt, 1e-3) : 0, v.aim > 0);
      }
    }

    // camera focus: yourself, or whoever you are spectating once dead
    focus.copy(localView.pos); let focusForm = inMatch ? me.form : 0;
    if (joined && state && (me.spectator || me.st >= 2) && state.phase !== 'lobby') {
      const alive = state.players.filter((p) => p.st < 2 && p.id !== me.id);
      if (alive.length) { const p = alive[spectate % alive.length], v = views.get(p.id); if (v) { focus.copy(v.pos); focusForm = v.form; } }
    }
    hud(inMatch, t);
    return { focus, focusForm, night: state && state.phase !== 'lobby' ? state.night : sandboxNight, speed };
  }

  // lights carried by players (alive humans) and burning flares
  function lights(out) {
    for (const v of views.values()) if (v.fig.root.visible && v.st === 0) out.push({ p: v.fig.lampPos, r: 7.5, c: 0xffb060 });
    if (state) for (const f of state.flares) out.push({ p: new THREE.Vector3(f[0], height(f[0], f[1]) + 0.4, f[1]), r: 13, c: 0xff4030 });
  }

  let hudAcc = 0;
  function hud(inMatch, t) {
    if ((hudAcc += 1) % 3) return;
    const show = (id, on, d = 'block') => ($(id).style.display = on ? d : 'none');
    show('vitals', inMatch && !!me.you); show('cross', inMatch && me.st === 0 && !me.form); show('top', !!state && state.phase !== 'lobby');
    if (!state || state.phase === 'lobby') { show('prompt', false); show('progress', false); return; }
    $('phase').textContent = PHASE[state.phase] + (state.phase === 'explore' || state.phase === 'blackout' ? ` · Zona ${Math.min(state.zone, 2) + 1}` : '');
    $('timer').textContent = `${String(Math.floor(state.pt / 60)).padStart(2, '0')}:${String(state.pt % 60).padStart(2, '0')}`;
    $('txrow').innerHTML = state.tx.map((s, i) => `${i === 2 || i === 4 ? '<i class="gap"></i>' : ''}<i class="${s.on ? 'on' : s.fuse ? 'fuse' : ''}"></i>`).join('');
    const y = me.you; let obj = '';
    if (me.spectator) obj = 'A assistir — entras na próxima partida';
    else if (me.st === 2) obj = 'Morreste. Clica para mudar de jogador observado.';
    else if (me.st === 3) obj = 'Evacuaste.';
    else if (me.st === 1) obj = `Abatido — alguém tem de te reanimar (${y?.bleed ?? 0}s)`;
    else if (state.phase === 'prep') obj = 'A partida começa dentro de momentos';
    else if (state.phase === 'extract') obj = me.role === 'echo' ? 'Não deixes ninguém chegar à zona de extração' : 'Corre para a zona de extração junto ao mastro';
    else if (me.role === 'echo') obj = me.form ? 'Caça os Operativos antes que a energia acabe' : state.night ? (y?.energy >= RULES.transformCost ? 'F para te transformares' : 'Energia insuficiente para transformar') : 'Finge reparar: drena energia dos transmissores (E)';
    else obj = state.night ? 'Sobrevive ao blackout. Luz e munições contam.' : 'Encontra fusíveis e repara os transmissores da zona (E)';
    $('objective').textContent = obj;
    if (!y) return;
    $('hpn').textContent = me.form ? `${y.hp} (forma Echo)` : y.hp; $('hp').firstChild.style.width = `${me.form ? y.hp / 3 : y.hp}%`;
    $('stam').firstChild.style.width = `${y.stam * 100}%`;
    show('energyRow', me.role === 'echo');
    if (me.role === 'echo') { $('enn').textContent = y.energy; $('energy').firstChild.style.width = `${y.energy}%`; }
    $('inv').innerHTML = `<span>MUNIÇÃO <b>${y.ammo}</b></span><span>KIT <b>${y.med}</b></span><span>SINALIZADOR <b>${y.flare}</b></span><span>FUSÍVEL <b>${y.fuse}</b></span>`;
    // interaction prompt
    let prompt = '';
    if (me.st === 0 && !me.form && state.phase !== 'prep') {
      const near = (p, r) => Math.hypot(p.x - me.s.x, p.z - me.s.z) < r;
      const downed = state.players.find((p) => p.id !== me.id && p.st === 1 && near(p, 2.2));
      const ti = LAYOUT.tx.findIndex((p) => near(p, RULES.useRange));
      if (downed) prompt = `E — reanimar ${nameOf(downed.id)} (${Math.round(downed.rv * 100)}%)`;
      else if (ti >= 0) {
        const s = state.tx[ti];
        prompt = !s.fuse ? (y.fuse > 0 ? 'E — instalar fusível' : 'Este transmissor precisa de um fusível')
          : me.role === 'echo' ? 'E — drenar energia (parece uma reparação)' : s.on ? 'Transmissor online' : 'E — reparar transmissor';
      } else if (state.phase === 'extract' && me.role === 'operative' && near(EXTRACT, EXTRACT.r)) prompt = `A evacuar… ${Math.round(y.ext * 100)}%`;
    }
    $('prompt').textContent = prompt; show('prompt', !!prompt);
    show('progress', y.txp >= 0); if (y.txp >= 0) $('progress').querySelector('i').style.width = `${y.txp * 100}%`;
  }

  connect();
  return { setMap, update, lights, act, chat, join, start: () => send({ t: 'start' }), nextSpectate, toggleSandboxNight, toast, me, playing, get state() { return state; }, get joined() { return joined; }, get online() { return online; } };
}
