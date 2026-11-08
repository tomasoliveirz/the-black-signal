import { VOICE_SAMPLES, VOICE_RATE } from '../shared/sim.js';

class ProximityMicrophone extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
    this.index = 0;
    this.frame = new Int16Array(VOICE_SAMPLES);
    this.port.onmessage = ({ data }) => {
      this.active = data;
      this.phase = this.sum = this.count = this.index = 0;
    };
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!this.active || !channel) return true;
    for (const value of channel) {
      this.sum += value;
      this.count++;
      this.phase += VOICE_RATE;
      if (this.phase < sampleRate) continue;
      const mono = Math.max(-1, Math.min(1, this.sum / this.count));
      this.frame[this.index++] = mono * 32767;
      this.phase -= sampleRate;
      this.sum = this.count = 0;
      if (this.index === this.frame.length) {
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = new Int16Array(VOICE_SAMPLES);
        this.index = 0;
      }
    }
    return true;
  }
}

registerProcessor('proximity-microphone', ProximityMicrophone);
