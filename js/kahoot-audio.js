/**
 * ThermoOlyMaster - ThermoKahoot Synthesized Sound Effects Engine
 * Generates dynamic countdown, tick, suspense, fanfare, and answer feedback
 * using the browser's native Web Audio API (zero external assets/network requests).
 */

class KahootAudioEngine {
  constructor() {
    this.ctx = null;
    this.soundEnabled = localStorage.getItem('thermo_kahoot_sound_enabled') !== 'false';
    this.pulseInterval = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('thermo_kahoot_sound_enabled', this.soundEnabled ? 'true' : 'false');
    if (!this.soundEnabled) {
      this.stopCountdownPulse();
    }
    return this.soundEnabled;
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  /**
   * Crisp answer selection pop
   */
  playPop() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Countdown tick blip
   */
  playTick(isUrgent = false) {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = isUrgent ? 'sawtooth' : 'triangle';
    const freq = isUrgent ? 880 : 520;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.06);

    gain.gain.setValueAtTime(isUrgent ? 0.22 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Start rhythmic background tension pulse during question countdown
   */
  startCountdownPulse(urgent = false) {
    if (!this.soundEnabled) return;
    this.stopCountdownPulse();

    const bpm = urgent ? 160 : 120;
    const intervalMs = (60 / bpm) * 1000;

    let beat = 0;
    this.pulseInterval = setInterval(() => {
      const ctx = this.ensureContext();
      if (!ctx || !this.soundEnabled) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      const baseFreq = urgent ? 220 : 150;
      const freq = beat % 2 === 0 ? baseFreq : baseFreq * 1.33;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

      gain.gain.setValueAtTime(urgent ? 0.14 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);

      beat++;
    }, intervalMs);
  }

  stopCountdownPulse() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
  }

  /**
   * Dramatic reveal boom / gong
   */
  playReveal() {
    if (!this.soundEnabled) return;
    this.stopCountdownPulse();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.4);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.46);
  }

  /**
   * Upbeat ascending major chord for correct answer
   */
  playCorrect() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = ctx.currentTime + (idx * 0.07);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  /**
   * Buzzer / thud for wrong answer
   */
  playWrong() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.25);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Sparkle sound for streak bonuses
   */
  playStreak() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [587.33, 739.99, 880, 1174.66, 1479.98]; // D5, F#5, A5, D6, F#6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = ctx.currentTime + (idx * 0.05);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.22);
    });
  }

  /**
   * Triumphal victory fanfare for 1st, 2nd, 3rd place podium
   */
  playFanfare() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Brass triumphal chords: G4 -> C5 -> E5 -> G5
    const chords = [
      { notes: [392.00, 493.88], delay: 0.0, dur: 0.18 }, // G4 + B4
      { notes: [392.00, 493.88], delay: 0.2, dur: 0.18 },
      { notes: [392.00, 493.88], delay: 0.4, dur: 0.18 },
      { notes: [523.25, 659.25, 783.99, 1046.50], delay: 0.65, dur: 0.8 } // C-maj triumphal
    ];

    chords.forEach(chord => {
      chord.notes.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + chord.delay;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + chord.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + chord.dur + 0.05);
      });
    });
  }
}

export const kahootAudio = new KahootAudioEngine();
