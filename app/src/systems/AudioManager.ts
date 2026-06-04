// Audio manager - generates all sounds programmatically via Web Audio API
// No external audio files needed

import type { SfxKey } from '../types';

interface WindowWithWebkit extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export class AudioManager {
  muted: boolean;
  sfxVolume: number;
  ctx: AudioContext | null;

  constructor() {
    this.muted = false;
    this.sfxVolume = 0.5;
    this.ctx = null;
    this._initContext();
  }

  _initContext(): void {
    try {
      const W = window as WindowWithWebkit;
      this.ctx = new (W.AudioContext || W.webkitAudioContext!)();
    } catch {
      // Web Audio not supported
    }
  }

  _ensureCtx(): boolean {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // Play a synthesized tone
  _tone(freq: number, duration: number, type: OscillatorType = 'square', vol: number = 0.15, decay: boolean = true): void {
    if (this.muted || !this._ensureCtx()) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol * this.sfxVolume;
    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // Play noise burst (for explosions, hits)
  _noise(duration: number, vol: number = 0.12): void {
    if (this.muted || !this._ensureCtx()) return;
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = vol * this.sfxVolume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Play a frequency-swept tone (pitch glides from→to over the duration) — the
  // building block for zips/whooshes (a needle shot's descending whistle, a
  // stampede's whoomph) that a fixed-pitch _tone can't voice.
  _sweep(fromFreq: number, toFreq: number, duration: number, type: OscillatorType = 'square', vol: number = 0.12): void {
    if (this.muted || !this._ensureCtx()) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(toFreq, ctx.currentTime + duration);
    gain.gain.value = vol * this.sfxVolume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // --- Tier-1 synthesis toolbox (osc → FM → filter → ADSR) ---

  // ADSR-ish amplitude envelope on a gain param: linear attack to peak, then an
  // exponential fall to a `sustain` shelf, then to silence by `dur`. Exponential
  // tails decay the way ears expect (the old single-decay primitives only had
  // this much). `sustain` 0 = a clean percussive pluck.
  _applyEnv(p: AudioParam, t0: number, peak: number, attack: number, dur: number, sustain: number = 0): void {
    const floor = 0.0001;
    const a = Math.min(attack, dur * 0.4);
    p.setValueAtTime(floor, t0);
    p.linearRampToValueAtTime(Math.max(floor, peak), t0 + a);
    if (sustain > 0) {
      p.exponentialRampToValueAtTime(Math.max(floor, peak * sustain), t0 + a + (dur - a) * 0.4);
    }
    p.exponentialRampToValueAtTime(floor, t0 + dur);
  }

  // A full tonal voice: a carrier osc, optional FM modulator (metallic/organic
  // timbres a lone osc can't make), optional pitch glide, optional biquad filter
  // with its own cutoff sweep, and an ADSR. Per-trigger `jitter` nudges pitch +
  // cutoff a few % so repeats (a herd biting) never sound machine-gunned.
  _voice(o: {
    freq: number; freqEnd?: number; type?: OscillatorType; dur: number;
    attack?: number; sustain?: number; vol?: number;
    fmRatio?: number; fmDepth?: number;
    filter?: BiquadFilterType; cutoff?: number; cutoffEnd?: number; q?: number;
    jitter?: number;
  }): void {
    if (this.muted || !this._ensureCtx()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const jit = o.jitter ?? 0;
    const rnd = (amt: number) => 1 + (Math.random() * 2 - 1) * amt;

    const freq = Math.max(20, o.freq * rnd(jit * 0.5));
    const freqEnd = Math.max(20, (o.freqEnd ?? o.freq) * rnd(jit * 0.5));

    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sawtooth';
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + o.dur);

    let mod: OscillatorNode | null = null;
    if (o.fmRatio && o.fmDepth) {
      mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = freq * o.fmRatio;
      const modGain = ctx.createGain();
      modGain.gain.value = o.fmDepth;
      mod.connect(modGain);
      modGain.connect(osc.frequency); // adds deviation to the carrier
    }

    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(Math.max(40, (o.cutoff ?? 2000) * rnd(jit)), t0);
      if (o.cutoffEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutoffEnd * rnd(jit)), t0 + o.dur);
      f.Q.value = o.q ?? 1;
      osc.connect(f);
      node = f;
    }

    const gain = ctx.createGain();
    this._applyEnv(gain.gain, t0, (o.vol ?? 0.12) * this.sfxVolume, o.attack ?? 0.004, o.dur, o.sustain ?? 0);
    node.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
    if (mod) { mod.start(t0); mod.stop(t0 + o.dur + 0.02); }
  }

  // A filtered-noise transient — the "crunch/thud" layer of an impact. Raw white
  // noise is static; a swept bandpass/lowpass turns it into a real hit. ADSR +
  // jitter as above.
  _noiseHit(o: {
    dur: number; vol?: number; attack?: number;
    filter?: BiquadFilterType; cutoff?: number; cutoffEnd?: number; q?: number;
    jitter?: number;
  }): void {
    if (this.muted || !this._ensureCtx()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const jit = o.jitter ?? 0;
    const rnd = (amt: number) => 1 + (Math.random() * 2 - 1) * amt;

    const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1; // flat — the envelope shapes it
    const src = ctx.createBufferSource();
    src.buffer = buf;

    let node: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(Math.max(40, (o.cutoff ?? 1500) * rnd(jit)), t0);
      if (o.cutoffEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutoffEnd * rnd(jit)), t0 + o.dur);
      f.Q.value = o.q ?? 0.8;
      src.connect(f);
      node = f;
    }

    const gain = ctx.createGain();
    this._applyEnv(gain.gain, t0, (o.vol ?? 0.12) * this.sfxVolume, o.attack ?? 0.002, o.dur, 0);
    node.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0); src.stop(t0 + o.dur + 0.02);
  }

