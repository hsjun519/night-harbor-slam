// Head painter. Faces, hair, masks and hats are drawn once per expression at 4x and then sampled by the rasterizer.
import { makeCanvas, ctxOf } from '../core/util.js';
import { rampHex, skinHex, mixHex, OUTLINE_HEX } from './palette.js';

const TS = 4, HW = 152, HH = 152, HCX = 72, HCY = 84;
const headCache = new Map();
export const EXPRS = ['neutral', 'fierce', 'shout', 'hurt', 'dizzy', 'ko', 'happy', 'talk', 'blink', 'smug', 'sad'];

function painter(g) {
  const path = (pts, curve) => {
    g.beginPath();
    if (!curve) { pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); }
    else {
      const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let m = mid(pts[n - 1], pts[0]);
      g.moveTo(m[0], m[1]);
      for (let i = 0; i < n; i++) { const e = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    }
    g.closePath();
  };
  return {
    g,
    poly(c, pts, curve = false) { g.fillStyle = c; path(pts, curve); g.fill(); },
    blob(c, pts) { g.fillStyle = c; path(pts, true); g.fill(); },
    ell(c, x, y, rx, ry = rx, rot = 0) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); },
    rect(c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); },
    line(c, w, pts) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); },
    clip(pts, curve, fn) { g.save(); path(pts, curve); g.clip(); fn(); g.restore(); },
  };
}

const FACE = {
  square: [[-8.4, -10], [0, -12.4], [6.4, -11], [9.4, -6.4], [9.6, -2.8], [9.8, 4], [9.6, 8.8], [7, 11.8], [0.6, 11.4], [-4.6, 7.2], [-6.4, 1.6], [-10.4, -0.6], [-10.8, -6]],
  round: [[-8.6, -10], [0, -12.4], [6.4, -11], [9.6, -6], [10, -1], [10, 4.6], [8.6, 8.8], [5, 11.4], [0, 10.6], [-4.8, 7], [-6.8, 1.4], [-10.6, -0.6], [-11, -6]],
  long: [[-8.2, -10.4], [0, -12.8], [6, -11.4], [9, -6.8], [9.2, -2.8], [9.4, 4], [9, 10], [6.4, 13.2], [1.4, 12.2], [-3.8, 7.6], [-6, 1.6], [-10, -0.6], [-10.6, -6]],
  slim: [[-8.2, -10], [0, -12.4], [6, -11], [8.9, -6.4], [9, -2.4], [9.2, 3.4], [8, 8.4], [5.8, 11.2], [1.6, 9.8], [-3.8, 6], [-5.8, 1.4], [-9.8, -0.6], [-10.4, -6]],
  jaw: [[-8.6, -9.6], [0, -12], [6.4, -10.6], [9.4, -6.2], [9.8, -2.4], [10.4, 4], [11, 9.4], [8.4, 12.6], [0.2, 12.4], [-5.4, 8], [-6.8, 1.8], [-10.6, -0.4], [-11, -5.8]],
  fat: [[-8.8, -9.8], [0, -12.2], [6.6, -10.8], [9.8, -6], [10.2, -1.4], [11, 4.6], [10.4, 10.4], [6.6, 13.4], [-0.6, 13], [-6.8, 8.8], [-8, 2], [-11, -0.4], [-11.4, -6]],
};

