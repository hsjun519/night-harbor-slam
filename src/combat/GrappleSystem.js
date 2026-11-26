// Grapple tie-up: pick-up, holding, direction choice, switching sides, escapes, shoves and counter throws.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B, ATTACKS } from '../data/balance.js';
import { MOVES, HOLDS } from '../data/moves.js';
import { startAttack, tryBurst } from './CharacterController.js';

ATTACKS.shove = { id: 'shove', name: '밀치기', startup: .14, active: .07, recover: .32, reach: 42, low: 30, high: 80, hp: .6, stun: 7, kb: 190, hs: .34, stop: .05, lv: 2, shove: 1, unblock: 1, clip: 'shove', hand: 'open', sfx: 'grip', noCounter: 0 };

export class GrappleSystem {
  constructor(match) { this.m = match; }
  canReach(f, v) { return Math.abs(v.x - f.x) <= B.grabRange + (v.st === 'DOWN' ? 8 : 0) && Math.abs(v.y - f.y) < 30 && v.side === f.side; }
  grabTarget(f) {
    let best = null, bd = 1e9;
    for (const v of this.m.fighters) {
      if (!f.isFoe(v) || !v.grabbable || !this.canReach(f, v)) continue;
      const d = Math.abs(v.x - f.x) + (sgn(v.x - f.x) === f.face ? 0 : 14);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  tryGrab(f, I) {
    const m = this.m;
    // catch somebody flying back from the ropes
    const run = f.nearestFoe(66, o => o.st === 'WHIPPED' && o.whip && o.whip.back && o.inv <= 0 && sgn(f.x - o.x) === o.whip.dir);
    if (run && f.ground) { f.face = sgn(run.x - f.x) || f.face; return m.wrestle.start(f, run, f.moves.catch || 'backBody', { noReverse: true }); }
    const v = this.grabTarget(f);
    if (v) return this.beginHold(f, v);
    if (Math.abs(I.mx) > .3) f.face = sgn(I.mx); else f.faceFoe(80);
    return startAttack(f, ATTACKS.shove);
  }
  beginHold(f, v, pos) {
    const m = this.m;
    if (!f.set('GRAB')) return false;
    f.face = sgn(v.x - f.x) || f.face;
    const rear = pos ? pos === 'rear' : v.st === 'STAGGER' && v.face === f.face;
    const down = v.st === 'DOWN';
    v.dropRag();
    v.set('GRABBED', { force: true });
    const link = { kind: 'hold', a: f, v, pos: rear ? 'rear' : 'front', t: 0, phase: 'pickup', pick: down ? B.pickup : .14, hold: B.grabHold * (.8 + .2 * f.stats.grp), strikes: 0, strikeT: 0, switches: 0, switchT: 0, fromDown: down };
    f.link = v.link = link;
    v.escape = Math.max(0, (v.grabCount || 0) * 5); v.grabCount = (v.grabCount || 0) + 1;
    v.inv = 0; f.vx = v.vx = 0; v.y = f.y; v.side = f.side; v.ground = true;
    m.links.push(link);
    m.emit('grab', { a: f, v, link });
    return true;
  }
  update(dt) {
    for (const L of this.m.links.slice()) if (L.kind === 'hold') this.updateHold(L, dt);
  }
  updateHold(L, dt) {
    const { a, v } = L, ar = this.m.arena;
    L.t += dt;
    if (L.phase === 'pickup' && L.t >= L.pick) { L.phase = 'hold'; L.t = 0; }
    if (L.switchT > 0) L.switchT -= dt;
    if (L.strikeT > 0) L.strikeT -= dt;
    if (L.phase === 'hold') L.hold -= dt;
    if (!a.alive || !v.alive || a.st !== 'GRAB' || v.st !== 'GRABBED') { this.breakLink(L, 'state'); return; }
    // keep the pair on this side of the ropes
    const off = (L.pos === 'front' ? 24 : 17) * a.face;
    if (ar.hasRing && a.side === 'in') { const lo = ar.ropeL + 14, hi = ar.ropeR - 14; a.x = clamp(a.x, Math.max(lo, lo - off), Math.min(hi, hi - off)); } else a.x = clamp(a.x, ar.x0 + 40, ar.x1 - 40);
    v.x = a.x + off; v.y = a.y; v.side = a.side; v.face = L.pos === 'front' ? -a.face : a.face;
    if (v.escape >= B.grabEscape) { this.m.emit('escape', { a, v }); this.breakLink(L, 'escape'); return; }
    if (L.hold <= 0) this.breakLink(L, 'timeout');
  }
  holdDef(L) { return L.phase === 'pickup' && L.fromDown ? HOLDS.pickup : L.pos === 'front' ? HOLDS.front : HOLDS.rear; }
  // Which move would this direction give, and is it usable right now?
  slotFor(f, I) { if (I.up) return 'u'; if (I.down) return 'd'; if (Math.abs(I.mx) > .3) return sgn(I.mx) === f.face ? 'f' : 'b'; return 'n'; }
  moveInSlot(f, L, slot) { return f.moves[L.pos] && f.moves[L.pos][slot]; }
  liftNeed(mv, v) { return mv.lift * v.stats.weight / 100; }
  liftPower(a, v) { return a.stats.lift * (1 + (1 - v.hp / v.maxHp) * .55); }
  check(f, v, mv) {
    if (!mv) return { ok: false, why: '기술 없음' };
    if (mv.lift < 9 && this.liftNeed(mv, v) > this.liftPower(f, v)) return { ok: false, why: '너무 무겁다' };
    if (mv.need === 'rope') { const ar = this.m.arena; if (!ar.hasRing || f.side !== 'in') return { ok: false, why: '링 안에서만' }; if (ar.nearRope(f.x).dist > 120) return { ok: false, why: '로프가 멀다' }; if (mv.tags && mv.tags.includes('ringout') && this.m.rules.ringOutThrow === false) return { ok: false, why: '규칙상 불가' }; }
    if (mv.tags && mv.tags.includes('whip') && !this.m.arena.hasRing) return { ok: false, why: '로프 없음' };
    if (mv.tags && mv.tags.includes('whip') && f.side !== 'in') return { ok: false, why: '링 안에서만' };
    return { ok: true, why: '' };
  }
  holdControl(f, I, dt) {
    const L = f.link, m = this.m;
    if (!L || L.kind !== 'hold' || L.a !== f) { f.set('IDLE'); return; }
    if (L.phase === 'pickup' || L.switchT > 0 || L.strikeT > 0) return;
    if (f.has('fin') && f.fin >= B.finMax) { f.consume('fin'); if (m.finisher.fromHold(f, L)) return; }
    if (f.has('grab')) {
      f.consume('grab');
      const slot = this.slotFor(f, I), id = this.moveInSlot(f, L, slot), mv = MOVES[id], c = this.check(f, L.v, mv);
      if (c.ok) { m.wrestle.startFromHold(L, id); return; }
      m.emit('deny', { f, why: c.why, mv });
      L.deny = { slot, t: m.time, why: c.why };
    }
    if (f.has('dodge') && !I.down) { f.consume('dodge'); if (L.switches < 2) { L.switches++; L.pos = L.pos === 'front' ? 'rear' : 'front'; L.switchT = B.switchTime; L.hold -= .2; m.anim.freezeBlend(f, .18); m.anim.freezeBlend(L.v, .18); m.emit('switch', { a: f, v: L.v }); } }
    if (f.has('atk')) {
      f.consume('atk');
      if (L.strikes < B.grabStrikeMax) { L.strikes++; L.strikeT = .26; L.strikeAt = L.t; m.combat.damage(L.v, 1.5 * f.stats.atk, 0, f, {}); m.combat.addFin(f, 2.4); L.v.escape = Math.max(0, L.v.escape - 8); L.v.hitShake = .16; L.v.flash = .08; m.hitstop(.06); m.emit('grabStrike', { a: f, v: L.v }); }
    }
    if (Math.abs(I.mx) > .3) f.x += sgn(I.mx) * B.grabWalk * f.stats.spd * dt * (sgn(I.mx) === f.face ? .85 : 1);
  }
  heldControl(v, I, dt) {
    const L = v.link, m = this.m;
    if (!L) { v.set('IDLE', { force: true }); return; }
    if (L.kind === 'move') return; // WrestlingMoveSystem reads the reversal input
    if (I.down && v.has('dodge')) { if (tryBurst(v)) { v.clearBuf(); return; } }
    let n = 0;
    for (const k of ['atk', 'grab', 'dodge', 'jump']) if (v.buf[k] >= B.inputBuffer - 1e-6) n++;
    const power = v.stats.grp / L.a.stats.grp * (.62 + .38 * v.hp / v.maxHp);
    v.escape = Math.max(0, v.escape + n * B.mashValue * power - B.mashDecay * dt * (L.phase === 'pickup' ? 0 : .6));
  }
  breakLink(L, why) {
    const m = this.m, { a, v } = L, i = m.links.indexOf(L);
    if (i >= 0) m.links.splice(i, 1);
    if (a.link === L) a.link = null;
    if (v && v.link === L) v.link = null;
    if (v) { m.anim.freezeBlend(v, .16); v.y = m.arena.ground(v.x, v.y, v.side); v.ground = true; }
    m.anim.freezeBlend(a, .16);
    if (a.alive && a.st === 'GRAB') {
      if (why === 'escape' || why === 'burst') { a.hs = .4; a.hsKind = 'stand'; a.set('HITSTUN', { force: true, clip: 'hitF' }); a.vx = -a.face * 120; }
      else if (why === 'timeout') { a.hs = .3; a.hsKind = 'stand'; a.set('HITSTUN', { force: true, clip: 'hitLow' }); }
      else a.set('IDLE', { force: true });
    }
    if (v && v.alive && v.st === 'GRABBED') {
      v.grabImm = Math.max(v.grabImm, 1.2); v.stun = Math.max(v.stun, v.maxStun * (why === 'escape' ? .5 : .42)); v.inv = Math.max(v.inv, .5);
      v.vx = -v.face * 60;
      v.set('IDLE', { force: true });
    }
    m.emit('unlink', { a, v, why });
  }
  // L at the right moment turns a strike into a throw.
  startCounter(v, a) {
    const m = this.m;
    v.counterCd = B.counterCd;
    v.face = sgn(a.x - v.x) || v.face;
    if (!v.set('COUNTER', { force: true })) return false;
    a.atk = null;
    const id = v.moves.counter || 'hipToss';
    const ok = m.wrestle.begin(v, a, [id], { state: 'COUNTER', noReverse: true, counter: true });
    if (!ok) { v.set('IDLE', { force: true }); return false; }
    m.combat.addFin(v, B.finCounter); v.counters++;
    m.addHype(6);
    m.hitstop(.14);
    m.emit('counter', { f: v, a });
    return true;
  }
}
