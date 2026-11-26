// Shared math, easing, RNG and event helpers. No DOM access, so the simulation can run in Node tests.
export const VIEW_W = 640, VIEW_H = 360;
export const TAU = Math.PI * 2, DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : clamp01((v - a) / (b - a)));
export const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
export const damp = (v, t, rate, dt) => lerp(v, t, 1 - Math.exp(-rate * dt));
export const sgn = v => (v < 0 ? -1 : 1);
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];
export const wrapAngle = a => { a = (a + 180) % 360; if (a < 0) a += 360; return a - 180; };

export const EASE = {
  lin: t => t,
  in: t => t * t,
  in3: t => t * t * t,
  out: t => 1 - (1 - t) * (1 - t),
  out3: t => 1 - Math.pow(1 - t, 3),
  io: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  elastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1),
  bounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  },
  hold: () => 0,
};

// Small deterministic generator. Every system that needs randomness takes one of these.
export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  weighted(list, w) {
    let sum = 0;
    for (const e of list) sum += Math.max(0, w(e));
    let r = this.next() * sum;
    for (const e of list) { r -= Math.max(0, w(e)); if (r <= 0) return e; }
    return list[list.length - 1];
  }
}

export class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) { if (!this.map.has(type)) this.map.set(type, []); this.map.get(type).push(fn); return () => this.off(type, fn); }
  off(type, fn) { const l = this.map.get(type); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  emit(type, data) { const l = this.map.get(type); if (l) for (const fn of l.slice()) fn(data); }
}

export const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const deepClone = o => JSON.parse(JSON.stringify(o));
export const fmtMoney = n => '₩' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// Korean particle helper: josa('철수','이/가') -> '철수가'
export function josa(word, pair) {
  const [a, b] = pair.split('/');
  const c = word.charCodeAt(word.length - 1);
  let has;
  if (c >= 0xAC00 && c <= 0xD7A3) {
    const jong = (c - 0xAC00) % 28;
    has = jong !== 0;
    if (pair === '으로/로' && jong === 8) has = false;
  } else has = /[013678LMNR]$/i.test(word);
  return word + (has ? a : b);
}

// Canvas factory. Returns null outside the browser.
export function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  return c;
}
export function ctxOf(c, opts) { const g = c.getContext('2d', opts); g.imageSmoothingEnabled = false; return g; }
