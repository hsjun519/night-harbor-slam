// Draws wrestlers (and the referee) in depth order, keeping grapple layering, flashes, shadows and after-images.
import { Joints, JN, J, dimsFor, solveFK, toWorld, pose } from '../anim/skeleton.js';
import { clip, sampleClip, stancePose, gaitPose } from '../anim/clips.js';
import { BodyCanvas } from './raster.js';
import { drawBody } from './body.js';
import { packHex } from './palette.js';
import { LOOKS } from '../data/looks.js';
import { makeCanvas, ctxOf, TAU } from '../core/util.js';
import { ellipse, rect, poly } from './painter.js';

const tmp = new Joints();
const WHITE = packHex('#ffffff');
const P = new Float32Array(16);
// the championship belt: on the waist, over the head (a winner), or over the referee's shoulder (joints already shifted)
export function drawBelt(g, j, mode) {
  let x, y, w = 26;
  if (mode === 'up') { x = (j.x(J.hN) + j.x(J.hF)) / 2; y = Math.min(j.y(J.hN), j.y(J.hF)) - 3; w = 30; }
  else if (mode === 'shoulder') { x = j.x(J.chest); y = j.y(J.chest) - 4; w = 22; }
  else { x = j.x(J.pelvis); y = j.y(J.pelvis) - 3; }
  x = Math.round(x); y = Math.round(y);
  rect(g, '#120c1e', x - w / 2 - 1, y - 4, w + 2, 9); rect(g, '#c9a22e', x - w / 2, y - 3, w, 7); rect(g, '#8a6a1a', x - w / 2, y + 2, w, 2);
  rect(g, '#120c1e', x - 7, y - 7, 14, 14); rect(g, '#ffe9a8', x - 6, y - 6, 12, 12); rect(g, '#c9a22e', x - 4, y - 4, 8, 8); rect(g, '#fff6d0', x - 3, y - 4, 2, 2);
}

