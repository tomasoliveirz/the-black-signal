import { Vector3 } from 'three';
import { BOXES, LAYOUT, MAP, MAP_ID, height, pathDist } from '../shared/layout.js';

const surfaces = ['soil', 'hard', 'metal', 'snow'];
const samples = [
  ...surfaces.flatMap(surface => [1, 2, 3].map(n => `${surface}-${n}`)),
  'shot', 'empty', 'growl-1', 'growl-2', 'growl-3', 'impact', 'fuse', 'pickup', 'revive',
  'heal', 'extract', 'phase', 'blackout', 'flare', 'generator', 'wind', 'dread', 'forest', 'mire',
];
const levels = {
  shot: [.78, 58], empty: [.45, 9], impact: [.55, 17], fuse: [.52, 13], revive: [.42, 12],
  heal: [.43, 0], pickup: [.32, 0], extract: [.40, 0], phase: [.31, 0], blackout: [.53, 0],
  'growl-1': [.70, 31], 'growl-2': [.62, 25], 'growl-3': [.62, 25],
};
const relative = (origin, target, radius) => Math.hypot(origin.x - target.x, origin.z - target.z) / radius;

export function createAmbience() {
  let context, effects, voices, environment, reverb, loaded = false, elapsed = 0;
  const mix = { effects: .80, voices: .85, environment: .68 };
  const buffers = new Map(), loops = new Map();
  const listener = new Vector3(), forward = new Vector3();
  let playing = 0;

  function wake() {
    if (!globalThis.AudioContext) return;
    if (!context) {
      context = new AudioContext();
      const master = context.createDynamicsCompressor();
      master.threshold.value = -13;
      master.ratio.value = 5;
      master.connect(context.destination);
      effects = context.createGain(); effects.gain.value = mix.effects; effects.connect(master);
      voices = context.createGain(); voices.gain.value = mix.voices; voices.connect(master);
      environment = context.createGain(); environment.gain.value = mix.environment; environment.connect(master);
      reverb = context.createConvolver();
      const impulse = context.createBuffer(2, Math.round(context.sampleRate * .6), context.sampleRate);
      for (let i = 0; i < impulse.numberOfChannels; i++) {
        const channel = impulse.getChannelData(i);
        for (let j = 0; j < channel.length; j++) channel[j] = (Math.random() * 2 - 1) * (1 - j / channel.length) ** 5;
      }
      reverb.buffer = impulse;
      const wet = context.createGain();
      wet.gain.value = .11;
      reverb.connect(wet).connect(effects);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    if (!loaded) {
      loaded = true;
      for (const name of samples) {
        fetch(`./assets/audio/${name}.ogg`).then(response => {
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        }).then(data => context.decodeAudioData(data)).then(buffer => buffers.set(name, buffer))
          .catch(error => console.warn(`Áudio ${name}: ${error.message}`));
      }
    }
    return context;
  }

  function level(bus, value) {
    mix[bus] = value;
    if (!context) return;
    const node = { effects, voices, environment }[bus];
    node.gain.setTargetAtTime(value, context.currentTime, .035);
  }

  function obscured(point) {
    const dx = point.x - listener.x, dz = point.z - listener.z;
    for (const b of BOXES) {
      let enter = .045, exit = .955;
      for (const [start, delta, low, high] of [
        [listener.x, dx, b.x - b.w / 2, b.x + b.w / 2],
        [listener.z, dz, b.z - b.d / 2, b.z + b.d / 2],
      ]) {
        if (Math.abs(delta) < 1e-5) {
          if (start < low || start > high) { enter = 1; break; }
        } else {
          const a = (low - start) / delta, c = (high - start) / delta;
          enter = Math.max(enter, Math.min(a, c));
          exit = Math.min(exit, Math.max(a, c));
        }
      }
      if (enter < exit && listener.y + (point.y - listener.y) * enter < b.gy + b.h) return true;
    }
    return false;
  }

  function emitter(bus, spatial = true, wet = false) {
    const input = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.Q.value = .15; filter.frequency.value = 18000;
    const panner = spatial ? new PannerNode(context, { panningModel: 'HRTF', rolloffFactor: 0 }) : null;
    input.connect(filter);
    const output = panner ? filter.connect(panner) : filter;
    output.connect(bus);
    if (wet) output.connect(reverb);
    return {
      input,
      update(point, radius, volume, initial = false) {
        if (panner && point) {
          const time = context.currentTime;
          for (const [param, value] of [[panner.positionX, point.x], [panner.positionY, point.y], [panner.positionZ, point.z]]) {
            if (initial) param.value = value;
            else param.setTargetAtTime(value, time, .025);
          }
          const distance = relative(listener, point, radius);
          const blocked = volume > 0 && distance < 1 && obscured(point);
          volume *= Math.max(0, 1 - distance ** 1.25) ** 1.35 * (blocked ? .36 : 1);
          if (initial) filter.frequency.value = blocked ? 850 : 15500;
          else filter.frequency.setTargetAtTime(blocked ? 850 : 15500, time, .045);
        }
        if (initial) input.gain.value = volume;
        else input.gain.setTargetAtTime(volume, context.currentTime, .035);
      },
      disconnect() { input.disconnect(); filter.disconnect(); panner?.disconnect(); },
    };
  }

  function cue(name, point, volume = 1, pitch = 1, radius) {
    const buffer = buffers.get(name);
    if (!buffer || context?.state !== 'running' || mix.effects === 0 || playing >= 30) return;
    const [gain, range] = levels[name] ?? [.42, 17];
    const distance = radius ?? range;
    const spatial = Boolean(point && distance);
    if (spatial && relative(listener, point, distance) >= 1) return;
    const routed = emitter(effects, spatial, spatial && (MAP.kind === 'factory' || MAP.kind === 'mesh'));
    routed.update(point, distance, volume * gain, true);
    const source = context.createBufferSource();
    source.buffer = buffer; source.playbackRate.value = pitch;
    source.connect(routed.input); source.start();
    playing++;
    source.onended = () => { playing--; source.disconnect(); routed.disconnect(); };
  }

  function step(event, local) {
    const { x, y, z, gait, sample } = event;
    let surface = 'soil';
    if (MAP.theme.snow) surface = 'snow';
    else if (MAP.kind === 'factory' && Math.abs(x) > 2.6) surface = 'metal';
    else if (MAP.kind === 'factory' || MAP.kind === 'mesh' || (MAP.kind === 'city' && pathDist(x, z) < 6.1)) surface = 'hard';
    const volume = [ .58, .98, 1.23, .85 ][gait];
    const pitch = gait === 2 ? .72 : .92 + sample * .058;
    cue(`${surface}-${sample + 1}`, local ? null : { x, y: y + .08, z }, volume, pitch, [13, 22, 29, 18][gait]);
  }

  function loop(key, name, volume, point, radius) {
    const buffer = buffers.get(name);
    let track = loops.get(key);
    if (!track && volume > 0 && buffer) {
      const node = emitter(environment, Boolean(point));
      const source = context.createBufferSource();
      source.buffer = buffer; source.loop = true;
      source.connect(node.input);
      node.update(point, radius, 0, true);
      source.start(0, buffer.duration * .13);
      track = { node, source };
      loops.set(key, track);
    }
    track?.node.update(point, radius, volume);
  }

  function reset() {
    for (const { node, source } of loops.values()) {
      source.stop(); source.disconnect(); node.disconnect();
    }
    loops.clear();
    elapsed = .1;
  }

  function update(dt, live, night, focus, camera, state) {
    if (!context || context.state !== 'running') return;
    listener.set(focus.x, focus.y + 1.55, focus.z);
    camera.getWorldDirection(forward);
    const time = context.currentTime, ear = context.listener;
    ear.positionX.setValueAtTime(listener.x, time);
    ear.positionY.setValueAtTime(listener.y, time);
    ear.positionZ.setValueAtTime(listener.z, time);
    ear.forwardX.setValueAtTime(forward.x, time);
    ear.forwardY.setValueAtTime(forward.y, time);
    ear.forwardZ.setValueAtTime(forward.z, time);

    elapsed += dt;
    if (elapsed < .10) return;
    elapsed = 0;
    if (!live) { if (loops.size) reset(); return; }
    const indoor = MAP.kind === 'factory' || MAP.kind === 'mesh';
    const wind = { frost: [.24, .17], ashfall: [.14, .13], foundry: [.024, .016], mall: [.018, .013] }[MAP_ID] ?? [.09, .12];
    loop('wind', 'wind', wind[Number(night)]);
    loop('dread', 'dread', night ? .115 : 0);
    loop('forest', 'forest', MAP_ID === 'amberwood' && !night ? .17 : 0);
    loop('mire', 'mire', MAP_ID === 'hollow' ? night ? .047 : .105 : 0);
    for (const tx of LAYOUT.tx) {
      const on = state?.tx[tx.id].on;
      loop(`tx${tx.id}`, 'generator', on ? .24 : 0, { x: tx.x, y: tx.y + .65, z: tx.z }, 16);
    }
    const flares = state?.flares ?? [];
    flares.forEach(([x, z]) => loop(`f${x},${z}`, 'flare', .11, { x, y: height(x, z) + .15, z }, 9));
    for (const [key, { node, source }] of loops) if (key.startsWith('f') && !flares.some(([x, z]) => key === `f${x},${z}`)) {
      source.stop(); source.disconnect(); node.disconnect(); loops.delete(key);
    }
  }

  return { wake, cue, step, level, update, reset, voiceEmitter: () => emitter(voices) };
}
