/** Lightweight Web Audio SFX — no asset files, tiny footprint. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Call on first user gesture so browsers unlock audio. */
  unlock() {
    this.ensure();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    gain = 0.4,
    slideTo?: number,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, gain = 0.25) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  torchWave() {
    this.tone(220, 0.18, 'sawtooth', 0.18, 140);
    this.noiseBurst(0.2, 0.12);
  }

  noisemaker() {
    this.tone(880, 0.12, 'square', 0.15);
    setTimeout(() => this.tone(660, 0.15, 'square', 0.12), 80);
    setTimeout(() => this.tone(990, 0.1, 'square', 0.1), 160);
  }

  jaguarStalk() {
    this.tone(90, 0.35, 'sine', 0.2, 60);
  }

  jaguarChase() {
    this.tone(140, 0.25, 'sawtooth', 0.22, 90);
  }

  jaguarFlee() {
    this.tone(320, 0.2, 'triangle', 0.18, 520);
    setTimeout(() => this.tone(480, 0.25, 'triangle', 0.12, 700), 90);
  }

  trapWarn() {
    this.tone(180, 0.15, 'square', 0.12);
  }

  death() {
    this.tone(160, 0.4, 'sawtooth', 0.25, 40);
    this.noiseBurst(0.35, 0.2);
  }

  win() {
    this.tone(523, 0.18, 'triangle', 0.2);
    setTimeout(() => this.tone(659, 0.18, 'triangle', 0.18), 140);
    setTimeout(() => this.tone(784, 0.35, 'triangle', 0.22), 280);
  }

  tip() {
    this.tone(640, 0.08, 'sine', 0.1);
  }

  padStep() {
    this.tone(440, 0.1, 'triangle', 0.14);
  }

  puzzleSolved() {
    this.tone(392, 0.12, 'triangle', 0.16);
    setTimeout(() => this.tone(523, 0.14, 'triangle', 0.16), 100);
    setTimeout(() => this.tone(659, 0.28, 'triangle', 0.18), 220);
  }
}
