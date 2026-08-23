// ==========================================================
// Market World - sound.
//
// Every sound in the game is generated at runtime with the Web Audio
// API: no audio files, nothing to download, and each location gets its
// own key, tempo and instrument colour for its background music.
// ==========================================================

const SCALES = {
  major: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 11],
  dorian: [0, 2, 3, 5, 7, 9]
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.timer = null;
    this.step = 0;
    this.theme = null;
  }

  /** Browsers only allow audio after a gesture, so this is called on first tap. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.5 : 0;
    this.sfxGain.connect(this.master);
    if (this.theme) this.playTheme(this.theme);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.16 : 0;
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.5 : 0;
  }

  tone({ freq = 440, dur = 0.16, type = 'sine', gain = 0.3, attack = 0.008, slide = 0, delay = 0, bus = null }) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq + slide), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(bus || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.2, filter = 1200, delay = 0, sweep = 0 }) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(filter, t0);
    if (sweep) bp.frequency.exponentialRampToValueAtTime(Math.max(80, filter + sweep), t0 + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(env); env.connect(this.sfxGain);
    src.start(t0);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone({ freq: 620, dur: 0.06, type: 'triangle', gain: 0.16 }); break;
      case 'plant':
        this.noise({ dur: 0.16, gain: 0.16, filter: 700, sweep: -400 });
        this.tone({ freq: 300, dur: 0.12, type: 'sine', gain: 0.14, slide: 90 });
        break;
      case 'water':
        this.noise({ dur: 0.42, gain: 0.14, filter: 2600, sweep: -1600 });
        break;
      case 'harvest':
        this.tone({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.22, slide: 260 });
        this.tone({ freq: 780, dur: 0.12, type: 'sine', gain: 0.18, delay: 0.06 });
        break;
      case 'pickup': this.tone({ freq: 700, dur: 0.07, type: 'square', gain: 0.1, slide: 220 }); break;
      case 'stock':
        this.tone({ freq: 240, dur: 0.09, type: 'square', gain: 0.12 });
        this.noise({ dur: 0.1, gain: 0.1, filter: 1500 });
        break;
      case 'coin':
        this.tone({ freq: 1180, dur: 0.09, type: 'triangle', gain: 0.2 });
        this.tone({ freq: 1560, dur: 0.14, type: 'triangle', gain: 0.16, delay: 0.05 });
        break;
      case 'checkout':
        this.tone({ freq: 1720, dur: 0.06, type: 'square', gain: 0.14 });
        this.tone({ freq: 1180, dur: 0.1, type: 'sine', gain: 0.14, delay: 0.05 });
        break;
      case 'customer': this.tone({ freq: 520, dur: 0.13, type: 'sine', gain: 0.1, slide: 180 }); break;
      case 'machine':
        this.tone({ freq: 130, dur: 0.35, type: 'sawtooth', gain: 0.1, slide: 40 });
        this.noise({ dur: 0.3, gain: 0.06, filter: 500 });
        break;
      case 'upgrade':
        [0, 4, 7, 12].forEach((s, i) => this.tone({
          freq: 330 * Math.pow(2, s / 12), dur: 0.24, type: 'triangle', gain: 0.16, delay: i * 0.07
        }));
        break;
      case 'levelup':
        [0, 5, 9, 12, 16].forEach((s, i) => this.tone({
          freq: 392 * Math.pow(2, s / 12), dur: 0.3, type: 'sine', gain: 0.18, delay: i * 0.08
        }));
        break;
      case 'unlock':
        [0, 7, 12, 19].forEach((s, i) => this.tone({
          freq: 262 * Math.pow(2, s / 12), dur: 0.5, type: 'triangle', gain: 0.16, delay: i * 0.12
        }));
        this.noise({ dur: 0.7, gain: 0.07, filter: 3000, sweep: -2400, delay: 0.1 });
        break;
      case 'campaign':
        this.tone({ freq: 440, dur: 0.5, type: 'sawtooth', gain: 0.1, slide: 320 });
        this.tone({ freq: 660, dur: 0.4, type: 'square', gain: 0.07, delay: 0.12 });
        break;
      case 'reward':
        [0, 4, 7].forEach((s, i) => this.tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.35, type: 'sine', gain: 0.16, delay: i * 0.06 }));
        break;
      case 'error': this.tone({ freq: 210, dur: 0.18, type: 'sawtooth', gain: 0.13, slide: -70 }); break;
      case 'build':
        this.noise({ dur: 0.5, gain: 0.14, filter: 900, sweep: 600 });
        this.tone({ freq: 90, dur: 0.4, type: 'square', gain: 0.12 });
        break;
      case 'truck':
        this.tone({ freq: 110, dur: 0.6, type: 'sawtooth', gain: 0.08, slide: 30 });
        break;
      default: break;
    }
  }

  /** theme: { root, scale, tempo, wave, sub } - each location supplies its own. */
  playTheme(theme) {
    this.theme = theme;
    if (!this.ctx) return;
    if (this.timer) clearInterval(this.timer);
    this.step = 0;
    const beat = 60000 / (theme.tempo || 96) / 2;
    this.timer = setInterval(() => this.musicStep(), beat);
  }

  stopTheme() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  musicStep() {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    const theme = this.theme;
    const scale = SCALES[theme.scale] || SCALES.major;
    const s = this.step;
    const bar = Math.floor(s / 8) % 4;
    const chordRoots = [0, 5, 3, 7];
    const chord = chordRoots[bar];
    const t = this.ctx.currentTime;
    const voice = (semis, dur, gain, type, delay = 0) => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 2200;
      osc.type = type;
      osc.frequency.value = theme.root * Math.pow(2, semis / 12);
      env.gain.setValueAtTime(0.0001, t + delay);
      env.gain.exponentialRampToValueAtTime(gain, t + delay + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      osc.connect(filt); filt.connect(env); env.connect(this.musicGain);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.05);
    };
    // Bass on the down beat, an arpeggio riding on top of it.
    if (s % 4 === 0) voice(chord - 12, 0.55, 0.5, theme.sub || 'sine');
    const note = scale[(s * 3 + bar) % scale.length] + chord + (s % 8 === 6 ? 12 : 0);
    voice(note, 0.4, 0.22, theme.wave || 'triangle');
    if (s % 8 === 4) voice(note + 7, 0.3, 0.12, 'sine', 0.06);
    this.step = (s + 1) % 32;
  }

  destroy() {
    this.stopTheme();
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}
