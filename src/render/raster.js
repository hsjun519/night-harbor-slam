// Software pixel rasterizer for bodies. Every limb is a lit capsule written straight to pixels, so rotated
// limbs keep one light direction, a clean one-pixel contour and no rotated-sprite jaggies.
import { makeCanvas, ctxOf } from '../core/util.js';
import { OUTLINE, packHex } from './palette.js';

export const BODY_W = 288, BODY_H = 240;
const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - .47)));

export class BodyCanvas {
  constructor(w = BODY_W, h = BODY_H) {
    this.w = w; this.h = h;
    this.canvas = makeCanvas(w, h); this.g = ctxOf(this.canvas, { willReadFrequently: true });
    this.img = this.g.createImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
    this.gid = new Uint8Array(w * h);
    this.lx = -.36; this.ly = -.72; this.lz = .59;
    this.rx = .86; this.ry = -.3; this.rim = 0; this.rimAmt = .46;
    this.dither = .16; this.light = 0;
    this.ox = 0; this.oy = 0;
    this.clear();
  }
  setLight(env) {
    this.rim = env && env.rim ? packHex(env.rim) : 0;
    this.light = env && env.light ? env.light : 0;
    if (env && env.rimX != null) this.rx = env.rimX;
  }
  // (cx, cy) is the world point that lands on the middle of the buffer.
  begin(cx, cy) { this.ox = Math.round(cx) - (this.w >> 1); this.oy = Math.round(cy) - (this.h >> 1); this.clear(); }
  clear() { this.px.fill(0); this.gid.fill(0); this.x0 = this.w; this.y0 = this.h; this.x1 = 0; this.y1 = 0; }
  grow(a, b, c, d) { if (a < this.x0) this.x0 = a; if (b < this.y0) this.y0 = b; if (c > this.x1) this.x1 = c; if (d > this.y1) this.y1 = d; }
  tone(lum, x, y) {
    const l = lum + this.light + BAYER[(y & 3) * 4 + (x & 3)] * this.dither;
    return l < -.34 ? 0 : l < .08 ? 1 : l < .58 ? 2 : l < .9 ? 3 : 4;
  }
  /* segs: [{t, ramp, pat?}] along the axis. jr>0 keeps the contour away from the joint circle (jx, jy). */
  capsule(ax, ay, ra, bx, by, rb, segs, grp, bulge = 0, jr = 0, dark = 0, jx = ax, jy = ay) {
    ax -= this.ox; ay -= this.oy; bx -= this.ox; by -= this.oy; jx -= this.ox; jy -= this.oy;
    const m = Math.max(ra, rb) + Math.max(0, bulge) + 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + m));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + m));
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy + 1e-6, iL2 = 1 / L2, L = Math.sqrt(L2);
    const ux = dx / L, uy = dy / L; // axis
    const px = this.px, gid = this.gid, W = this.w, j2 = jr * jr;
    const lx = this.lx, ly = this.ly, lz = this.lz, rimC = this.rim, rrx = this.rx, rry = this.ry, rimT = this.rimAmt;
    const n = segs.length;
    for (let y = y0; y <= y1; y++) {
      const py = y + .5 - ay;
      for (let x = x0; x <= x1; x++) {
        const qx = x + .5 - ax;
        let t = (qx * dx + py * dy) * iL2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = ra + (rb - ra) * t + bulge * 4 * t * (1 - t);
        const ex = qx - dx * t, ey = py - dy * t, d2 = ex * ex + ey * ey;
        const i = y * W + x;
        if (d2 <= r * r) {
          const inv = 1 / r, nx = ex * inv, ny = ey * inv, q = 1 - nx * nx - ny * ny, nz = q > 0 ? Math.sqrt(q) : 0;
          let k = 0;
          while (k < n - 1 && t > segs[k].t) k++;
          const seg = segs[k];
          let rp = seg.ramp;
          const lum = nx * lx + ny * ly + nz * lz - dark;
          let tone = this.tone(lum, x, y);
          if (seg.pat) {
            const s = -nx * uy + ny * ux; // signed across
            const alt = seg.pat(t, s, tone);
            if (alt) { if (alt.length) rp = alt; else tone = Math.max(0, Math.min(4, tone + alt)); }
          }
          let c = rp[tone];
          if (rimC && nz < rimT && nx * rrx + ny * rry > .62 && tone > 0) c = rimC;
          px[i] = c; gid[i] = grp;
        } else if (gid[i] && gid[i] !== grp) {
          const r1 = r + 1;
          if (d2 <= r1 * r1) {
            if (j2 > 0) { const jdx = x + .5 - jx, jdy = y + .5 - jy; if (jdx * jdx + jdy * jdy < j2) continue; }
            px[i] = OUTLINE; gid[i] = 254;
          }
        }
      }
    }
  }
  ball(x, y, r, rampC, grp, jr = 0, dark = 0) { this.capsule(x, y, r, x + .01, y, r, [{ t: 1, ramp: rampC }], grp, 0, jr, dark); }
  /* Torso: a profile swept along the spine. prof rows are [v, back, front]. shadeFn(u, v, d) returns {ramp, dt} via fields. */
  torso(ax, ay, bx, by, fx, fy, prof, shader, grp, dark = 0) {
    ax -= this.ox; ay -= this.oy; bx -= this.ox; by -= this.oy;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy + 1e-6, iL2 = 1 / L2;
    let m = 0;
    for (const p of prof) m = Math.max(m, p[1], p[2]);
    m += 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + m));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + m));
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const L = Math.sqrt(L2), ux = dx / L, uy = dy / L, px = this.px, gid = this.gid, W = this.w;
    const lx = this.lx, ly = this.ly, lz = this.lz, rimC = this.rim, rrx = this.rx, rry = this.ry;
    const np = prof.length;
    const out = { ramp: null, dt: 0 };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + .5 - ax, qy = y + .5 - ay;
      let v = (qx * dx + qy * dy) * iL2;
      if (v < -.04 || v > 1.04) continue;
      const vc = v < 0 ? 0 : v > 1 ? 1 : v;
      let k = 1;
      while (k < np - 1 && vc > prof[k][0]) k++;
      const p0 = prof[k - 1], p1 = prof[k];
      let t = (vc - p0[0]) / (p1[0] - p0[0] || 1);
      t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t);
      const d = qx * fx + qy * fy;
      let w = d >= 0 ? p0[2] + (p1[2] - p0[2]) * t : p0[1] + (p1[1] - p0[1]) * t;
      if (v < 0) w *= Math.sqrt(Math.max(0, 1 + v / .04)); else if (v > 1) w *= Math.sqrt(Math.max(0, 1 - (v - 1) / .04));
      const i = y * W + x, ad = d < 0 ? -d : d;
      if (w > .3 && ad <= w) {
        const u = d / w, q = 1 - u * u, nzc = q > 0 ? Math.sqrt(q) : 0;
        // slope of the outline tilts the normal up or down the body
        const sl = ((d >= 0 ? p1[2] - p0[2] : p1[1] - p0[1]) / ((p1[0] - p0[0] || 1) * L)) * -.55;
        const nx = fx * u + ux * sl * .7, ny = fy * u + uy * sl * .7;
        out.ramp = null; out.dt = 0;
        shader(u, vc, out);
        const lum = nx * lx + ny * ly + nzc * lz - dark;
        let tn = this.tone(lum + out.dt * .3, x, y);
        let c = out.ramp[tn];
        if (rimC && ad > w - 1.1 && (fx * u) * rrx + (fy * u) * rry > .55 && tn > 0) c = rimC;
        px[i] = c; gid[i] = grp;
      } else if (gid[i] && gid[i] !== grp && w > .3 && ad <= w + 1) { px[i] = OUTLINE; gid[i] = 254; }
    }
  }
  /* Convex quad or polygon with a per-pixel cloth ramp. pts: [[x,y],...]. */
  poly(pts, rampC, grp, opt = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const P = pts.map(p => [p[0] - this.ox, p[1] - this.oy]);
    for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1); x1 = Math.min(this.w - 1, Math.ceil(x1) + 1); y1 = Math.min(this.h - 1, Math.ceil(y1) + 1);
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const W = this.w, px = this.px, gid = this.gid, n = P.length;
    const inside = (x, y) => { let c = false; for (let a = 0, b = n - 1; a < n; b = a++) { const A = P[a], B = P[b]; if ((A[1] > y) !== (B[1] > y) && x < (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]) + A[0]) c = !c; } return c; };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (inside(x + .5, y + .5)) {
        const fx = (x - x0) / (x1 - x0 || 1);
        let lum = opt.flat != null ? opt.flat : .62 - Math.abs(fx - (opt.mid ?? .38)) * 1.1;
        if (opt.folds) lum += Math.sin(fx * opt.folds * 6.28 + (opt.phase || 0)) * .28;
        px[i] = (opt.pat ? opt.pat(fx, (y - y0) / (y1 - y0 || 1)) || rampC : rampC)[this.tone(lum - (opt.dark || 0), x, y)]; gid[i] = grp;
      }
    }
    if (opt.noOutline) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (gid[i] === grp || !gid[i]) continue;
      if ((x > 0 && gid[i - 1] === grp) || (x < W - 1 && gid[i + 1] === grp) || (y > 0 && gid[i - W] === grp) || (y < this.h - 1 && gid[i + W] === grp)) { if (opt.clearTop && y <= y0 + 2) continue; px[i] = OUTLINE; gid[i] = 254; }
    }
  }
  /* Rotated texture (Uint32, tw x th, ts texels per pixel). cxT, cyT: texture origin. */
  sprite(tex, tw, th, ts, cxT, cyT, x, y, ca, sa, flip, grp, scale = 1, shadeLow = 0) {
    x -= this.ox; y -= this.oy;
    const R = Math.ceil(Math.hypot(tw, th) / ts / 2 * scale) + 4;
    const X = Math.round(x), Y = Math.round(y);
    const x0 = Math.max(1, X - R), x1 = Math.min(this.w - 2, X + R), y0 = Math.max(1, Y - R), y1 = Math.min(this.h - 2, Y + R);
    if (x1 < x0 || y1 < y0) return;
    this.grow(x0, y0, x1, y1);
    const W = this.w, px = this.px, gid = this.gid, k = ts / scale;
    for (let pass = 0; pass < 2; pass++) for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + .5 - x, dy = yy + .5 - y;
      let u = dx * ca + dy * sa;
      const v = -dx * sa + dy * ca;
      if (flip) u = -u;
      const tx = Math.floor(u * k + cxT), ty = Math.floor(v * k + cyT);
      if (tx < 0 || ty < 0 || tx >= tw || ty >= th) continue;
      const c = tex[ty * tw + tx];
      if ((c >>> 24) < 128) continue;
      const i = yy * W + xx;
      if (pass === 0) {
        for (const o of [i - 1, i + 1, i - W, i + W]) if (gid[o] && gid[o] !== grp) { px[o] = OUTLINE; gid[o] = 254; }
      } else { px[i] = (c | 0xff000000) >>> 0; gid[i] = grp; }
    }
    void shadeLow;
  }
  /* Outer contour, optional whole-body recolour, then upload. */
  finish(opts = {}) {
    const W = this.w, H = this.h, px = this.px, gid = this.gid;
    const x0 = Math.max(1, this.x0 - 1), y0 = Math.max(1, this.y0 - 1), x1 = Math.min(W - 2, this.x1 + 1), y1 = Math.min(H - 2, this.y1 + 1);
    const out = opts.outline != null ? opts.outline : OUTLINE;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (gid[i]) continue;
      if ((gid[i - 1] && gid[i - 1] !== 255) || (gid[i + 1] && gid[i + 1] !== 255) || (gid[i - W] && gid[i - W] !== 255) || (gid[i + W] && gid[i + W] !== 255)) { px[i] = out; gid[i] = 255; }
    }
    if (opts.flat) { const f = opts.flat; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (gid[i] && gid[i] !== 255) px[i] = f; } }
    this.bx = x0; this.by = y0; this.bw = Math.max(1, x1 - x0 + 1); this.bh = Math.max(1, y1 - y0 + 1);
    this.g.clearRect(0, 0, W, H);
    this.g.putImageData(this.img, 0, 0, x0, y0, this.bw, this.bh);
  }
  drawTo(g, camX = 0, camY = 0, alpha = 1) {
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(this.canvas, this.bx, this.by, this.bw, this.bh, this.ox + this.bx - camX, this.oy + this.by - camY, this.bw, this.bh);
    if (alpha !== 1) g.globalAlpha = 1;
  }
}
