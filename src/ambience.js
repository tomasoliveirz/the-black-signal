import { Vector3 } from 'three';
import { obstacle } from '../shared/sight.js';
import { createAudioDirector } from './audio-director.js';
import { LAYOUT, MAP, MAP_ID, height, pathDist } from '../shared/layout.js';

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
  let context, effects, voices, environment, music, reverb, loaded = false, elapsed = 0, voiceUntil=0, criticalUntil=0;
  const director=createAudioDirector();
  const mix = { effects: .80, voices: .85, environment: .68, music:.35 };
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
      const limiter=context.createWaveShaper(),curve=new Float32Array(2049);
      for(let i=0;i<curve.length;i++){
        const x=i/(curve.length-1)*2-1,absolute=Math.abs(x);
        curve[i]=absolute<=.76?x:Math.sign(x)*(.76+.18*Math.tanh((absolute-.76)/.18));
      }
      limiter.curve=curve;limiter.oversample='none';
      master.connect(limiter).connect(context.destination);
      effects = context.createGain(); effects.gain.value = mix.effects; effects.connect(master);
      voices = context.createGain(); voices.gain.value = mix.voices; voices.connect(master);
      environment = context.createGain(); environment.gain.value = mix.environment; environment.connect(master);
      music=context.createGain();music.gain.value=mix.music;music.connect(master);
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
    if(!Object.hasOwn(mix,bus))return;
    value=Math.max(0,Math.min(1,Number(value)||0));mix[bus] = value;
    if (!context) return;
    const node = { effects, voices, environment, music }[bus];
    node.gain.setTargetAtTime(value, context.currentTime, .035);
  }

  function obscured(point) {return obstacle(listener,point,true,true)<.955;}

  function voiceActivity(rms){if(context&&rms>.012)voiceUntil=context.currentTime+.24;}

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
      update(point, radius, volume, initial = false, fade = .035) {
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
        else input.gain.setTargetAtTime(volume, context.currentTime, fade);
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
    if(name==='shot'||name.startsWith('growl-')||/^(soil|hard|metal|snow)-/.test(name)||name==='impact')criticalUntil=context.currentTime+.45;
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

  function loop(key, name, volume, point, radius, bus=environment, rate=1) {
    const buffer = buffers.get(name);
    let track = loops.get(key);
    if (!track && volume > 0 && buffer) {
      const node = emitter(bus, Boolean(point));
      const source = context.createBufferSource();
      source.buffer = buffer; source.loop = true;source.playbackRate.value=rate;
      source.connect(node.input);
      node.update(point, radius, 0, true);
      source.start(0, buffer.duration * .13);
      track = { node, source };
      loops.set(key, track);
    }
    track?.node.update(point, radius, volume, false, key==='score'?.7:.035);
    track?.source.playbackRate.setTargetAtTime(rate,context.currentTime,.3);
  }

  function stopLoop({node,source}){
    const time=context.currentTime;
    node.input.gain.cancelScheduledValues(time);node.input.gain.setTargetAtTime(0,time,.035);
    source.stop(time+.25);source.onended=()=>{source.disconnect();node.disconnect();};
  }

  function reset() {
    for (const track of loops.values()) stopLoop(track);
    loops.clear();
    elapsed = .1;voiceUntil=criticalUntil=0;director.reset();
  }

  function update(dt, live, night, focus, camera, state, me) {
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

    const talking=context.currentTime<voiceUntil,critical=context.currentTime<criticalUntil;
    music.gain.setTargetAtTime(mix.music*(talking?.28:critical?.55:1),time,(talking||critical)?.08:.45);
    environment.gain.setTargetAtTime(mix.environment*(talking?.65:1),time,talking?.08:.4);
    elapsed += dt;
    if (elapsed < .10) return;
    const stepTime=elapsed;elapsed = 0;
    if (!live) { if (loops.size) reset(); return; }
    const indoor = MAP.kind === 'factory' || MAP.kind === 'mesh';
    const wind = { frost: [.24, .17], ashfall: [.14, .13], foundry: [.024, .016], mall: [.018, .013] }[MAP_ID] ?? [.09, .12];
    loop('wind', 'wind', wind[Number(night)]);
    const plan=director.update(stepTime,{state,focus,me,night});
    loop('score','dread',plan.volume,null,0,music,plan.rate);
    loop('forest', 'forest', MAP_ID === 'amberwood' && !night ? .17 : 0);
    loop('mire', 'mire', MAP_ID === 'hollow' ? night ? .047 : .105 : 0);
    for (const tx of LAYOUT.tx) {
      const on = state?.tx[tx.id].on;
      loop(`tx${tx.id}`, 'generator', on ? .24 : 0, { x: tx.x, y: tx.y + .65, z: tx.z }, 16);
    }
    const flares = state?.flares ?? [];
    flares.forEach(([x, z]) => loop(`f${x},${z}`, 'flare', .11, { x, y: height(x, z) + .15, z }, 9));
    for (const [key, { node, source }] of loops) if (key.startsWith('f') && !flares.some(([x, z]) => key === `f${x},${z}`)) {
      stopLoop({node,source});loops.delete(key);
    }
  }

  return { wake, cue, step, level, update, reset, voiceActivity, event:director.event, get directorState(){return director.state}, voiceEmitter: () => emitter(voices) };
}