function paintEyes(p, h, ex, S) {
  const line = S[0], fem = h.lashes;
  const W = '#fbf7ee', eye = h.eye || '#3a2436';
  const nx = 3.4, fx = 8.2, y = -1.2;
  const closed = (x, w, up) => p.line(line, 1.1, up ? [[x - w, y + .9], [x, y - .9], [x + w, y + .9]] : [[x - w, y + .2], [x, y + .9], [x + w, y + .2]]);
  if (ex === 'ko') { for (const [x, w] of [[nx, 1.9], [fx, 1.5]]) { p.line(line, 1.1, [[x - w, y - 1.6], [x + w, y + 1.8]]); p.line(line, 1.1, [[x + w, y - 1.6], [x - w, y + 1.8]]); } return; }
  if (ex === 'hurt') { p.line(line, 1.15, [[nx - 2, y - 1.4], [nx + 1.6, y + .2], [nx - 2, y + 1.6]]); p.line(line, 1.15, [[fx + 1.6, y - 1.4], [fx - 1, y + .2], [fx + 1.6, y + 1.6]]); return; }
  if (ex === 'blink') { closed(nx, 2.1, false); closed(fx, 1.5, false); return; }
  if (ex === 'happy') { closed(nx, 2.1, true); closed(fx, 1.5, true); return; }
  if (ex === 'dizzy') { for (const [x, r] of [[nx, 2.7], [fx, 2.2]]) { p.ell(line, x, y, r + .6, r + .7); p.ell(W, x, y, r, r + .1); p.ell(line, x + .5, y + .5, .8, .8); p.line(line, .5, [[x - 1, y + .4], [x - .4, y - 1], [x + 1, y - .9]]); } return; }
  const squint = ex === 'fierce' || ex === 'smug' || ex === 'shout' ? .55 : 0;
  const one = (x, rx, ry, px) => {
    p.ell(line, x, y - .1, rx + .55, ry + .55);
    p.ell(W, x, y + .1, rx, ry);
    p.ell(eye, x + px, y + .15, Math.min(1.25, rx * .62), ry * .92);
    p.rect('#ffffff', x + px + .1, y - .9, .7, .7);
    if (squint) p.rect(S[2], x - rx - .8, y - ry - 1, rx * 2 + 1.6, ry * squint + 1);
    if (squint) p.rect(line, x - rx - .4, y - ry + ry * squint - .5, rx * 2 + .8, .8);
    if (fem) { p.line(line, 1, [[x - rx - 1, y - ry - .2], [x - rx * .2, y - ry - .5], [x + rx + .2, y - ry + .2]]); p.line(line, .8, [[x - rx - 1.6, y - ry - .9], [x - rx, y - ry + .3]]); }
  };
  one(nx, fem ? 2.1 : 1.9, fem ? 2.1 : 1.7, .55); one(fx, 1.5, fem ? 2 : 1.6, .45);
}
function paintBrows(p, h, ex, S) {
  if (h.noBrow) return;
  const c = h.browCol || mixHex(h.hairCol || '#2a1a2a', '#140a22', .35), w = h.browW || (h.lashes ? 1 : 1.5);
  const k = ex === 'fierce' || ex === 'shout' ? 1.5 : ex === 'hurt' || ex === 'sad' || ex === 'dizzy' ? -1.4 : ex === 'smug' ? .5 : ex === 'happy' ? -.5 : (h.browTilt || .35);
  p.line(c, w, [[.9, -4.5 - k * .55], [5.6, -3.9 + k * .6]]);
  p.line(c, w, [[7, -3.9 + k * .55], [10, -4.6 - k * .45]]);
}
function paintMouth(p, h, ex, S) {
  const line = S[0], y = 6.5 + (h.face === 'long' ? .8 : h.face === 'slim' ? -.3 : 0);
  const lip = h.lips;
  switch (ex) {
    case 'fierce': p.rect(line, 3.4, y - 1.5, 5.8, 3); p.rect('#f6f2e6', 4, y - .9, 4.6, 1.8); p.line(line, .5, [[4, y], [8.6, y]]); p.line(line, .5, [[6.2, y - .9], [6.2, y + .9]]); break;
    case 'shout': p.ell(line, 6.4, y + .2, 3.1, 2.8); p.ell('#7c1a3a', 6.4, y + .5, 2.3, 2); p.rect('#f6f2e6', 4.8, y - 1.9, 3.4, 1); p.ell('#ff7a8c', 6.6, y + 1.7, 1.4, .8); break;
    case 'hurt': p.poly(line, [[3.2, y + 1.4], [4.4, y - 1.4], [8.6, y - 1.2], [9.2, y + 1.6]]); p.rect('#f6f2e6', 4.5, y - .7, 4, 1); p.rect('#7c1a3a', 4.4, y + .3, 4.2, .8); break;
    case 'dizzy': p.line(line, 1, [[3.4, y], [4.8, y + 1], [6.2, y - .4], [7.6, y + 1], [9, y]]); break;
    case 'ko': p.ell(line, 6.2, y + .3, 2.6, 1.9); p.ell('#7c1a3a', 6.2, y + .4, 1.8, 1.2); p.ell('#ff7a8c', 6.8, y + 1.7, 1.2, 1.7); break;
    case 'happy': p.poly(line, [[3, y - 1], [9.4, y - 1.2], [8.6, y + 1.6], [6.2, y + 2.4], [4, y + 1.4]]); p.poly('#f6f2e6', [[3.8, y - .4], [8.8, y - .6], [8.3, y + .7], [4.3, y + .8]]); break;
    case 'talk': p.ell(line, 6.6, y, 2, 1.7); p.ell('#8c2346', 6.6, y + .3, 1.3, 1); break;
    case 'smug': p.line(line, 1.1, [[4, y + .4], [7, y + .3], [9.2, y - 1.1]]); break;
    case 'sad': p.line(line, 1.1, [[4, y + .9], [6.4, y - .1], [8.8, y + .9]]); break;
    default: if (lip) { p.ell(lip, 6.8, y + .1, 2.3, 1.1); p.line(line, .7, [[4.6, y], [9, y - .1]]); } else { p.line(line, 1.1, [[4.2, y + .2], [8.8, y - .1]]); p.line(S[1], .7, [[5.2, y + 1.6], [7.6, y + 1.5]]); }
  }
}