export class FighterRenderer {
  constructor() {
    this.bc = new BodyCanvas(); this.trails = []; this.pool = []; this.frame = 0;
    for (let i = 0; i < 18; i++) { const c = makeCanvas(this.bc.w, this.bc.h); this.pool.push({ c, g: ctxOf(c), used: false }); }
    this.refLook = LOOKS.referee; this.refDims = dimsFor(this.refLook.build, this.refLook.scale); this.refJ = new Joints();
  }
  setEnv(env) { this.bc.setLight(env); }
  shift(j, camX) { tmp.copy(j); for (let i = 0; i < JN; i++) tmp.p[i * 2] -= camX; return tmp; }
  body(g, f, camX, layer, extra = {}) {
    const bc = this.bc, jt = this.shift(f.joints, camX);
    if (f.hitShake > 0) { const s = (this.frame & 1 ? 1 : -1) * Math.ceil(f.hitShake * 8); for (let i = 0; i < JN; i++) tmp.p[i * 2] += s; }
    bc.begin(jt.x(0), jt.y(0) - 4);
    const tails = f.tails ? f.tails.map(T => ({ pts: Array.from(T.pts, (v, i) => (i % 2 ? v : v - camX)), w: T.w, c: T.c, front: T.front })) : null;
    drawBody(bc, jt, f.dims, f.look, { expr: f.faceExpr || 'neutral', layer, hand: f.handOpen ? 'open' : 'fist', tails, cape: f.st === 'INTRO' || f.st === 'WIN', sway: Math.sin((f.poseT || 0) * 2) * 2 });
    bc.finish({ flat: f.flash > .05 ? WHITE : extra.flat });
    const blink = f.inv > 0 && f.protect > 0 && (this.frame >> 2) & 1;
    bc.drawTo(g, 0, 0, extra.alpha != null ? extra.alpha : blink ? .55 : 1);
    const Bt = f.match && f.match.belt;
    if (Bt && Bt.on === f && !f.hidden) drawBelt(g, jt, f.st === 'WIN' ? 'up' : 'waist');
    return bc;
  }
  shadow(g, f, camX, ground) {
    const x = f.joints.x(0) - camX, h = Math.max(0, ground - f.joints.y(0) - f.dims.leg * .8), k = Math.max(.35, 1 - h / 140);
    const w = Math.round((f.dims.prof[4][2] + 8) * k * (f.st === 'DOWN' || f.st === 'KO' || f.hsKind === 'lie' ? 2.2 : 1.1));
    g.globalAlpha = .38 * k; ellipse(g, '#04030a', Math.round(x), Math.round(ground + 1), w, 3); g.globalAlpha = 1;
  }
  // Grab the current body pixels as a fading after-image.
  trail(f, col, life = .22) {
    const slot = this.pool.find(s => !s.used);
    if (!slot) return;
    const bc = this.bc;
    slot.used = true; slot.g.clearRect(0, 0, slot.c.width, slot.c.height);
    slot.g.drawImage(bc.canvas, bc.bx, bc.by, bc.bw, bc.bh, 0, 0, bc.bw, bc.bh);
    slot.g.globalCompositeOperation = 'source-atop'; slot.g.fillStyle = col; slot.g.globalAlpha = .75; slot.g.fillRect(0, 0, bc.bw, bc.bh); slot.g.globalAlpha = 1; slot.g.globalCompositeOperation = 'source-over';
    this.trails.push({ slot, x: bc.ox + bc.bx, y: bc.oy + bc.by, w: bc.bw, h: bc.bh, t: 0, life, camX: this.camX });
  }
  drawAll(g, m, camX, opts = {}) {
    this.frame++; this.camX = camX;
    const ar = m.arena;
    // after-images behind everything
    for (const t of this.trails) { t.t += opts.dt || 0; g.globalAlpha = Math.max(0, .5 * (1 - t.t / t.life)); g.drawImage(t.slot.c, 0, 0, t.w, t.h, Math.round(t.x - (camX - t.camX)), t.y, t.w, t.h); }
    g.globalAlpha = 1;
    for (const t of this.trails) if (t.t >= t.life) t.slot.used = false;
    this.trails = this.trails.filter(t => t.t < t.life);
    // shadows
    for (const f of m.fighters) if (!f.gone && !f.hidden) this.shadow(g, f, camX, ar.ground(f.joints.x(0), f.y, f.side) + (f.side === 'in' ? f.lane : 0));
    if (ar.hasRing && m.ref) this.refShadow(g, m, camX);
    // depth order: back row first. Linked pairs are drawn together.
    const items = [];
    const seen = new Set();
    for (const L of m.links) { if (L.a.gone) continue; items.push({ z: L.a.y + L.a.lane + .5, pair: L }); seen.add(L.a); if (L.v) seen.add(L.v); }
    if (m.pin) { items.push({ z: m.pin.a.y + .4, pin: m.pin }); seen.add(m.pin.a); seen.add(m.pin.v); }
    for (const f of m.fighters) if (!seen.has(f) && !f.gone && !f.hidden) items.push({ z: f.y + (f.side === 'in' ? f.lane : 6) + (f.st === 'DOWN' || f.st === 'KO' ? -1 : 0) + (f.ctrl === 'human' ? .2 : 0), f });
    if (ar.hasRing && m.ref && m.ref.visible !== false) items.push({ z: ar.matY - 6, ref: 1 });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.ref) { this.drawRef(g, m, camX); continue; }
      if (it.pin) { this.body(g, it.pin.v, camX, 'all'); this.body(g, it.pin.a, camX, 'all'); continue; }
      if (it.pair) {
        const L = it.pair, a = L.a, v = L.v;
        if (!v) { this.body(g, a, camX, 'all'); this.fxFor(a, opts); continue; }
        if (L.front || (L.kind === 'move' && L.move.vf > 0 && !L.front)) {
          if (L.front) { if (!a.hidden) this.body(g, a, camX, 'all'); this.body(g, v, camX, 'all'); }
          else { this.body(g, v, camX, 'all'); if (!a.hidden) this.body(g, a, camX, 'all'); }
        } else {
          if (!a.hidden) this.body(g, a, camX, 'back');
          this.body(g, v, camX, 'all');
          if (!a.hidden) this.body(g, a, camX, 'front');
        }
        this.fxFor(a, opts);
        continue;
      }
      const f = it.f;
      if (f.hidden) continue;
      this.body(g, f, camX, 'all');
      this.fxFor(f, opts);
      this.overlays(g, f, camX, m);
    }
  }
  fxFor(f, opts) {
    const want = (f.st === 'ATTACK' && f.atk && f.atk.def.run) || f.st === 'DODGE' || (f.st === 'FINISHER') || (f.link && f.link.fin) || f.boost > 0 || (f.st === 'AIR_ATTACK' && f.atk && f.atk.def.dive);
    if (want && (this.frame % 3 === 0) && opts.trails !== false) this.trail(f, f.link && f.link.fin ? (f.finisher ? f.finisher.color : '#ffffff') : f.char.color || '#49d6ff', f.st === 'DODGE' ? .18 : .26);
  }
  overlays(g, f, camX, m) {
    // dizzy stars
    if ((f.st === 'STAGGER' || (f.st === 'DOWN' && !f.postMove && !f.rag)) && f.alive) {
      const hx = f.joints.x(J.head) - camX, hy = f.joints.y(J.head) - 14, t = m.time * 5;
      for (let i = 0; i < 3; i++) { const a = t + i * TAU / 3, x = Math.round(hx + Math.cos(a) * 9), y = Math.round(hy + Math.sin(a) * 3); poly(g, i === 1 ? '#7fe0ff' : '#ffd65a', [[x, y - 3], [x + 1, y - 1], [x + 3, y], [x + 1, y + 1], [x, y + 3], [x - 1, y + 1], [x - 3, y], [x - 1, y - 1]]); }
    }
    if (f.sweatT > 0 || f.exhausted && (this.frame % 40 === 0)) { const hx = f.joints.x(J.head) - camX, hy = f.joints.y(J.head); rect(g, '#bfefff', hx + f.face * 6, hy - 6 + (this.frame % 40) / 4, 1, 2); }
  }
  refShadow(g, m, camX) { g.globalAlpha = .3; ellipse(g, '#04030a', Math.round(m.ref.x - camX), m.arena.matY + 1 - 8, 12, 2); g.globalAlpha = 1; }
  drawRef(g, m, camX) {
    const r = m.ref, d = this.refDims, j = this.refJ;
    let p;
    if (r.act === 'count' && m.pin) { const k = (m.pin.t % .92) / .92; p = sampleClip(clip('refSlap'), k * .6, P); }
    else if (r.act === 'raise' && r.raise) p = sampleClip(clip('refRaise'), 0, P);
    else if (Math.abs(r.vx) > 5) { stancePose('npcA', m.time, P); p = gaitPose(P, r.gait * 6, 'walk', 1); }
    else p = sampleClip(clip('ref1'), m.time, P);
    solveFK(p, d, j, {});
    toWorld(j, r.face, r.x, m.arena.matY - 8);
    const bc = this.bc;
    for (let i = 0; i < JN; i++) j.p[i * 2] -= camX;
    bc.begin(j.x(0), j.y(0) - 4);
    drawBody(bc, j, d, this.refLook, { expr: r.act === 'count' ? 'shout' : 'neutral', hand: 'open' });
    bc.finish();
    bc.drawTo(g);
    if (m.belt && m.belt.on === 'ref') drawBelt(g, j, 'shoulder');
    void pose;
  }
}
