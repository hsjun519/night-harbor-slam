// STUN gauge: regeneration after a quiet moment, and the knock-down when it runs out.
import { BALANCE as B } from '../data/balance.js';

export class StunSystem {
  constructor(match) { this.m = match; }
  update(dt) {
    for (const f of this.m.fighters) {
      if (!f.alive || f.regenDelay > 0) continue;
      if (f.fsm.is('HITSTUN', 'DOWN', 'GRABBED', 'PINNED', 'KO', 'STAGGER')) continue;
      f.stun = Math.min(f.maxStun, f.stun + B.stunRegen * f.stats.down * dt * (f.st === 'GUARD' ? .4 : 1));
    }
  }
  downTime(f) { const n = Math.min(f.downs, B.downTimes.length) - 1; return B.downTimes[Math.max(0, n)]; }
  // STUN hit zero: knock the body down.
  breakStun(v, a, vx, vy, dir) {
    if (!v.alive || v.st === 'DOWN') return;
    v.stun = 0; v.downs++;
    v.downTime = this.downTime(v); v.downClock = 0; v.postMove = false;
    v.set('DOWN', { force: true });
    v.ragdoll(vx, vy, dir * 4.2);
    v.wallHit = false; v.grabImm = 0; v.combo.n = 0; v.expr = 'dizzy'; v.exprT = v.downTime + 1;
    if (a) { this.m.combat.addFin(a, 5); }
    this.m.addHype(4);
    this.m.hitstop(.12);
    this.m.emit('down', { f: v, a, n: v.downs });
  }
}