  // --- Fitted per-ability SFX ---

  // One synth recipe per ability verb. `pitch` shifts the whole voice by body
  // size (a Chitling bites high, a Matriarch bites deep) so a single recipe
  // fits every caster; `intensity` (0..1) swells signature weight by the herd's
  // cohesion. Unmapped keys are a no-op (callers fall back to category sounds).
  playSfx(key: SfxKey, opts: { pitch?: number; intensity?: number } = {}): void {
    if (this.muted || !this._ensureCtx()) return;
    const p = opts.pitch ?? 1;
    const k = opts.intensity ?? 0;
    switch (key) {
      case 'jaw': // mandible snap — short crunch + a quick high-to-low click
        this._noise(0.03, 0.09);
        this._tone(440 * p, 0.045, 'square', 0.09);
        this._tone(290 * p, 0.05, 'square', 0.05);
        break;
      case 'gore': // TIER-1 re-voice (A/B vs the others' old primitives): a wet,
        // rough chomp — a bandpass-swept noise crunch over an FM sawtooth body
        // that drops in pitch + closes its lowpass, so it "bites" and settles.
        this._noiseHit({ dur: 0.09, filter: 'bandpass', cutoff: 1500 * p, cutoffEnd: 350 * p, q: 1.1, vol: 0.16, jitter: 0.18 });
        this._voice({
          freq: 280 * p, freqEnd: 110 * p, type: 'sawtooth', dur: 0.13,
          fmRatio: 1.5, fmDepth: 220 * p,
          filter: 'lowpass', cutoff: 1700 * p, cutoffEnd: 480 * p, q: 1.2,
          vol: 0.12, attack: 0.003, jitter: 0.22,
        });
        break;
      case 'clack': // hard chitin tok — bright tonal click, almost no noise
        this._noise(0.015, 0.05);
        this._tone(760 * p, 0.035, 'square', 0.10);
        this._tone(560 * p, 0.045, 'square', 0.05);
        break;
      case 'needle': // spine shot — a sharp descending whistle + air hiss
        this._sweep(1600 * p, 720 * p, 0.07, 'square', 0.08);
        this._noise(0.02, 0.04);
        break;
      case 'ram': // head ram — hard impact crunch over a deep thud + sub boom
        this._noise(0.08, 0.16);
        this._tone(115 * p, 0.10, 'sawtooth', 0.14);
        this._tone(70 * p, 0.15, 'square', 0.08);
        break;
      case 'stampede': // herd shockwave — dust rumble + a low whoomph + sub,
        // all swelling with cohesion intensity
        this._noise(0.24 + 0.12 * k, 0.16 + 0.10 * k);
        this._sweep(170, 60, 0.22, 'sawtooth', 0.11 + 0.05 * k);
        this._tone(52, 0.30, 'square', 0.09 + 0.04 * k);
        break;
    }
  }

  // --- Game SFX ---

  spawn(): void {
    this._tone(600, 0.08, 'square', 0.12);
    this._tone(800, 0.06, 'square', 0.08);
  }

  meleeHit(): void {
    this._noise(0.06, 0.15);
    this._tone(200, 0.05, 'sawtooth', 0.08);
  }

  rangedShot(): void {
    this._tone(1200, 0.04, 'square', 0.1);
    this._tone(800, 0.06, 'square', 0.06);
  }

  aoeHit(): void {
    this._noise(0.15, 0.2);
    this._tone(150, 0.12, 'sawtooth', 0.1);
  }

  heal(): void {
    this._tone(523, 0.1, 'sine', 0.1);
    this._tone(659, 0.1, 'sine', 0.08);
    this._tone(784, 0.12, 'sine', 0.06);
  }

  unitDeath(): void {
    this._noise(0.1, 0.12);
    this._tone(120, 0.15, 'sawtooth', 0.1);
  }

  nectarEarn(): void {
    this._tone(1047, 0.04, 'square', 0.06);
    this._tone(1319, 0.06, 'square', 0.05);
  }

  waveStart(): void {
    this._tone(440, 0.15, 'sawtooth', 0.12);
    this._tone(550, 0.12, 'sawtooth', 0.1);
    this._tone(660, 0.1, 'square', 0.08);
  }

  abilityNuke(): void {
    this._noise(0.3, 0.3);
    this._tone(100, 0.2, 'sawtooth', 0.15);
    this._tone(60, 0.3, 'square', 0.1);
  }

  abilityWall(): void {
    this._tone(300, 0.08, 'square', 0.12);
    this._tone(600, 0.12, 'square', 0.1);
    this._tone(900, 0.08, 'sine', 0.06);
  }

  abilitySlow(): void {
    this._tone(400, 0.2, 'sine', 0.1);
    this._tone(350, 0.25, 'sine', 0.08);
  }

  abilityRepair(): void {
    this._tone(440, 0.08, 'sine', 0.1);
    this._tone(554, 0.08, 'sine', 0.08);
    this._tone(659, 0.1, 'sine', 0.07);
  }

  uiClick(): void {
    this._tone(900, 0.03, 'square', 0.08);
  }

  defeat(): void {
    this._tone(300, 0.2, 'sawtooth', 0.12);
    this._tone(200, 0.3, 'sawtooth', 0.1);
    this._tone(120, 0.4, 'sawtooth', 0.08);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }
}
