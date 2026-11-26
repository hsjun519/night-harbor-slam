// Poses, body proportions, forward kinematics and two-bone IK.
// Poses are written facing right. Angles in degrees. Arms: 0 hangs along the torso, 90 points forward, 180 up.
// Forearm flex is positive toward the front. Thigh: 0 straight down, 90 forward. Knee flex is positive (shin goes back).
import { DEG, clamp, lerp } from '../core/util.js';

export const PF = { r: 0, sp: 1, hd: 2, a1: 3, a2: 4, b1: 5, b2: 6, t1: 7, t2: 8, u1: 9, u2: 10, lift: 11, ox: 12, f1: 13, f2: 14, sq: 15 };
export const POSE_N = 16;
const PAIRS = { a: [3, 4], b: [5, 6], t: [7, 8], u: [9, 10], f: [13, 14] };
const SINGLES = { r: 0, sp: 1, hd: 2, lift: 11, ox: 12, sq: 15 };
const poseMemo = new Map();
// 'sp10 hd-5 a60/90 b70/80 t15/20 u-15/20 lift4'
export function pose(str) {
  let p = poseMemo.get(str);
  if (p) return p;
  p = new Float32Array(POSE_N);
  for (const tk of str.trim().split(/\s+/)) {
    if (!tk) continue;
    const m = /^([a-z]+)(-?[\d.]+)(?:\/(-?[\d.]+))?$/.exec(tk);
    if (!m) throw new Error('bad pose token ' + tk + ' in ' + str);
    if (PAIRS[m[1]]) { p[PAIRS[m[1]][0]] = +m[2]; p[PAIRS[m[1]][1]] = m[3] != null ? +m[3] : 0; }
    else if (m[1] in SINGLES) p[SINGLES[m[1]]] = +m[2];
    else throw new Error('bad pose key ' + tk);
  }
  poseMemo.set(str, p);
  return p;
}
export function poseLerp(a, b, t, out) { for (let i = 0; i < POSE_N; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; }
export function poseAdd(p, q, k = 1) { for (let i = 0; i < POSE_N; i++) p[i] += q[i] * k; return p; }

// Joint indices (x,y pairs).
export const J = { pelvis: 0, chest: 1, neck: 2, head: 3, sN: 4, eN: 5, hN: 6, sF: 7, eF: 8, hF: 9, pN: 10, kN: 11, aN: 12, tN: 13, pF: 14, kF: 15, aF: 16, tF: 17 };
export const JN = 18;

// Body builds. prof rows: [v, back, front] half widths of the torso at scale 1.
export const BUILDS = {
  athletic: { spine: 23, nk: 4, hd: 12, ua: 16, fa: 15, th: 20, sh: 19, ft: 4, fl: 10, sx: [-10, 8.5], hx: [-4.2, 4.2], uaR: [7.2, 5.6, .7], faR: [5.7, 4.1, .9], hR: 4.6, thR: [9, 6.6, .9], shR: [6.5, 4.4, 1.2], ftR: 4.4, nkR: 5, head: 1, mus: 1, prof: [[0, 8.5, 8.5], [.14, 10.2, 10.2], [.36, 9.6, 9.8], [.56, 12, 11.4], [.76, 14.6, 13.6], [.9, 12.6, 12], [1, 7, 7]] },
  power: { spine: 24, nk: 3, hd: 12, ua: 17, fa: 16, th: 19, sh: 18, ft: 4, fl: 11, sx: [-13.5, 11], hx: [-5, 5], uaR: [9, 7, 1.2], faR: [7.2, 5, 1.2], hR: 5.4, thR: [10.6, 7.6, 1], shR: [7.4, 5, 1.3], ftR: 5, nkR: 6.4, head: .98, mus: 1.2, prof: [[0, 9.5, 9.5], [.14, 11.5, 11.5], [.36, 11.5, 11.5], [.56, 15, 13.6], [.76, 18.4, 16.4], [.9, 16, 14.4], [1, 8.5, 8.5]] },
  lean: { spine: 22, nk: 4, hd: 12, ua: 15.5, fa: 15, th: 21, sh: 20, ft: 4, fl: 9.5, sx: [-8.4, 7.4], hx: [-3.4, 3.4], uaR: [5.8, 4.6, .6], faR: [4.8, 3.6, .7], hR: 4.1, thR: [7.8, 5.6, .9], shR: [5.6, 3.9, 1], ftR: 4, nkR: 4.3, head: 1, mus: .9, prof: [[0, 7, 7], [.14, 8.2, 8.4], [.36, 7.4, 7.8], [.56, 9.4, 9.2], [.76, 11.6, 11], [.9, 10, 9.8], [1, 6, 6]] },
  heavy: { spine: 24, nk: 3, hd: 12, ua: 16, fa: 15, th: 18, sh: 17, ft: 4, fl: 11, sx: [-13.5, 11], hx: [-5.6, 5.6], uaR: [9, 7.2, .6], faR: [7, 5, .6], hR: 5.2, thR: [11.6, 8, .5], shR: [7.6, 5.4, .8], ftR: 5, nkR: 7, head: 1.02, mus: 0, belly: 1, prof: [[0, 11, 12], [.12, 13.4, 16], [.3, 14, 20.5], [.5, 15.4, 19], [.74, 17.4, 16.4], [.9, 14.6, 13.4], [1, 8, 8]] },
  giant: { spine: 27, nk: 4, hd: 12.5, ua: 19, fa: 18, th: 23, sh: 22, ft: 5, fl: 12, sx: [-12.5, 10.5], hx: [-4.8, 4.8], uaR: [8.4, 6.6, .9], faR: [6.8, 4.9, .9], hR: 5.6, thR: [10.4, 7.6, .8], shR: [7.2, 5, 1], ftR: 5.2, nkR: 6, head: 1.02, mus: .9, prof: [[0, 9.4, 9.4], [.14, 11.4, 11.4], [.36, 11, 11.4], [.56, 13.6, 13], [.76, 17, 15.6], [.9, 14.6, 13.6], [1, 8, 8]] },
  fem: { spine: 21, nk: 4, hd: 12, ua: 14.5, fa: 14, th: 20.5, sh: 19.5, ft: 4, fl: 9, sx: [-7.6, 6.6], hx: [-3.8, 3.8], uaR: [5, 4, .5], faR: [4.3, 3.3, .6], hR: 3.9, thR: [8.6, 5.8, .8], shR: [5.7, 3.8, 1.1], ftR: 3.9, nkR: 3.9, head: 1, mus: .55, fem: 1, prof: [[0, 8.6, 8], [.14, 9.8, 9.2], [.36, 7.2, 7.4], [.56, 8.4, 8.6], [.74, 9.4, 11.2], [.88, 8.6, 8.8], [1, 5.2, 5.2]] },
  femPower: { spine: 22, nk: 4, hd: 12, ua: 15.5, fa: 15, th: 20, sh: 19, ft: 4, fl: 10, sx: [-9, 7.8], hx: [-4.4, 4.4], uaR: [6.6, 5.2, .9], faR: [5.4, 4, .9], hR: 4.4, thR: [10, 6.8, .9], shR: [6.5, 4.3, 1.2], ftR: 4.3, nkR: 4.6, head: 1, mus: .9, fem: 1, prof: [[0, 9.6, 9], [.14, 11, 10.4], [.36, 8.8, 8.8], [.56, 10.4, 10.2], [.74, 12, 12.6], [.88, 10.8, 10.4], [1, 6.2, 6.2]] },
  slim: { spine: 22, nk: 4, hd: 12, ua: 15, fa: 14.5, th: 20, sh: 19, ft: 4, fl: 9.5, sx: [-7.6, 6.6], hx: [-3.2, 3.2], uaR: [5.2, 4.4, .3], faR: [4.5, 3.6, .4], hR: 4, thR: [7.4, 5.4, .5], shR: [5.2, 4, .6], ftR: 4, nkR: 4, head: 1, mus: 0, prof: [[0, 7.6, 7.6], [.14, 8.4, 8.6], [.36, 8, 8.4], [.56, 9, 9], [.76, 10.6, 10], [.9, 9.4, 9], [1, 5.6, 5.6]] },
  stout: { spine: 21, nk: 3, hd: 12, ua: 14, fa: 13, th: 16, sh: 15, ft: 4, fl: 10, sx: [-9, 8], hx: [-4.4, 4.4], uaR: [6.8, 5.6, .3], faR: [5.4, 4.2, .3], hR: 4.4, thR: [9, 6.8, .3], shR: [6, 4.6, .5], ftR: 4.4, nkR: 5.4, head: 1.04, mus: 0, belly: 1, prof: [[0, 9, 10], [.14, 11, 13.6], [.32, 11.4, 16.4], [.54, 12, 14.6], [.76, 12.8, 12], [.9, 11, 10], [1, 6.4, 6.4]] },
  elder: { spine: 20, nk: 3, hd: 12, ua: 14, fa: 13, th: 17, sh: 16, ft: 4, fl: 9, sx: [-6.6, 6], hx: [-3.2, 3.2], uaR: [4.8, 4, .3], faR: [4.2, 3.4, .3], hR: 3.8, thR: [7, 5.2, .4], shR: [5, 3.8, .5], ftR: 3.9, nkR: 3.8, head: 1.02, mus: 0, prof: [[0, 8, 8], [.14, 9, 9.4], [.36, 8.6, 9.4], [.56, 8.8, 9], [.76, 9.4, 9.2], [.9, 8.4, 8.2], [1, 5, 5]] },
};
const dimsMemo = new Map();
export function dimsFor(build, scale = 1) {
  const key = build + scale;
  let d = dimsMemo.get(key);
  if (d) return d;
  const b = BUILDS[build] || BUILDS.athletic, s = scale, m = a => a.map(v => v * s);
  d = {
    build, scale, spine: b.spine * s, nk: b.nk * s, hd: b.hd * s, ua: b.ua * s, fa: b.fa * s, th: b.th * s, sh: b.sh * s, ft: b.ft * s, fl: b.fl * s,
    sx: m(b.sx), hx: m(b.hx), uaR: m(b.uaR), faR: m(b.faR), hR: b.hR * s, thR: m(b.thR), shR: m(b.shR), ftR: b.ftR * s, nkR: b.nkR * s, head: b.head * Math.pow(s, .6), mus: b.mus, belly: b.belly || 0, fem: b.fem || 0,
    prof: b.prof.map(p => [p[0], p[1] * s, p[2] * s]),
  };
  d.leg = d.th + d.sh + d.ft;
  d.height = d.leg + d.spine + d.nk + d.hd + 12 * d.head;
  d.reach = d.ua + d.fa + d.hR;
  // radius used for ground contact per joint
  d.gr = new Float32Array(JN);
  d.gr[J.pelvis] = d.thR[0] * .95; d.gr[J.chest] = d.uaR[0] + 1.5; d.gr[J.neck] = 3; d.gr[J.head] = 10 * d.head;
  for (const k of ['eN', 'eF']) d.gr[J[k]] = d.faR[0] * .8;
  for (const k of ['hN', 'hF']) d.gr[J[k]] = d.hR * .7;
  for (const k of ['kN', 'kF']) d.gr[J[k]] = d.shR[0] * .8;
  for (const k of ['aN', 'aF']) d.gr[J[k]] = d.ft;
  for (const k of ['tN', 'tF']) d.gr[J[k]] = d.ft * .6;
  d.gr[J.sN] = d.gr[J.sF] = 2; d.gr[J.pN] = d.gr[J.pF] = 4;
  dimsMemo.set(key, d);
  return d;
}

export class Joints {
  constructor() { this.p = new Float32Array(JN * 2); this.S = 0; this.H = 0; this.face = 1; this.yaw = 1; }
  x(i) { return this.p[i * 2]; }
  y(i) { return this.p[i * 2 + 1]; }
  set(i, x, y) { this.p[i * 2] = x; this.p[i * 2 + 1] = y; }
  copy(o) { this.p.set(o.p); this.S = o.S; this.H = o.H; this.face = o.face; this.yaw = o.yaw; return this; }
  lerp(a, b, t) {
    for (let i = 0; i < JN * 2; i++) this.p[i] = a.p[i] + (b.p[i] - a.p[i]) * t;
    const da = Math.atan2(Math.sin((b.S - a.S) * DEG), Math.cos((b.S - a.S) * DEG)) / DEG; this.S = a.S + da * t;
    const dh = Math.atan2(Math.sin((b.H - a.H) * DEG), Math.cos((b.H - a.H) * DEG)) / DEG; this.H = a.H + dh * t;
    this.face = t < .5 ? a.face : b.face; this.yaw = lerp(a.yaw, b.yaw, t);
    return this;
  }
}

/* Forward kinematics in facing-right local space.
   snap: put the lowest contact point on y=0 (feet origin). Otherwise the pelvis lands on (px, py). */
export function solveFK(p, d, out, opt = {}) {
  const r = p[0] * DEG, S = (p[0] + p[1]) * DEG, H = (p[0] + p[1] + p[2]) * DEG;
  const P = out.p;
  const set = (i, x, y) => { P[i * 2] = x; P[i * 2 + 1] = y; };
  let X = 0, Y = 0;
  set(0, 0, 0);
  const sS = Math.sin(S), cS = Math.cos(S), sq = 1 - clamp(p[15], -.4, .6) * .5;
  const cx = sS * d.spine * sq, cy = -cS * d.spine * sq;
  set(1, cx, cy);
  const nx = cx + sS * d.nk, ny = cy - cS * d.nk;
  set(2, nx, ny);
  set(3, nx + Math.sin(H) * d.hd, ny - Math.cos(H) * d.hd);
  const arm = (si, ox, u, f) => {
    const sx = cx + cS * ox + sS * -1.5, sy = cy + sS * ox + cS * 1.5;
    const a = u * DEG - S, b = (u + f) * DEG - S;
    const ex = sx + Math.sin(a) * d.ua, ey = sy + Math.cos(a) * d.ua;
    set(si, sx, sy); set(si + 1, ex, ey); set(si + 2, ex + Math.sin(b) * d.fa, ey + Math.cos(b) * d.fa);
  };
  arm(4, d.sx[0], p[3], p[4]); arm(7, d.sx[1], p[5], p[6]);
  const cr = Math.cos(r), sr = Math.sin(r);
  const leg = (li, ox, t, k, fa) => {
    const lx = cr * ox, ly = sr * ox;
    const a = t * DEG - r, b = (t - k) * DEG - r;
    const kx = lx + Math.sin(a) * d.th, ky = ly + Math.cos(a) * d.th;
    const ax = kx + Math.sin(b) * d.sh, ay = ky + Math.cos(b) * d.sh;
    const c = b + (90 - 0) * DEG + fa * DEG; // foot points forward of the shin
    set(li, lx, ly); set(li + 1, kx, ky); set(li + 2, ax, ay); set(li + 3, ax + Math.sin(c) * d.fl * .8, ay + Math.cos(c) * d.fl * .8);
  };
  leg(10, d.hx[0], p[7], p[8], p[13]); leg(14, d.hx[1], p[9], p[10], p[14]);
  out.S = (p[0] + p[1]); out.H = (p[0] + p[1] + p[2]); out.face = 1; out.yaw = 1;
  if (opt.snap !== false) {
    // flatten feet that touch the floor, then drop the body onto its lowest point
    let low = -1e9;
    for (let i = 0; i < JN; i++) { if (i === 13 || i === 17) continue; const v = P[i * 2 + 1] + d.gr[i]; if (v > low) low = v; }
    Y = -low - p[11]; X = p[12];
    for (let i = 0; i < JN; i++) { P[i * 2] += X; P[i * 2 + 1] += Y; }
    for (const a of [12, 16]) {
      const ay = P[a * 2 + 1];
      if (ay > -d.ft - 5 && !opt.freeFeet) { // near the floor: sole goes flat
        const k = clamp((ay + d.ft + 5) / 5, 0, 1), dirx = 1;
        P[(a + 1) * 2] = lerp(P[(a + 1) * 2], P[a * 2] + dirx * d.fl * .8, k);
        P[(a + 1) * 2 + 1] = lerp(P[(a + 1) * 2 + 1], ay + d.ft * .45, k);
      }
    }
  } else {
    X = opt.px || 0; Y = (opt.py || 0);
    for (let i = 0; i < JN; i++) { P[i * 2] += X; P[i * 2 + 1] += Y; }
  }
  return out;
}

// Local facing-right joints -> world. yaw (cosine) squashes the body around its root for fake 3D spins.
export function toWorld(j, face, x, y, yaw = 1) {
  const P = j.p, k = face * yaw, f = yaw < 0 ? -face : face;
  for (let i = 0; i < JN; i++) { P[i * 2] = x + P[i * 2] * k; P[i * 2 + 1] = y + P[i * 2 + 1]; }
  j.face = f; j.yaw = Math.abs(yaw);
  const m = Math.max(.25, Math.abs(yaw));
  if (m < 1) { j.S *= m; j.H *= m; }
  if (f < 0) { j.S = -j.S; j.H = -j.H; }
  return j;
}

// Puts joint chain (root, mid, end) so that end reaches (tx, ty). bend: +1/-1 picks the elbow side.
export function ik2(P, ri, mi, ei, tx, ty, L1, L2, bend) {
  const rx = P[ri * 2], ry = P[ri * 2 + 1];
  let dx = tx - rx, dy = ty - ry, D = Math.hypot(dx, dy) || 1e-4;
  const max = (L1 + L2) * .998, min = Math.abs(L1 - L2) + .5;
  const c = clamp(D, min, max);
  dx *= c / D; dy *= c / D; D = c;
  const a = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)), base = Math.atan2(dy, dx);
  const an = base + a * bend;
  P[mi * 2] = rx + Math.cos(an) * L1; P[mi * 2 + 1] = ry + Math.sin(an) * L1;
  P[ei * 2] = rx + dx; P[ei * 2 + 1] = ry + dy;
}
