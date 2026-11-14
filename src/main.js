import { t } from './i18n.js';
import * as THREE from 'three';
import { uniforms, updateUnder, setStyle, isNormal, applyTheme, NLIGHTS, SUN } from './paint.js';
import { buildWorld, buildSky } from './world.js';
import { createGame } from './game.js';
import { createMenu } from './menu.js';
import { createAmbience } from './ambience.js';
import { createAccount } from './account.js';
import { createRooms } from './rooms.js';
import { createLobbyAudio } from './lobby-audio.js';
import { height, setMap, MAP, MAP_ID, MAPS, BOXES } from '../shared/layout.js';
import '../shared/maps/index.js';

THREE.ColorManagement.enabled = false; // palette colours are authored directly in display space

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const qp = new URLSearchParams(location.search);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9c48e, 18, 150);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 900);

// ---------- lighting for the normal style (paint style lights its own dabs)
const sun = new THREE.DirectionalLight(0xffe2b8, 2.3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 180 });
const hemi = new THREE.HemisphereLight(0xbcd4f0, 0x7a6038, 1.15);
scene.add(sun, sun.target, hemi);
const points = Array.from({ length: NLIGHTS }, () => { const l = new THREE.PointLight(0xffb060, 0, 10, 1.2); scene.add(l); return l; });

buildSky(scene);
const world = {};
setMap(qp.get('map') || 'amberwood'); applyTheme(MAP.theme);
Object.assign(world, buildWorld(scene));
const keys = new Set();
const view = { yaw: 2.6, pitch: 0.22, dist: 4.4 };
function changeMap(id) { // tear the world down and build the other environment
  if (id === MAP_ID || !MAPS[id]) return;
  ambience.reset();
  world.dispose(); setMap(id); applyTheme(MAP.theme);
  Object.assign(world, buildWorld(scene));
  setQuality(quality);
}
const ambience = createAmbience();
const lobbyAudio=createLobbyAudio(ambience);
const game = createGame({
  scene, world, view, keys, changeMap, ambience, camera, isActive: () => active,
  menu: {
    connection: status => menu.connection(status),
    joined: () => menu.joined(),
    lobby: message => { menu.lobby(message); roomUI.lobby(message); },
    matchStart: () => menu.matchStart(),
    matchEnd: result => menu.matchEnd(result),
    roomOptions: () => roomUI.options(),
    roomJoined: message => roomUI.joined(message),
    roomLeft: () => roomUI.clear(),
  },
});

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- settings
let quality = 3, active = false;
const QUALITY = [0.25, 0.5, 0.75, 1], QNAME = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
function setQuality(q) {
  quality = q; const f = QUALITY[q];
  $('quality').value = q;
  for (const m of world.meshes) if (!m.userData.fixed) m.geometry.instanceCount = Math.floor(m.userData.fullCount * f);
  uniforms.uSizeMul.value = 1 / Math.sqrt(f);
  sun.shadow.mapSize.setScalar(q >= 2 ? 2048 : 1024); sun.shadow.map?.dispose(); sun.shadow.map = null;
  renderer.setPixelRatio(Math.min(devicePixelRatio, q === 0 ? 1 : 1.5));
}
function applyStyle(normal) {
  setStyle(normal);
  sun.castShadow = normal;
  $('visual').value = normal ? 'normal' : 'paint';
  try { localStorage.setItem('bs.style', normal ? 'normal' : 'paint'); } catch {}
}

