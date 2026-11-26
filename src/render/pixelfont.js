// Original pixel font. Hangul syllables are composed from stroke rules (no font files are used),
// Latin glyphs are stroke lists on a 5x9 grid, and symbols are small bitmaps.
import { makeCanvas, ctxOf } from '../core/util.js';
import { UI } from './palette.js';

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const DOUBLE = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };

class Bits {
  constructor(w, h) { this.w = w; this.h = h; this.b = new Uint8Array(w * h); }
  set(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.b[y * this.w + x] = 1; }
  hl(y, a, b) { for (let x = a; x <= b; x++) this.set(x, y); }
  vl(x, a, b) { for (let y = a; y <= b; y++) this.set(x, y); }
  line(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (; ;) {
      this.set(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  runs() {
    const out = [];
    for (let y = 0; y < this.h; y++) {
      let s = -1;
      for (let x = 0; x <= this.w; x++) {
        const on = x < this.w && this.b[y * this.w + x];
        if (on && s < 0) s = x;
        if (!on && s >= 0) { out.push([s, y, x - s]); s = -1; }
      }
    }
    return out;
  }
}

// One consonant inside a box.
function cons(g, j, x, y, w, h) {
  if (j.length === 2 || DOUBLE[j]) {
    const a = DOUBLE[j] || j[0], b = DOUBLE[j] || j[1];
    const hw = (w - 1) >> 1;
    cons(g, a, x, y, hw, h); cons(g, b, x + w - hw, y, hw, h);
    return;
  }
  const X = x + w - 1, Y = y + h - 1, mid = y + ((h - 1) >> 1);
  const siot = (y0, h0) => {
    // Two legs meeting near the top. Left leg starts at the centre, right leg leaves it a third of the way down.
    const c = x + ((w - 1) >> 1), n = h0 - 1;
    for (let r = 0; r <= n; r++) {
      const k = n ? r / n : 1;
      const top = n >= 4 ? Math.max(0, (r - 1) / (n - 1)) : k;
      g.set(Math.round(c - (c - x) * Math.max(0, top)), y0 + r);
      const rk = n >= 3 ? Math.max(0, (r - Math.floor(n * .34)) / (n - Math.floor(n * .34))) : k;
      if (r >= Math.floor(n * .34)) g.set(Math.round(c + (X - c) * rk), y0 + r);
    }
    for (let r = 1; r <= n; r++) { // close gaps on flat slopes
      const k0 = n >= 4 ? Math.max(0, (r - 2) / (n - 1)) : (r - 1) / n, k1 = n >= 4 ? Math.max(0, (r - 1) / (n - 1)) : r / n;
      const a = Math.round(c - (c - x) * Math.max(0, k1)), b = Math.round(c - (c - x) * Math.max(0, k0));
      for (let i = a; i < b - 1; i++) g.set(i + 1, y0 + r - (i + 1 > (a + b) / 2 ? 1 : 0));
    }
  };
  const ring = (y0, h0) => {
    const W = w > h0 + 3 ? Math.min(w, h0 + 4) : w, ox = x + ((w - W) >> 1), oX = ox + W - 1, oY = y0 + h0 - 1;
    if (h0 <= 2) { g.set(ox, y0); g.set(oX, y0); g.hl(oY, ox + 1, oX - 1); return; }
    const cut = W >= 6 && h0 >= 6 ? 2 : 1;
    g.hl(y0, ox + cut, oX - cut); g.hl(oY, ox + cut, oX - cut);
    g.vl(ox, y0 + cut, oY - cut); g.vl(oX, y0 + cut, oY - cut);
    if (cut === 2) { g.set(ox + 1, y0 + 1); g.set(oX - 1, y0 + 1); g.set(ox + 1, oY - 1); g.set(oX - 1, oY - 1); }
  };
  switch (j) {
    case 'ㄱ': g.hl(y, x, X); g.vl(X, y, Y); if (h >= 7) { g.b[Y * g.w + X] = 0; g.set(X - 1, Y); } break;
    case 'ㄴ': g.vl(x, y, Y); g.hl(Y, x, X); break;
    case 'ㄷ': g.hl(y, x, X); g.vl(x, y, Y); g.hl(Y, x, X); break;
    case 'ㄹ': { const m = y + Math.round((h - 1) / 2); g.hl(y, x, X); g.vl(X, y, m); g.hl(m, x, X); g.vl(x, m, Y); g.hl(Y, x, X); break; }
    case 'ㅁ': g.hl(y, x, X); g.hl(Y, x, X); g.vl(x, y, Y); g.vl(X, y, Y); break;
    case 'ㅂ': { const m = y + (h >= 5 ? Math.floor((h - 1) / 2) : 1); g.vl(x, y, Y); g.vl(X, y, Y); g.hl(m, x, X); g.hl(Y, x, X); break; }
    case 'ㅅ': siot(y, h); break;
    case 'ㅇ': ring(y, h); break;
    case 'ㅈ': g.hl(y, x, X); siot(y + (h >= 6 ? 1 : 1), h - 1); break;
    case 'ㅊ': { const c = x + ((w - 1) >> 1); g.hl(y, c - (w > 5 ? 1 : 0), c + 1); const t = h >= 7 ? y + 2 : y + 1; g.hl(t, x, X); siot(t + 1, Y - t); break; }
    case 'ㅋ': g.hl(y, x, X); g.vl(X, y, Y); g.hl(mid, x, X); if (h >= 7) { g.b[Y * g.w + X] = 0; g.set(X - 1, Y); } break;
    case 'ㅌ': { const m = y + Math.round((h - 1) / 2); g.hl(y, x, X); g.hl(m, x, X); g.hl(Y, x, X); g.vl(x, y, Y); break; }
    case 'ㅍ': { const a = x + Math.max(1, Math.round(w * .24)), b = X - Math.max(1, Math.round(w * .24)); g.hl(y, x, X); g.hl(Y, x, X); g.vl(a, y, Y); g.vl(b, y, Y); break; }
    case 'ㅎ': { const c = x + ((w - 1) >> 1); g.hl(y, c - (w > 5 ? 1 : 0), c + 1); const t = h >= 8 ? y + 2 : y + 1; g.hl(t, x, X); ring(t + 1 + (h >= 9 ? 1 : 0), Y - t - (h >= 9 ? 1 : 0)); break; }
  }
}

// Vowel columns: verticals, bar span, number of bars, and the widest initial that fits next to it.
const VCOL = {
  14: { 'ㅏ': { v: [9], b: [10, 12], n: 1, w: 7 }, 'ㅑ': { v: [9], b: [10, 12], n: 2, w: 7 }, 'ㅣ': { v: [10], n: 0, w: 8 }, 'ㅐ': { v: [8, 11], b: [9, 10], n: 1, w: 6 }, 'ㅒ': { v: [8, 11], b: [9, 10], n: 2, w: 6 }, 'ㅓ': { v: [11], b: [8, 10], n: 1, w: 7 }, 'ㅕ': { v: [11], b: [8, 10], n: 2, w: 7 }, 'ㅔ': { v: [9, 12], b: [7, 8], n: 1, w: 6 }, 'ㅖ': { v: [9, 12], b: [7, 8], n: 2, w: 6 } },
  11: { 'ㅏ': { v: [7], b: [8, 9], n: 1, w: 5 }, 'ㅑ': { v: [7], b: [8, 9], n: 2, w: 5 }, 'ㅣ': { v: [8], n: 0, w: 6 }, 'ㅐ': { v: [6, 9], b: [7, 8], n: 1, w: 5 }, 'ㅒ': { v: [6, 9], b: [7, 8], n: 2, w: 5 }, 'ㅓ': { v: [9], b: [7, 8], n: 1, w: 6 }, 'ㅕ': { v: [9], b: [7, 8], n: 2, w: 6 }, 'ㅔ': { v: [7, 9], b: [6, 6], n: 1, w: 5 }, 'ㅖ': { v: [7, 9], b: [6, 6], n: 2, w: 5 } },
};
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const tallIni = c => c === 'ㅎ' || c === 'ㅊ';

function vertVowel(g, spec, y0, y1, bars) {
  for (const x of spec.v) g.vl(x, y0, y1);
  if (spec.n === 1) g.hl(bars[0], spec.b[0], spec.b[1]);
  if (spec.n === 2) { g.hl(bars[1], spec.b[0], spec.b[1]); g.hl(bars[2], spec.b[0], spec.b[1]); }
}

function composeHangul(code, S) {
  const i = code - 0xAC00, ci = Math.floor(i / 588), vi = Math.floor((i % 588) / 28), fi = i % 28;
  const c = CHO[ci], v = JUNG[vi], f = JONG[fi];
  const big = S === 14, W = big ? 13 : 10, g = new Bits(W, S);
  const vc = VCOL[S];
  const horiz = v[0] === 'ㅗ' || v[0] === 'ㅛ' || v[0] === 'ㅜ' || v[0] === 'ㅠ' || v[0] === 'ㅡ';
  if (!horiz) {
    const sp = vc[v];
    if (!f) {
      if (big) { const t = tallIni(c); cons(g, c, 0, t ? 1 : 2, sp.w, t ? 10 : 9); vertVowel(g, sp, 0, 13, [6, 4, 8]); }
      else { cons(g, c, 0, 1, sp.w, 8); vertVowel(g, sp, 0, 10, [5, 3, 6]); }
    } else if (big) {
      cons(g, c, 0, 0, sp.w, 6); vertVowel(g, sp, 0, 6, [3, 2, 4]); cons(g, f, 2, 8, 10, 6);
    } else {
      cons(g, c, 0, 0, sp.w, 5); vertVowel(g, sp, 0, 4, [2, 1, 3]); cons(g, f, 1, 6, 8, 5);
    }
    return g;
  }
  if (v.length === 1) {
    const mid = big ? 6 : 5, a = big ? 4 : 3, b = big ? 8 : 6;
    const stems = v === 'ㅛ' || v === 'ㅠ' ? [a, b] : v === 'ㅡ' ? [] : [mid];
    const up = v === 'ㅗ' || v === 'ㅛ';
    const ix = big ? 2 : 1, iw = big ? 9 : 8;
    if (!f) {
      if (big) {
        if (v === 'ㅡ') { cons(g, c, ix, 1, iw, 7); g.hl(11, 0, 12); }
        else if (up) { cons(g, c, ix, 0, iw, 7); for (const x of stems) g.vl(x, 8, 10); g.hl(11, 0, 12); }
        else { cons(g, c, ix, 0, iw, 7); g.hl(8, 0, 12); for (const x of stems) g.vl(x, 9, 13); }
      } else {
        if (v === 'ㅡ') { cons(g, c, ix, 1, iw, 6); g.hl(9, 0, 9); }
        else if (up) { cons(g, c, ix, 0, iw, 6); for (const x of stems) g.vl(x, 7, 8); g.hl(9, 0, 9); }
        else { cons(g, c, ix, 0, iw, 5); g.hl(6, 0, 9); for (const x of stems) g.vl(x, 7, 10); }
      }
    } else if (big) {
      if (v === 'ㅡ') { cons(g, c, ix, 0, iw, 5); g.hl(6, 0, 12); cons(g, f, 2, 8, 9, 6); }
      else if (up) { cons(g, c, ix, 0, iw, 5); for (const x of stems) g.vl(x, 5, 6); g.hl(7, 0, 12); cons(g, f, 2, 9, 9, 5); }
      else { cons(g, c, ix, 0, iw, 5); g.hl(6, 0, 12); for (const x of stems) g.vl(x, 7, 7); cons(g, f, 2, 9, 9, 5); }
    } else {
      const ih = tallIni(c) || c === 'ㄹ' || c === 'ㅌ' ? 4 : 3;
      if (v === 'ㅡ') { cons(g, c, ix, 0, iw, ih); g.hl(4 + (ih > 3 ? 0 : 0), 0, 9); cons(g, f, 1, 6, 8, 5); }
      else if (up) { cons(g, c, ix, 0, iw, 3 + (ih > 3 ? 1 : 0)); for (const x of stems) g.vl(x, ih > 3 ? 4 : 3, 4); g.hl(5, 0, 9); cons(g, f, 1, 7, 8, 4); }
      else { cons(g, c, ix, 0, iw, 3 + (ih > 3 ? 0 : 0)); g.hl(4, 0, 9); for (const x of stems) g.vl(x, 5, 5); cons(g, f, 1, 7, 8, 4); }
    }
    return g;
  }
  // Mixed vowels.
  const h0 = v[0], sp = vc[v[1]];
  if (big) {
    const sx = 3, lx = 7;
    if (!f) {
      cons(g, c, 0, 0, 7, 6);
      if (h0 === 'ㅗ') { g.vl(sx, 7, 8); g.hl(9, 0, lx); vertVowel(g, sp, 0, 13, [5, 4, 7]); }
      else if (h0 === 'ㅜ') { g.hl(8, 0, lx); g.vl(sx, 9, 12); vertVowel(g, sp, 0, 13, [10, 4, 7]); }
      else { g.hl(9, 0, lx); vertVowel(g, sp, 0, 13, [5, 4, 7]); }
    } else {
      cons(g, c, 0, 0, 6, h0 === 'ㅜ' ? 4 : 5);
      if (h0 === 'ㅗ') { g.vl(sx, 5, 5); g.hl(6, 0, lx); vertVowel(g, sp, 0, 6, [3, 2, 4]); cons(g, f, 2, 8, 10, 6); }
      else if (h0 === 'ㅜ') { g.hl(5, 0, lx - 1); g.vl(sx, 6, 7); vertVowel(g, sp, 0, 7, [6, 2, 4]); cons(g, f, 2, 9, 10, 5); }
      else { g.hl(6, 0, lx); vertVowel(g, sp, 0, 6, [3, 2, 4]); cons(g, f, 2, 8, 10, 6); }
    }
  } else {
    const sx = 2, lx = 5;
    if (!f) {
      cons(g, c, 0, 0, 5, 5);
      if (h0 === 'ㅗ') { g.vl(sx, 6, 6); g.hl(7, 0, lx); vertVowel(g, sp, 0, 10, [4, 3, 5]); }
      else if (h0 === 'ㅜ') { g.hl(6, 0, lx); g.vl(sx, 7, 9); vertVowel(g, sp, 0, 10, [8, 3, 5]); }
      else { g.hl(7, 0, lx); vertVowel(g, sp, 0, 10, [4, 3, 5]); }
    } else {
      cons(g, c, 0, 0, 5, 3);
      if (h0 === 'ㅗ') { g.set(sx, 3); g.hl(4, 0, lx); vertVowel(g, sp, 0, 5, [2, 1, 3]); cons(g, f, 1, 7, 8, 4); }
      else if (h0 === 'ㅜ') { g.hl(4, 0, lx - 1); g.set(sx, 5); vertVowel(g, sp, 0, 5, [5, 1, 3]); cons(g, f, 1, 7, 8, 4); }
      else { g.hl(4, 0, lx); vertVowel(g, sp, 0, 5, [2, 1, 3]); cons(g, f, 1, 7, 8, 4); }
    }
  }
  return g;
}

// Latin strokes: each group of four hex digits is x0 y0 x1 y1 on a 5x9 grid (rows 9-10 are descenders).
const LATIN = {
  A: '0802 0220 2042 4248 0545', B: '0008 0030 3041 4143 4334 0434 3445 4547 4738 3808', C: '4130 3010 1001 0107 0718 1838 3847', D: '0008 0030 3041 4147 4738 3808', E: '4000 0008 0848 0434', F: '4000 0008 0434', G: '4130 3010 1001 0107 0718 1838 3847 4744 4424', H: '0008 4048 0444', I: '1030 2028 1838', J: '4047 4738 3818 1807 0706', K: '0008 4004 0448', L: '0008 0848', M: '0008 0022 2240 4048', N: '0008 0147 4048', O: '1030 3041 4147 4738 3818 1807 0701 0110', P: '0008 0030 3041 4143 4334 3404', Q: '1030 3041 4147 4738 3818 1807 0701 0110 2648', R: '0008 0030 3041 4143 4334 3404 2448', S: '4130 3010 1001 0103 0314 1434 3445 4547 4738 3818 1807', T: '0040 2028', U: '0007 0718 1838 3847 4740', V: '0005 0528 2845 4540', W: '0007 0718 1826 2638 3847 4740', X: '0048 4008', Y: '0024 4024 2428', Z: '0040 4008 0848',
  0: '1030 3041 4147 4738 3818 1807 0701 0110 2425', 1: '1120 2028 1838', 2: '0110 1030 3041 4143 4308 0848', 3: '0110 1030 3041 4143 4334 3424 3445 4547 4738 3818 1807', 4: '3006 0646 3038', 5: '4000 0004 0434 3445 4547 4738 3818 1807', 6: '4130 3010 1001 0107 0718 1838 3847 4745 4534 3404', 7: '0040 4042 4225 2528', 8: '1030 3041 4143 4334 3414 1403 0301 0110 3445 4547 4738 3818 1807 0705 0514', 9: '0718 1838 3847 4741 4130 3010 1001 0103 0314 1444',
  a: '1333 3344 4448 4818 1807 0706 0615 1545', b: '0008 0413 1333 3344 4447 4738 3818 1807', c: '4433 3313 1304 0407 0718 1838 3847', d: '4048 4433 3313 1304 0407 0718 1838 3847', e: '0545 4544 4433 3313 1304 0407 0718 1848', f: '4030 3021 2128 0343', g: '4433 3313 1304 0406 0617 1737 3746 4349 493a 3a1a', h: '0008 0413 1333 3344 4448', i: '2121 2328', j: '3131 3339 392a 2a1a', k: '0008 4306 1648', l: '2027 2738', m: '0308 0313 1324 2428 2433 3344 4448', n: '0308 0413 1333 3344 4448', o: '1333 3344 4447 4738 3818 1807 0704 0413', p: '030a 0413 1333 3344 4446 4637 3717 1706', q: '434a 4433 3313 1304 0406 0617 1737 3746', r: '0308 0413 1333 3344', s: '4313 1304 0415 1535 3546 4647 4738 3808', t: '1117 1728 2838 0333', u: '0307 0718 1838 3847 4348', v: '0305 0528 2845 4543', w: '0306 0618 1825 2538 3846 4643', x: '0348 4308', y: '0306 0617 1747 4349 493a 3a1a', z: '0343 4308 0848',
  '.': '2828', ',': '2829 2919', '!': '2025 2828', '?': '0110 1030 3041 4142 4224 2425 2828', ':': '2323 2727', ';': '2323 2729', '-': '1434', '+': '0444 2226', '=': '0343 0646', '/': '4008', '\\': '0048', '(': '3021 2127 2738', ')': '1021 2127 2718', '[': '3010 1018 1838', ']': '1030 3038 3818', '<': '3105 0538', '>': '1145 4518', '*': '2226 0444 1335 3315', '%': '4008 0001 1011 3738 4748', '#': '1018 3038 0343 0646', "'": '2022', '"': '1012 3032', '_': '0848', '~': '0514 1425 2534', '^': '0220 2042', '|': '2028', '&': '1030 3012 1248 3807 0705 0514', '@': '4838 3818 1807 0701 0110 1030 3041 4146 4636 3634 2434 2426 2636', '$': '4130 3010 1001 0103 0314 1434 3445 4547 4738 3818 1807 2028', '`': '1021',
};
const NARROW = { '.': 2, ',': 2, '!': 2, ':': 2, ';': 2, "'": 2, '|': 2, i: 2, l: 3, I: 3, '(': 3, ')': 3, '[': 3, ']': 3, 1: 4, j: 3, t: 4, '`': 2 };
// Symbols as bitmaps: rows of '.' and '#'.
const SYMBOLS = {
  '…': ['......#.', '........', '#..#..#.'.replace(/#\.\.#\.\.#\./, '#..#..#.')],
  '·': ['##', '##'],
  '★': ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '.#.....#.'],
  '☆': ['....#....', '....#....', '...#.#...', '####.####', '.#.....#.', '..#...#..', '..#.#.#..', '.#.#.#.#.', '.##...##.'],
  '♥': ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  '●': ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
  '○': ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'],
  '■': ['#######', '#######', '#######', '#######', '#######', '#######', '#######'],
  '□': ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'],
  '▶': ['##....', '####..', '######', '######', '####..', '##....'],
  '◀': ['....##', '..####', '######', '######', '..####', '....##'],
  '▲': ['...#...', '...#...', '..###..', '..###..', '.#####.', '#######'],
  '▼': ['#######', '.#####.', '..###..', '..###..', '...#...', '...#...'],
  '→': ['.....#..', '......#.', '########', '......#.', '.....#..'],
  '←': ['..#.....', '.#......', '########', '.#......', '..#.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '×': ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '♪': ['..##.', '..#.#', '..#..', '..#..', '###..', '###..'],
  '₩': ['#...#...#', '#...#...#', '#########', '.#.#.#.#.', '#########', '.#.#.#.#.', '..#...#..', '..#...#..'],
  '—': ['##########'],
  '「': ['####', '#...', '#...', '#...', '#...'],
  '」': ['...#', '...#', '...#', '...#', '####'],
  '※': ['#..#..#', '.#...#.', '..#.#..', '#..#..#', '..#.#..', '.#...#.', '#..#..#'],
  '✓': ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'],
};
SYMBOLS['…'] = ['#...#...#', '#...#...#'];

const glyphCache = { 14: new Map(), 11: new Map() };
function makeGlyph(ch, S) {
  const code = ch.codePointAt(0), big = S === 14;
  if (code >= 0xAC00 && code <= 0xD7A3) { const g = composeHangul(code, S); return { runs: g.runs(), w: g.w, adv: big ? 14 : 11 }; }
  if (code >= 0x3131 && code <= 0x3163) {
    const g = new Bits(big ? 12 : 9, S);
    const list = 'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    const k = code - 0x3131;
    if (k < list.length) cons(g, list[k], big ? 1 : 0, big ? 2 : 1, big ? 9 : 8, big ? 9 : 8);
    return { runs: g.runs(), w: g.w, adv: big ? 12 : 10 };
  }
  if (SYMBOLS[ch]) {
    const rows = SYMBOLS[ch], w = Math.max(...rows.map(r => r.length)), g = new Bits(w, Math.max(S, rows.length));
    const oy = ch === '…' ? S - 5 : Math.max(0, Math.floor((S - rows.length) / 2) + (ch === '·' || ch === '—' ? 0 : 0));
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') g.set(x, y + oy); });
    return { runs: g.runs(), w, adv: w + 2 };
  }
  if (ch === ' ') return { runs: [], w: 0, adv: big ? 6 : 5 };
  const st = LATIN[ch] || LATIN['?'];
  const gw = big ? 6 : 5, g = new Bits(gw + 1, S + 2);
  const sx = big ? 1.25 : 1, sy = big ? 10 / 8 : 7 / 8, oy = big ? 2 : 2;
  const nar = NARROW[ch];
  for (const s of st.split(' ')) {
    const [x0, y0, x1, y1] = [...s].map(d => parseInt(d, 16));
    const f = (x, y) => [Math.round(x * (nar ? 1 : sx)), Math.round(y * sy) + oy];
    const a = f(x0, y0), b = f(x1, y1);
    g.line(a[0], a[1], b[0], b[1]);
  }
  let runs = g.runs();
  if (nar) { let m = 99; for (const r of runs) m = Math.min(m, r[0]); runs = runs.map(r => [r[0] - m, r[1], r[2]]); }
  let mw = 0;
  for (const r of runs) mw = Math.max(mw, r[0] + r[2]);
  return { runs, w: mw, adv: mw + 2 };
}
function glyph(ch, S) {
  const m = glyphCache[S];
  let g = m.get(ch);
  if (!g) { g = makeGlyph(ch, S); m.set(ch, g); }
  return g;
}

const COLOR_TAGS = { y: '#ffd65a', r: '#ff6b78', g: '#7be88f', b: '#62d7ff', p: '#ff8fc4', o: '#ffa14d', d: '#9aa6d6', v: '#d29bff' };
const TAG_RE = /\{([a-z\/])\}/g;
export const stripTags = s => s.replace(TAG_RE, '');

export function textWidth(str, size = 14, scale = 1, bold = false) {
  let w = 0;
  for (const ch of stripTags(str)) w += glyph(ch, size).adv + (bold ? 1 : 0);
  return Math.max(0, w - (size === 14 ? 1 : 1)) * scale;
}

const textCache = new Map();
function stringCanvas(str, size, scale, color, outline, bold, grad, shadow) {
  const key = str + '\u0001' + size + scale + color + (outline || '') + (bold ? 'b' : '') + (grad || '') + (shadow || '');
  let c = textCache.get(key);
  if (c) { textCache.delete(key); textCache.set(key, c); return c; }
  const pad = 2, w = textWidth(str, size, 1, bold) + pad * 2 + 2, h = size + 3 + pad * 2;
  c = makeCanvas(w, h);
  const g = ctxOf(c);
  const put = (ox, oy, col) => {
    g.fillStyle = col;
    let x = pad + ox;
    for (const ch of str) {
      const gl = glyph(ch, size);
      for (const r of gl.runs) g.fillRect(x + r[0], pad + oy + r[1], r[2] + (bold ? 1 : 0), 1);
      x += gl.adv + (bold ? 1 : 0);
    }
  };
  if (shadow) { put(1, 1, shadow); }
  if (outline) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) put(dx, dy, outline);
  if (grad) {
    // Two-tone face: draw once, then recolour the lower half.
    put(0, 0, color);
    const t = makeCanvas(w, h), tg = ctxOf(t);
    tg.fillStyle = grad;
    let x = pad;
    for (const ch of str) {
      const gl = glyph(ch, size);
      for (const r of gl.runs) if (r[1] >= size * .55) tg.fillRect(x + r[0], pad + r[1], r[2] + (bold ? 1 : 0), 1);
      x += gl.adv + (bold ? 1 : 0);
    }
    g.drawImage(t, 0, 0);
  } else put(0, 0, color);
  let out = c;
  if (scale !== 1) { out = makeCanvas(w * scale, h * scale); const og = ctxOf(out); og.drawImage(c, 0, 0, w * scale, h * scale); }
  out.pad = pad * scale;
  textCache.set(key, out);
  if (textCache.size > 900) textCache.delete(textCache.keys().next().value);
  return out;
}

// Draws one line. Options: color, size (14|11), scale, outline, bold, align (l|c|r), alpha, grad, shadow.
export function drawText(g, str, x, y, o = {}) {
  str = String(str);
  if (!str) return 0;
  const size = o.size || 14, scale = o.scale || 1, color = o.color || UI.text, bold = !!o.bold;
  const w = textWidth(str, size, scale, bold);
  let px = Math.round(o.align === 'c' ? x - w / 2 : o.align === 'r' ? x - w : x);
  const py = Math.round(y);
  const old = g.globalAlpha;
  if (o.alpha != null) g.globalAlpha = old * o.alpha;
  if (str.indexOf('{') < 0) {
    const c = stringCanvas(str, size, scale, color, o.outline, bold, o.grad, o.shadow);
    g.drawImage(c, px - c.pad, py - c.pad);
  } else {
    const re = new RegExp(TAG_RE.source, 'g');
    let col = color, last = 0, m;
    const seg = s => { if (!s) return; const c = stringCanvas(s, size, scale, col, o.outline, bold, o.grad, o.shadow); g.drawImage(c, px - c.pad, py - c.pad); for (const ch of s) px += (glyph(ch, size).adv + (bold ? 1 : 0)) * scale; };
    while ((m = re.exec(str))) { seg(str.slice(last, m.index)); col = m[1] === '/' ? color : COLOR_TAGS[m[1]] || color; last = m.index + m[0].length; }
    seg(str.slice(last));
  }
  g.globalAlpha = old;
  return w;
}

// Splits text into lines. Tags stay attached and reopen on the next line when a colour spans a wrap.
export function wrapText(str, width, size = 14, bold = false) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '', lw = 0, open = '';
    const tokens = para.split(/( )/);
    const push = () => { out.push(line.replace(/ +$/, '') + (open ? '{/}' : '')); line = open ? '{' + open + '}' : ''; lw = 0; };
    const tagScan = s => { const re = new RegExp(TAG_RE.source, 'g'); let m; while ((m = re.exec(s))) open = m[1] === '/' ? '' : m[1]; };
    for (const tk of tokens) {
      if (!tk) continue;
      const w = textWidth(tk, size, 1, bold) + 1;
      if (lw + w > width && lw > 0 && tk !== ' ') push();
      if (w > width) {
        for (const ch of tk) { const cw = glyph(ch, size).adv + (bold ? 1 : 0); if (lw + cw > width) push(); line += ch; lw += cw; }
      } else if (!(tk === ' ' && lw === 0)) { line += tk; lw += w; }
      tagScan(tk);
    }
    out.push(line);
  }
  return out;
}

// Draws the first n visible characters of a tagged line (typewriter).
export function sliceTagged(str, n) {
  let out = '', k = 0, i = 0;
  while (i < str.length && k < n) {
    if (str[i] === '{' && str[i + 2] === '}') { out += str.slice(i, i + 3); i += 3; continue; }
    const ch = String.fromCodePoint(str.codePointAt(i));
    out += ch; i += ch.length; k++;
  }
  return out;
}
export const visLen = s => [...stripTags(s)].length;
