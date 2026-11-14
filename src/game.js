import { t, translateText } from './i18n.js';
// Client game layer: connection, prediction, remote players, HUD. The server decides everything that matters.
import * as THREE from 'three';
import { buildPlayer, buildEcho } from './figures.js';
import { LAYOUT, EXTRACT, MAP, MAP_ID, height } from '../shared/layout.js';
import { createVoice } from './voice.js';
import { eye, obstacle } from '../shared/sight.js';
import { stepMove, newMove, RULES } from '../shared/sim.js';

const $ = (id) => document.getElementById(id);
const PHASE = {lobby:'Room',prep:'Preparation',day1:'Day 1 — night in',night1:'Night 1 — dawn in',day2:'Day 2 — night in',night2:'Night 2 — dawn in',day3:'Day 3 — final hunt in',final:'Final hunt',end:'Results'};

export function createGame({ scene, world, view, keys, changeMap, menu, ambience, isActive, camera }) {
  const me = { id: 0, slot: 0, role: null, partner: 0, s: newMove(LAYOUT.spawns[0].x, LAYOUT.spawns[0].z), st: 0, form: 0, you: null, spectator: false };
  const voicePositions = new Map();
  const views = new Map();   // id -> { fig, mon, pos, target, face, st, form, speed, name }
  let state = null, names = new Map(), ws = null, online = false, joined = false, sandboxNight = 0, sendAcc = 0, attackT = 0, aimT = 0, reconnectTimer, reconnecting=false, lastRoom=null;
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
    try { const endpoint=new URL('./ws',location.href);endpoint.protocol=location.protocol==='https:'?'wss:':'ws:';ws=new WebSocket(endpoint); } catch { return offline(); }
    ws.onopen = () => {
      online = true; menu.connection('online');
      if(reconnecting&&lastRoom) { send({t:'join',name:$('name').value||t("Guest"),room:lastRoom.room,resume:lastRoom.resume}); }
    };
    ws.binaryType = 'arraybuffer';
    ws.onclose = offline;
    ws.onmessage = ({ data }) => {
      if (typeof data === 'string') handle(JSON.parse(data));
      else voice.receive(data);
    };
  }
  function offline() {
    online = false; joined = false; me.spectator = false;
    clearMatch();
    voice.reset();
    menu.connection('offline');
    reconnecting=Boolean(lastRoom);
    clearTimeout(reconnectTimer);
    if(reconnecting)reconnectTimer=setTimeout(connect,1600);
  }
  const send = (m) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
  function join(name,options=menu.roomOptions()) {
    if(online&&!joined)send({t:'join',name,...options});
  }
  function leave(){
    send({t:'leave'});
    lastRoom=null;reconnecting=false;joined=false;clearMatch();
    menu.connection('online');menu.roomLeft();
    $('entry').hidden=false;$('room').hidden=true;$('play').disabled=false;
  }
  function reconnect(){
    lastRoom=null;reconnecting=false;clearTimeout(reconnectTimer);
    if(ws){ws.onclose=null;ws.close();}
    joined=false;online=false;clearMatch();voice.reset();menu.roomLeft();
    $('entry').hidden=false;$('room').hidden=true;$('play').disabled=false;
    function renderRole() {
    if (!me.role) return;
    const panel=$('role'); panel.style.display='block'; panel.className='hud '+me.role;
    panel.innerHTML=me.role==='echo'
      ? `<b>ECHO</b>${t('Stop the signal. Eliminate the Operatives.')}<br>${esc(t('Partner: {name}',{name:nameOf(me.partner)}))}`
      : `<b>${t('OPERATIVE')}</b>${t('Repair the transmitters and evacuate.')}<br>${t('Two of you are no longer human.')}`;
  }
  window.addEventListener('language-change', () => {renderRole();hintUntil=0;lastHint=-30;shownHints.clear();hudAcc=2;hud(playing());});
  connect();
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
      lastRoom={room:m.room,resume:m.resume};reconnecting=false;
      menu.roomJoined(m);
      menu.joined();
    }
    else if(m.t==='left'){joined=false;clearMatch();menu.roomLeft();}
    else if(m.t==='error'){
      $('room-connection').textContent=translateText(m.message);$('play').disabled=false;
      if(!joined){lastRoom=null;reconnecting=false;}
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
      renderRole();
      toast(translateText(MAP.name), m.role === 'echo' ? t("You are an Echo") : t("You are an Operative"));
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
    voicePositions.clear();
    ambience.reset();
    voice.reset();
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
    if(k==='voice-position'){voicePositions.set(m.id,{x:m.x,y:m.y,z:m.z,heard:performance.now()});return;}
    if(k==='sound'){ambience.cue(m.sound,{x:m.x,y:m.y,z:m.z});return;}
    const source=views.get(m.id);
    const from = m.id === me.id ? null : source?.seen===state?source.pos:undefined;
    const tx = LAYOUT.tx[m.tx];
    if (k === 'step') ambience.step(m, m.id === me.id);
    if (k === 'shot') ambience.cue('shot', m.id === me.id ? null : { x: m.a[0], y: m.a[1], z: m.a[2] });
    if (k === 'claw' || k === 'transform' || k === 'revert') {
      const cue = { transform: 'growl-1', claw: 'growl-2', revert: 'growl-3' }[k];
      if (from || m.id === me.id) ambience.cue(cue, from);
    }
    if (k === 'revive' || k === 'down' || k === 'dead') {
      if (from || m.id === me.id) ambience.cue(k === 'revive' ? 'revive' : 'impact', from);
    }
    if (k === 'fuse') ambience.cue('fuse', tx);
    if (k === 'txon') ambience.cue('phase', tx, .95, 1, 22);
    if (k === 'flare') ambience.cue('flare', { x: m.x, y: height(m.x, m.z) + .18, z: m.z }, 1, .9);
    if (k === 'pickup' || k === 'empty' || k === 'heal') ambience.cue(k);
    if (k === 'escaped' && m.id === me.id) ambience.cue('extract');
    if (k === 'phase') ambience.cue(m.phase.startsWith('night') || m.phase === 'final' ? 'blackout' : 'phase');
    if (k === 'phase') {
      if (m.phase === 'prep') {
        toast(translateText(MAP.name));
        menu.matchStart();
      } else if (m.phase === 'blackout') toast(t("Blackout — the signal is lost"));
      else if (m.phase.startsWith('day')) toast(m.zone === 0 ? t("Recover the power") : t('Sector {sector}',{sector:m.zone+1}));
      else if (m.phase === 'final') toast(t('Final hunt · prepare extraction'));
    } else if (k === 'shot') { world.tracer(m.a, m.b); const v = m.id === me.id ? localView : views.get(m.id); if (v) v.aim = 0.5; }
    else if (k === 'claw') { const v = m.id === me.id ? localView : views.get(m.id); if (v) v.atk = 0.45; }
    else if (k === 'hurt') { ambience.cue('impact', null, .7); $('vignette').classList.add('hurt'); setTimeout(() => $('vignette').classList.remove('hurt'), 260); }
    else if (k === 'down') feed(t('{name} was downed',{name:nameOf(m.id)}));
    else if (k === 'dead') feed(t('{name} died',{name:nameOf(m.id)}));
    else if (k === 'fed') feed(t("Blood absorbed · +30 energy"));
    else if (k === 'revive') feed(t('{name} revived {target}',{name:nameOf(m.by),target:nameOf(m.id)}));
    else if (k === 'escaped') feed(t('{name} evacuated',{name:nameOf(m.id)}));
    else if (k === 'transform') {
      feed(t("Something transformed in the dark"));
    }
    else if (k === 'txon') feed(t('Transmitter {number} online',{number:m.tx+1}));
    else if (k === 'fuse') feed(t('Cell installed at transmitter {number}',{number:m.tx+1}));
    else if (k === 'pickup') feed({ cell: t("+1 energy cell"), ammo: t("+3 rounds"), med: t("+1 medical kit"), flare: t("+1 flare") }[m.type]);
    else if (k === 'chat') {
      const line=document.createElement('li');line.textContent=`${m.name}: ${m.text}`;
      $('room-chat-log').append(line);
      while($('room-chat-log').children.length>40)$('room-chat-log').firstChild.remove();
      line.scrollIntoView({block:'nearest'});
      feed(`${m.ch === 'echo' ? '[ECHO] ' : m.ch === 'dead' ? '['+t('DEAD')+'] ' : ''}${m.name}: ${m.text}`, m.ch);
    }
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
      const direction = camera.getWorldDirection(new THREE.Vector3());
      if (me.form) return send({t:'act',a:'attack',d:[direction.x,direction.y,direction.z]});
      send({t:'act',a:'fire',d:[direction.x,direction.y,direction.z],c:camera.position.toArray()});
      aimT = .6; localView.face = me.face = Math.atan2(direction.x,direction.z);
    } else send({t:'act',a});
  }
  function chat(text, ch) { if (joined) send({ t: 'chat', text, ch }); }
  function nextSpectate() {
    if(!state||(!me.spectator&&me.st<2))return;
    const targets=state.players.filter(p=>p.st<2&&p.id!==me.id);
    if(!targets.length)return;
    const current=targets.findIndex(p=>p.id===state.watching);
    send({t:'watch',id:targets[(current+1)%targets.length].id});
  }
  function toggleSandboxNight() { if (!playing()) { sandboxNight = 1 - sandboxNight; toast(sandboxNight ? t("Blackout — the signal is lost") : t("Signal restored")); } }

  // ---------- per-frame
  let localStride = 0, localSample = 0, heldTarget = null, focused = null, useHeld = false;
  const aimDirection = new THREE.Vector3(), targetPosition = new THREE.Vector3();
  function findTarget() {
    if (!state || me.st !== 0 || me.spectator || state.phase === 'prep') return null;
    const options = [];
    for (const p of state.players) if (p.id !== me.id && p.st === 1) options.push({
      target:{kind:'player',id:p.id},point:{x:p.x,y:p.y+.38,z:p.z},
      label:me.form?t("Execute"):t("Revive"),range:me.form?RULES.clawRange:RULES.useRange,
    });
    if (!me.form) {
      for (const tx of LAYOUT.tx) if (tx.zone<=state.unlocked) options.push({
        target:{kind:'tx',id:tx.id}, point:{x:tx.x,y:tx.y+.9,z:tx.z},range:RULES.useRange,
        label:state.tx[tx.id].on?t("Transmitter active"):!state.tx[tx.id].fuse?(me.you?.cell?t("Install cell"):t("Needs an energy cell")):me.role==='echo'?t("Pretend to repair"):t("Hold to repair"),
      });
      const available=LAYOUT.items.filter(item=>state.items[item.id]==='1');
      for (const item of [...available,...state.extraDrops]) if (item.zone<=state.unlocked) options.push({
        target:{kind:'item',id:item.id},point:{x:item.x,y:item.y+.88,z:item.z},range:RULES.pickupRange,
        label:{cell:me.you?.cell?t("Already carrying a cell"):t("Take energy cell"),ammo:t("Take ammunition"),med:t("Take medical kit"),flare:t("Take flare")}[item.type],
      });
      for (const station of LAYOUT.blood) if (station.zone<=state.unlocked && (me.role==='echo'||state.blood[station.id]>0)) options.push({
        target:{kind:'blood',id:station.id},point:{x:station.x,y:station.y+.9,z:station.z},range:RULES.useRange,
        label:state.blood[station.id]>0?t("Tampered cabinet"):me.you?.bloodUsed?.[station.id]==='1'?t("Source depleted"):state.night?t("Feeding is available during the day"):t("Hold to absorb blood"),
      });
    }
    let best=null,score=Infinity;
    const origin=eye(me.s,inp.crouch);
    for (const option of options) {
      if (Math.hypot(me.s.x-option.point.x,me.s.z-option.point.z)>option.range || obstacle(origin,option.point,false)<.995)continue;
      targetPosition.set(option.point.x,option.point.y,option.point.z).project(camera);
      if (targetPosition.z>1 || Math.abs(targetPosition.x)>.63 || Math.abs(targetPosition.y)>.8)continue;
      const value=targetPosition.x**2+targetPosition.y**2;
      if(value<score){best=option;score=value;}
    }
    return best;
  }
  const inp = { mx: 0, mz: 0, sprint: false, crouch: false, jump: false, use: false };
  me.face = Math.PI;
  function update(dt, t, active) {
    const typing = document.activeElement === $('chat') || document.activeElement === $('name');
    const f = active && !typing ? (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) : 0, s = active && !typing ? (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) : 0;
    inp.mx = -Math.sin(view.yaw) * f + Math.cos(view.yaw) * s; inp.mz = -Math.cos(view.yaw) * f - Math.sin(view.yaw) * s;
    inp.sprint = active && keys.has('ShiftLeft') && !typing; inp.crouch = active && (keys.has('KeyC') || keys.has('ControlLeft')) && !typing;
    inp.jump = keys.has('Space') && active && !typing;
    const held = keys.has('KeyE') && active && !typing;
    if (!held) heldTarget = null;
    const found = findTarget();
    if (held && !useHeld) heldTarget = found?.target ?? null;
    focused = held ? found?.target?.kind === heldTarget?.kind && found?.target?.id === heldTarget?.id ? found : null : found;
    useHeld = held;
    inp.use = held && Boolean(focused);
    inp.target = focused ? heldTarget : null;
    if (active) {inp.aim = Math.atan2(camera.getWorldDirection(aimDirection).x, aimDirection.z);inp.camera=camera.position.toArray();}

    const inMatch = playing();
    const frozen = inMatch && (state.phase === 'prep' || me.you?.stun || (me.form && me.you?.action?.kind === 'player'));
    const mode = !inMatch ? 'human' : frozen || me.st >= 2 ? 'frozen' : me.st === 1 ? 'downed' : me.form ? 'monster' : 'human';
    const before = Math.hypot(me.s.vx, me.s.vz);
    const wasGrounded = me.s.grounded, beforeX = me.s.x, beforeZ = me.s.z;
    if (!joined || inMatch) stepMove(me.s, inp, dt, mode,
      me.form && state?.flares.some(([x,z]) => Math.hypot(x-me.s.x,z-me.s.z)<RULES.flareRadius) ? .5 : 1);
    if (!joined && active && me.s.grounded && !inp.crouch) {
      const distance = Math.hypot(me.s.x - beforeX, me.s.z - beforeZ);
      localStride = distance > dt * .55 ? localStride + distance : 0;
      const running = inp.sprint && me.s.stam > .03;
      const stride = running ? 1.68 : 1.35;
      if (!wasGrounded || localStride >= stride) {
        ambience.step({ ...me.s, gait: wasGrounded ? Number(running) : 3, sample: localSample++ % 3 }, true);
        localStride = 0;
      }
    } else localStride = 0;
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
      if (alive.length) { const p = alive.find(p=>p.id===state.watching)??alive[0], v = views.get(p.id); if (v) { focus.copy(v.pos); focusForm = v.form; } }
    }
    voice.update();
    hud(inMatch, t);
    return { focus, focusForm, night: state && state.phase !== 'lobby' ? state.night : sandboxNight, speed };
  }

  // lights carried by players (alive humans) and burning flares
  function lights(out) {
    for (const v of views.values()) if (v.fig.root.visible && v.st === 0) out.push({ p: v.fig.lampPos, r: 7.5, c: 0xffb060 });
    if (state) for (const f of state.flares) out.push({ p: new THREE.Vector3(f[0], height(f[0], f[1]) + 0.4, f[1]), r: 13, c: 0xff4030 });
  }

  let hudAcc = 0;
  function hud(inMatch) {
    if ((hudAcc += 1) % 3) return;
    const show = (id, on, d = 'block') => ($(id).style.display = on ? d : 'none');
    show('vitals', inMatch && !!me.you); show('cross', inMatch && me.st === 0 && !me.form); show('top', !!state && state.phase !== 'lobby');
    if (!state || state.phase === 'lobby') { show('prompt',false);show('progress',false);$('relay-status').textContent='';$('match-tip').hidden=true;return; }
    $('phase').textContent = t(PHASE[state.phase] ?? state.phase);
    $('timer').textContent = `${String(Math.floor(state.pt/60)).padStart(2,'0')}:${String(state.pt%60).padStart(2,'0')}`;
    const count=state.tx.filter(tx=>tx.on).length;
    $('relay-status').textContent = t('TRANSMITTERS {count}/3 · SECTOR {sector}',{count,sector:state.unlocked+1})+'\n'+translateText(LAYOUT.zoneNames?.[state.unlocked] ?? '');
    $('txrow').innerHTML = state.tx.map((tx,i)=>`<i class="${tx.on?'on':tx.fuse?'fuse':''}" title="${t('Transmitter {number}',{number:i+1})}"></i>`).join('');
    const y=me.you;
    let objective=t("Take a cell and repair the sector transmitter.");
    if (me.spectator) objective=t("Spectating. Join the next match if a seat is free.");
    else if (me.st===2) objective=t("You died. Click to follow another player.");
    else if (me.st===3) objective=t("You evacuated.");
    else if (me.st===1) objective=t('Downed · {seconds} s to be revived',{seconds:y?.bleed ?? 0});
    else if (state.phase==='prep') objective=t("4 Operatives, 2 Echoes · three transmitters to prepare your escape.");
    else if (state.phase==='final') objective=state.extractionOpen?t("EXTRACTION OPEN · stay in the green area for 5 s"):count<3?t('EXTRACTION LOCKED · {count}/3 transmitters',{count}):t('POWERING UP · {seconds} s',{seconds:state.warmup});
    else if (me.role==='echo') objective=me.form?t("Hunt. Hold E to execute a downed player."):state.night?(y?.nightUsed===state.nightIndex?t("Transformation already used tonight"):y?.energy>=RULES.transformThreshold?t("F — transform · once tonight"):t("Not enough energy to transform")):t("Feed discreetly. Hold E at a medical cabinet.");
    else if (state.night) objective=t("Survive the hunt. Use a flare to delay the monster.");
    else if (!state.combatOpen) objective=t("Explore and prepare to leave. Weapons unlock on the first night.");
    $('objective').textContent=objective;
    if(!y)return;
    $('hpn').textContent = Math.ceil(y.hp);
    $('hp').firstChild.style.width=`${Math.max(0,y.hp)/(me.form?RULES.monsterHp:100)*100}%`;
    $('stam').firstChild.style.width=`${y.stam*100}%`;
    show('energyRow',me.role==='echo');
    if(me.role==='echo'){$('enn').textContent=Math.floor(y.energy);$('energy').firstChild.style.width=`${y.energy}%`;}
    $('inv').innerHTML=`<span>${t('ROUNDS')} <b>${y.ammo}</b></span><span>${t('KIT')} <b>${y.med}</b></span><span>${t('FLARE')} <b>${y.flare}</b></span><span>${t('CELL')} <b>${y.cell}</b></span>`;
    const progress=y.action?.progress;
    let prompt=focused?`E — ${focused.label}`:'';
    if(y.protect>0)prompt=t("Revive protection · offensive actions disabled");
    if(state.extractionOpen&&Math.hypot(me.s.x-EXTRACT.x,me.s.z-EXTRACT.z)<EXTRACT.r)prompt=t('Evacuating · {seconds}/5 s',{seconds:Math.round(y.ext*5)});
    $('prompt').textContent=prompt;show('prompt',Boolean(prompt));
    show('progress',Boolean(progress));if(progress)$('progress').querySelector('i').style.width=`${progress*100}%`;
    contextualHint();
  }

  const shownHints=new Set();
  let lastHint=-30, hintUntil=0;
  function contextualHint(){
    const node=$('match-tip');
    if(!$('tips-enable').checked){node.hidden=true;return;}
    const now=performance.now()/1000;
    if(now<hintUntil)return;
    node.hidden=true;
    if(now-lastHint<28)return;
    const nightSoon=state.phase.startsWith('day')&&state.pt<=60;
    const key=nightSoon?'night-warning':me.st===1?'downed':state.phase==='final'?'final':state.phase==='day1'?(me.role==='echo'?'echo':'first-day'):null;
    if(!key||shownHints.has(key))return;
    shownHints.add(key);lastHint=now;hintUntil=now+9;
    const hints={
      'night-warning':me.role==='echo'&&me.you.energy<50?t("Night is coming. Find blood to reach 50 energy."):t("Night is coming. Prepare a flare and an escape route."),
      downed:t("An ally can revive you. The monster must hold its execution for 2.5 s."),
      final:t("Extraction warms up for 45 s and needs all three transmitters online."),
      echo:t("Absorb blood for 6 s out of sight. Waiting five minutes gives only 36 energy."),
      'first-day':t("You have five minutes before the first hunt. Aim at crates and press E to collect."),
    };
    node.textContent=hints[key];node.hidden=false;
  }

  const voice = createVoice(ambience,
    () => isActive() && Boolean(playing()) && me.st < 2,
    frame => { if (ws?.readyState === 1 && ws.bufferedAmount < 8192) ws.send(frame); },
    id => {
      const v = views.get(id);
      return v && v.seen === state && v.st < 2 ? { x: v.pos.x, y: v.pos.y + (v.st === 1 ? .45 : v.form ? 1.9 : v.cr ? .95 : 1.55), z: v.pos.z } : performance.now()-(voicePositions.get(id)?.heard??-1000)<500?voicePositions.get(id):null;
    },
    nameOf
  );

  function renderRole() {
    if (!me.role) return;
    const panel=$('role'); panel.style.display='block'; panel.className='hud '+me.role;
    panel.innerHTML=me.role==='echo'
      ? `<b>ECHO</b>${t('Stop the signal. Eliminate the Operatives.')}<br>${esc(t('Partner: {name}',{name:nameOf(me.partner)}))}`
      : `<b>${t('OPERATIVE')}</b>${t('Repair the transmitters and evacuate.')}<br>${t('Two of you are no longer human.')}`;
  }
  window.addEventListener('language-change', () => {renderRole();hintUntil=0;lastHint=-30;shownHints.clear();hudAcc=2;hud(playing());});
  connect();
  return { voice, leave, reconnect, setMap, update, lights, act, chat, join, start: () => send({ t: 'start' }), nextSpectate, toggleSandboxNight, toast, me, playing, get state() { return state; }, get joined() { return joined; }, get online() { return online; } };
}