const HAIR = {
  bald(p, h, H, S) { p.ell(S[4], 1.6, -9, 2.6, 1.3, -.3); },
  buzz(p, h, H, S) { p.blob(mixHex(H[1], S[1], .35), [[-10.6, -1], [-11.2, -7], [-7, -11.8], [0, -13], [6.6, -11.4], [9.4, -7], [7, -7.2], [1, -8], [-3, -5], [-5.4, -1], [-7, 1.4]]); p.blob(mixHex(H[2], S[2], .3), [[-7, -10.6], [0, -12.4], [6, -10.8], [3, -9.2], [-5, -8.4]]); },
  short(p, h, H) {
    p.blob(H[1], [[-11, 0], [-12, -7], [-8, -13], [0, -14.8], [7, -13], [10.4, -8], [9, -5.4], [5, -8], [0, -8.4], [-3.6, -5], [-5, -1], [-7, 2]]);
    p.blob(H[2], [[-10.6, -5], [-8.4, -12], [0, -14], [6.8, -12.4], [9.6, -8.2], [4.6, -9.4], [-3, -8.8], [-7, -4.4]]); p.blob(H[3], [[-6.6, -11], [-1, -13.4], [4.6, -12.2], [1, -11], [-4, -9.6]]);
  },
  spiky(p, h, H) {
    const a = [[-11.6, 1], [-14.4, -4], [-11.4, -5], [-14.6, -10.6], [-9.8, -10], [-10.6, -16.2], [-5, -12.8], [-3.2, -18.6], [0.8, -13.4], [5, -17.8], [6, -12], [10.8, -13.2], [9, -8], [11, -6.6], [7.6, -7], [5, -8.6], [2.4, -6], [0, -8.8], [-3, -5.4], [-5, -1], [-7.4, 2]];
    p.poly(H[1], a); p.poly(H[2], a.map(q => [q[0] * .9 + .6, q[1] * .92 - .8])); p.poly(H[3], [[-7.6, -10.6], [-5, -12.4], [-3.2, -16], [-1, -12.6], [1, -12.4], [4.4, -15], [4.8, -11.6], [0, -10.4]]);
  },
  mohawk(p, h, H, S) {
    p.blob(mixHex(S[1], H[1], .35), [[-10.6, -1], [-11, -7], [-7, -11.6], [0, -12.8], [6.4, -11.4], [9, -7.4], [2, -8.4], [-4, -4], [-6.6, .6]]);
    p.poly(H[1], [[-11.6, -2], [-15, -6], [-13.6, -11], [-14.4, -15], [-9.8, -15.4], [-8.6, -19.6], [-4, -17.4], [-.6, -21], [2.8, -17], [7.4, -18.4], [8, -13.4], [10.4, -11.4], [7.4, -9.4], [0, -11], [-6, -9], [-9.4, -4]]);
    p.poly(H[2], [[-11.6, -6], [-12.4, -13.6], [-8.4, -13.8], [-7.4, -17.6], [-3.6, -15.8], [-.6, -19], [2.2, -15.6], [6.4, -16.6], [6.8, -12.6], [0, -12.6], [-7, -10.4]]);
    p.poly(H[3], [[-8, -12.6], [-6.4, -15.6], [-3.4, -14], [-.6, -17], [1.8, -13.8], [-3, -12.6]]);
  },
  slick(p, h, H) {
    p.blob(H[1], [[-11, 4], [-13.6, -2], [-12.6, -9], [-7.6, -13.8], [0, -14.6], [7, -12.6], [9.8, -7.6], [6, -8.6], [0, -8], [-4, -4.6], [-5.4, 0], [-7.6, 4.4]]);
    p.blob(H[2], [[-12, -3], [-10.6, -9.6], [-5, -13.2], [1, -13.8], [7, -11.6], [9, -8.4], [2, -9.6], [-5, -6.4], [-8.6, 0]]); p.line(H[3], 1, [[7.2, -10.4], [0, -12], [-7, -9.2], [-10, -4]]); p.line(H[1], .8, [[6, -9.2], [-1, -10], [-7, -6.6], [-9.4, -1]]);
  },
  side(p, h, H) {
    HAIR.short(p, h, H);
    p.blob(H[1], [[-2, -13], [7, -13.4], [11.4, -8], [11.6, -2], [10, 1.6], [8.6, -3], [5, -6.8], [0, -8]]); p.blob(H[2], [[-2, -12.6], [6.6, -12.6], [10.4, -8], [10.4, -3.4], [8, -6.4], [3, -8.8]]); p.line(H[3], .9, [[1, -12], [6.6, -10.6], [9.4, -6.4]]);
  },
  afro(p, h, H) { for (const [x, y, r] of [[-8, -7, 7], [-2, -12, 8.4], [5.4, -11.6, 6], [-10, 0, 5], [0, -10, 9]]) p.ell(H[1], x, y, r); for (const [x, y, r] of [[-7, -9, 5], [-1, -13.4, 6], [5, -12.6, 4.2]]) p.ell(H[2], x, y, r); for (const [x, y] of [[-6, -13], [0, -16.6], [4.6, -14], [-9.6, -7], [-3, -11.6], [2, -12]]) p.ell(H[3], x, y, 1.2); },
  curly(p, h, H) { for (const [x, y, r] of [[-9.4, -1, 3.6], [-10.8, -6, 3.8], [-8, -11, 4], [-3, -13.4, 4], [2.4, -13.8, 3.8], [7, -11.4, 3.6], [9, -8, 2.6], [-4, -8, 4]]) p.ell(H[1], x, y, r); for (const [x, y, r] of [[-10, -6.6, 2.4], [-7.6, -11.6, 2.6], [-2.6, -14, 2.6], [2.6, -14.2, 2.4], [6.8, -12, 2.2]]) p.ell(H[2], x, y, r); for (const [x, y] of [[-8, -12.4], [-3, -15], [2.4, -15], [6.6, -12.8]]) p.ell(H[3], x, y, .9); },
  topknot(p, h, H) { HAIR.slick(p, h, H); p.ell(H[1], -3, -16.6, 4.2, 3.8); p.ell(H[2], -2.6, -17.2, 2.9, 2.6); p.rect(h.bandCol || '#d23b5a', -5.4, -14.6, 5, 1.6); },
  bun(p, h, H) { HAIR.slick(p, h, H); p.ell(H[1], -12, -8.6, 4.8, 4.8); p.ell(H[2], -11.8, -9.4, 3.4, 3.4); p.line(H[3], .8, [[-14, -10.4], [-11.4, -12], [-9.4, -10.4]]); },
  bob(p, h, H) {
    p.blob(H[1], [[-12.6, 8], [-13.4, -4], [-9, -13], [0, -15], [7, -13], [10.4, -8], [9.6, -4.4], [4.6, -7.6], [0, -6.6], [-1.6, 0], [-2, 8.4], [-7, 11]]);
    p.blob(H[2], [[-11.4, 5], [-12, -4], [-8, -12], [0, -14], [6.6, -12.2], [9.4, -8], [3.6, -9], [-2, -7], [-4, 0], [-5, 8]]); p.line(H[3], 1.1, [[5.6, -11.6], [-1, -12.4], [-7.4, -9], [-9.6, -2]]);
  },
  wave(p, h, H) {
    p.blob(H[1], [[-12, 12], [-15, 4], [-13.4, -4], [-9, -13.2], [0, -15.4], [7.4, -13.4], [10.6, -8], [9.4, -5], [4.4, -8], [-1, -6.8], [-3, 0], [-3.4, 8], [-6, 13]]);
    p.blob(H[2], [[-11.6, 8], [-13, 2], [-11.4, -5], [-7.6, -12], [0, -14.4], [6.8, -12.6], [9.6, -8.2], [3, -9.4], [-4, -6], [-5.6, 1], [-6.4, 9]]); p.line(H[3], 1.1, [[5.8, -11.6], [-1, -12.8], [-7.4, -9], [-10, -2], [-9, 5]]);
  },
  mullet(p, h, H) { HAIR.short(p, h, H); p.blob(H[1], [[-7, -3], [-12, -4], [-14.4, 4], [-13, 11], [-9, 9.6], [-6.4, 6], [-5.4, 1]]); p.blob(H[2], [[-8, -2], [-11.6, -2], [-13, 4], [-11.4, 8.6], [-8, 5]]); },
  flat(p, h, H) { p.poly(H[1], [[-10.6, 0], [-11, -8], [-10, -16.4], [7.6, -17], [10, -9], [8.6, -6.6], [2, -8], [-3.6, -5], [-5.4, 0], [-7, 2]]); p.poly(H[2], [[-9.6, -8], [-9, -15], [6.8, -15.8], [8.8, -9.2], [0, -9.6]]); p.poly(H[3], [[-8, -14], [6, -14.8], [6.4, -13.2], [-7.6, -12.4]]); },
  horns(p, h, H) { HAIR.slick(p, h, H); for (const sx of [0, 1]) { p.poly(H[1], sx ? [[2, -12], [6, -20.6], [8.6, -11.6]] : [[-9, -11], [-7.6, -20], [-3, -13]]); p.poly(H[3], sx ? [[3.6, -12.6], [6, -18], [6.8, -12]] : [[-7.4, -12], [-7, -17.6], [-5, -13]]); } },
};

