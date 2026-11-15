import { t } from './i18n.js';
import { VOICE_RANGE, VOICE_SAMPLES, VOICE_RATE } from '../shared/sim.js';

const FRAME_BYTES = 4 + VOICE_SAMPLES * 2;
const $ = id => document.getElementById(id);

export function createVoice(audio, canSpeak, send, positionOf, nameOf) {
  const button = $('mic'), status = $('mic-status'), hud = $('voice-hud');
  const channels = new Map(), muted = new Set();
  let context, stream, input, capture, silent, moduleReady;
  let requesting = false, talking = false, listening = true, lastUpdate = 0;
  const listen = $('voice-listen');
  try { listen.checked = localStorage.getItem('bs.voice-listen') !== 'off'; } catch {}
  listening = listen.checked;
  let micHintUntil = 0;
  const supported = isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function';

  if (!supported) {
    button.disabled = true;
    status.textContent = isSecureContext ? t("Microphone unavailable in this browser.") : t("The microphone requires HTTPS outside localhost.");
  }

  function push(pressed) {
    const active = Boolean(pressed && capture && canSpeak() && !document.hidden);
    if (pressed && !capture && supported && !requesting) {
      hud.textContent = t("ENABLE YOUR MICROPHONE IN SETTINGS");
      hud.hidden = false;
      micHintUntil = performance.now() + 1800;
    }
    if (active === talking) return;
    talking = active;
    for (const track of stream?.getAudioTracks() ?? []) track.enabled = active;
    capture?.port.postMessage(active);
    render();
  }

  function release(message = t("Microphone off.")) {
    push(false);
    input?.disconnect();
    capture?.disconnect();
    silent?.disconnect();
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = input = capture = silent = null;
    button.textContent = t("Enable microphone");
    status.textContent = message;
  }

  async function toggle() {
    if (capture) return release();
    if (requesting || !supported) return;
    context = audio.wake();
    if (!context?.audioWorklet) {
      status.textContent = t("Microphone processing is unavailable.");
      return;
    }
    requesting = button.disabled = true;
    status.textContent = t("Waiting for microphone permission…");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const track = stream.getAudioTracks()[0];
      track.enabled = false;
      track.addEventListener('ended', () => release(t("Microphone disconnected by the browser.")));
      moduleReady ??= context.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url)).catch(error => {
        moduleReady = null;
        throw error;
      });
      await moduleReady;
      if (!stream || track.readyState !== 'live') return release(t("Microphone unavailable."));
      input = context.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(context, 'proximity-microphone');
      capture.port.onmessage = ({ data }) => { if (talking && canSpeak()) {const pcm=new Int16Array(data);audio.voiceActivity(Math.sqrt(pcm.reduce((sum,v)=>sum+(v/32768)**2,0)/pcm.length));send(data);} };
      silent = context.createGain();
      silent.gain.value = 0;
      input.connect(capture).connect(silent).connect(context.destination);
      button.textContent = t("Disable microphone");
      status.textContent = t("Microphone ready. Hold Z during the match.");
    } catch (error) {
      release(error.name === 'NotAllowedError' ? t("Permission denied. You can change it in your browser.") : t("Could not open the microphone."));
    } finally {
      requesting = button.disabled = false;
    }
  }

  function receive(packet) {
    if (!listening || !canSpeak() || packet.byteLength !== FRAME_BYTES) return;
    context ??= audio.wake();
    if (context?.state !== 'running') return;
    const id = new DataView(packet).getUint32(0, true);
    if (muted.has(id)) return;
    const point = positionOf(id);
    if (!point) return;
    let channel = channels.get(id);
    if (!channel) {
      channel = { emitter: audio.voiceEmitter(), next: 0, heard: 0, sources: new Set() };
      channel.emitter.update(point, VOICE_RANGE, .96, true);
      channels.set(id, channel);
    }
    const now = context.currentTime;
    if (channel.next > now + .22) return;
    if (channel.next < now + .005) channel.next = now + .095;
    const pcm = new Int16Array(packet, 4);
    const buffer = context.createBuffer(1, pcm.length, VOICE_RATE);
    const output = buffer.getChannelData(0);
    let energy=0;
    for (let i = 0; i < pcm.length; i++) {output[i] = pcm[i] / 32768;energy+=output[i]*output[i];}
    audio.voiceActivity(Math.sqrt(energy/pcm.length));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(channel.emitter.input);
    source.start(channel.next);
    channel.next += buffer.duration;
    channel.heard = now;
    channel.sources.add(source);
    source.onended = () => { channel.sources.delete(source); source.disconnect(); };
  }

  function remove(id, channel) {
    for (const source of channel.sources) { source.stop(); source.disconnect(); }
    channel.emitter.disconnect();
    channels.delete(id);
  }

  function render() {
    const names = [...channels.keys()].map(nameOf).filter(Boolean);
    const text = talking ? t("MICROPHONE LIVE") : names.length ? t('LISTENING · {names}',{names:names.join(', ')}) : performance.now() < micHintUntil ? t("ENABLE YOUR MICROPHONE IN SETTINGS") : '';
    if (hud.textContent !== text) hud.textContent = text;
    hud.hidden = !text;
  }

  function reset() {
    micHintUntil = 0;
    push(false);
    for (const [id, channel] of channels) remove(id, channel);
    render();
  }

  function update() {
    if (!canSpeak()) {
      if (talking || channels.size) reset();
      return;
    }
    const now = performance.now();
    if (now - lastUpdate < 45) return;
    lastUpdate = now;
    for (const [id, channel] of channels) {
      const point = positionOf(id);
      if (!point || context.currentTime - channel.heard > .36) remove(id, channel);
      else channel.emitter.update(point, VOICE_RANGE, .96);
    }
    render();
  }

  addEventListener('voice-mute', ({detail}) => {
    if(detail.muted)muted.add(detail.id);else muted.delete(detail.id);
    const channel=channels.get(detail.id);if(channel)remove(detail.id,channel);
    render();
  });
  window.addEventListener('language-change', () => {
    button.textContent = capture ? t('Disable microphone') : t('Enable microphone');
    status.textContent = !supported ? (isSecureContext ? t('Microphone unavailable in this browser.') : t('The microphone requires HTTPS outside localhost.')) : capture ? t('Microphone ready. Hold Z during the match.') : t('Hold Z to talk. Range: 22 m.');
    render();
  });
  button.addEventListener('click', toggle);
  listen.addEventListener('change', () => {
    listening = listen.checked;
    try { localStorage.setItem('bs.voice-listen', listening ? 'on' : 'off'); } catch {}
    if (!listening) {
      for (const [id, channel] of channels) remove(id, channel);
      render();
    }
  });
  return { push, reset, receive, update, release };
}