// ---------- input
const menuScreen = $('menu'), chatBox = $('chat');
function lockPointer() {
  try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {}
}
function enter(lock) {
  active = true;
  menuScreen.hidden = true;
  document.body.classList.remove('menu-open');
  if (lock) {
    ambience.wake();
    lockPointer();
  }
}
function openMenu() {
  active = false;
  game.voice.reset();
  keys.clear();
  chatBox.style.display = 'none';
  chatBox.blur();
  menuScreen.hidden = false;
  document.body.classList.add('menu-open');
  document.exitPointerLock?.();
}
const menu = createMenu({ game, enter, openMenu, applyStyle, setQuality });
const roomUI = createRooms(game,openMenu);
let identityReady=false;
createAccount(() => {
  if(identityReady) { game.reconnect(); openMenu(); }
  identityReady=true;
});
for (const bus of ['effects', 'voices', 'environment']) {
  const slider = $('volume-' + bus);
  try {
    const saved = localStorage.getItem('bs.volume.' + bus);
    if (saved !== null && Number.isFinite(+saved)) slider.value = saved;
    else if (bus === 'environment' && localStorage.getItem('bs.ambience') === 'off') slider.value = 0;
  } catch {}
  ambience.level(bus, Number(slider.value) / 100);
  slider.addEventListener('input', () => {
    ambience.level(bus, Number(slider.value) / 100);
    try { localStorage.setItem('bs.volume.' + bus, slider.value); } catch {}
  });
}
$('play').addEventListener('click', ambience.wake);
canvas.addEventListener('mousedown', (e) => {
  if (!active || e.button !== 0) return;
  if (document.pointerLockElement !== canvas) { ambience.wake(); lockPointer(); return; }
  if (game.me.st >= 2 || game.me.spectator) game.nextSpectate(); else game.act('primary', camera);
});
addEventListener('keydown', (e) => {
  if (document.activeElement === chatBox) {
    if (e.code === 'Enter') { if (chatBox.value.trim()) game.chat(chatBox.value, chatBox.dataset.ch); chatBox.value = ''; chatBox.style.display = 'none'; chatBox.blur(); }
    else if (e.code === 'Escape') { chatBox.value = ''; chatBox.style.display = 'none'; chatBox.blur(); }
    return;
  }
  if (e.target instanceof HTMLElement && e.target.matches('input, select')) return;
  keys.add(e.code);
  if (e.code === 'Escape' && active) return openMenu();
  if (!e.repeat && e.code === 'KeyV') applyStyle(!isNormal());
  if (!e.repeat && /^Digit[1-4]$/.test(e.code)) setQuality(+e.code[5] - 1);
  if (!active) return;
  if (e.code === 'KeyZ' && !e.repeat) { ambience.wake(); game.voice.push(true); }
  if (e.code === 'KeyB') game.toggleSandboxNight();
  if (e.code === 'KeyQ') game.act('heal');
  if (e.code === 'KeyG') game.act('flare');
  if (e.code === 'KeyF' && !e.repeat) game.act('transform');
  if (e.code === 'KeyR' && !e.repeat) game.act('drop');
  if ((e.code === 'Enter' || (e.code === 'KeyT' && game.me.role === 'echo')) && game.joined) {
    game.voice.push(false);
    chatBox.dataset.ch = e.code === 'KeyT' ? 'echo' : 'prox';
    chatBox.placeholder = e.code === 'KeyT' ? t("Private Echo channel (only your partner can read)") : t("Proximity text chat (up to 22 m)");
    chatBox.style.display = 'block'; chatBox.focus(); keys.clear(); e.preventDefault();
  }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (e.code === 'KeyZ') game.voice.push(false);
});
addEventListener('blur', () => { keys.clear(); game.voice.reset(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.voice.reset(); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas && !(e.buttons & 2 && active)) return;
  view.yaw -= e.movementX * 0.0026; view.pitch = THREE.MathUtils.clamp(view.pitch + e.movementY * 0.0022, -0.6, 1.2);
});
addEventListener('wheel', (e) => { if (!active) return; view.dist = THREE.MathUtils.clamp(view.dist + Math.sign(e.deltaY) * 0.4, 2.2, 7.5); });
canvas.addEventListener('contextmenu', (e) => { if (active) e.preventDefault(); });

// ---------- frame loop
const clock = new THREE.Clock();
const fogC = new THREE.Color(), camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(), lightList = [];
const sunDay = new THREE.Color(0xffead1), sunNight = new THREE.Color(0xa0bedf);
const hemiDay = new THREE.Color(0xd4dcdf), hemiNight = new THREE.Color(0x5b769f);
const tDay = new THREE.Color(1, 1, 1), tNight = new THREE.Color(.37,.47,.63);
const moon = new THREE.Vector3(-.49,.51,.43).normalize();
const stats = { acc: 0, n: 0, worst: 0 };
let autoStart = false, camReach = 1;