const BEARD = {
  stubble(p, h, H, S) { p.blob(mixHex(S[2], h.hairCol || '#2a1a2a', .28), [[-4.6, 4], [-1, 5.4], [3, 4.6], [9.6, 4.4], [9.8, 9], [6.6, 11.8], [.4, 11.2], [-4, 7.6]]); },
  goatee(p, h, H) { p.blob(H[1], [[4, 7.4], [9.6, 7.2], [9.6, 11], [7.4, 14], [5, 12.4]]); p.blob(H[2], [[5, 9], [9, 8.6], [8.6, 11], [7.2, 12.6]]); p.line(H[1], 1.3, [[4, 5], [6.6, 4.4], [9.6, 5]]); },
  mustache(p, h, H) { p.blob(H[1], [[2.4, 6.4], [6.4, 3.6], [11.4, 5.4], [10.4, 6.8], [6.8, 5.6], [3.4, 7.6]]); p.line(H[3], .7, [[4, 5.4], [6.6, 4.4], [9.8, 5]]); },
  handlebar(p, h, H) { p.blob(H[1], [[1.2, 8.6], [2.6, 4.8], [6.6, 3.4], [11, 4.6], [12.6, 8], [10.6, 6.6], [6.8, 5.8], [3.8, 6.8], [2.6, 10]]); p.line(H[3], .7, [[3.4, 5.6], [6.6, 4.3], [10, 5]]); },
  full(p, h, H) { p.blob(H[1], [[-6, 1], [-3.6, 3.6], [1, 4.4], [4, 4], [6.6, 3.4], [10.4, 4.4], [11, 9.6], [8.4, 14.4], [2, 14.6], [-4, 10.4]]); p.blob(H[2], [[-3.4, 5], [1, 6], [3.6, 8], [9, 8.6], [9.4, 10.6], [7, 13], [1.6, 12.6], [-2.6, 9]]); p.line(H[3], .9, [[0, 8.6], [4, 11], [8, 11]]); },
  long(p, h, H) { BEARD.full(p, h, H); p.poly(H[1], [[-2.6, 10], [10, 11], [8.6, 18], [5.4, 22], [2.4, 18.4]]); p.poly(H[2], [[0, 12], [8.4, 12.6], [7, 17], [5, 19.4], [3, 16]]); p.line(H[3], .8, [[3, 13], [5, 17]]); },
  chops(p, h, H) { p.blob(H[1], [[-6.4, -2], [-3, -1], [-1, 4], [3.4, 6.6], [3, 10], [-1.4, 10.6], [-5, 6.6]]); p.blob(H[2], [[-5, 0], [-3, 1], [-1.6, 5], [1.6, 7.6], [0, 9], [-3.6, 6]]); },
  sideburn(p, h, H) { p.blob(H[1], [[-6.2, -3], [-3, -3], [-2.8, 4], [-4.6, 5]]); },
};

