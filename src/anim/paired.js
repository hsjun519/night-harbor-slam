// Evaluates two-person move timelines into joints for both wrestlers, keeping hands attached by IK.
import { DEG, EASE, clamp01, lerp } from '../core/util.js';
import { pose, poseLerp, POSE_N, solveFK, ik2, J, JN, Joints } from './skeleton.js';

const compiledMoves = new WeakMap();
export function compileMove(m) {
  let c = compiledMoves.get(m);
  if (c) return c;
  const tr = list => list.map(k => ({ t: k[0], p: pose(k[1]), e: EASE[k[2] || 'io'] }));
  c = {
    A: tr(m.A), V: tr(m.V),
    R: m.R.map(k => ({ t: k[0], x: k[1], y: k[2], r: k[3], e: EASE[k[4] || 'io'] })),
    yaw: m.yaw ? m.yaw.map(k => ({ t: k[0], v: k[1], e: EASE[k[2] || 'lin'] })) : null,
    yawA: !!(m.yaw && m.yaw[0][3] === 'A'),
    yawV: !!(m.yaw && m.yaw[0][3] === 'V'),
    ax: m.ax ? m.ax.map(k => ({ t: k[0], x: k[1], y: k[2], e: EASE[k[3] || 'io'] })) : null,
    ik: (m.ik || []).map(k => ({ t0: k[0], t1: k[1], arm: k[2], j: J[k[3]] })),
    ikV: (m.ikV || []).map(k => ({ t0: k[0], t1: k[1], arm: k[2], j: J[k[3].replace('A:', '')] })),
  };
  compiledMoves.set(m, c);
  return c;
}
const tmpA = new Float32Array(POSE_N), tmpV = new Float32Array(POSE_N);
function trackPose(K, t, out) {
  if (t <= K[0].t) { out.set(K[0].p); return out; }
  for (let i = 1; i < K.length; i++) if (t <= K[i].t) return poseLerp(K[i - 1].p, K[i].p, K[i].e(clamp01((t - K[i - 1].t) / (K[i].t - K[i - 1].t || 1))), out);
  out.set(K[K.length - 1].p);
  return out;
}
function trackVal(K, t) {
  if (t <= K[0].t) return K[0].v;
  for (let i = 1; i < K.length; i++) if (t <= K[i].t) return lerp(K[i - 1].v, K[i].v, K[i].e(clamp01((t - K[i - 1].t) / (K[i].t - K[i - 1].t || 1))));
  return K[K.length - 1].v;
}
export function yawAt(m, t) { const c = compileMove(m); return c.yaw ? trackVal(c.yaw, t) : 0; }

const REF_H = 94;
/* res: {front} front=true when the victim should be drawn over the attacker. Joints come out in attacker-local
   space: attacker feet at (0,0), facing right, y down. */
