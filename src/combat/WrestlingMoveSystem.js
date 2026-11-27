// Plays two-person moves: timing, position lock, timed damage, reversals, release into ragdoll. Data driven.
import { clamp, clamp01, sgn } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';
import { MOVES } from '../data/moves.js';
import { STATES } from './StateMachine.js';
import { moveExtent, yawAt, compileMove } from '../anim/paired.js';

// How many moves this down may carry (see BALANCE.moveChainByDown) and its index for the other per-down tables.
export function chainAllow(v) { const i = Math.max(0, Math.min(v.downs || 1, B.moveChainByDown.length) - 1); return { i, n: Math.min(B.moveChainMax, B.moveChainByDown[i]) }; }

export class WrestlingMoveSystem {
  constructor(match) { this.m = match; }
  startFromHold(L, id) {
    const { a, v } = L, i = this.m.links.indexOf(L);
    if (i >= 0) this.m.links.splice(i, 1);
    a.link = v.link = null;
    return this.begin(a, v, [id], {});
  }
  start(a, v, id, o = {}) { return this.begin(a, v, [id], o); }
  // parts: move ids run back to back without letting go.
  begin(a, v, parts, o = {}) {
    const m = this.m, mv = MOVES[parts[0]];
    if (!mv || !v.alive || v.link && v.link.kind === 'move') return false;
    if (v.link) m.grapple.breakLink(v.link, 'move');
    if (!a.fsm.is(o.state || 'WRESTLING_MOVE') && !a.set(o.state || 'WRESTLING_MOVE', { force: a.fsm.is('GRAB', 'IDLE', 'MOVE', 'FINISHER', 'COUNTER', 'DODGE', 'GUARD') })) return false;
    v.dropRag(); v.atk = null;
    v.set('GRABBED', { force: true });
    if (mv.need === 'rope' || mv.toRope) { const nr = m.arena.nearRope(a.x); a.face = nr.dir; }
    const stale = this.stale(a, parts[parts.length - 1], o.fin);
    const L = {
      kind: 'move', a, v, dV: v.dims, vName: v.name, move: mv, parts: parts.slice(), part: 0, t: 0, evI: 0, committed: !!o.noReverse, noReverse: !!o.noReverse, fin: o.fin || null, counter: !!o.counter,
      power: a.stats.grp * stale * (o.power || 1) * (o.fin ? 1 : Math.pow(B.moveChainScale, v.moveChain || 0)), stunAlive: v.stun > 0, released: false, x0: a.x, shift: 0, rev: { tried: false, done: false }, swept: new Set(), front: false, mirror: o.mirror, follow: !!o.follow,
    };
    a.link = v.link = L;
    m.links.push(L);
    a.vx = a.vy = v.vx = v.vy = 0; v.y = a.y; v.side = a.side; v.ground = true; a.ground = true;
    v.expr = 'hurt'; v.exprT = mv.dur + 1; a.expr = 'fierce'; a.exprT = mv.dur;
    this.planShift(L);
    m.anim.freezeBlend(a, .14); m.anim.freezeBlend(v, .18);
    m.emit('moveStart', { a, v, mv, L, fin: L.fin });
    return true;
  }
  stale(a, id, fin) {
    if (fin) return 1;
    for (const k in a.moveStale) if (k !== id) a.moveStale[k] = Math.max(0, a.moveStale[k] - .5);
    const n = a.moveStale[id] || 0;
    a.moveStale[id] = n + 1;
    if (!a.movesDone.has(id)) { a.movesDone.add(id); this.m.addHype(5); } else this.m.addHype(Math.max(0, 3 - n));
    return Math.max(.6, 1 - n * .12);
  }
  // Slide the pair so the whole move stays inside the ring.
  planShift(L) {
    const ar = this.m.arena, { a, move } = L;
    L.shift = 0;
    if (move.tags && move.tags.includes('ringout')) { // stand where the throw clears the rope
      const tx = a.face > 0 ? ar.ropeR - 40 : ar.ropeL + 40;
      L.shift = tx - a.x;
      return;
    }
    if (move.push) { const tx = a.face > 0 ? ar.ropeR - 38 : ar.ropeL + 38; L.shift = tx - a.x; return; }
    const e = moveExtent(move), k = a.dims.height / 94;
    const lo = ar.hasRing && a.side === 'in' ? ar.ropeL + 8 : ar.x0 + 12, hi = ar.hasRing && a.side === 'in' ? ar.ropeR - 8 : ar.x1 - 12;
    let x0 = a.x + (a.face > 0 ? e.lo : -e.hi) * k, x1 = a.x + (a.face > 0 ? e.hi : -e.lo) * k;
    if (move.yaw) { const r = Math.min(120, Math.max(Math.abs(e.lo), e.hi) * k); x0 = a.x - r; x1 = a.x + r; }
    if (ar.hasRing && a.side === 'out') return;
    if (x0 < lo) L.shift = lo - x0; else if (x1 > hi) L.shift = hi - x1;
  }
  update(dt) {
    for (const L of this.m.links.slice()) if (L.kind === 'move') this.tick(L, dt);
  }
  tick(L, dt) {
    const m = this.m, { a } = L;
    let mv = L.move;
    const before = L.t;
    L.t += dt;
    // eased slide into position
    if (L.shift) { const T = mv.push ? .46 : .4, k = clamp01(L.t / T), s = k * k * (3 - 2 * k); a.x = L.x0 + L.shift * s; if (k >= 1) { L.x0 = a.x; L.shift = 0; } }
    if (L.v) this.placeVictim(L);
    this.reversal(L, dt);
    if (a.link !== L) return; // reversed or cancelled
    while (L.evI < mv.ev.length && mv.ev[L.evI][0] <= L.t) { const e = mv.ev[L.evI++]; this.event(L, e[0], e[1], e[2] || {}); if (a.link !== L) return; }
    if (mv.sweep && mv.yaw && L.t > mv.yaw[0][0] && L.t < mv.rel) this.sweep(L, mv);
    if (L.v && !L.released && L.t >= mv.rel && L.part === L.parts.length - 1) this.release(L);
    if (a.link !== L) return;
    if (L.t >= mv.dur) {
      if (L.part < L.parts.length - 1) {
        const c = compileMove(mv), last = c.A[c.A.length - 1].p;
        a.x += a.face * last[12];
        L.part++; L.move = mv = MOVES[L.parts[L.part]]; L.t = 0; L.evI = 0; L.x0 = a.x; L.committed = true;
        this.planShift(L);
        m.anim.freezeBlend(a, .1); if (L.v) m.anim.freezeBlend(L.v, .1);
        return;
      }
      if (mv.toHold && L.v && !L.released) { this.toHold(L); return; }
      if (L.v && !L.released) this.release(L);
      this.finish(L);
    }
    void before;
  }
  placeVictim(L) {
    const { a, v } = L;
    if (!v) return;
    // rough body position for cameras and targeting; the drawing uses the exact pose
    const j = v.joints; void j;
    v.x = clamp(v.pelvisX != null && v.pelvisLink === L ? v.pelvisX : a.x + a.face * 24, this.m.arena.x0, this.m.arena.x1);
    v.y = a.y; v.side = a.side;
  }
  reversal(L, dt) {
    const v = L.v, mv = L.move;
    if (!v || L.released) return;
    if (mv.sub) this.subCheck(L, dt);
    if (mv.roll) { this.rollCheck(L); return; }
    if (L.committed) return;
    const n = v.reversals || 0;
    let lead = L.fin ? .2 : B.reversalLead, win = B.reversalWindow * Math.max(.5, 1 - n * .14) * (L.fin ? .7 : 1) * (v.char.style === 'tech' ? 1.2 : 1);
    if (mv.revAt) { lead = mv.revAt[0]; win = (mv.revAt[1] - mv.revAt[0]) * Math.max(.6, 1 - n * .1); }
    L.rev.open = L.t >= lead && L.t <= lead + win;
    if (L.t > lead + win) { L.committed = true; L.rev.open = false; return; }
    if (v.has('dodge') && !L.rev.tried) {
      v.consume('dodge');
      L.rev.tried = true;
      if (L.rev.open) this.reverse(L); else this.m.emit('revFail', { v });
    }
    void dt;
  }
  reverse(L) {
    const m = this.m, { a, v } = L, mv = L.move;
    let id = v.moves.counter || 'hipToss';
    if (mv.revMove) {   // this one is only turned around with energy
      if (v.fin < (mv.revCost || 0)) { m.emit('revFail', { v, why: `에너지 ${mv.revCost} 필요` }); return; }
      v.fin -= mv.revCost || 0; id = mv.revMove;
      m.emit('sCounter', { f: v, a, name: MOVES[id].name, kind: 'reverse', cost: mv.revCost || 0 });
    }
    v.reversals = (v.reversals || 0) + 1;
    this.unlink(L);
    v.face = sgn(a.x - v.x) || -a.face; v.side = a.side; v.y = a.y; v.ground = true;
    v.stun = Math.max(v.stun, v.maxStun * .45);
    v.set('IDLE', { force: true });
    m.combat.addFin(v, B.finCounter); v.counters++;
    if (L.fin) a.fin = Math.max(a.fin, B.finMax * .3);
    m.addHype(9);
    m.hitstop(.16);
    m.emit('reversal', { f: v, a, fin: L.fin });
    this.begin(v, a, [id], { noReverse: true, counter: true });
  }
  // L in the window: roll out of the way, the attacker hits the mat
  rollCheck(L) {
    const v = L.v, mv = L.move, [t0, t1] = mv.roll;
    L.rev.open = L.t >= t0 && L.t <= t1;
    if (L.rev.tried || L.t > t1) return;
    if (v.ai && v.ctrl === 'ai') {
      if (L.rollAi == null) L.rollAi = v.ai.rng.chance(v.ai.D.rev * 1.5) ? t0 + v.ai.D.react * .25 + v.ai.rng.next() * (t1 - t0) * .5 : -1;
      if (L.rollAi > 0 && L.t >= L.rollAi) { L.rev.tried = true; this.rollAway(L); }
      return;
    }
    if (v.has('dodge')) { v.consume('dodge'); L.rev.tried = true; if (L.rev.open) this.rollAway(L); else this.m.emit('revFail', { v }); }
  }
  rollAway(L) {
    const m = this.m, { a, v } = L, ar = m.arena;
    this.unlink(L);
    const away = sgn(v.x - a.x) || a.face;
    const lo = ar.hasRing && v.side === 'in' ? ar.ropeL + 16 : ar.x0 + 20, hi = ar.hasRing && v.side === 'in' ? ar.ropeR - 16 : ar.x1 - 20;
    v.x = clamp(v.x + away * 36, lo, hi); v.y = ar.ground(v.x, a.y, v.side); v.ground = true;
    v.downClock = 0; v.downTime = .45; v.grabImm = 1; v.inv = .6; v.postMove = true;
    v.set('DOWN', { force: true }); m.anim.freezeBlend(v, .22);
    a.lieClip = 'downProne'; a.hs = .75; a.hsKind = 'lie'; a.x += a.face * 12;
    a.set('HITSTUN', { force: true, clip: 'downProne' }); m.anim.freezeBlend(a, .12);
    m.combat.damage(a, 2, 8, null, { src: 'self' });
    m.emit('rollAway', { a, v, move: L.move });
  }
  // holds on the mat: mash to break out
  subCheck(L, dt) {
    const v = L.v, mv = L.move;
    if (L.t < mv.sub[0] || L.t > mv.sub[1]) { L.subOn = false; return; }
    L.subOn = true;
    let n = 0;
    for (const k of ['atk', 'grab', 'dodge', 'jump']) if (v.buf[k] >= B.inputBuffer - 1e-6) n++;
    if (v.ai && v.ctrl === 'ai') n += v.ai.rng.chance(dt * v.ai.D.mash * .8) ? 1 : 0;
    const power = (.5 + .5 * v.hp / v.maxHp) * Math.sqrt(v.stats.grp / L.a.stats.grp);
    L.esc = Math.max(0, (L.esc || 0) + n * 8.5 * power - dt * 9);
    if (L.esc >= 100) this.subEscape(L);
  }
  subEscape(L) {
    const m = this.m, { a, v } = L;
    this.unlink(L);
    v.downClock = 0; v.downTime = .35; v.grabImm = 1.2; v.inv = .5; v.postMove = true;
    v.set('DOWN', { force: true }); m.anim.freezeBlend(v, .2);
    if (a.alive) { a.gettingUp = { wait: .1, dur: .5 / a.stats.rec, prot: .2, clip: 'getupSup' }; a.set('GET_UP', { force: true }); m.anim.freezeBlend(a, .15); }
    m.emit('subEscape', { a, v, move: L.move });
  }
  // end of a lift: keep holding them (어깨 메기 -> carrying)
  toHold(L) {
    const m = this.m, { a, v, move } = L;
    this.unlink(L);
    m.anim.freezeBlend(a, .08); m.anim.freezeBlend(v, .08);
    m.emit('moveEnd', { a, move });
    if (!m.grapple.beginCarry(a, v)) { a.set('IDLE', { force: true }); v.set('IDLE', { force: true }); }
  }
  unlink(L) {
    const i = this.m.links.indexOf(L);
    if (i >= 0) this.m.links.splice(i, 1);
    if (L.a.link === L) L.a.link = null;
    if (L.v && L.v.link === L) L.v.link = null;
  }
  cancel(L, why) {
    const { a, v } = L;
    this.unlink(L);
    if (v) { this.m.anim.freezeBlend(v, .15); v.y = this.m.arena.ground(v.x, v.y, v.side); v.ground = true; v.grabImm = 1; v.inv = .4; v.stun = Math.max(v.stun, v.maxStun * .3); if (v.alive) v.set('IDLE', { force: true }); }
    if (a.alive && a.st === 'WRESTLING_MOVE') a.set('IDLE', { force: true });
    this.m.emit('moveCancel', { a, v, why });
  }
  event(L, t, k, o) {
    const m = this.m, { a, move } = L, v = L.v || L.relV;
    if (o.d && v) {
      // slammed onto a chair lying on the mat: the chair breaks and the rest of the move hits twice as hard
      if (k === 'impact' && !L.chairK) { const ch = m.props.under(v); if (ch) { L.chairK = L.fin ? B.chairSlamFin : B.chairSlam; m.emit('chairSlam', { a, v, x: ch.x, y: ch.y, k: L.chairK }); m.props.breakProp(ch, 'slam'); } }
      // career mastery: a little more damage per level; each landed move (a finisher once) counts as one use
      const key = L.fin ? 'fin:' + L.fin.id : move.id, tag = L.fin ? 'fin' : L.part;
      const hp = move.hp * L.power * o.d * (1 + (a.mastery && a.mastery[key] || 0)) * (L.chairK || 1), st = move.stun * o.d * (L.chairK ? 1.3 : 1);
      if (L.usedTag !== tag) { L.usedTag = tag; a.moveUses[key] = (a.moveUses[key] || 0) + 1; }
      m.combat.damage(v, hp, st, a, { move });
      if (!L.fin) m.combat.addFin(a, move.gain * o.d); else if (v) v.finishersTaken += o.d > .4 ? 1 : 0;
      v.combo.n = Math.max(1, v.combo.n); v.flash = .12; v.hitShake = .2;
    }
    const pos = this.contactPoint(L, o);
    m.emit('moveEvent', { L, a, v, move, k, o, x: pos[0], y: pos[1], fin: L.fin });
    if (k === 'impact') {
      m.hitstop(L.fin ? .16 + .03 * o.p : .06 + .04 * o.p);
      m.addHype(2 + o.p * 2);
      if (move.quake) this.quake(L, move.quake);
    } else if (k === 'smack') m.hitstop(.07);
  }
  contactPoint(L, o) {
    const v = L.v || L.relV || L.a;
    if (v.joints) { const j = v.joints, i = o.body ? 1 : 0; return [j.x(i), o.body || L.move.vf === undefined ? j.y(i) : L.a.y]; }
    return [v.x, v.y];
  }
  quake(L, r) {
    const m = this.m, cx = L.v ? L.v.x : L.a.x;
    for (const o of m.fighters) if (o !== L.a && o !== L.v && L.a.isFoe(o) && o.alive && !o.link && o.ground && o.inv <= 0 && Math.abs(o.x - cx) < r && STATES[o.st].hit && Math.abs(o.y - L.a.y) < 24) m.combat.knock(o, sgn(o.x - cx) * 150, -150, 14, L.a, 2);
  }
  sweep(L, mv) {
    const m = this.m, { a } = L, y = yawAt(mv, L.t) * Math.PI / 180, reach = mv.sweep + 34, vx = a.x + a.face * Math.cos(y) * reach;
    for (const o of m.fighters) {
      if (o === a || o === L.v || !a.isFoe(o) || !o.alive || o.link || o.inv > 0 || L.swept.has(o) || !STATES[o.st].hit) continue;
      const lo = Math.min(a.x, vx), hi = Math.max(a.x, vx);
      if (o.x > lo - 8 && o.x < hi + 8 && Math.abs(o.y - a.y) < 40) { L.swept.add(o); m.combat.knock(o, sgn(o.x - a.x) * 260, -170, 20, a, 4); m.hitstop(.08); m.emit('sweep', { a, o }); }
    }
  }
  release(L) {
    const m = this.m, { a, v, move } = L;
    L.released = true; L.committed = true;
    if (!v) return;
    v.link = null; L.v = null; L.relV = v;
    if (move.toSeat && v.hp > 0) { m.combo.seat(v, a); m.emit('release', { a, v, move }); return; }
    // a victim spun half way round (yaw) faces the other way when let go
    const yawFlip = move.yaw && Math.cos(yawAt(move, L.t) * Math.PI / 180) < 0 ? -1 : 1;
    v.side = a.side; v.ground = false; v.face = a.face * move.vf * (L.faceFlip || 1) * yawFlip;
    const vel = move.vel || [0, -60, 0], k = 1 / Math.sqrt(v.stats.kbr);
    if (move.whip) {
      const dir = a.face;
      v.face = dir; v.ground = true; v.y = a.y;
      v.whip = { dir, t: 0, speed: 290, back: false, lean: 0, max: .85, by: a };
      v.set('WHIPPED', { force: true }); v.stun = Math.max(v.stun, v.maxStun * .34); v.vx = dir * 290;
      m.emit('whip', { a, v });
      return;
    }
    if (move.stagger && v.hp > 0 && (v.grabCount || 0) < 2 && L.part === L.parts.length - 1) { v.ground = true; v.y = a.y; v.stun = Math.max(6, v.stun); m.combat.stagger(v, 1.0, a); v.vx = a.face * 110; v.face = move.vf > 0 ? a.face : -a.face; m.emit('release', { a, v, move }); return; }
    const ringout = move.tags && move.tags.includes('ringout');
    if (v.hp <= 0 && m.koAllowed(v)) m.knockOut(v, a, a.face * vel[0] * k, vel[1], vel[2] * a.face);
    else {
      const broke = L.stunAlive && v.stun <= 0;
      v.downClock = 0;
      if (broke && !L.fin) { v.downs++; v.downTime = m.stun.downTime(v); v.grabImm = 0; v.postMove = false; }
      else {
        // one down can carry a short chain of moves; after the last one the body is left alone until it stands
        v.postMove = true; v.moveChain = (v.moveChain || 0) + 1;
        const ca = chainAllow(v), more = !L.fin && v.moveChain < ca.n;
        v.grabImm = more ? .45 : 60;
        v.downTime = (B.moveDownTimes[ca.i] || B.moveDownTime) * (L.fin ? 1.6 : 1);
        if (L.fin) v.downs++;
      }
      v.set('DOWN', { force: true });
      v.ragdoll(a.face * vel[0] * k, vel[1], vel[2] * a.face, ringout);
      if (ringout) { v.rag.over = true; v.thrownOut = { by: a, t: m.time }; }
      m.emit('down', { f: v, a, n: v.downs, quiet: !broke, fin: !!L.fin });
    }
    v.expr = 'dizzy'; v.exprT = 1.6;
    m.emit('release', { a, v, move });
  }
  finish(L) {
    const { a, move } = L, m = this.m;
    this.unlink(L);
    if (!a.alive) return;
    const c = compileMove(move), last = c.A[c.A.length - 1].p;
    m.anim.freezeBlend(a, .12);
    a.x += a.face * last[12];
    a.ground = true; a.y = m.arena.ground(a.x, a.y, a.side);
    const selfT = (move.self || .2) / a.stats.rec * .5;
    if (last[0] < -45 || last[0] > 45) { a.gettingUp = { wait: selfT * .5, dur: .5 / a.stats.rec, prot: .25, clip: last[0] < 0 ? 'getupSup' : 'getupProne' }; a.set('GET_UP', { force: true }); }
    else { a.landT = Math.max(.07, selfT * .6); a.set('IDLE', { force: true }); }
    if (move.endApron && m.arena.hasRing) { const ar = m.arena, left = a.x < ar.mid; a.side = 'out'; a.x = left ? ar.ropeL - 9 : ar.ropeR + 9; a.y = ar.matY; a.ground = true; a.vx = a.vy = 0; a.set('APRON', { force: true }); }
    m.emit('moveEnd', { a, move });
  }
}