// Masks cover the head and leave eye holes; every design is a harbour motif.
const MASK = {
  plain(p, o) { p.blob(o.c1R[2], o.outline); p.clip(o.outline, true, () => { p.blob(o.c1R[1], [[-12, -2], [-3, 0], [-1, 13], [-12, 13]]); p.blob(o.c1R[3], [[-4, -13], [7, -12], [8, -8], [-3, -9]]); }); },
  gull(p, o) {
    MASK.plain(p, o);
    p.clip(o.outline, true, () => { p.blob(o.c2R[2], [[-12, -3], [-4, -8], [4, -5], [10.6, -5.4], [10.6, 1.4], [6, 2.6], [0, 2], [-6, 1.4]]); p.poly(o.c2R[3], [[-8, -3.4], [-2, -6.4], [4, -4.2], [0, -3]]); });
    p.poly(o.c3R[2], [[7.4, .4], [14.4, 3.6], [8.6, 5]]); p.poly(o.c3R[1], [[8.2, 3.4], [14.4, 3.6], [8.6, 5]]);
    p.poly(o.c1R[3], [[-8.8, -8], [-17, -13.4], [-13, -8.6], [-17.6, -7], [-12, -4.6], [-15.4, -1.4], [-9, -2]]); p.poly(o.c1R[1], [[-9, -5], [-14, -6], [-10, -3.4]]);
  },
  wave(p, o) { MASK.plain(p, o); p.clip(o.outline, true, () => { p.blob(o.c2R[2], [[-12, -4], [-6, -9], [0, -6], [-2, -2], [4, -8], [11, -9], [11, -14], [-12, -14]]); p.line(o.c2R[4], 1.2, [[-11, -3], [-6, -7.6], [-1, -5], [-2.4, -1.4], [4, -6.8], [10, -8]]); p.blob(o.c2R[2], [[-8, 8], [0, 6], [4, 9], [10, 8], [10, 14], [-8, 14]]); }); },
  shark(p, o) {
    MASK.plain(p, o);
    p.poly(o.c1R[1], [[-6, -11], [-7.6, -20], [2, -12]]); p.poly(o.c1R[3], [[-5, -12], [-6.4, -17], [0, -12.4]]);
    p.clip(o.outline, true, () => { p.blob(o.c2R[3], [[-6, 14], [-2, 4], [4, 2.4], [11, 3], [11, 14]]); });
    for (let i = 0; i < 5; i++) p.poly('#fff8e6', [[1.6 + i * 1.9, 3.2], [3.4 + i * 1.9, 3.2], [2.5 + i * 1.9, 5.4]]);
    for (let i = 0; i < 3; i++) p.line(o.c1R[0], .8, [[-5.4 + i * 1.6, 1], [-4.4 + i * 1.6, 4]]);
  },
  octo(p, o) { MASK.plain(p, o); p.blob(o.c1R[2], [[-10, -8], [-9, -17], [0, -20], [8, -16], [9, -8]]); p.blob(o.c1R[3], [[-6, -14], [0, -18], [5, -15], [0, -13]]); for (const [x, y] of [[-6, -10], [-1, -15], [4, -11]]) p.ell(o.c2R[3], x, y, 1.3); for (const x of [-7, -3, 1]) { p.blob(o.c1R[1], [[x, 6], [x + 3, 6], [x + 2.4, 14], [x + .4, 14]]); } },
  fog(p, o) { MASK.plain(p, o); p.clip(o.outline, true, () => { p.line(o.c2R[2], 1.1, [[6.8, -13], [6, 13]]); p.poly(o.c2R[1], [[-.4, -2.8], [6, -1], [5.6, .6], [0, -.6]]); p.poly(o.c2R[1], [[7.4, -1], [11, -2.6], [10.8, -.6], [7.6, .6]]); p.line(o.c1R[1], .9, [[4.4, 6], [9, 6]]); }); },
  oni(p, o) { MASK.plain(p, o); for (const pts of [[[0, -11], [-1, -19], [5, -12]], [[6, -11], [9.4, -18], [9.6, -9.4]]]) { p.poly(o.c3R[1], pts); p.poly(o.c3R[3], pts.map(q => [q[0] * .8 + 1, q[1] * .9 - 1])); } p.clip(o.outline, true, () => { p.poly(o.c2R[2], [[-1, -5.4], [5.4, -2.6], [5, -4.6], [0, -7]]); p.poly(o.c2R[2], [[7.4, -2.8], [11, -5.6], [10.6, -3.8]]); p.poly('#fff3d8', [[3.6, 7.6], [5, 7.6], [4.2, 4.4]]); p.poly('#fff3d8', [[8, 7.4], [9.4, 7.4], [8.9, 4.4]]); }); },
  anchor(p, o) { MASK.plain(p, o); p.clip(o.outline, true, () => { p.line(o.c2R[2], 1.5, [[6.6, -11], [6.4, 10]]); p.line(o.c2R[2], 1.4, [[2, -8], [10.4, -8]]); p.line(o.c2R[2], 1.6, [[-1, 5], [2, 9], [6.4, 10.4], [10, 8.6]]); }); },
  visor(p, o) { p.blob(o.c1R[1], [[-10, -9], [0, -14.4], [8, -13], [11.4, -7], [12, 5], [10, 12], [2, 13], [-4, 9], [-9, 2]]); p.blob(o.c1R[2], [[-7, -9], [0, -13], [7.6, -11.6], [10.4, -6], [10.8, 4], [8, 10], [2, 10]]); p.poly('#1a1030', [[.4, -4.4], [11.4, -5.2], [11.6, .8], [.6, 1.4]]); p.poly(o.c2R[3], [[1.4, -3.4], [10.4, -4.2], [10.6, -.4], [1.6, .4]]); p.poly('#ffffff', [[2.4, -2.8], [5, -3.2], [4, -.6], [2.6, -.4]]); for (const [x, y] of [[-6, -6], [-6, 4], [3, 10]]) p.ell(o.c1R[4], x, y, .9); p.line(o.c1R[3], .9, [[1, 4], [10, 3.4]]); p.line(o.c1R[3], .9, [[1.4, 6.4], [9.6, 5.8]]); },
};

