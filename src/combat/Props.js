// Loose objects in a match: folding chairs. They fly in (tossed by the boss, slid in by a coach, thrown by a
// wrestler), land, get picked up (K), swung (J: a chair shot knocks the target down at once), thrown (K while
// holding), dropped when the holder is hit or grabbed, and taken away (K on a foe holding one). A chair bends a
// little with every blow and breaks after a few. Simulation only: PropRenderer draws them.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B, ATTACKS } from '../data/balance.js';
import { J } from '../anim/skeleton.js';

ATTACKS.chairShot = { id: 'chairShot', name: '체어샷', startup: .3, active: .09, recover: .48, reach: 46, low: -12, high: 96, hp: 9, stun: 0, kb: 210, up: 140, hs: .5, stop: .17, lv: 4, chair: 1, ground: 1, wind: 'sp-16 hd-8 a176/20 b170/20 t12/12 u-16/12', hit: 'sp26 hd6 a84/6 b90/6 t32/28 u-26/16', sfx: 'clang' };
ATTACKS.chairToss = { id: 'chairToss', name: '의자 던지기', startup: .16, active: .02, recover: .3, reach: 0, low: 0, high: 0, hp: 0, stun: 0, kb: 0, hs: 0, stop: 0, lv: 1, nohit: 1, wind: 'sp-12 hd-4 a170/30 b160/30 t10/10 u-14/10', hit: 'sp18 hd4 a100/10 b96/10 t26/20 u-20/12' };
ATTACKS.chairPick = { id: 'chairPick', name: '의자 줍기', startup: .12, active: .02, recover: .16, reach: 0, low: 0, high: 0, hp: 0, stun: 0, kb: 0, hs: 0, stop: 0, lv: 1, nohit: 1, wind: 'sp46 hd14 a70/10 b76/10 t70/90 u-6/70', hit: 'sp12 hd0 a64/70 b70/66 t20/16 u-20/12' };

export const CHAIR = { uses: 3, pickR: 32, catchR: 44, throwV: 340, half: 12 };
// States in which a wrestler keeps hold of a chair; any other state drops it.
const KEEP = new Set(['IDLE', 'MOVE', 'ATTACK', 'GUARD', 'JUMP', 'FALL', 'TAUNT', 'ROPE', 'WIN', 'INTRO', 'ENTER_RING', 'EXIT_RING', 'APRON']);
export const keepsProp = st => KEEP.has(st);

