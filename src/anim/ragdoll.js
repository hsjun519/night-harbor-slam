// Verlet ragdoll for big hits, throws and ring-outs. It keeps limb lengths and joint sides, collides with the
// arena and hands back joints, so the renderer and the animation blender treat it like any other pose.
import { clamp } from '../core/util.js';
import { J } from './skeleton.js';

// point order: 0 pelvis 1 chest 2 head 3 elbowN 4 handN 5 elbowF 6 handF 7 kneeN 8 ankleN 9 kneeF 10 ankleF
const SRC = [J.pelvis, J.chest, J.head, J.eN, J.hN, J.eF, J.hF, J.kN, J.aN, J.kF, J.aF];
const N = 11;
export class Ragdoll {
  constructor(joints, dims, face) {
    this.d = dims; this.face = face;
    this.x = new Float32Array(N); this.y = new Float32Array(N); this.px = new Float32Array(N); this.py = new Float32Array(N);
    this.r = Float32Array.from([dims.thR[0] * .95, dims.uaR[0] + 1.5, 9.5 * dims.head, dims.faR[0] * .8, dims.hR * .8, dims.faR[0] * .8, dims.hR * .8, dims.shR[0] * .8, dims.ft, dims.shR[0] * .8, dims.ft]);
    this.m = Float32Array.from([.5, .45, .9, 1.4, 1.8, 1.4, 1.8, 1.1, 1.5, 1.1, 1.5]); // inverse masses
    const P = joints.p;
    for (let i = 0; i < N; i++) { this.x[i] = this.px[i] = P[SRC[i] * 2]; this.y[i] = this.py[i] = P[SRC[i] * 2 + 1]; }
    const d = dims;
    this.con = [[0, 1, d.spine], [1, 2, d.nk + d.hd], [1, 3, d.ua], [3, 4, d.fa], [1, 5, d.ua], [5, 6, d.fa], [0, 7, d.th], [7, 8, d.sh], [0, 9, d.th], [9, 10, d.sh]];
    this.t = 0; this.still = 0; this.ground = false; this.over = false; this.side = 'in'; this.hitGround = 0; this.hitWall = 0; this.ropeHit = 0; this.lastDt = 1 / 60; this.maxT = 1.9;
    this.dragT = 0;
  }
  // vx, vy in px/s, spin in rad/s around the chest-pelvis middle.
  kick(vx, vy, spin = 0, dt = 1 / 60) {
    const cx = (this.x[0] + this.x[1]) / 2, cy = (this.y[0] + this.y[1]) / 2;
    for (let i = 0; i < N; i++) {
      const rx = this.x[i] - cx, ry = this.y[i] - cy;
      this.px[i] = this.x[i] - (vx - ry * spin) * dt; this.py[i] = this.y[i] - (vy + rx * spin) * dt;
    }
    this.lastDt = dt;
  }
  push(i, vx, vy) { this.px[i] -= vx * this.lastDt; this.py[i] -= vy * this.lastDt; }
  vel(i = 0) { return [(this.x[i] - this.px[i]) / this.lastDt, (this.y[i] - this.py[i]) / this.lastDt]; }
  step(dt, arena, gravity) {
    if (dt < 1e-4) return;
    const steps = dt > 1 / 90 ? 2 : 1, h = dt / steps;
    for (let s = 0; s < steps; s++) this.sub(h, arena, gravity);
    this.t += dt;
    let mv = 0;
    for (let i = 0; i < N; i++) mv = Math.max(mv, Math.abs(this.x[i] - this.px[i]) + Math.abs(this.y[i] - this.py[i]));
    if (mv / this.lastDt < 46 && this.ground) this.still += dt; else this.still = 0;
  }
  sub(h, arena, G) {
    const { x, y, px, py, r, m } = this;
    // Verlet keeps velocity as a position difference; rescale it for this step, but never by a wild ratio.
    const k = Math.min(3, Math.max(1 / 3, h / (this.lastDt || h))); this.lastDt = h;
    const damp = this.ground ? .97 : .998, vmax = (this.ground ? 520 : 950) * h;
    for (let i = 0; i < N; i++) {
      let vx = (x[i] - px[i]) * k * damp, vy = (y[i] - py[i]) * k * damp;
      // a hard cap: no joint may fling faster than a thrown body
      const sp = Math.hypot(vx, vy);
      if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; }
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx; y[i] += vy + G * h * h;
    }
    const f = this.face, d = this.d;
    for (let it = 0; it < 6; it++) {
      for (const c of this.con) this.link(c[0], c[1], c[2], 1);
      // keep the head off the hips and the knees off the chest
      this.minDist(2, 0, d.spine * .86 + d.hd * .5, .5); this.minDist(7, 1, d.spine * .62, .4); this.minDist(9, 1, d.spine * .62, .4);
      this.minDist(2, 7, d.hd * .8, .2); this.minDist(2, 9, d.hd * .8, .2);
      if (it >= 4) { this.limit(0, 7, 8, f); this.limit(0, 9, 10, f); this.limit(1, 3, 4, -f); this.limit(1, 5, 6, -f); }
      if (it > 2) this.collide(arena, h);
    }
    void m; void r;
  }
  link(a, b, L, k) {
    const { x, y, m } = this, dx = x[b] - x[a], dy = y[b] - y[a], D = Math.hypot(dx, dy) || 1e-4, w = m[a] + m[b], q = (D - L) / D / w * k;
    x[a] += dx * q * m[a]; y[a] += dy * q * m[a]; x[b] -= dx * q * m[b]; y[b] -= dy * q * m[b];
  }
  minDist(a, b, L, k) { const { x, y } = this, dx = x[b] - x[a], dy = y[b] - y[a]; if (dx * dx + dy * dy < L * L) this.link(a, b, L, k); }
  // Keeps the joint b of a-b-c bending to one side (sign of the cross product).
  limit(a, b, c, s) {
    const { x, y } = this, ux = x[b] - x[a], uy = y[b] - y[a], vx = x[c] - x[b], vy = y[c] - y[b], cr = (ux * vy - uy * vx) * s;
    if (cr >= 0) return;
    const L = Math.hypot(ux, uy) || 1, V = Math.hypot(vx, vy) || 1, tx = x[b] + ux / L * V, ty = y[b] + uy / L * V;
    x[c] += (tx - x[c]) * .18; y[c] += (ty - y[c]) * .18;
  }
  collide(ar, h) {
    const { x, y, px, py, r } = this;
    this.ground = false;
    const pelvisIn = x[0] > ar.ropeL && x[0] < ar.ropeR;
    if (ar.hasRing) {
      if (this.side === 'in' && !pelvisIn) { if (!ar.cageH && (y[0] < ar.matY - ar.ropeH + 14 || this.over)) this.side = 'out'; }   // a cage keeps everybody in
      else if (this.side === 'out' && pelvisIn && y[0] < ar.matY - 2) this.side = 'in';
    } else this.side = 'in';
    for (let i = 0; i < N; i++) {
      let g = ar.floorY;
      if (ar.hasRing) {
        const overMat = x[i] > ar.ropeL - ar.apron && x[i] < ar.ropeR + ar.apron;
        if (overMat && (this.side === 'in' || y[i] < ar.matY + 3)) g = ar.matY;
        if (this.side === 'out' && !overMat) g = ar.floorY;
        // ropes hold bodies that are not flying over them
        if (this.side === 'in' && !this.over) {
          const hgt = ar.matY - y[i];
          if (hgt < (ar.cageH || ar.ropeH + 6)) {
            const lo = ar.ropeL + r[i] * .3, hi = ar.ropeR - r[i] * .3;
            // project onto the rope line and reflect only the outward motion, so the rope never adds energy
            if (x[i] < lo) { const v = x[i] - px[i], p = lo - x[i]; x[i] = lo; px[i] = v < 0 ? lo + v * .3 : lo - v; if (hgt > 4) { ar.press('L', Math.min(18, p * 2 + Math.abs(v) / h * .02)); this.ropeHit = 1; } }
            else if (x[i] > hi) { const v = x[i] - px[i], p = x[i] - hi; x[i] = hi; px[i] = v > 0 ? hi + v * .3 : hi - v; if (hgt > 4) { ar.press('R', Math.min(18, p * 2 + Math.abs(v) / h * .02)); this.ropeHit = 1; } }
          }
        }
        if (this.side === 'out' && y[i] > ar.matY + 6) { // apron face
          const mid = (ar.ropeL + ar.ropeR) / 2, L = ar.ropeL - ar.apron - r[i], R = ar.ropeR + ar.apron + r[i];
          if (x[i] > L && x[i] < mid) { x[i] = L; px[i] = L + (L - px[i]) * .3; } else if (x[i] < R && x[i] >= mid) { x[i] = R; px[i] = R + (R - px[i]) * .3; }
        }
      }
      const lo = ar.x0 + r[i], hi = ar.x1 - r[i];
      if (x[i] < lo) { const v = (x[i] - px[i]) / h; x[i] = lo; px[i] = lo + (x[i] - px[i]) * 0 + v * h * .35; if (v < -120) this.hitWall = Math.max(this.hitWall, -v); }
      else if (x[i] > hi) { const v = (x[i] - px[i]) / h; x[i] = hi; px[i] = hi + v * h * .35; if (v > 120) this.hitWall = Math.max(this.hitWall, v); }
      const gy = g - r[i];
      if (y[i] > gy) {
        const vy = (y[i] - py[i]) / h, vx = x[i] - px[i];
        y[i] = gy;
        if (vy > 90) { this.hitGround = Math.max(this.hitGround, vy); py[i] = gy + vy * h * (i < 3 ? .3 : .2); } else py[i] = gy;
        px[i] = x[i] - vx * (i < 2 ? .82 : .7);
        if (i < 3) this.ground = true;
      }
    }
  }
  done() { return (this.still > .12 && this.t > .3) || (this.ground && this.t > 1.1 && this.speed() < 140) || this.t > this.maxT; }
  // Writes joints with exact limb lengths.
  toJoints(j) {
    const { x, y, d, face: f } = this, P = j.p;
    const set = (i, a, b) => { P[i * 2] = a; P[i * 2 + 1] = b; };
    let sx = x[1] - x[0], sy = y[1] - y[0];
    const L = Math.hypot(sx, sy) || 1; sx /= L; sy /= L;
    const fx = -sy * f, fy = sx * f; // facing normal of the torso
    set(J.pelvis, x[0], y[0]); set(J.chest, x[1], y[1]);
    set(J.neck, x[1] + sx * d.nk, y[1] + sy * d.nk);
    set(J.head, x[2], y[2]);
    const limb = (root, mid, end, rx, ry, a, b, L1, L2) => {
      let ux = x[a] - rx, uy = y[a] - ry, q = Math.hypot(ux, uy) || 1;
      const mx = rx + ux / q * L1, my = ry + uy / q * L1;
      ux = x[b] - mx; uy = y[b] - my; q = Math.hypot(ux, uy) || 1;
      set(root, rx, ry); set(mid, mx, my); set(end, mx + ux / q * L2, my + uy / q * L2);
    };
    limb(J.sN, J.eN, J.hN, x[1] + fx * d.sx[0] - sx * 1.5, y[1] + fy * d.sx[0] - sy * 1.5, 3, 4, d.ua, d.fa);
    limb(J.sF, J.eF, J.hF, x[1] + fx * d.sx[1] - sx * 1.5, y[1] + fy * d.sx[1] - sy * 1.5, 5, 6, d.ua, d.fa);
    limb(J.pN, J.kN, J.aN, x[0] + fx * d.hx[0], y[0] + fy * d.hx[0], 7, 8, d.th, d.sh);
    limb(J.pF, J.kF, J.aF, x[0] + fx * d.hx[1], y[0] + fy * d.hx[1], 9, 10, d.th, d.sh);
    for (const [k, a, t] of [[J.kN, J.aN, J.tN], [J.kF, J.aF, J.tF]]) {
      let vx = P[a * 2] - P[k * 2], vy = P[a * 2 + 1] - P[k * 2 + 1];
      const q = Math.hypot(vx, vy) || 1; vx /= q; vy /= q;
      set(t, P[a * 2] + vy * f * d.fl * .8, P[a * 2 + 1] - vx * f * d.fl * .8);
    }
    const ang = Math.atan2(sx, -sy) * 180 / Math.PI, hx = x[2] - P[J.neck * 2], hy = y[2] - P[J.neck * 2 + 1];
    j.S = ang; j.face = f; j.yaw = 1;
    const ha = Math.atan2(hx, -hy) * 180 / Math.PI;
    j.H = ha;
    return j;
  }
  // Which way is the chest pointing when the body rests?
  faceUp() { const sx = this.x[1] - this.x[0], sy = this.y[1] - this.y[0]; void sy; return sx * this.face < 0; }
  get cx() { return this.x[0]; }
  get cy() { return this.y[0]; }
  speed() { const v = this.vel(0); return Math.hypot(v[0], v[1]); }
}
export const clampRag = clamp;