const HAT = {
  captain(p, h) { p.blob('#f3f0e4', [[-12, -9], [-11, -16], [0, -20], [9, -17], [11.4, -10], [0, -11]]); p.blob('#cfc9d6', [[-12, -9], [-11, -13], [-6, -11.4], [0, -11]]); p.poly('#1d2547', [[-11.4, -11.6], [11.4, -12.4], [11.6, -8.6], [-11.4, -7.8]]); p.poly('#0e1330', [[4, -9], [14.6, -8], [14.8, -6.4], [6, -6.8]]); p.ell('#ffd65a', 5, -13, 2.2); p.ell('#c98a1a', 5, -13, 1); },
  beanie(p, h) { const R = rampHex(h.hatCol || '#c2453f'); p.blob(R[1], [[-11.6, -4], [-12, -12], [-6, -17], [2, -17.6], [9, -14], [10.6, -6.6], [0, -8]]); p.blob(R[2], [[-9, -9], [-5, -15.4], [2, -16.2], [8, -13], [8.6, -9]]); p.poly(R[3], [[-11.8, -3.6], [-11.4, -7.4], [10.6, -9.4], [10.8, -5.8]]); for (let i = -9; i < 10; i += 2.6) p.line(R[1], .7, [[i, -4], [i, -8.6]]); },
  cap(p, h) { const R = rampHex(h.hatCol || '#2d63b8'); p.blob(R[1], [[-11, -5], [-11.4, -11], [-5, -16], [3, -16], [9, -12], [10.4, -7], [0, -7.6]]); p.blob(R[2], [[-8, -10], [-4, -14.6], [3, -14.6], [8, -11], [8.4, -8.6]]); p.poly(R[3], [[5, -9.4], [16, -7], [16, -5.4], [6, -6.4]]); p.ell(R[4], 6.4, -11.4, 1.6); },
  hard(p, h) { const R = rampHex(h.hatCol || '#ffb52e'); p.blob(R[1], [[-12.4, -5], [-12, -12], [-6, -18], [2, -18.6], [9, -15], [11.6, -7]]); p.blob(R[2], [[-9, -11], [-5, -16.6], [2, -17.2], [8, -14], [9.4, -9]]); p.poly(R[3], [[-3, -18.4], [1.4, -18.8], [2.4, -9], [-2.6, -9]]); p.poly(R[1], [[-13, -7], [13.4, -9], [14, -6], [-13, -4.4]]); p.poly(R[3], [[-12, -6.6], [13, -8.4], [13, -7.6], [-12, -5.8]]); },
  band(p, h) { const R = rampHex(h.hatCol || '#d23b5a'); p.poly(R[2], [[-11, -4.6], [-10.6, -8.8], [0, -9.8], [9.8, -8.6], [9.8, -5], [0, -6.4]]); p.line(R[3], .9, [[-10.4, -8], [0, -9.2], [9.4, -8]]); p.line(R[1], .9, [[-10.6, -5.2], [0, -6.8], [9.4, -5.6]]); },
  bandana(p, h) { const R = rampHex(h.hatCol || '#d23b5a'); p.blob(R[1], [[-11.6, -2], [-11.8, -10], [-6, -14.6], [2, -15], [8.6, -12], [10.4, -6.6], [0, -8]]); p.blob(R[2], [[-8.6, -9], [-5, -13.4], [2, -13.8], [8, -11], [9, -8], [0, -9.4]]); p.poly(R[2], [[-11, -4], [-17, -1], [-14, 3], [-10.4, -1]]); for (const [x, y] of [[-5, -11], [1, -12], [5, -10]]) p.ell(R[4], x, y, .9); },
  headset(p) { p.line('#1a2148', 1.8, [[-5, -12.4], [-6.6, -6], [-5, -1]]); p.line('#1a2148', 1.6, [[-5.4, -12], [0, -14.4], [4, -13.6]]); p.ell('#1a2148', -4.8, .4, 3, 3.6); p.ell('#49d6ff', -4.8, .4, 1.4, 1.8); p.line('#1a2148', 1, [[-4, 3], [1, 8], [5.6, 8.4]]); p.ell('#1a2148', 6, 8.2, 1.2); },
  nurse(p) { p.poly('#f5f7ff', [[-6, -12], [-5, -18], [5, -18.6], [6.4, -12.6]]); p.rect('#ff4f6d', -.9, -17.4, 1.6, 4.4); p.rect('#ff4f6d', -2.3, -16, 4.4, 1.6); },
  crown(p) { p.poly('#e0a32e', [[-8, -10], [-9.6, -18], [-5, -14], [-1, -20], [2.6, -14.4], [7.6, -18.6], [7.6, -10.6]]); p.poly('#ffe07a', [[-6.6, -11.4], [-7.4, -15.4], [-4.4, -12.8], [-1, -17.4], [2, -13], [5.8, -15.8], [6, -11.6]]); p.ell('#ff4f6d', -1, -12.4, 1.3); },
};
const GLASS = {
  shades(p) { p.poly('#140a22', [[-.4, -3.4], [6.2, -3.4], [5.4, 1.2], [1, 1.2]]); p.poly('#140a22', [[6.8, -3.4], [11.2, -3.2], [10.6, 1], [7.4, 1]]); p.line('#140a22', 1.1, [[-5, -2], [1, -2.8]]); p.poly('#4b5a9c', [[1, -2.6], [3.6, -2.6], [2.4, -.4], [1.4, -.4]]); p.poly('#4b5a9c', [[7.6, -2.6], [9, -2.6], [8.4, -.6]]); },
  round(p) { p.line('#f0c24a', .9, [[-5, -2], [0, -1.8]]); for (const [x, r] of [[3.4, 3], [8.6, 2.5]]) { p.g.strokeStyle = '#f0c24a'; p.g.lineWidth = .9; p.g.beginPath(); p.g.ellipse(x, -1, r, r, 0, 0, 7); p.g.stroke(); } },
  square(p) { p.line('#1d1433', 1, [[-5, -2], [.4, -2]]); for (const [x, w] of [[.6, 5.6], [6.9, 4]]) { p.g.strokeStyle = '#1d1433'; p.g.lineWidth = 1; p.g.strokeRect(x, -3.4, w, 4.6); } },
  eyepatch(p) { p.poly('#140a22', [[.4, -3.8], [6, -3.6], [5.4, 1.6], [2, 2]]); p.line('#140a22', 1, [[-9, -6], [2, -3.4]]); p.line('#140a22', 1, [[5.6, -3.4], [9, -6]]); },
};

