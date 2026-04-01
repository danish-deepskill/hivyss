// Audio manager - generates all sounds programmatically via Web Audio API
// No external audio files needed

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