function frame() {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), elapsed = clock.elapsedTime, u = uniforms;
  if (autoStart && game.online) { autoStart = false; game.join('Tester'); setTimeout(() => game.start(), 300); enter(false); }
  const g = game.update(dt, elapsed, active);
  lobbyAudio.update(!game.state||game.state.phase==='lobby'||game.state.phase==='end');
  u.uTime.value = elapsed;
  u.uNight.value += (Math.max(g.night, MAP.theme.minNight ?? 0) - u.uNight.value) * (1 - Math.exp(-1.6 * dt));
  const night = u.uNight.value, normal = isNormal();
  u.uSun.value.copy(SUN).lerp(moon, night).normalize();

  // camera: over-the-shoulder orbit around the focus
  const preview = !active && !game.state;
  const yaw = preview ? 0.14 + Math.sin(elapsed * 0.22) * 0.18 : view.yaw;
  const pitch = preview ? 0.21 : view.pitch;
  const distance = preview ? 6.2 : view.dist;
  const big = g.focusForm ? 1.35 : 1;
  camTarget.set(g.focus.x, g.focus.y + 1.45 * big, g.focus.z);
  const cp = Math.cos(pitch), sx = Math.cos(yaw) * 0.55, sz = -Math.sin(yaw) * 0.55;
  camPos.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(distance * big);
  let reach = 1; // pull the camera in front of any wall between it and the player
  scan: for (let k = 2; k <= 12; k++) {
    const f = k / 12, x = camTarget.x + sx * f + camPos.x * f, y = camTarget.y + camPos.y * f, z = camTarget.z + sz * f + camPos.z * f;
    for (const b of BOXES) if (Math.abs(x - b.x) < b.w / 2 + 0.25 && Math.abs(z - b.z) < b.d / 2 + 0.25 && y < b.gy + b.h + 0.3) { reach = Math.max(0.12, (k - 1.2) / 12); break scan; }
  }
  camReach += (reach - camReach) * Math.min(1, dt * (reach < camReach ? 30 : 5));
  camPos.multiplyScalar(camReach).add(camTarget);
  camPos.x += sx * camReach; camPos.z += sz * camReach;
  camPos.y = Math.max(camPos.y, height(camPos.x, camPos.z) + 0.35);
  camera.position.copy(camPos); camera.lookAt(camTarget.x + sx, camTarget.y, camTarget.z + sz);

  // lights: nearest eight of carried lanterns, flares and (while powered) path lanterns
  lightList.length = 0; game.lights(lightList);
  if (night < 0.6) for (const p of world.powerLights) lightList.push({ p, r: 10 * (1 - night), c: 0xffb060 });
  for (const source of world.practicals) if (source.r > 2) lightList.push(source);
  lightList.sort((a, b) => a.p.distanceToSquared(camPos) - b.p.distanceToSquared(camPos));
  const flick = 1 + Math.sin(elapsed * 11) * 0.03 + Math.sin(elapsed * 23.7) * 0.02;
  for (let i = 0; i < NLIGHTS; i++) {
    const l = lightList[i], pl = points[i];
    if (l) { u.uLights.value[i].set(l.p.x, l.p.y, l.p.z, l.r * flick); pl.position.copy(l.p); pl.color.set(l.c); pl.distance = l.r * 1.5; pl.intensity = normal ? (0.8 + 4.2 * night) * flick : 0; }
    else { u.uLights.value[i].set(0, -999, 0, 1); pl.intensity = 0; }
  }
  u.uBlob.value.copy(g.focus);

  fogC.copy(u.uFogDay.value).lerp(u.uFogNight.value, night);
  scene.fog.color.copy(fogC);
  const [fogNear, fogFar] = MAP.theme.fog ?? [18, 150];
  const sheltered = MAP.kind === 'factory' || MAP.kind === 'mesh';
  ambience.update(dt, active && (Boolean(game.state) || !game.joined), Boolean(g.night), g.focus, camera, game.state);
  u.uFog.value.set(fogNear * (1 - night * .23), fogFar * (1 - night * (sheltered ? .27 : .37)));
  scene.fog.near = u.uFog.value.x; scene.fog.far = u.uFog.value.y;
  updateUnder(night);
  world.terrainPaint.color.copy(tDay).lerp(tNight, night);
  world.update(dt, elapsed, night, game.state && game.state.phase !== 'lobby' ? game.state : null);
  if (normal) {
    sun.color.copy(sunDay).lerp(sunNight, night);
    sun.intensity = (sheltered ? 1.62 : 1.98) - .92 * night;
    hemi.color.copy(hemiDay).lerp(hemiNight, night);
    hemi.intensity = .98 - .48 * night;
    sun.target.position.set(Math.round(g.focus.x), g.focus.y, Math.round(g.focus.z));
    sun.position.copy(sun.target.position).addScaledVector(u.uSun.value, 80);
  }

  renderer.render(scene, camera);

  stats.acc += raw; stats.n++; stats.worst = Math.max(stats.worst, raw);
  if (stats.acc >= 0.5) {
    const drawn = world.meshes.reduce((s, m) => s + (m.visible ? m.geometry.instanceCount : 0), 0);
    $('stats').textContent = `FPS ${(stats.n / stats.acc).toFixed(0).padStart(3)}  ${(stats.acc / stats.n * 1000).toFixed(1)} ms  ${t('WORST')} ${(stats.worst * 1000).toFixed(0)} ms\n${normal ? 'NORMAL' : t('PAINTERLY')} · ${t(QNAME[quality])} · ${drawn.toLocaleString(document.documentElement.lang)} ${t('instances')} · ${renderer.info.render.calls} draw calls`;
    stats.acc = 0; stats.n = 0; stats.worst = 0;
  }
  requestAnimationFrame(frame);
}