export function headTexture(look, expr = 'neutral') {
  const h = look.head;
  const key = JSON.stringify(h) + look.skin + '|' + expr;
  let t = headCache.get(key);
  if (t) return t;
  const c = makeCanvas(HW, HH), g = ctxOf(c, { willReadFrequently: true }), p = painter(g);
  g.setTransform(TS, 0, 0, TS, HCX, HCY);
  const S = skinHex(look.skin), H = rampHex(h.hairCol || '#3a2636'), outline = FACE[h.face] || FACE.square;
  const hairFn = HAIR[h.hair];
  // Back volume first so the skull covers it.
  if (h.backHair) { const b = h.backHair; p.blob(H[1], [[-6, -10], [-13, -8], [-14.6, 0], [-13.4, b], [-6, b + 1.5], [-2, 6], [0, -4]]); p.blob(H[2], [[-7, -9], [-12, -6], [-13, 0], [-11.6, b - 2], [-7, b - 1], [-4, 4]]); }
  if (h.mask && h.mask.full) {
    const m = h.mask, o = { outline, c1R: rampHex(m.c1), c2R: rampHex(m.c2 || '#ffffff'), c3R: rampHex(m.c3 || '#ffb52e') };
    if (h.maskHair && hairFn) hairFn(p, h, H, S);
    (MASK[m.kind] || MASK.plain)(p, o);
    if (m.kind !== 'visor' && m.kind !== 'fog') {
      const rim = o.c3R[2];
      p.ell(rim, 3.5, -1.1, 3.6, 3); p.ell(rim, 8.5, -1.1, 2.7, 2.8);
      p.ell(S[2], 3.5, -1.1, 2.7, 2.2); p.ell(S[2], 8.5, -1.1, 1.9, 2.1);
      paintEyes(p, h, expr, S);
      if (!m.noMouth) { p.blob(rim, [[2, 4.6], [6, 3.8], [10, 4.6], [10, 9], [6.4, 10.4], [2.4, 8.8]]); p.blob(S[2], [[3, 5.2], [6, 4.6], [9.4, 5.2], [9.4, 8.4], [6.4, 9.4], [3.2, 8.2]]); paintMouth(p, h, expr, S); }
    }
    if (m.kind === 'fog') { const col = expr === 'fierce' || expr === 'shout' ? '#ff5fa2' : expr === 'ko' ? '#5a5f7a' : '#49d6ff'; p.poly(col, [[.8, -1.9], [5.2, -.6], [4.8, .2], [1.2, -.8]]); p.poly(col, [[8, -.6], [10.4, -1.7], [10.2, -.8], [8.2, .2]]); }
  } else {
    p.blob(S[2], outline);
    p.clip(outline, true, () => {
      p.blob(S[1], [[-12, -4], [-5, -3], [-3.6, 4], [1, 8.4], [7, 9.6], [8.4, 14], [-12, 15]]);
      p.blob(S[3], [[-1, -10], [6, -10.6], [9.4, -6], [9.4, -4.4], [4, -5.4], [-1, -5.8]]);
      p.blob(S[3], [[5, 1.4], [9.6, .6], [9.8, 4.4], [6.6, 4.8]]);
      p.ell(S[4], 4.6, -8, 2.2, 1);
      if (h.blush) { p.ell(mixHex(S[2], '#ff5f7a', .45), 2.4, 3.2, 1.9, 1.1); p.ell(mixHex(S[2], '#ff5f7a', .45), 9, 3, 1, 1); }
    });
    // ear
    if (!h.noEar) { p.ell(S[0], -5.2, .4, 3, 3.9); p.ell(S[2], -5, .3, 2.2, 3.1); p.ell(S[1], -4.7, .8, 1.1, 1.8); }
    if (h.earring) p.ell(h.earring, -5, 4.2, 1.1);
    if (h.beard && BEARD[h.beard]) BEARD[h.beard](p, h, H, S);
    if (h.paint) h.paint === 'stripe' ? p.poly(h.paintCol, [[-1, -3.6], [10.4, -3.6], [10.2, .8], [-1, .8]]) : h.paint === 'lines' ? (p.line(h.paintCol, 1.1, [[1.6, 2.4], [1.2, 6]]), p.line(h.paintCol, 1.1, [[3.6, 2.8], [3.4, 6.4]]), p.line(h.paintCol, 1.1, [[9.6, 2.6], [9.6, 5.4]])) : h.paint === 'star' ? p.poly(h.paintCol, [[3.4, -6], [4.6, -2.6], [8, -1.4], [4.6, 0], [3.4, 4], [2.2, 0], [-1.4, -1.4], [2.2, -2.6]]) : h.paint === 'wave' ? p.line(h.paintCol, 1.6, [[-3, 4], [0, 2], [2, 4], [4.4, 2.2], [6.4, 4], [9.6, 2.2]]) : 0;
    paintEyes(p, h, expr, S);
    // nose
    p.blob(S[3], [[6.6, -.6], [8.4, -.4], [11.6, 2.6], [10.6, 4], [7.4, 3.8]]);
    p.line(S[0], .9, [[9.2, -.4], [11.9, 2.9], [10.6, 4.3], [7.6, 4.2]]); p.ell(S[4], 10, 2, .8);
    if (h.noseRed) p.ell(mixHex(S[2], '#ff4f4f', .5), 10.4, 2.8, 1.6, 1.5);
    paintMouth(p, h, expr, S);
    if (h.scar) p.line('#f6b7a0', .9, [[1, -6.6], [5.6, 3.4]]);
    if (h.wrinkle) { p.line(S[1], .7, [[1, 2.4], [4.4, 3]]); p.line(S[1], .7, [[2, -7], [7, -7.2]]); p.line(S[1], .7, [[3, 4.4], [3.4, 6.4]]); }
    if (hairFn) hairFn(p, h, H, S);
    if (!h.mask) paintBrows(p, h, expr, S);
    if (h.mask) { // half mask over the eyes
      const R = rampHex(h.mask.c1);
      p.blob(R[2], [[-10, -5.6], [0, -6.4], [10.6, -5.8], [11, -.6], [9, 2.2], [7, 1], [5, 2.6], [0, 2], [-9, -1]]); p.line(R[3], .9, [[-8, -4.6], [0, -5.4], [10, -4.8]]);
      p.ell(S[2], 3.5, -1.2, 2.5, 2); p.ell(S[2], 8.5, -1.2, 1.8, 1.9); paintEyes(p, h, expr, S);
    }
    if (h.tear && (expr === 'hurt' || expr === 'sad')) p.ell('#7fd8ff', 1.6, 2, 1, 1.4);
  }
  if (h.glass && GLASS[h.glass]) GLASS[h.glass](p, h);
  if (h.hat && HAT[h.hat]) HAT[h.hat](p, h);
  if (expr === 'hurt' || expr === 'dizzy') { p.ell('#8fe0ff', -2, -7, .9, 1.3); }
  const d = g.getImageData(0, 0, HW, HH), tex = new Uint32Array(d.data.buffer.slice(0));
  // Hard alpha, and a dark rim so hair and hats keep a contour against the body.
  for (let i = 0; i < tex.length; i++) if ((tex[i] >>> 24) < 120) tex[i] = 0; else tex[i] = (tex[i] | 0xff000000) >>> 0;
  t = { tex, w: HW, h: HH, ts: TS, cx: HCX, cy: HCY, canvas: c };
  headCache.set(key, t);
  if (headCache.size > 420) headCache.delete(headCache.keys().next().value);
  return t;
}
export const HAIR_STYLES = Object.keys(HAIR), BEARD_STYLES = Object.keys(BEARD), MASK_STYLES = Object.keys(MASK), HAT_STYLES = Object.keys(HAT), FACE_STYLES = Object.keys(FACE);

