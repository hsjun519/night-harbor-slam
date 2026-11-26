// Gravity, floors, ropes, walls, body separation and ragdolls. Linked pairs are positioned by the grapple systems.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';

const NO_PHYS = new Set(['CLIMB', 'PERCH', 'HANG', 'APRON', 'ENTER_RING', 'EXIT_RING', 'TAGWAIT', 'ROPE']);
export class PhysicsSystem {
  constructor(match) { this.m = match; }
  update(dt) {
    const m = this.m, ar = m.arena;
    for (const f of m.fighters) {
      f.touchRope = null;
      f.lastVx = f.vx;
      if (f.eliminated && f.st === 'OUT' && !f.rag && f.gone) continue;
      if (f.rag) { this.ragdoll(f, dt, ar); continue; }
      if (f.link) continue;
      if (NO_PHYS.has(f.st)) continue;
      this.body(f, dt, ar);
    }
    this.separate(dt);
    for (const f of m.fighters) this.safety(f, ar);
  }
  body(f, dt, ar) {
    if (!f.ground) f.vy = Math.min(B.maxFall, f.vy + B.gravity * dt * (f.st === 'FINISHER' && f.floatT > 0 ? .4 : 1));
    const px = f.x;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (ar.hasRing) {
      const hgt = ar.matY - f.y; // feet height above the mat
      if (f.side === 'in') {
        const pad = 11, over = hgt > ar.ropeH - 6 && (f.vault || f.st === 'ENTER_RING');
        if (!over) {
          if (f.x < ar.ropeL + pad) { f.x = ar.ropeL + pad; f.touchRope = 'L'; if (f.vx < 0) { if (Math.abs(f.vx) > 60) ar.press('L', Math.min(14, Math.abs(f.vx) * .05)); f.vx = 0; } }
          else if (f.x > ar.ropeR - pad) { f.x = ar.ropeR - pad; f.touchRope = 'R'; if (f.vx > 0) { if (Math.abs(f.vx) > 60) ar.press('R', Math.min(14, Math.abs(f.vx) * .05)); f.vx = 0; } }
        } else if (f.x < ar.ropeL - 2 || f.x > ar.ropeR + 2) { f.side = 'out'; f.vault = false; this.m.emit('overRope', { f }); }
      } else {
        const inX = f.x > ar.ropeL + 2 && f.x < ar.ropeR - 2;
        if (inX && hgt > ar.ropeH - 10) f.side = 'in';
        else if (f.y > ar.matY + 3) { // beside the apron
          const L = ar.ropeL - ar.apron - 10, R = ar.ropeR + ar.apron + 10, mid = ar.mid;
          if (f.x > L && f.x < mid) { f.x = Math.min(px > L ? L : f.x, L); if (f.vx > 0) f.vx = 0; }
          else if (f.x < R && f.x >= mid) { f.x = Math.max(px < R ? R : f.x, R); if (f.vx < 0) f.vx = 0; }
        } else { // above the apron but below the top rope: the ropes block the way in
          if (f.x > ar.ropeL - 9 && f.x < ar.mid) { f.x = ar.ropeL - 9; if (f.vx > 0) { f.vx = 0; ar.press('L', 6); } }
          else if (f.x < ar.ropeR + 9 && f.x >= ar.mid) { f.x = ar.ropeR + 9; if (f.vx < 0) { f.vx = 0; ar.press('R', 6); } }
        }
      }
    }
    f.x = clamp(f.x, ar.x0 + 14, ar.x1 - 14);
    const g = ar.ground(f.x, f.y, f.side);
    if (f.y >= g) {
      if (!f.ground && f.vy > 0) { f.landV = f.vy; f.y = g; f.vy = 0; f.ground = true; f.vault = false; }
      else { f.y = g; f.vy = 0; f.ground = true; }
    } else if (f.y < g - .5) f.ground = false;
    else { f.y = g; f.ground = true; }
  }
  ragdoll(f, dt, ar) {
    const r = f.rag;
    r.hitGround = 0; r.hitWall = 0; r.ropeHit = 0;
    const wasOut = r.side;
    r.step(dt, ar, B.gravity);
    if (r.hitGround > 130) this.m.emit('thud', { f, v: r.hitGround, x: r.cx, y: ar.ground(r.cx, r.cy, r.side) });
    if (r.hitWall > 220 && !f.wallHit) { f.wallHit = true; this.m.combat.damage(f, B.wallDamage, 8, null, { src: 'wall' }); this.m.emit('wall', { f, x: r.cx, y: r.cy }); }
    if (r.ropeHit && Math.abs(r.vel(0)[0]) > 60) this.m.emit('ropeBody', { f });
    if (wasOut === 'in' && r.side === 'out') this.m.emit('overRope', { f, thrown: true });
    f.x = r.cx; f.side = r.side;
    const g = ar.ground(f.x, r.cy, r.side);
    f.y = Math.min(g, r.cy + f.dims.leg * .9);
    f.ground = r.ground;
    if (!f.rag) return;
    if (f.st !== 'HITSTUN' && f.st !== 'DOWN' && f.st !== 'KO' && f.st !== 'OUT') { f.dropRag(); }
  }
  // Standing bodies do not share one spot.
  separate(dt) {
    const L = this.m.fighters;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.link || b.link || a.rag || b.rag || !a.alive || !b.alive || !a.ground || !b.ground || a.side !== b.side || Math.abs(a.y - b.y) > 20) continue;
      const ok = f => f.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK', 'TAUNT', 'HITSTUN', 'STAGGER');
      if (!ok(a) || !ok(b) || (a.hsKind === 'lie' && a.st === 'HITSTUN') || (b.hsKind === 'lie' && b.st === 'HITSTUN')) continue;
      const dx = b.x - a.x, need = (a.dims.prof[4][2] + b.dims.prof[4][2]) * .9 + 6, d = Math.abs(dx);
      if (d < need) {
        const p = (need - d) * Math.min(1, dt * 10) * .5, s = dx === 0 ? (a.idx < b.idx ? 1 : -1) : sgn(dx), wa = b.stats.weight / (a.stats.weight + b.stats.weight);
        a.x -= s * p * 2 * wa; b.x += s * p * 2 * (1 - wa);
      }
    }
  }
  // Last line of defence: no NaN, nobody outside the hall, nobody under the floor.
  safety(f, ar) {
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { this.m.emit('fault', { f, why: 'nan', info: { st: f.st, prev: f.fsm.prev, x: f.x, y: f.y, vx: f.vx, vy: f.vy, rag: !!f.rag, ragx: f.rag && f.rag.x[0], hs: f.hsKind, link: f.link && f.link.kind, atk: f.atk && f.atk.def.id, t: f.t, clock: this.m.clock } }); f.rag = null; f.x = ar.mid; f.y = ar.matY; f.vx = f.vy = 0; f.side = 'in'; if (!f.link) f.set('IDLE', { force: true }); }
    f.x = clamp(f.x, ar.x0 + 8, ar.x1 - 8);
    if (f.y > ar.floorY) f.y = ar.floorY;
  }
}