export function evalPaired(m, t, dA, dV, outA, outV, res, modA) {
  const c = compileMove(m), kA = dA.height / REF_H;
  trackPose(c.A, t, tmpA);
  if (modA) modA(tmpA);
  // A lift written for a 94px body scales with the attacker.
  solveFK(tmpA, dA, outA, {});
  let axx = 0, axy = 0;
  if (c.ax) { const K = c.ax; let i = 1; while (i < K.length - 1 && t > K[i].t) i++; const u = K[i].e(clamp01((t - K[i - 1].t) / (K[i].t - K[i - 1].t || 1))); axx = lerp(K[i - 1].x, K[i].x, u); axy = -lerp(K[i - 1].y, K[i].y, u); }
  if (axx || axy) for (let i = 0; i < JN; i++) { outA.p[i * 2] += axx; outA.p[i * 2 + 1] += axy; }
  trackPose(c.V, t, tmpV);
  const K = c.R;
  let i = 1;
  while (i < K.length - 1 && t > K[i].t) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[Math.min(i, K.length - 1)];
  const u = k1.t === k0.t ? 1 : k1.e(clamp01((t - k0.t) / (k1.t - k0.t)));
  const rot = lerp(k0.r, k1.r, u), vf = m.vf;
  const saveR = tmpV[0];
  tmpV[0] = saveR + rot * vf;
  solveFK(tmpV, dV, outV, { snap: false, px: 0, py: 0 });
  const P = outV.p;
  if (vf < 0) { for (let j = 0; j < JN; j++) P[j * 2] = -P[j * 2]; outV.face = -1; outV.S = -outV.S; outV.H = -outV.H; }
  let low = -1e9;
  for (let j = 0; j < JN; j++) { const v = P[j * 2 + 1] + dV.gr[j]; if (v > low) low = v; }
  const groundY = -low; // pelvis offset that rests the body on the mat
  const yOf = k => {
    if (k.y === 'g') return groundY;
    if (k.y >= 40 && k.y <= 46 && Math.abs(k.r) <= 46) return groundY;
    return -k.y * kA;
  };
  let py = lerp(yOf(k0), yOf(k1), u);
  if (py > groundY) py = groundY;
  const px = lerp(k0.x, k1.x, u) * (kA * .75 + .25);
  for (let j = 0; j < JN; j++) { P[j * 2] += px; P[j * 2 + 1] += py; }
  res.front = false;
  if (c.yaw) {
    const a = trackVal(c.yaw, t) * DEG, cs = Math.cos(a), sn = Math.sin(a);
    const apply = (jt, doY) => {
      for (let j = 0; j < JN; j++) { jt.p[j * 2] *= cs; if (doY) jt.p[j * 2 + 1] += sn * 7; }
      if (cs < 0) { jt.face = -jt.face; jt.S = -jt.S; jt.H = -jt.H; }
      const mm = Math.max(.2, Math.abs(cs)); jt.S *= mm; jt.H = jt.H * mm; jt.yaw = Math.abs(cs);
    };
    if (!c.yawV) apply(outA, false);
    if (!c.yawA) apply(outV, true);
    res.front = sn > .05;
    res.yaw = a;
  } else res.yaw = 0;
  const dirA = outA.face;
  for (const k of c.ik) {
    if (t < k.t0 || t > k.t1) continue;
    const w = Math.min(clamp01((t - k.t0) / .08), clamp01((k.t1 - t) / .05));
    const tx = P[k.j * 2], ty = P[k.j * 2 + 1];
    const s = k.arm === 'N' ? 4 : 7, ap = outA.p;
    const ex = ap[(s + 1) * 2], ey = ap[(s + 1) * 2 + 1], hx = ap[(s + 2) * 2], hy = ap[(s + 2) * 2 + 1];
    ik2(ap, s, s + 1, s + 2, tx, ty, dA.ua, dA.fa, dirA);
    if (w < 1) { ap[(s + 1) * 2] = lerp(ex, ap[(s + 1) * 2], w); ap[(s + 1) * 2 + 1] = lerp(ey, ap[(s + 1) * 2 + 1], w); ap[(s + 2) * 2] = lerp(hx, ap[(s + 2) * 2], w); ap[(s + 2) * 2 + 1] = lerp(hy, ap[(s + 2) * 2 + 1], w); }
  }
  for (const k of c.ikV) {
    if (t < k.t0 || t > k.t1) continue;
    const tx = outA.p[k.j * 2], ty = outA.p[k.j * 2 + 1];
    for (const s of k.arm === 'both' ? [4, 7] : k.arm === 'N' ? [4] : [7]) ik2(P, s, s + 1, s + 2, tx, ty, dV.ua, dV.fa, outV.face);
  }
  return res;
}
export function pairBuffers() { return { A: new Joints(), V: new Joints(), res: { front: false, yaw: 0 } }; }
// Furthest forward and backward reach of the victim during a move, for keeping pairs inside the ring.
const extentMemo = new WeakMap();
export function moveExtent(m) {
  let e = extentMemo.get(m);
  if (e) return e;
  let lo = 0, hi = 0;
  for (const k of m.R) { lo = Math.min(lo, k[1]); hi = Math.max(hi, k[1]); }
  e = { lo: lo - 16, hi: hi + 16 };
  extentMemo.set(m, e);
  return e;
}
