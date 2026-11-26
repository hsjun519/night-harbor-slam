// Finishers: start-up, the attempt (which can miss, be blocked or interrupted) and the hand-off to the move player.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';
import { STATES } from './StateMachine.js';

export class FinisherSystem {
  constructor(match) { this.m = match; }
  start(f) {
    const F = f.finisher, m = this.m;
    if (!F || f.fin < B.finMax) return false;
    // a helpless foe in reach: no need for the attempt phase
    const g = m.grapple.grabTarget(f);
    f.faceFoe(220);
    if (!f.set('FINISHER')) return false;
    f.vx = 0;
    f.finPhase = { F, t: 0, stage: 'charge', armor: !!F.armor, target: g, direct: !!g, tx: 0, hit: false };
    f.expr = 'fierce'; f.exprT = 3;
    m.emit('finisherStart', { f, F, direct: !!g });
    return true;
  }
  fromHold(f, L) {
    const m = this.m, F = f.finisher, v = L.v;
    const i = m.links.indexOf(L);
    if (i >= 0) m.links.splice(i, 1);
    f.link = v.link = null;
    f.fin = 0;
    m.emit('finisherStart', { f, F, direct: true, hold: true });
    this.connect(f, v, F, true);
    return true;
  }
  connect(f, v, F, canReverse) {
    const m = this.m;
    f.fin = 0; f.finPhase = null;
    f.face = sgn(v.x - f.x) || f.face;
    const ok = m.wrestle.begin(f, v, F.parts, { fin: F, noReverse: !canReverse });
    if (ok) { m.emit('finisherHit', { f, v, F }); m.addHype(22); }
    else f.set('IDLE', { force: true });
    return ok;
  }
  miss(f, why) {
    const F = f.finPhase.F;
    f.fin = B.finMax * B.finMissKeep; f.finPhase = null;
    this.m.emit('finisherMiss', { f, F, why });
    this.m.addHype(-6);
    if (why === 'crash') { f.hsKind = 'lie'; f.hs = 1.0; f.lieClip = 'downProne'; f.set('HITSTUN', { force: true, clip: 'downProne' }); }
    else if (why === 'blocked') { f.hsKind = 'stand'; f.hs = .75; f.set('HITSTUN', { force: true, clip: 'hitHeavy' }); f.vx = -f.face * 140; }
    else this.m.combat.stagger(f, .8, null);
  }
  catchable(v, strike) { return v.alive && !v.link && v.inv <= 0 && !(v.st === 'DODGE' && v.invDodge) && (STATES[v.st].hit || v.st === 'STAGGER' || (v.st === 'DOWN' && !v.rag && v.grabImm <= 0)) && (!v.rag || strike) && v.st !== 'PERCH'; }
  control(f, I, dt) {
    const P = f.finPhase, m = this.m;
    if (!P) { f.set('IDLE', { force: true }); return; }
    P.t += dt;
    const F = P.F;
    if (P.stage === 'charge') {
      f.vx = 0;
      const T = P.direct ? .34 : F.type === 'quake' ? .55 : F.type === 'stance' ? .2 : .42;
      if (P.t < T * .8) { const n = f.nearestFoe(400); if (n) f.face = sgn(n.x - f.x) || f.face; }
      if (P.t >= T) {
        if (P.direct) { const v = P.target; if (v && v.alive && !v.link && m.grapple.canReach(f, v) && (v.grabbable || this.catchable(v))) { this.connect(f, v, F, false); return; } this.miss(f, 'gone'); return; }
        P.stage = F.type === 'stance' ? 'stance' : F.type === 'dive' ? 'leap' : F.type === 'quake' ? 'lunge' : 'lunge'; P.t = 0;
        const n = f.nearestFoe(420);
        P.tx = n ? n.x : f.x + f.face * 120;
        if (P.stage === 'leap') { f.ground = false; f.vy = -330; f.vx = clamp((P.tx - f.x) / .72, -F.reach * 1.9, F.reach * 1.9); f.floatT = 0; }
        m.emit('finisherGo', { f, F });
      }
      return;
    }
    if (P.stage === 'lunge') {
      const T = F.type === 'strike' ? .36 : F.type === 'quake' ? .3 : .3;
      f.vx = f.face * (F.type === 'strike' ? 330 : 270) * (1 - P.t / T * .4);
      for (const v of m.fighters) {
        if (!f.isFoe(v) || !this.catchable(v, F.type === 'strike')) continue;
        const dx = (v.x - f.x) * f.face;
        if (dx > -14 && dx < 40 && Math.abs(v.y - f.y) < (F.type === 'strike' ? 46 : 30)) {
          if (v.st === 'GUARD' && v.face === -f.face && F.type === 'strike') { m.combat.damage(v, 4, 20, f, { chip: true }); m.hitstop(.12); m.emit('block', { a: f, v, d: { lv: 3 }, x: v.x, y: v.y - 50 }); this.miss(f, 'blocked'); return; }
          if (v.atk && v.atk.def.armor >= 2) continue;
          if (v.rag) { v.dropRag(); v.y = f.y; }
          this.connect(f, v, F, true);
          return;
        }
      }
      if (P.t >= T || f.touchRope) { f.vx *= .3; this.miss(f, 'whiff'); }
      return;
    }
    if (P.stage === 'leap') {
      const down = f.vy > 0;
      for (const v of m.fighters) {
        if (!f.isFoe(v) || !this.catchable(v, true)) continue;
        if (Math.abs(v.x - f.x) < 38 && down && f.y > v.y - 74) { f.y = v.ground ? v.y : f.y; f.ground = true; f.vx = f.vy = 0; f.y = m.arena.ground(f.x, f.y, f.side); if (v.rag) { v.dropRag(); v.y = f.y; } this.connect(f, v, F, true); return; }
      }
      if (f.ground && P.t > .1) this.miss(f, 'crash');
      return;
    }
    if (P.stage === 'stance') {
      f.vx = 0;
      // strikes landing on the stance are read in stanceCatch()
      for (const v of m.fighters) if (f.isFoe(v) && this.catchable(v) && Math.abs(v.x - f.x) < F.reach && P.t > .1 && (v.st === 'STAGGER' || v.st === 'ATTACK' || v.st === 'GRAB')) { this.connect(f, v, F, false); return; }
      if (P.t > 1.35) this.miss(f, 'stance');
    }
  }
}
