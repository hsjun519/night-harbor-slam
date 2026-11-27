// All sound is synthesised with WebAudio: hits, slams, ropes, bell, crowd and an original chiptune soundtrack.
const NOTE = n => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) return 0; const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (base + (+m[3] + 1) * 12 - 69) / 12); };
const CHORD = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14], sus: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14] };
const midiF = n => 440 * Math.pow(2, (n - 69) / 12);
const rootMidi = r => { const m = /^([A-G])(#|b)?$/.exec(r); return 48 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };

/* Tracks: bpm, swing, chords (one per bar, 'Root:quality'), lead (16 steps per bar, note or '.' or '-' to hold),
   bass pattern over chord tones, drums (k kick, s snare, h hat, o open hat per 16 steps). All original. */
export const TRACKS = {
  title: { bpm: 92, chords: ['A:m9', 'F:M7', 'C:add9', 'G:sus', 'A:m9', 'F:M7', 'D:m7', 'E:7'], lead: ['E5 - - . A5 - G5 . E5 - D5 . C5 - . .', 'A4 - - . C5 - D5 . E5 - - . G5 - E5 .', 'G5 - - . E5 - D5 . C5 - D5 . E5 - . .', 'D5 - - - - . B4 . D5 - E5 . D5 - . .', 'E5 - - . A5 - B5 . C6 - B5 . A5 - . .', 'A5 - G5 . F5 - E5 . F5 - G5 . A5 - . .', 'F5 - E5 . D5 - C5 . D5 - E5 . F5 - . .', 'E5 - - - G#5 - - - B5 - - - E5 - . .'], bass: '1 . . 1 . . 5 . 1 . . 1 . 3 5 .', drums: 'k . . . s . . . k . k . s . . h', pad: 1, lead2: 'pulse' },
  lobby: { bpm: 84, swing: .14, chords: ['F:M7', 'E:m7', 'D:m7', 'G:7', 'C:M7', 'A:m7', 'D:m7', 'G:7'], lead: ['A5 . C6 . E6 - - . D6 . C6 . A5 - . .', 'G5 . B5 . D6 - - . C6 . B5 . G5 - . .', 'F5 . A5 . C6 - - . A5 . G5 . F5 - . .', 'G5 - - . B5 - - . D6 - C6 . B5 - . .', 'E5 . G5 . B5 - - . A5 . G5 . E5 - . .', 'C6 - - . A5 . . . G5 . E5 . C5 - . .', 'D5 . F5 . A5 . C6 . A5 - F5 . D5 - . .', 'B4 . D5 . F5 . G5 - - - . . . . . .'], bass: '1 . . . 5 . . . 1 . . 3 . . 5 .', drums: 'k . h . s . h k . . h . s . h .', pad: 1, keys: 1 },
  office: { bpm: 104, chords: ['C:M', 'A:m', 'F:M', 'G:M', 'C:M', 'E:m', 'F:M', 'G:sus'], lead: ['E5 . G5 . C6 - - . B5 . G5 . E5 - . .', 'C5 . E5 . A5 - - . G5 . E5 . C5 - . .', 'F5 . A5 . C6 - - . A5 . F5 . A5 - . .', 'G5 - - . F5 . E5 . D5 - - . . . . .', 'E5 . G5 . C6 - - . D6 . E6 . C6 - . .', 'B5 - - . G5 . E5 . G5 - - . . . . .', 'A5 . C6 . A5 . F5 . A5 . C6 . F6 - . .', 'G5 - - - - . D5 . G5 - - - . . . .'], bass: '1 . 5 . 1 . 5 . 1 . 5 . 3 . 5 .', drums: 'k . h . s . h . k . h k s . h .', brass: 1 },
  gym: { bpm: 128, chords: ['E:m', 'C:M', 'D:M', 'B:m', 'E:m', 'C:M', 'A:m', 'B:7'], lead: ['E5 . E5 . G5 . A5 . B5 - - . A5 . G5 .', 'E5 . . . G5 . E5 . C5 - - . . . . .', 'F#5 . F#5 . A5 . B5 . D6 - - . B5 . A5 .', 'F#5 . . . D5 . F#5 . B4 - - . . . . .', 'E5 . E5 . G5 . A5 . B5 - - . E6 . D6 .', 'C6 . B5 . G5 . E5 . G5 - - . . . . .', 'A5 . G5 . E5 . C5 . E5 . G5 . A5 . . .', 'B5 - - . D#6 - - . F#6 - - . B5 . . .'], bass: '1 1 . 1 1 . 1 . 1 1 . 1 5 . 3 .', drums: 'k . h . s . h k k . h . s . h h', lead2: 'square' },
  street: { bpm: 76, swing: .2, chords: ['D:m9', 'G:7', 'C:M9', 'A:7', 'D:m9', 'G:7', 'E:m7', 'A:7'], lead: ['F5 - A5 . C6 - - . D6 . C6 . A5 - - .', 'B5 . A5 . G5 - F5 . D5 - - - . . . .', 'E5 - G5 . B5 - - . D6 . B5 . G5 - - .', 'C#6 - - . A5 . G5 . E5 - - - . . . .', 'F5 - A5 . C6 - - . E6 - D6 . C6 - - .', 'B5 - - . G5 . F5 . D5 - F5 . G5 - - .', 'G5 - B5 . D6 - - . B5 . A5 . G5 - - .', 'A5 - - - G5 - - - E5 - - - C#5 - - -'], bass: '1 . . 5 . . 1 . 3 . . 5 . . 6 .', drums: 'k . . h s . . h k . k h s . . h', pad: 1, keys: 1 },
  clinic: { bpm: 70, chords: ['C:M7', 'F:M7', 'A:m7', 'G:sus', 'C:M7', 'F:M7', 'D:m7', 'G:M'], lead: ['E5 - - - G5 - - - B5 - - - A5 - - -', 'A5 - - - G5 - - - F5 - - - E5 - - -', 'C5 - - - E5 - - - G5 - - - A5 - - -', 'G5 - - - - - - - D5 - - - - - - -', 'E5 - - - G5 - - - C6 - - - B5 - - -', 'A5 - - - C6 - - - A5 - - - G5 - - -', 'F5 - - - A5 - - - D6 - - - C6 - - -', 'B5 - - - - - - - G5 - - - - - - -'], bass: '1 . . . . . . . 5 . . . . . . .', drums: '. . . . . . . . . . . . . . . .', pad: 1, soft: 1 },
  shop: { bpm: 112, chords: ['G:M', 'E:m', 'C:M', 'D:M', 'G:M', 'B:m', 'C:M', 'D:7'], lead: ['B5 . D6 . B5 . G5 . A5 . B5 . G5 - . .', 'G5 . B5 . G5 . E5 . F#5 . G5 . E5 - . .', 'E5 . G5 . C6 . E6 . D6 . C6 . G5 - . .', 'F#5 - A5 . D6 - - . C6 . A5 . F#5 - . .', 'B5 . D6 . G6 . D6 . B5 . G5 . B5 - . .', 'D6 . B5 . F#5 . D5 . F#5 . B5 . D6 - . .', 'E6 . C6 . G5 . E5 . G5 . C6 . E6 - . .', 'F#6 - - . D6 . A5 . F#5 . A5 . D6 - . .'], bass: '1 . 5 . 1 . 5 . 1 . 5 . 1 . 5 .', drums: 'k . h . s . h . k k h . s . h .', lead2: 'pulse' },
  match: { bpm: 142, chords: ['E:m', 'C:M', 'D:M', 'B:M', 'E:m', 'C:M', 'A:m', 'B:7'], lead: ['E5 . G5 . B5 . E6 . D6 . B5 . G5 . A5 .', 'G5 - - . E5 . G5 . C6 - - . B5 . G5 .', 'F#5 . A5 . D6 . F#6 . E6 . D6 . A5 . B5 .', 'D#6 - - . B5 . F#5 . D#5 - - . . . . .', 'E5 . G5 . B5 . E6 . G6 . F#6 . E6 . D6 .', 'C6 - - . G5 . E5 . G5 - C6 . E6 - - .', 'A5 . C6 . E6 . A6 . G6 . E6 . C6 . A5 .', 'B5 - - - D#6 - - - F#6 - - - B6 - - -'], bass: '1 1 1 . 1 1 5 . 1 1 1 . 8 . 5 .', drums: 'k . h . s . h . k k h . s . h o', lead2: 'square', drive: 1 },
  boss: { bpm: 152, chords: ['C:m', 'Ab:M', 'Bb:M', 'G:M', 'C:m', 'F:m', 'D:dim', 'G:7'], lead: ['C5 . Eb5 . G5 . C6 . B5 . G5 . Eb5 . D5 .', 'C5 - - . Eb5 . Ab5 . C6 - - . Ab5 . Eb5 .', 'D5 . F5 . Bb5 . D6 . C6 . Bb5 . F5 . D5 .', 'B4 - - . D5 . G5 . B5 - - . . . . .', 'C6 . G5 . Eb5 . C5 . Eb5 . G5 . C6 . Eb6 .', 'F6 - - . C6 . Ab5 . F5 - - . Ab5 . C6 .', 'D6 . Ab5 . F5 . D5 . F5 . Ab5 . B5 . D6 .', 'G6 - - - F6 - - - D6 - - - B5 - - -'], bass: '1 1 . 1 1 . 1 . 1 1 . 1 5 . 8 .', drums: 'k k h . s . h k k . h k s . h o', lead2: 'square', drive: 1 },
  rival: { bpm: 124, swing: .06, chords: ['D:m', 'D:m', 'Bb:M', 'C:M', 'D:m', 'F:M', 'G:m', 'A:7'], lead: ['D5 . . D5 . F5 . A5 - - . G5 . F5 . .', 'D5 . . D5 . F5 . A5 - - . C6 . A5 . .', 'Bb5 - - . A5 . G5 . F5 - - . G5 . A5 .', 'C6 - - . Bb5 . A5 . G5 - - . . . . .', 'D6 . . D6 . C6 . A5 - - . F5 . A5 . .', 'F5 . A5 . C6 . F6 . E6 - - . D6 . C6 .', 'Bb5 . . Bb5 . A5 . G5 - - . F5 . G5 . .', 'A5 - - - C#6 - - - E6 - - - A5 - - -'], bass: '1 . 1 . 5 . 1 . 8 . 5 . 1 . 5 .', drums: 'k . h . s . h k k . h . s . h o', lead2: 'square', drive: .8 },
  rumble: { bpm: 160, chords: ['A:m', 'F:M', 'G:M', 'E:M', 'A:m', 'F:M', 'D:m', 'E:7'], lead: ['A5 . C6 . E6 . A6 . G6 . E6 . C6 . E6 .', 'F6 - - . C6 . A5 . C6 - - . F6 . E6 .', 'D6 . G5 . B5 . D6 . G6 . F6 . D6 . B5 .', 'G#5 - - . B5 . E6 . G#6 - - . . . . .', 'A5 . C6 . E6 . A6 . C7 . B6 . A6 . E6 .', 'F6 - - . A6 . F6 . C6 - - . A5 . C6 .', 'D6 . F6 . A6 . F6 . D6 . A5 . F5 . A5 .', 'B5 - - - D6 - - - E6 - - - G#6 - - -'], bass: '1 1 1 1 1 1 5 5 1 1 1 1 8 8 5 5', drums: 'k . h k s . h k k . h k s . h o', lead2: 'square', drive: 1 },
};
// the main theme, slowed and softened: A NEW WAVE (keys, a little lift) and THE FINAL BELL (a pad, no drums)
TRACKS.wave = Object.assign({}, TRACKS.title, { bpm: 70, soft: 1, keys: 1, pad: 0, drums: '. . . . . . . . k . . . . . . .', bass: '1 . . . . . . . 5 . . . . . . .' });
TRACKS.ending = Object.assign({}, TRACKS.title, { bpm: 62, soft: 1, pad: 1, drums: '. . . . . . . . . . . . . . . .', bass: '1 . . . . . . . . . . . 5 . . .' });
export const JINGLES = {
  win: { bpm: 150, notes: 'C5 E5 G5 C6 - - G5 C6 E6 - - - - - - -', chord: 'C:M' },
  lose: { bpm: 90, notes: 'G4 - F4 - E4 - D4 - C4 - - - - - - -', chord: 'C:m' },
  fanfare: { bpm: 132, notes: 'G4 - C5 - E5 - G5 - - - E5 G5 C6 - - - - -', chord: 'C:M' },
  gameover: { bpm: 70, notes: 'E4 - - D#4 - - D4 - - C#4 - - - - - - -', chord: 'E:m' },
  level: { bpm: 180, notes: 'C5 E5 G5 C6 E6 G6 C7 - -', chord: 'C:M' },
  title: { bpm: 120, notes: 'A4 C5 E5 A5 - - G5 - E5 - - -', chord: 'A:m' },
};

export class AudioManager {
  constructor() {
    this.ctx = null; this.vol = { master: .8, music: .55, sfx: .85 }; this.muted = false;
    this.track = null; this.nextTime = 0; this.step = 0; this.timer = null; this.crowdLevel = 0; this.crowdNode = null; this.voices = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(this.master);
    this.out = comp;
    this.mus = c.createGain(); this.mus.gain.value = this.vol.music; this.mus.connect(comp);
    this.fx = c.createGain(); this.fx.gain.value = this.vol.sfx; this.fx.connect(comp);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let p = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; p = .97 * p + .03 * w; d[i] = w * .6 + p * 2.2; }
    this.noise = b;
    const pw = (duty) => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty); return c.createPeriodicWave(re, im); };
    this.pulse25 = pw(.25); this.pulse12 = pw(.125);
    this.startCrowd();
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.music(t); }
  }
  setVolume(k, v) { this.vol[k] = v; if (!this.ctx) return; const n = k === 'master' ? this.master : k === 'music' ? this.mus : this.fx; n.gain.setTargetAtTime(this.muted && k === 'master' ? 0 : v, this.ctx.currentTime, .05); }
  // ---- primitives ----
  env(g, t, a, peak, d, end = .0001) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  tone(type, f0, f1, dur, vol, t = 0, dest = this.fx, opts = {}) {
    const c = this.ctx; if (!c) return;
    const T = c.currentTime + t, o = c.createOscillator(), g = c.createGain();
    if (type === 'pulse') o.setPeriodicWave(this.pulse25); else if (type === 'thin') o.setPeriodicWave(this.pulse12); else o.type = type;
    o.frequency.setValueAtTime(f0, T); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), T + dur);
    if (opts.detune) o.detune.value = opts.detune;
    this.env(g, T, opts.a || .004, vol, dur);
    let node = o;
    if (opts.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.lp; fl.Q.value = opts.q || .7; node.connect(fl); node = fl; }
    node.connect(g); g.connect(dest);
    o.start(T); o.stop(T + (opts.a || .004) + dur + .05);
  }
  burst(dur, vol, type, freq, q, t = 0, dest = this.fx, f1) {
    const c = this.ctx; if (!c) return;
    const T = c.currentTime + t, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, T); if (f1) f.frequency.exponentialRampToValueAtTime(f1, T + dur); f.Q.value = q;
    this.env(g, T, .002, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(T, Math.random() * 1.5); s.stop(T + dur + .05);
  }
  // ---- effects ----
  sfx(name, o = {}) {
    if (!this.ctx || this.muted) return;
    const p = o.p != null ? o.p : 1, pitch = o.pitch || 1, R = () => .92 + Math.random() * .16;
    switch (name) {
      case 'punch1': this.burst(.05, .5, 'bandpass', 1100 * R(), 1.4); this.tone('sine', 150 * R(), 60, .07, .55); break;
      case 'punch2': this.burst(.08, .6, 'bandpass', 800 * R(), 1.2); this.tone('sine', 120 * R(), 45, .12, .7); this.burst(.02, .3, 'highpass', 3000, .7); break;
      case 'punch3': this.burst(.12, .7, 'lowpass', 1400 * R(), 1); this.tone('sine', 110 * R(), 38, .18, .85); this.tone('square', 90, 40, .06, .12); this.burst(.025, .4, 'highpass', 3500, .7); break;
      case 'kick1': this.burst(.06, .45, 'bandpass', 700 * R(), 1.2); this.tone('sine', 130 * R(), 55, .08, .55); break;
      case 'kick2': this.burst(.1, .6, 'bandpass', 600 * R(), 1); this.tone('sine', 115 * R(), 42, .14, .75); break;
      case 'slap': this.burst(.06, .55, 'highpass', 2200 * R(), .9); this.burst(.03, .35, 'bandpass', 4200, 2); this.tone('triangle', 900, 500, .03, .15); break;
      case 'chop': this.burst(.07, .55, 'bandpass', 1800 * R(), 1.5); this.tone('sine', 160, 70, .08, .45); break;
      case 'belly': this.tone('sine', 90 * R(), 40, .22, .7); this.burst(.12, .35, 'lowpass', 500, .8); this.tone('triangle', 200, 120, .1, .15); break;
      case 'slash': this.burst(.09, .4, 'bandpass', 2500, 2, 0, this.fx, 900); this.tone('sine', 140, 60, .06, .35); break;
      case 'whip': this.burst(.07, .4, 'bandpass', 3000, 3, 0, this.fx, 1200); this.tone('sine', 120, 60, .05, .3); break;
      case 'clang': this.burst(.06, .55, 'bandpass', 2600 * R(), 2.2); [[523, .5], [1187, .32], [1939, .22], [3061, .14]].forEach(([f, v], i) => this.tone(i ? 'sine' : 'triangle', f * R(), f * .985, .6 - i * .1, v * .35 * p)); this.tone('sine', 120, 50, .15, .5); break;
      case 'block': this.burst(.05, .4, 'bandpass', 1500, 2); this.tone('square', 380, 300, .05, .1); break;
      case 'parry': this.tone('square', 1320, 1320, .12, .18); this.tone('square', 1760, 1760, .18, .14, .05); this.burst(.05, .3, 'highpass', 4000, .7); break;
      case 'whoosh': this.burst(.18 * pitch, .32, 'bandpass', 500, 1.4, 0, this.fx, 2400); break;
      case 'swing': this.burst(.09, .14, 'bandpass', 900, 1.2, 0, this.fx, 2200); break;
      case 'jump': this.burst(.05, .14, 'lowpass', 400, .7); break;
      case 'land': this.tone('sine', 90, 50, .06, .25 * p); this.burst(.05, .15 * p, 'lowpass', 600, .7); break;
      case 'step': this.burst(.03, .05, 'lowpass', 300 + Math.random() * 200, .7); break;
      case 'slam': {
        const k = Math.min(2.6, p);
        this.tone('sine', 72, 30, .32 + k * .1, .9); this.tone('triangle', 110, 40, .18, .4);
        this.burst(.28 + k * .08, .65, 'lowpass', 700, .8); this.burst(.07, .5, 'bandpass', 1300, 1.2);
        for (let i = 0; i < 3; i++) this.tone('square', 520 + i * 137 + Math.random() * 40, 400 + i * 90, .16 + k * .05, .035 * k, .01 * i);
        if (k > 1.6) { this.tone('sine', 50, 25, .6, .6, .02); this.burst(.5, .35, 'lowpass', 300, .7, .03); }
        break;
      }
      case 'thud': this.tone('sine', 85, 40, .12, .4 * p); this.burst(.08, .25 * p, 'lowpass', 500, .7); break;
      case 'rope': { const c = this.ctx, T = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, T); o.frequency.linearRampToValueAtTime(140, T + .05); o.frequency.exponentialRampToValueAtTime(70, T + .45); f.type = 'lowpass'; f.frequency.setValueAtTime(1600, T); f.frequency.exponentialRampToValueAtTime(260, T + .45); f.Q.value = 6; this.env(g, T, .005, .28 * p, .45); o.connect(f); f.connect(g); g.connect(this.fx); o.start(T); o.stop(T + .55); break; }
      case 'bell': for (const [m, v] of [[1, .4], [2.76, .18], [5.4, .1], [8.93, .05]]) this.tone('sine', 820 * m, 820 * m, 1.6 / Math.sqrt(m), v); break;
      case 'bell3': for (let i = 0; i < 3; i++) for (const [m, v] of [[1, .35], [2.76, .15], [5.4, .08]]) this.tone('sine', 820 * m, 820 * m, .9 / Math.sqrt(m), v, i * .32); break;
      case 'count': this.burst(.06, .5, 'bandpass', 900, 1.1); this.tone('sine', 140, 70, .08, .5); this.tone('square', 660 + (o.n || 1) * 110, 660 + (o.n || 1) * 110, .09, .08, .02); break;
      case 'grip': this.burst(.06, .25, 'bandpass', 600, 2); this.tone('sine', 180, 140, .05, .2); break;
      case 'grunt': this.voice(o.voice || 1, 'hup'); break;
      case 'cry': this.voice(o.voice || 1, 'yah'); break;
      case 'hurt': this.voice(o.voice || 1, 'ugh'); break;
      case 'lift': this.voice(o.voice || 1, 'hnn'); this.burst(.2, .1, 'bandpass', 400, 1, .05, this.fx, 900); break;
      case 'spin': this.burst(.16, .22, 'bandpass', 700, 2, 0, this.fx, 1800); break;
      case 'charge': { for (let i = 0; i < 6; i++) this.tone('square', 220 * Math.pow(1.19, i), 220 * Math.pow(1.19, i), .07, .07, i * .05); this.burst(.4, .15, 'bandpass', 500, 2, 0, this.fx, 3000); break; }
      case 'finisher': this.tone('sawtooth', 110, 110, .6, .22, 0, this.fx, { lp: 900 }); this.tone('sawtooth', 165, 165, .6, .18, 0, this.fx, { lp: 900 }); this.tone('square', 440, 880, .5, .1); this.burst(.5, .25, 'bandpass', 300, 1.2, 0, this.fx, 3000); break;
      case 'ko': this.tone('sine', 60, 25, 1, .8); this.burst(.8, .4, 'lowpass', 400, .7); this.tone('square', 220, 55, .8, .12); break;
      case 'counter': this.tone('square', 880, 1760, .08, .15); this.tone('square', 1320, 1320, .14, .12, .06); break;
      case 'reversal': this.tone('square', 660, 1320, .1, .16); this.tone('square', 990, 1980, .14, .12, .05); this.burst(.1, .25, 'highpass', 3000, .8); break;
      case 'down': this.tone('triangle', 330, 160, .25, .12); break;
      case 'deny': this.tone('square', 200, 160, .1, .12); this.tone('square', 150, 120, .12, .1, .08); break;
      case 'ui': this.tone('square', 880 * pitch, 880 * pitch, .03, .07); break;
      case 'ok': this.tone('square', 988, 988, .05, .08); this.tone('square', 1319, 1319, .08, .08, .05); break;
      case 'back': this.tone('square', 660, 440, .08, .08); break;
      case 'type': this.tone('square', (1000 + Math.random() * 300) * pitch, 0, .018, .03); break;
      case 'coin': this.tone('square', 988, 988, .06, .09); this.tone('square', 1319, 1319, .22, .09, .06); break;
      case 'buy': this.tone('square', 784, 784, .06, .09); this.tone('square', 1047, 1047, .06, .09, .06); this.tone('square', 1319, 1319, .16, .09, .12); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, .18, .14, i * .07)); break;
      case 'boo': for (let i = 0; i < 3; i++) { this.tone('sawtooth', 150 + i * 23, 120 + i * 18, 1.1, .05 * p, i * .05); } this.burst(.9, .12 * p, 'lowpass', 420, .9); break;
      case 'pyro': for (let i = 0; i < 4 * p; i++) this.burst(.08, .22, 'highpass', 1800 + i * 300, .5, i * .11); this.tone('sine', 70, 40, .5, .3, 0); break;
      case 'gull': for (let i = 0; i < 2; i++) { this.tone('sine', 1900, 1250, .16, .05 * p, i * .22); this.tone('sine', 1500, 2100, .08, .03 * p, i * .22 + .14); } break;
      case 'wave': this.burst(1.6, .16 * p, 'lowpass', 700, .9); this.burst(1.1, .06 * p, 'highpass', 2400, .7, .35); break;
      case 'horn': this.tone('sawtooth', 84, 78, 2.2, .16 * p); this.tone('sine', 42, 40, 2.4, .3 * p); this.tone('triangle', 126, 118, 1.8, .06 * p); break;
      case 'warn': for (let i = 0; i < 2; i++) { this.tone('square', 740, 740, .12, .1, i * .26); this.tone('square', 554, 554, .12, .1, i * .26 + .13); } break;
      case 'door': this.burst(.14, .3, 'lowpass', 500, .8); this.tone('sine', 110, 70, .12, .3); this.tone('triangle', 300, 520, .2, .05, .06); break;
      case 'stat': this.tone('square', 523, 523, .05, .08); this.tone('square', 784, 784, .1, .08, .05); break;
      case 'good': this.tone('square', 784, 784, .06, .08); this.tone('square', 1175, 1175, .1, .08, .06); break;
      case 'miss': this.tone('square', 300, 200, .12, .09); break;
      case 'tick': this.tone('square', 1500, 1500, .02, .05); break;
      case 'splash': this.burst(.35, .4, 'bandpass', 900, .8, 0, this.fx, 300); this.tone('sine', 300, 80, .2, .2); break;
      case 'crowdBoom': this.cheer(1.2 * p); break;
      case 'boo': this.boo(p); break;
      case 'clap': for (let i = 0; i < 8; i++) this.burst(.03, .05 + Math.random() * .05, 'bandpass', 1400 + Math.random() * 900, 1.5, Math.random() * .25); break;
      case 'ink': this.burst(.3, .3, 'lowpass', 600, 2, 0, this.fx, 200); this.tone('sine', 200, 60, .3, .3); break;
      case 'lightsOff': this.tone('square', 200, 50, .2, .2); this.burst(.1, .3, 'lowpass', 400, 1); break;
    }
  }
  voice(v, kind) {
    const c = this.ctx; if (!c || this.voices > 3) return;
    this.voices++; setTimeout(() => this.voices--, 300);
    const T = c.currentTime, base = 130 * v * (.92 + Math.random() * .16);
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth';
    const shapes = { hup: [1.15, .8, .12, [700, 1200]], yah: [1.2, 1, .28, [800, 1300]], ugh: [.95, .7, .2, [500, 900]], hnn: [1, .92, .3, [400, 1900]] }[kind];
    o.frequency.setValueAtTime(base * shapes[0], T); o.frequency.exponentialRampToValueAtTime(base * shapes[1], T + shapes[2]);
    this.env(g, T, .02, .22, shapes[2]);
    o.connect(g);
    for (const fq of shapes[3]) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq * (v > 1.1 ? 1.15 : 1); f.Q.value = 5; g.connect(f); const g2 = c.createGain(); g2.gain.value = .55; f.connect(g2); g2.connect(this.fx); }
    o.start(T); o.stop(T + shapes[2] + .1);
  }
  // ---- crowd bed ----
  startCrowd() {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = .6; f2.type = 'lowpass'; f2.frequency.value = 1800;
    g.gain.value = 0; lfo.frequency.value = .37; lg.gain.value = .02; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.fx); s.start(); lfo.start();
    this.crowdNode = g;
  }
  crowd(level) { // 0..1 murmur level, eased
    this.crowdLevel = level;
    if (!this.ctx || !this.crowdNode) return;
    this.crowdNode.gain.setTargetAtTime(Math.min(.32, level * .28), this.ctx.currentTime, .4);
  }
  cheer(k = 1) {
    if (!this.ctx) return;
    const c = this.ctx, T = c.currentTime;
    for (const [fq, q] of [[750, 2], [1150, 3], [2400, 4]]) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = fq * (.9 + Math.random() * .2); f.Q.value = q;
      g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(.18 * k, T + .12); g.gain.exponentialRampToValueAtTime(.06 * k, T + .7); g.gain.exponentialRampToValueAtTime(.0001, T + 1.8);
      s.connect(f); f.connect(g); g.connect(this.fx); s.start(T, Math.random()); s.stop(T + 1.9);
    }
    for (let i = 0; i < 3 * k; i++) { const st = Math.random() * .6; this.tone('sine', 2200 + Math.random() * 800, 3000 + Math.random() * 600, .25, .03, st); }
    this.sfx('clap');
  }
  boo(k = 1) {
    if (!this.ctx) return;
    const c = this.ctx, T = c.currentTime;
    for (const fq of [320, 860]) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 4; g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(.16 * k, T + .25); g.gain.exponentialRampToValueAtTime(.0001, T + 1.5); s.connect(f); f.connect(g); g.connect(this.fx); s.start(T); s.stop(T + 1.6); }
  }
  // ---- music ----
  music(id) {
    if (this.trackId === id) return;
    if (!this.ctx) { this.pendingTrack = id; return; }
    this.trackId = id;
    this.track = id ? TRACKS[id] : null;
    this.step = 0; this.nextTime = this.ctx.currentTime + .08;
    if (this.timer) clearInterval(this.timer);
    if (!this.track) return;
    this.prepare(this.track);
    this.timer = setInterval(() => this.schedule(), 25);
  }
  prepare(tr) {
    if (tr._p) return;
    tr._p = { lead: tr.lead.map(b => b.split(' ')), bass: tr.bass.split(' '), drums: tr.drums.split(' '), chords: tr.chords.map(s => { const [r, q] = s.split(':'); return { root: rootMidi(r), q: CHORD[q] || CHORD.M }; }) };
  }
  schedule() {
    const c = this.ctx, tr = this.track;
    if (!c || !tr) return;
    const sp = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + .14) {
      this.playStep(tr, this.step, this.nextTime);
      const sw = tr.swing && this.step % 2 === 0 ? sp * tr.swing : tr.swing ? -sp * tr.swing : 0;
      this.nextTime += sp + sw; this.step++;
    }
  }
  playStep(tr, n, T) {
    const P = tr._p, bar = Math.floor(n / 16) % P.chords.length, s = n % 16, ch = P.chords[bar], sp = 60 / tr.bpm / 4, M = this.mus, c = this.ctx;
    const at = T - c.currentTime;
    // drums
    const d = P.drums[s];
    if (d === 'k') { this.tone('sine', 140, 42, .16, tr.soft ? .2 : .55, at, M); }
    if (d === 's') { this.burst(.12, tr.soft ? .1 : .26, 'bandpass', 1800, .8, at, M); this.tone('triangle', 220, 140, .08, .12, at, M); }
    if (d === 'h' || (d === '.' && !tr.soft && s % 2 === 0 && tr.drive)) this.burst(.03, .07, 'highpass', 7000, .7, at, M);
    if (d === 'o') this.burst(.14, .08, 'highpass', 6500, .7, at, M);
    // bass
    const b = P.bass[s];
    if (b !== '.') { const deg = +b, iv = deg === 8 ? 12 : deg === 5 ? 7 : deg === 3 ? ch.q[1] : deg === 6 ? 9 : 0; const f = midiF(ch.root - 12 + iv); this.tone(tr.drive ? 'square' : 'triangle', f, f, sp * (tr.drive ? .8 : 1.7), tr.drive ? .13 : .24, at, M, { lp: tr.drive ? 700 : 1200 }); }
    // pad / keys: chord on beats
    if ((tr.pad || tr.keys || tr.brass) && s % (tr.keys ? 8 : 16) === 0) {
      for (const iv of ch.q.slice(0, 4)) { const f = midiF(ch.root + 12 + iv); this.tone(tr.brass ? 'sawtooth' : 'triangle', f, f, sp * (tr.keys ? 7 : 15), tr.brass ? .03 : .045, at, M, { a: tr.pad ? .3 : .01, lp: tr.brass ? 1600 : 2400 }); if (tr.pad && !tr.soft) this.tone('sawtooth', f * 1.003, f * 1.003, sp * 15, .015, at, M, { a: .4, lp: 900 }); }
    }
    if (tr.drive && s % 4 === 2) for (const iv of ch.q.slice(0, 3)) { const f = midiF(ch.root + 12 + iv); this.tone('square', f, f, sp * .9, .025, at, M, { lp: 2000 }); }
    // lead
    const L = P.lead[bar % P.lead.length], note = L[s];
    if (note && note !== '.' && note !== '-') {
      let len = 1; for (let k = s + 1; k < 16 && L[k] === '-'; k++) len++;
      const f = NOTE(note);
      this.tone(tr.lead2 === 'square' ? 'square' : 'pulse', f, f, sp * len * .92, tr.soft ? .05 : .075, at, M, { lp: 3200 });
      if (!tr.soft) this.tone('thin', f * 2, f * 2, sp * len * .5, .018, at + sp * .5, M, { lp: 4000 });
    }
  }
  jingle(id) {
    const j = JINGLES[id];
    if (!j || !this.ctx) return;
    const prev = this.trackId; this.music(null); this.trackId = null;
    const sp = 60 / j.bpm / 2;
    j.notes.split(' ').forEach((n, i, arr) => { if (n === '-' || n === '.') return; let len = 1; for (let k = i + 1; k < arr.length && arr[k] === '-'; k++) len++; const f = NOTE(n); this.tone('pulse', f, f, sp * len * .95, .1, i * sp, this.mus, { lp: 3500 }); this.tone('triangle', f / 2, f / 2, sp * len, .1, i * sp, this.mus); });
    return prev;
  }
}
