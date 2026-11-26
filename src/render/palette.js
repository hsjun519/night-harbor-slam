// Colour ramps. Shadows lean to violet and lights lean to warm, so every material shares the harbour-night mood.
import { clamp01, lerp } from '../core/util.js';

export function hexRGB(h) {
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
export const packRGB = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export function packHex(h, a = 255) { const [r, g, b] = hexRGB(h); return packRGB(r, g, b, a); }
export function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
export function shade(h, k) { return k < 0 ? mixHex(h, '#160b2a', -k) : mixHex(h, '#fff0cf', k); }

const rampCache = new Map();
// Five tones, dark to light, as hex strings.
export function rampHex(base) {
  if (rampCache.has(base)) return rampCache.get(base);
  const r = [mixHex(base, '#1b0d33', .68), mixHex(base, '#2a1445', .42), mixHex(base, '#3a1c50', .16), mixHex(base, '#ffe2b0', .10), mixHex(base, '#fff3d6', .42)];
  rampCache.set(base, r);
  return r;
}
const packedCache = new Map();
export function ramp(base) {
  if (packedCache.has(base)) return packedCache.get(base);
  const r = Uint32Array.from(rampHex(base), h => packHex(h));
  r.base = base;
  packedCache.set(base, r);
  return r;
}
// Skin is hand tuned: the generated ramps read too grey.
export const SKINS = {
  pale: ['#5a3350', '#a3646c', '#dc9c8e', '#f6c7ad', '#ffe6cf'],
  light: ['#572c44', '#9c574f', '#d58c6a', '#f2b68a', '#ffdcb5'],
  tan: ['#4a2440', '#834343', '#b9714f', '#dc9b69', '#f7c795'],
  brown: ['#37193a', '#5f3039', '#8c5240', '#b5784f', '#dba56f'],
  dark: ['#24122f', '#422336', '#64393b', '#8a5947', '#b5825b'],
  ash: ['#2b2644', '#56506f', '#86819a', '#b3b0bd', '#dedbd8'],
};
const skinPacked = {};
export function skinRamp(name) {
  if (!skinPacked[name]) {
    skinPacked[name] = Uint32Array.from(SKINS[name] || SKINS.tan, h => packHex(h));
    skinPacked[name].base = (SKINS[name] || SKINS.tan)[2];
  }
  return skinPacked[name];
}
export const skinHex = name => SKINS[name] || SKINS.tan;
export const OUTLINE_HEX = '#140a22';
export const OUTLINE = packHex(OUTLINE_HEX);

// Game-wide UI colours.
export const UI = {
  ink: '#0b0f22', panel: '#121834', panel2: '#1b2450', edge: '#3a4a8c', line: '#26315f', text: '#eef2ff', dim: '#9aa6d6', faint: '#5f6ca6',
  hp: '#ff4f6d', hpD: '#8c1f48', stun: '#ffc23d', stunD: '#8a5a1a', fin: '#3fe0d0', finD: '#116a7a', inj: '#c86bff', injD: '#51257a',
  good: '#6be38a', bad: '#ff5b5b', warn: '#ffb347', accent: '#ff5fa2', accent2: '#49d6ff', gold: '#ffd65a', money: '#9be36b', fame: '#ffd65a',
};
export function lightness(hex) { const [r, g, b] = hexRGB(hex); return clamp01((r * .3 + g * .59 + b * .11) / 255); }