// debug/benchmark URL params: ?auto (join + start with bots) &style=paint|normal &night &yaw= &pitch= &dist= &q=
let style = 'normal'; try { style = localStorage.getItem('bs.style') || 'normal'; } catch {}
applyStyle((qp.get('style') || style) !== 'paint');
setQuality(qp.has('q') ? +qp.get('q') : 3);
if (qp.has('auto')) autoStart = true;
if (qp.has('free')) enter(false);
if (qp.has('night')) game.toggleSandboxNight();
if (qp.has('yaw')) view.yaw = +qp.get('yaw');
if (qp.has('pitch')) view.pitch = +qp.get('pitch');
if (qp.has('dist')) view.dist = +qp.get('dist');
if (qp.has('px')) { game.me.s.x = +qp.get('px'); game.me.s.z = +qp.get('pz'); game.me.s.y = height(game.me.s.x, game.me.s.z); }
window.__bs = { game, view, keys, setQuality, applyStyle, camera, world, renderer };
if (qp.has('knocker')) { // debug: stand a Knocker next to the player
  const { buildEcho } = await import('./figures.js');
  const k = buildEcho(scene), x = game.me.s.x + (qp.has('kclose') ? 1.3 : 2.2), z = game.me.s.z + (qp.has('kclose') ? 0.4 : 3.5);
  k.root.position.set(x, height(x, z), z); k.root.rotation.y = +qp.get('knocker') || 0;
  setInterval(() => k.update(1 / 60, qp.has('krun') ? 6 : 0, qp.has('katk') ? 0.8 : 0), 16);
}
if (qp.has('chars')) { // debug: line up the six survivors next to the player
  const { buildPlayer } = await import('./figures.js');
  for (let i = 0; i < 6; i++) {
    const f = buildPlayer(scene, i), x = game.me.s.x - 3 + i * 1.2, z = game.me.s.z + 3;
    f.root.position.set(x, height(x, z), z); f.root.rotation.y = +qp.get('chars') || 0;
    setInterval(() => f.update(1 / 60, i % 3 === 1 ? 4 : 0, true, 0, i === 5, 0, i === 3), 16);
  }
}
requestAnimationFrame(frame);