// Flat portrait for HUD and dialogue, drawn with the same head texture at an integer scale.
export function drawPortrait(g, look, expr, x, y, size, opt = {}) {
  const t = headTexture(look, expr), key = look;
  void key;
  const px = opt.px || 1; // screen pixels per head pixel
  const w = Math.round(HW / TS), h = Math.round(HH / TS);
  const tmp = portraitCanvas(t, w, h);
  g.save();
  g.beginPath(); g.rect(x, y, size, size); g.clip();
  const ox = x + size / 2 + (opt.dx || 0), oy = y + size * .56 + (opt.dy || 0);
  if (opt.flip) { g.translate(ox, oy); g.scale(-1, 1); g.drawImage(tmp, -(HCX / TS) * px, -(HCY / TS) * px, w * px, h * px); }
  else g.drawImage(tmp, ox - (HCX / TS) * px, oy - (HCY / TS) * px, w * px, h * px);
  g.restore();
}
function portraitCanvas(t, w, h) {
  if (t.small) return t.small;
  const c = makeCanvas(w, h), g = ctxOf(c), im = g.createImageData(w, h), d = new Uint32Array(im.data.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = t.tex[Math.min(t.h - 1, y * TS + 2) * t.w + Math.min(t.w - 1, x * TS + 2)]; d[y * w + x] = v; }
  // contour
  const out = d.slice(), ol = 0xff220a14 >>> 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!d[i] && (d[i - 1] || d[i + 1] || d[i - w] || d[i + w])) out[i] = ol; }
  d.set(out);
  g.putImageData(im, 0, 0);
  t.small = c;
  return c;
}
void OUTLINE_HEX;
