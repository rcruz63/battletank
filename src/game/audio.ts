/**
 * Procedural Web Audio API sound effects for Vector Tank arcade retro feel.
 * Pure Web Audio - zero external MP3 / WAV 404 dependencies.
 * Master Gain architecture with active node tracking to guarantee no sound leaks.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private turretOsc: OscillatorNode | null = null;
  private turretGain: GainNode | null = null;
  private activeTransientOscillators = new Set<OscillatorNode>();

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getDestination(): AudioNode | null {
    this.initContext();
    return this.masterGain || this.ctx?.destination || null;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(mute ? 0 : 0.85, this.ctx.currentTime);
    }
    if (mute) {
      this.stopAll();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Initializes looping vector engine rumble.
   */
  public startEngine() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    // If already running, do not re-create
    if (this.engineOsc) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      // Low pass filter for deep mechanical engine rumble
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.035, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(dest);

      this.engineOsc.start();
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Updates engine pitch based on tank throttle speed.
   */
  public updateEnginePitch(speedRatio: number) {
    if (!this.engineOsc || !this.ctx || this.muted) return;
    try {
      const baseFreq = 40;
      const targetFreq = baseFreq + Math.abs(speedRatio) * 36;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
    } catch {}
  }

  /**
   * Turret servo swivel whine.
   */
  public playTurretWhine(moving: boolean) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    if (!this.turretOsc && moving) {
      try {
        this.turretOsc = this.ctx.createOscillator();
        this.turretGain = this.ctx.createGain();
        this.turretOsc.type = 'triangle';
        this.turretOsc.frequency.setValueAtTime(260, this.ctx.currentTime);
        this.turretGain.gain.setValueAtTime(0.018, this.ctx.currentTime);
        this.turretOsc.connect(this.turretGain);
        this.turretGain.connect(dest);
        this.turretOsc.start();
      } catch {
        // Safe fail
      }
    } else if (this.turretGain) {
      try {
        this.turretGain.gain.setTargetAtTime(moving ? 0.02 : 0, this.ctx.currentTime, 0.05);
      } catch {}
    }
  }

  /**
   * Track transient oscillator so stopAll() can immediately cancel it.
   */
  private trackTransient(osc: OscillatorNode) {
    this.activeTransientOscillators.add(osc);
    osc.onended = () => {
      this.activeTransientOscillators.delete(osc);
    };
  }

  /**
   * Player cannon shot - punchy vector discharge with deep acoustic body.
   */
  public playPlayerFire(isDoubleDamage = false) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;

    try {
      // High snap square wave
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = isDoubleDamage ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(isDoubleDamage ? 280 : 190, t);
      osc.frequency.linearRampToValueAtTime(35, t + 0.18);

      oscGain.gain.setValueAtTime(0.22, t);
      oscGain.gain.linearRampToValueAtTime(0.0001, t + 0.22);

      osc.connect(oscGain);
      oscGain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.23);

      // Deep sub-bass boom
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(95, t);
      subOsc.frequency.linearRampToValueAtTime(28, t + 0.3);

      subGain.gain.setValueAtTime(0.3, t);
      subGain.gain.linearRampToValueAtTime(0.0001, t + 0.32);

      subOsc.connect(subGain);
      subGain.connect(dest);
      this.trackTransient(subOsc);
      subOsc.start(t);
      subOsc.stop(t + 0.33);

      // White noise blast
      this.playNoiseBurst(0.22, 0.14, 300);
    } catch {}
  }

  /**
   * Enemy firing sound.
   */
  public playEnemyFire(isBoss = false) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isBoss ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(isBoss ? 160 : 220, t);
      osc.frequency.linearRampToValueAtTime(45, t + (isBoss ? 0.35 : 0.18));

      gain.gain.setValueAtTime(isBoss ? 0.25 : 0.12, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + (isBoss ? 0.35 : 0.18));

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + (isBoss ? 0.36 : 0.19));

      this.playNoiseBurst(isBoss ? 0.28 : 0.15, isBoss ? 0.18 : 0.08, 400);
    } catch {}
  }

  /**
   * Hit confirmation blip (arcade high chirps).
   */
  public playHitConfirm() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1320, t + 0.04);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.09);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.1);
    } catch {}
  }

  /**
   * Explosion blast for enemy defeat or tank damage.
   */
  public playExplosion(heavy = false) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    const dur = heavy ? 0.55 : 0.32;

    try {
      // Sub rumble
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(heavy ? 90 : 130, t);
      osc.frequency.linearRampToValueAtTime(22, t + dur);

      gain.gain.setValueAtTime(heavy ? 0.32 : 0.18, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + dur + 0.02);

      this.playNoiseBurst(dur, heavy ? 0.26 : 0.15, heavy ? 450 : 750);
    } catch {}
  }

  /**
   * Terrain dirt/crater impact sound.
   */
  public playTerrainHit() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(75, t);
      osc.frequency.linearRampToValueAtTime(25, t + 0.14);

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.14);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.15);

      this.playNoiseBurst(0.12, 0.09, 250);
    } catch {}
  }

  /**
   * Power-up pickup chime (rising arpeggio).
   */
  public playPowerUp() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const freqs = [330, 440, 554, 659, 880];
    freqs.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.05;
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.11);

        osc.connect(gain);
        gain.connect(dest);
        this.trackTransient(osc);
        osc.start(t);
        osc.stop(t + 0.12);
      } catch {}
    });
  }

  /**
   * Ambient pulsing chime played gently while inside a Repair Station.
   */
  public playRepairHum() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.18); // E5

      gain.gain.setValueAtTime(0.06, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.22);
    } catch {}
  }

  /**
   * Health pack / Repair kit instant recovery chime.
   */
  public playRepairKit() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const freqs = [440, 554.37, 659.25, 880];
    freqs.forEach((f, idx) => {
      const t = this.ctx!.currentTime + idx * 0.06;
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.15);

        osc.connect(gain);
        gain.connect(dest);
        this.trackTransient(osc);
        osc.start(t);
        osc.stop(t + 0.16);
      } catch {}
    });
  }

  /**
   * Fast scout alert sound (high vector radar ping).
   */
  public playScoutAlert() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.linearRampToValueAtTime(1400, t + 0.15);

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.17);
    } catch {}
  }

  /**
   * Boss appearance telegraph (ominous deep synth horn).
   */
  public playBossTelegraph() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, t);
      osc.frequency.linearRampToValueAtTime(55, t + 0.7);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.7);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.72);
    } catch {}
  }

  /**
   * Reload Ready chirp.
   */
  public playReloadReady() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.linearRampToValueAtTime(400, t + 0.18);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      this.trackTransient(osc);
      osc.start(t);
      osc.stop(t + 0.21);
    } catch {}
  }

  /**
   * Victory Fanfare.
   */
  public playVictory() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const notes = [
      { f: 440, d: 0.12, offset: 0 },
      { f: 554, d: 0.12, offset: 0.14 },
      { f: 659, d: 0.12, offset: 0.28 },
      { f: 880, d: 0.45, offset: 0.42 },
    ];

    notes.forEach((n) => {
      const t = this.ctx!.currentTime + n.offset;
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, t);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + n.d);

        osc.connect(gain);
        gain.connect(dest);
        this.trackTransient(osc);
        osc.start(t);
        osc.stop(t + n.d + 0.02);
      } catch {}
    });
  }

  /**
   * Defeat Sting.
   */
  public playDefeat() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    const notes = [
      { f: 330, d: 0.18, offset: 0 },
      { f: 311, d: 0.18, offset: 0.2 },
      { f: 293, d: 0.2, offset: 0.4 },
      { f: 220, d: 0.55, offset: 0.65 },
    ];

    notes.forEach((n) => {
      const t = this.ctx!.currentTime + n.offset;
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, t);

        gain.gain.setValueAtTime(0.16, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + n.d);

        osc.connect(gain);
        gain.connect(dest);
        this.trackTransient(osc);
        osc.start(t);
        osc.stop(t + n.d + 0.02);
      } catch {}
    });
  }

  private playNoiseBurst(duration: number, volume: number, cutoff: number) {
    if (!this.ctx) return;
    const dest = this.getDestination();
    if (!dest) return;

    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + duration + 0.02);
    } catch {
      // Audio buffer safe fail
    }
  }

  public stopEngine() {
    if (this.engineGain) {
      try {
        this.engineGain.gain.cancelScheduledValues(0);
        this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
        this.engineGain.disconnect();
      } catch {}
      this.engineGain = null;
    }
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
  }

  public stopTurret() {
    if (this.turretGain) {
      try {
        this.turretGain.gain.cancelScheduledValues(0);
        this.turretGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
        this.turretGain.disconnect();
      } catch {}
      this.turretGain = null;
    }
    if (this.turretOsc) {
      try {
        this.turretOsc.stop();
        this.turretOsc.disconnect();
      } catch {}
      this.turretOsc = null;
    }
  }

  /**
   * Completely silences all audio, loops, and transient oscillators.
   * Guarantees zero residual hum or stuck sounds on defeat / game over / pause.
   */
  public stopAll() {
    this.stopEngine();
    this.stopTurret();

    // Kill all active transient nodes
    for (const osc of this.activeTransientOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.activeTransientOscillators.clear();

    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(0);
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime);
      } catch {}
    }
  }
}

export const sound = new SoundManager();