export class PropSystem {
  constructor(m) { this.m = m; this.list = []; this.n = 0; }
  get any() { return this.list.length > 0; }
  // x, y: centre of the chair. o.state 'floor' puts it on the ground, 'fly' throws it with o.vx/o.vy.
  spawn(x, y, o = {}) {
    const ar = this.m.arena;
    const p = Object.assign({ id: ++this.n, kind: 'chair', x, y, vx: 0, vy: 0, rot: 0, spin: 0, side: 'in', state: 'floor', holder: null, uses: CHAIR.uses, by: null, aim: null, hit: new Set(), t: 0, gone: false, bounces: 0, dent: 0 }, o);
    if (p.state === 'fly' && !p.spin) p.spin = sgn(p.vx || 1) * 8;
    if (p.state === 'floor') this.rest(p, ar);
    this.list.push(p);
    this.m.emit('propSpawn', { p });
    return p;
  }
  rest(p, ar) { p.state = 'floor'; p.vx = p.vy = p.spin = 0; p.rot = (p.rot % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) < Math.PI ? Math.PI / 2 : -Math.PI / 2; p.y = ar.ground(p.x, p.y, p.side) - 10; p.by = null; p.aim = null; p.hit.clear(); }
  update(dt) {
    const m = this.m, ar = m.arena;
    for (const p of this.list) {
      p.t += dt;
      if (p.state === 'held') { if (!p.holder || !p.holder.alive || p.holder.prop !== p) this.release(p, 0, -60); continue; }
      if (p.state !== 'fly') continue;
      p.vy = Math.min(B.maxFall, p.vy + B.gravity * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      if (ar.hasRing) { // in or out of the ring, as a body would be
        if (p.side === 'out' && p.x > ar.ropeL + 2 && p.x < ar.ropeR - 2 && p.y < ar.matY - 4) p.side = 'in';
        else if (p.side === 'in' && (p.x < ar.ropeL - 6 || p.x > ar.ropeR + 6)) p.side = 'out';
      }
      if (p.x < ar.x0 + 12 || p.x > ar.x1 - 12) { p.x = clamp(p.x, ar.x0 + 12, ar.x1 - 12); p.vx *= -.3; }
      if (p.by || p.aim) this.hits(p);
      const g = ar.ground(p.x, p.y + 10, p.side) - 10;
      if (p.y >= g && p.vy > 0) {
        p.y = g;
        if (p.vy > 200 && p.bounces < 2) { p.vy *= -.3; p.vx *= .45; p.spin *= -.5; p.bounces++; p.by = null; p.aim = null; m.emit('propLand', { p, hard: true }); }
        else { this.rest(p, ar); m.emit('propLand', { p }); }
      }
    }
    if (this.list.some(p => p.gone)) this.list = this.list.filter(p => !p.gone);
  }
  // Held chairs ride on the hands; called after the bodies are posed.
  follow() {
    for (const p of this.list) {
      if (p.state !== 'held' || !p.holder) continue;
      const f = p.holder, jt = f.joints;
      const hx = (jt.x(J.hN) + jt.x(J.hF)) / 2, hy = (jt.y(J.hN) + jt.y(J.hF)) / 2, sx = (jt.x(J.sN) + jt.x(J.sF)) / 2, sy = (jt.y(J.sN) + jt.y(J.sF)) / 2;
      const a = Math.atan2(hy - sy, hx - sx);
      p.x = hx + Math.cos(a) * 9; p.y = hy + Math.sin(a) * 9; p.rot = a + Math.PI / 2; p.face = f.face; p.side = f.side;
    }
  }
  // Thrown chairs hit whoever they meet: guard blocks, a dodge passes through, otherwise down at once.
  hits(p) {
    const m = this.m;
    for (const v of m.fighters) {
      if (!v.alive || v === p.by || p.hit.has(v) || v.link || v.st === 'TAGWAIT') continue;
      if (p.by && !p.by.isFoe(v)) continue;
      const b = m.combat.hurtbox(v);
      if (p.x + CHAIR.half < b.x0 || p.x - CHAIR.half > b.x1 || p.y + CHAIR.half < b.y0 || p.y - CHAIR.half > b.y1) continue;
      p.hit.add(v);
      if (this.impact(p, v)) return;
    }
  }
  impact(p, v) {
    const m = this.m, dir = sgn(p.vx) || sgn(v.x - p.x) || 1;
    if (v.inv > 0 || (v.st === 'DODGE' && v.invDodge)) { m.emit('dodge', { f: v, a: p.by || v }); return false; }
    if (v.st === 'GUARD' && v.face === -dir) {
      v.stun -= v.maxStun * .35; v.regenDelay = B.stunRegenDelay;
      p.vx = -p.vx * .25; p.vy = -170; p.spin = -p.spin; p.by = null; p.aim = null; p.dent = Math.min(3, p.dent + 1);
      m.hitstop(.1); m.emit('chairHit', { a: null, v, p, guarded: true, thrown: true, x: p.x, y: p.y });
      if (v.stun <= 0) { v.stun = v.maxStun * .25; m.combat.stagger(v, B.guardBreakStagger, null); m.emit('guardBreak', { a: v, v }); }
      return true;
    }
    if (!(v.fsm.is('IDLE', 'MOVE', 'ATTACK', 'TAUNT', 'JUMP', 'FALL', 'AIR_ATTACK', 'STAGGER', 'HITSTUN', 'ROPE', 'WHIPPED', 'GET_UP', 'PERCH', 'CLIMB', 'APRON') || v.st === 'GUARD')) return false;
    m.combat.damage(v, 6, 0, p.by, { def: ATTACKS.chairShot });
    p.vx *= -.25; p.vy = -160; p.spin = -p.spin; p.dent = Math.min(3, p.dent + 1); p.uses--;
    const by = p.by; p.by = null; p.aim = null;
    m.addHype(10); m.hitstop(.15);
    m.emit('chairHit', { a: by, v, p, thrown: true, x: p.x, y: p.y });
    if (v.alive && v.st !== 'KO') m.stun.breakStun(v, by, dir * 150 / v.stats.kbr, -150, dir);
    if (p.uses <= 0) this.breakProp(p);
    return true;
  }
  // ---- what is near a wrestler ----
  loose(f, r = CHAIR.pickR) {
    let best = null, bd = r;
    for (const p of this.list) { if (p.state !== 'floor' || p.side !== f.side) continue; const d = Math.abs(p.x - f.x); if (d < bd && Math.abs((p.y + 10) - f.y) < 26) { bd = d; best = p; } }
    return best;
  }
  incoming(f) {
    for (const p of this.list) {
      if (p.state !== 'fly' || p.by === f || p.vy < -40 && p.aim !== f) continue;
      const dx = p.x - f.x, dy = p.y - (f.y - f.h * .55);
      if (Math.abs(dx) < CHAIR.catchR && Math.abs(dy) < 44 && (p.aim === f || sgn(-dx) === sgn(p.vx) || Math.abs(dx) < 16)) return p;
    }
    return null;
  }
  threat(f) { return this.list.find(p => p.state === 'fly' && p.aim === f) || null; }
  // ---- actions ----
  attach(p, f) {
    if (f.prop && f.prop !== p) this.release(f.prop, -f.face * 40, -80);
    if (p.holder && p.holder !== f) p.holder.prop = null;
    p.state = 'held'; p.holder = f; f.prop = p; p.by = null; p.aim = null; p.side = f.side; p.hit.clear();
  }
  release(p, vx = 0, vy = -60) {
    const f = p.holder;
    if (f && f.prop === p) f.prop = null;
    p.holder = null; p.state = 'fly'; p.vx = vx; p.vy = vy; p.spin = (sgn(vx) || 1) * 5; p.by = null; p.aim = null; p.bounces = 1;
  }
  pick(f, p) {
    this.attach(p, f);
    f.vx = 0; f.face = sgn(p.x - f.x) || f.face;
    if (!f.set('ATTACK')) return true;
    f.atk = { def: ATTACKS.chairPick, t: 0, hit: new Set(), connected: true, chain: -1, boost: 1, done: false };
    this.m.emit('propPick', { f, p });
    return true;
  }
  catchProp(f, p) {
    this.attach(p, f);
    f.vx = -sgn(p.vx || f.face) * 40;
    this.m.addHype(8);
    this.m.emit('propCatch', { f, p });
    return true;
  }
  toss(f) {
    const p = f.prop;
    if (!p) return false;
    if (!f.set('ATTACK')) return false;
    f.atk = { def: ATTACKS.chairToss, t: 0, hit: new Set(), connected: true, chain: -1, boost: 1, done: false };
    f.prop = null; p.holder = null; p.state = 'fly'; p.x = f.x + f.face * 16; p.y = f.y - f.h * .72;
    p.vx = f.face * CHAIR.throwV; p.vy = -150; p.spin = f.face * 11; p.by = f; p.aim = null; p.bounces = 0; p.hit.clear();
    this.m.emit('propThrow', { f, p });
    return true;
  }
  steal(f, v) {
    const p = v.prop;
    if (!p || (v.st === 'ATTACK' && v.atk && v.atk.def.chair && v.atk.t > v.atk.def.startup * .5)) return false;
    this.attach(p, f);
    f.face = sgn(v.x - f.x) || f.face;
    this.m.combat.stagger(v, .55, f); v.vx = f.face * 90;
    this.m.addHype(6);
    this.m.emit('propSteal', { f, v, p });
    return true;
  }
  drop(f, why, dir) {
    const p = f.prop;
    if (!p) return;
    this.release(p, (dir != null ? dir : -f.face) * (why === 'parry' ? 150 : 60), why === 'parry' ? -220 : -90);
    p.x = f.x + f.face * 10; p.y = f.y - f.h * .6;
    this.m.emit('propDrop', { f, p, why });
  }
  breakProp(p) {
    if (p.holder && p.holder.prop === p) p.holder.prop = null;
    p.gone = true; p.holder = null;
    this.m.emit('chairBreak', { p, x: p.x, y: p.y });
  }
}
