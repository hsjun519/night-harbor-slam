// Strikes: hit boxes, guard, dodge, counter, combo scaling, knockback. StunSystem owns the stun gauge and downs.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';
import { STATES } from './StateMachine.js';

export class CombatSystem {
  constructor(match) { this.m = match; }
  addFin(f, v) { if (!f.alive) return; const before = f.fin; f.fin = clamp(f.fin + v * f.stats.fin * (1 + B.hypeBonus * (this.m.hype / 100)), 0, B.finMax); if (before < B.finMax && f.fin >= B.finMax) this.m.emit('finReady', { f }); }
  hurtbox(f) {
    const w = f.dims.prof[4][2] * .9 + 2, h = f.dims.height;
    if (f.rag) { const r = f.rag; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const i of [0, 1, 2, 8, 10]) { x0 = Math.min(x0, r.x[i]); x1 = Math.max(x1, r.x[i]); y0 = Math.min(y0, r.y[i]); y1 = Math.max(y1, r.y[i]); } return { x0: x0 - 6, x1: x1 + 6, y0: y0 - 6, y1: y1 + 6 }; }
    if (f.st === 'DOWN' || f.st === 'PINNED' || (f.st === 'HITSTUN' && f.hsKind === 'lie')) return { x0: f.x - h * .48, x1: f.x + h * .48, y0: f.y - 24, y1: f.y };
    if (f.st === 'DODGE') return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .55, y1: f.y };
    if (f.st === 'PERCH' || f.st === 'CLIMB') return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .8, y1: f.y + 6 };
    if (f.st === 'SEATED') return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .5, y1: f.y + 28 };
    if (f.st === 'ATTACK' && f.atk && f.atk.def.id === 'slideKick') return { x0: f.x - 30, x1: f.x + 30, y0: f.y - 36, y1: f.y };
    return { x0: f.x - w, x1: f.x + w, y0: f.y - h * .95, y1: f.y };
  }
  hitbox(f) {
    const a = f.atk;
    if (!a) return null;
    const d = a.def, s = f.look.scale || 1, k = f.dims.reach / 35;
    if (d.nohit || a.t < d.startup || a.t > d.startup + d.active) return null;
    const reach = d.reach * (.4 + .6 * k), front = f.x + f.face * reach, back = f.x - f.face * (d.air ? 12 : 4);
    return { x0: Math.min(front, back), x1: Math.max(front, back), y0: f.y - d.high * s, y1: f.y - d.low * s };
  }
  update() {
    const m = this.m;
    for (const a of m.fighters) {
      if (!a.atk || a.link || !a.alive) continue;
      const hb = this.hitbox(a);
      if (!hb) continue;
      const d = a.atk.def;
      for (const v of m.fighters) {
        if (!a.atk || a.atk.def !== d) break;
        if (!a.isFoe(v) || !v.alive || a.atk.hit.has(v)) continue;
        const sd = STATES[v.st];
        const floorHit = d.ground && (v.st === 'DOWN' || v.st === 'PINNED') && v.downClock !== undefined && !(v.rag && !v.rag.ground) && v.protect <= 0;
        const helpOut = (v.st === 'GRAB' || v.st === 'PIN') && !(v.link && v.link.kind === 'move' && v.link.committed);
        if (!sd.hit && !floorHit && !helpOut) continue;
        if (d.floorOnly && !floorHit) continue;
        if (v.st === 'HITSTUN' && v.hsKind === 'lie' && !d.ground && !d.lowHit && !d.air) continue;
        // a flying body can be juggled only twice, and not at all once it lies on the mat
        if (v.st === 'HITSTUN' && v.hsKind === 'launch' && ((v.juggle || 0) >= 2 || (v.rag && v.rag.ground && !d.ground))) continue;
        const b = this.hurtbox(v);
        if (hb.x1 < b.x0 || hb.x0 > b.x1 || hb.y1 < b.y0 || hb.y0 > b.y1) continue;
        a.atk.hit.add(v);
        this.resolve(a, v, d, clamp((Math.max(hb.x0, b.x0) + Math.min(hb.x1, b.x1)) / 2, b.x0, b.x1), clamp((Math.max(hb.y0, b.y0) + Math.min(hb.y1, b.y1)) / 2, b.y0, b.y1));
      }
    }
  }
  resolve(a, v, d, hx, hy) {
    const m = this.m, dir = sgn(v.x - a.x) || a.face, facing = v.face === -dir;
    if (v.inv > 0) { m.emit('immune', { a, v }); return 'inv'; }
    if (v.st === 'DODGE' && v.invDodge) {
      const tech = v.char.style === 'tech';
      if (d.chair && a.prop && v.t <= B.counterWindow * 1.4 && (facing || v.dodge.back) && m.phase === 'fight') { m.props.snatch(v, a); return 'counter'; }
      if ((facing || v.dodge.back) && m.combo.strikeCounter(v, a, d)) return 'counter';   // with energy: the counter for this kind of blow
      if (v.t <= B.counterWindow * (tech ? 1.25 : 1) && v.counterCd <= 0 && !d.air && !d.dive && (!d.run || tech) && (facing || v.dodge.back) && !v.dodge.dir && m.phase === 'fight') { if (m.grapple.startCounter(v, a)) return 'counter'; }
      if (!v.dodge.dodged) { v.dodge.dodged = true; this.addFin(v, 2.5); m.emit('dodge', { f: v, a }); }
      return 'dodge';
    }
    if (d.chair) return this.chairHit(a, v, d, dir, facing, hx, hy);
    const boost = a.atk ? a.atk.boost : 1;
    if (v.st === 'FINISHER' && v.finPhase && v.finPhase.stage === 'stance' && facing && !d.air && a.ground) { m.finisher.connect(v, a, v.finPhase.F, false); return 'stance'; }
    if (d.shove && v.st === 'GUARD') {
      a.atk.connected = true;
      v.stun -= 22; v.regenDelay = B.stunRegenDelay;
      m.hitstop(.07);
      m.emit('guardBreak', { a, v, shove: true });
      if (v.stun <= 0) m.stun.breakStun(v, a, dir * 140, -120, dir); else { this.stagger(v, B.guardBreakStagger * .8, a); v.vx = dir * 120; }
      return 'crush';
    }
    // guard
    if (v.st === 'GUARD' && facing && !d.unblock && !d.floorOnly) {
      if (v.guardT <= B.perfectGuard && (!d.dive || d.topStand)) {
        a.atk.connected = false;
        this.addFin(v, B.finPerfect); v.perfects++;
        if (d.run || d.air) this.launch(a, -dir * 190, -130, dir * 4, null);
        else { a.hs = .44; a.hsKind = 'stand'; a.set('HITSTUN', { force: true, clip: 'hitHeavy' }); a.vx = -dir * 90; }
        m.hitstop(.11); m.emit('parry', { a, v, x: hx, y: hy });
        return 'parry';
      }
      const chip = Math.max(0, d.hp * B.guardHp * a.stats.atk), st = d.stun * B.guardStun * boost * (d.lv >= 3 ? 1.25 : 1) * (a.stats.brk || 1);
      this.damage(v, Math.min(chip, Math.max(0, v.hp - B.chipMin)), 0, a, { chip: true });
      v.stun -= st; v.regenDelay = B.stunRegenDelay;
      a.atk.connected = true; a.atk.blocked = true;
      v.vx = dir * d.kb * B.guardPush * .6 / v.stats.kbr; a.vx -= dir * 26;
      m.hitstop(d.stop * .6);
      m.emit('block', { a, v, d, x: hx, y: hy });
      if (v.stun <= 0) { v.stun = v.maxStun * .3; this.stagger(v, B.guardBreakStagger, a); m.emit('guardBreak', { a, v }); }
      else m.anim.kick(v, 'guardHit', .2);
      return 'block';
    }
    if (v.st === 'DOWN' && m.combo.stompCounter(v, a, d)) return 'counter';   // L as the foot comes down, with energy
    // hit
    const counterHit = (v.st === 'ATTACK' || v.st === 'AIR_ATTACK' || v.st === 'TAUNT' || v.st === 'FINISHER') && !(v.atk && v.atk.t > v.atk.def.startup + v.atk.def.active);
    if (v.combo.t <= 0) v.combo.n = 0;
    v.combo.n++; v.combo.t = B.comboWindow; v.combo.by = a;
    // Long strings lose health damage fast but keep most of their stun damage: the stun gauge is the road to a grab.
    const scale = Math.max(B.comboMin, 1 - B.comboStep * (v.combo.n - 1)), stunScale = Math.max(.72, 1 - .035 * (v.combo.n - 1));
    const stale = this.stale(a, d.id);
    const k = stale * boost * (counterHit ? B.counterHit : 1) * (v.st === 'DOWN' ? .85 : 1);
    const hp = d.hp * a.stats.atk * scale * k, st = d.stun * B.strikeStun * (.5 + .5 * a.stats.atk) * stunScale * k * (a.stats.brk || 1);
    a.atk.connected = true; a.hitsLanded++; v.combo.dmg += hp;
    // super armour
    const armored = v.atk && v.atk.def.armor && v.atk.t < v.atk.def.startup + v.atk.def.active && d.lv <= v.atk.def.armor * 2 && !d.run && !d.air;
    const finArmor = v.st === 'FINISHER' && v.finPhase && v.finPhase.armor && d.lv < 4;
    const crit = this.rollCrit(a);
    this.damage(v, (armored || finArmor ? hp * .8 : hp) * (crit ? B.critMul : 1), st * (armored ? .7 : 1) * (crit ? B.critStun : 1) + (crit ? v.maxStun * B.critStunFlat : 0), a, { def: d });
    if (crit) m.emit('crit', { a, v, x: v.x, y: v.y - 64, hit: d });
    this.addFin(a, B.finHit + d.hp * .35);
    if (counterHit) this.addFin(a, 2);
    m.addHype((d.lv >= 3 ? 1.6 : .5) * stale);
    m.hitstop(d.stop * (counterHit ? 1.3 : 1));
    m.emit('hit', { a, v, d, x: hx, y: hy, dir, counterHit, hp, combo: v.combo.n, armored: armored || finArmor });
    if (v.st === 'KO') return 'ko';
    // break someone else's grapple or pin
    if (v.link && v.link.kind !== 'move') m.grapple.breakLink(v.link, 'hit');
    if (v.link && v.link.kind === 'move' && v.link.a === v && !v.link.committed) m.wrestle.cancel(v.link, 'hit');
    if (v.st === 'PIN') m.breakPin('hit');
    if (armored || finArmor) { v.hitShake = .12; v.flash = .08; return 'hit'; }
    if (v.st === 'DOWN' || v.st === 'PINNED') { v.hitShake = .14; v.flash = .1; if (d.quake || d.dive) { v.vx = 0; } m.anim.kickBody(v, dir); return 'hit'; }
    if (v.stun <= 0) { m.stun.breakStun(v, a, dir * Math.max(120, d.kb * 1.05) / v.stats.kbr, -Math.max(130, d.up || 0), dir); return 'hit'; }
    this.react(a, v, d, dir, counterHit);
    return 'hit';
  }
  // A swung chair: a perfect guard knocks it out of the hands, a guard eats a lot of stun, anything else is down at once.
  chairHit(a, v, d, dir, facing, hx, hy) {
    const m = this.m, P = a.prop;
    a.atk.connected = true;
    if (P) P.dent = Math.min(3, P.dent + 1);
    if (v.st === 'GUARD' && facing && v.guardT <= B.perfectGuard) {
      m.props.drop(a, 'parry', -dir); this.stagger(a, .7, v); this.addFin(v, B.finPerfect); v.perfects++;
      m.hitstop(.12); m.emit('parry', { a, v, x: hx, y: hy }); m.emit('chairParry', { a, v });
      if (P && P.uses <= 0) m.props.breakProp(P);
      return 'parry';
    }
    if (v.st === 'GUARD' && facing) {
      v.stun -= v.maxStun * .5; v.regenDelay = B.stunRegenDelay; this.damage(v, 2, 0, a, { chip: true });
      m.hitstop(.12); m.emit('chairHit', { a, v, p: P, guarded: true, x: hx, y: hy });
      if (v.stun <= 0) { v.stun = v.maxStun * .25; this.stagger(v, B.guardBreakStagger, a); m.emit('guardBreak', { a, v }); } else { v.vx = dir * 160; m.anim.kick(v, 'guardHit', .25); }
      if (P) { P.swung = false; if (P.uses <= 0) m.props.breakProp(P); else { m.props.release(P, -dir * 90, -180); P.x = hx; P.y = hy - 10; } }
      return 'block';
    }
    const crit = this.rollCrit(a), hp = d.hp * a.stats.atk * (v.st === 'DOWN' ? .7 : 1) * (crit ? B.critMul : 1);
    a.hitsLanded++;
    this.damage(v, hp, crit ? v.maxStun * B.critStunFlat : 0, a, { def: d });
    if (crit) m.emit('crit', { a, v, x: v.x, y: v.y - 30, hit: d });
    this.addFin(a, 8); m.addHype(9); m.hitstop(d.stop);
    m.emit('hit', { a, v, d, x: hx, y: hy, dir, counterHit: false, hp, combo: 1 });
    m.emit('chairHit', { a, v, p: P, x: hx, y: hy });
    if (P) { P.swung = false; if (P.uses <= 0) m.props.breakProp(P); else { m.props.release(P, -dir * 70, -200); P.x = hx; P.y = hy - 10; } }
    if (v.st === 'KO' || !v.alive) return 'ko';
    if (v.link && v.link.kind !== 'move') m.grapple.breakLink(v.link, 'hit');
    if (v.link && v.link.kind === 'move' && v.link.a === v && !v.link.committed) m.wrestle.cancel(v.link, 'hit');
    if (v.st === 'PIN') m.breakPin('hit');
    if (v.st === 'DOWN' || v.st === 'PINNED') { v.hitShake = .2; v.flash = .12; v.downClock = Math.max(0, (v.downClock || 0) - .4); m.anim.kickBody(v, dir); return 'hit'; }
    if (v.chairImm > 0) { v.hs = .45; v.hsKind = 'stand'; v.set('HITSTUN', { force: true, clip: 'hitHeavy' }); v.vx = dir * 140; m.emit('chairShrug', { v }); return 'hit'; }
    m.stun.chairDown(v, a, dir);
    return 'hit';
  }
  react(a, v, d, dir, counterHit) {
    const kb = d.kb / v.stats.kbr * (100 / (60 + v.stats.weight * .4)), m = this.m;
    v.flash = .1; v.hitShake = .12 + d.lv * .03; v.expr = 'hurt'; v.exprT = .5;
    const onPerch = v.st === 'PERCH' || v.st === 'CLIMB' || v.st === 'HANG' || v.st === 'APRON' || v.st === 'SEATED';
    if (v.st === 'LADDER' || v.st === 'CAGE_CLIMB') { m.special.struck(v, a, d, dir); return; }   // up the ladder: a step down; low or on the cage: off
    if (v.st === 'CASE_HANG') { m.special.dropHang(v, a); return; }
    if (v.st === 'SEATED') { const o0 = v.seat ? v.seat.face : (v.x < v.arena.mid ? -1 : 1), out = m.rules.cage ? -o0 : o0; v.seat = null; v.seatOver = !m.rules.cage; this.launch(v, out * 170, -120, out * 3, a); m.emit('seatKnock', { a, v }); return; }
    if (v.st === 'HANG' || v.st === 'APRON') { v.side = 'out'; this.launch(v, (v.x < v.arena.mid ? -1 : 1) * 120, -60, dir * 2, a); return; }
    if (v.rag && v.st === 'HITSTUN') { v.juggle = (v.juggle || 0) + 1; const k = .55 / v.juggle; v.rag.kick(dir * kb * k, -(d.up || 90) * k, dir * 2); return; }
    if (d.lv >= 4 || !v.ground || onPerch || v.combo.n >= B.comboBreak) {
      this.launch(v, dir * kb * (onPerch ? .9 : 1), -(d.up || 90) / Math.sqrt(v.stats.kbr), dir * (d.up > 180 ? 5.5 : 3.2), a);
      if (v.combo.n >= B.comboBreak) { v.inv = .55; v.combo.n = 0; }
      return;
    }
    v.hs = d.hs * B.hitstunScale * (counterHit ? 1.2 : 1) * Math.max(.72, 1 - (v.combo.n - 1) * .05);
    v.hsKind = 'stand';
    const front = v.face === -dir;
    const clipN = d.lv >= 3 ? 'hitHeavy' : d.lowHit ? 'hitLow' : front ? 'hitF' : 'hitB';
    v.set('HITSTUN', { force: v.st === 'HITSTUN', clip: clipN });
    v.vx = dir * kb; v.face = v.combo.n > 1 || front ? v.face : v.face;
    void m;
  }
  launch(v, vx, vy, spin, a) {
    if (v.st === 'KO' || !v.alive) return;
    v.hsKind = 'launch'; v.hs = 9; v.juggle = 0;
    v.set('HITSTUN', { force: true, clip: 'limpAir' });
    // in elimination matches an exhausted body by the ropes goes over the top
    // a big blow against somebody leaning on the ropes can send them over the top
    const ar = this.m.arena, nr = ar.nearRope(v.x), outward = ar.hasRing && v.side === 'in' && Math.sign(vx) === nr.dir;
    const spent = v.hp <= 0 && this.m.rules.ringOut === 'elim' && nr.dist < 46 && outward && Math.abs(vx) > 90;
    const elim = this.m.rules.ringOut === 'elim';
    const over = !this.m.rules.cage && (v.seatOver || spent || (outward && nr.dist < (elim ? 52 : 34) && Math.abs(vx) > (elim ? 120 : 150) && this.m.rng.chance((elim ? .4 : .25) + (1 - v.hp / v.maxHp) * .5)));
    v.ragdoll(vx, over ? Math.min(vy, -240) : vy, spin, over);
    v.seatOver = false;
    v.wallHit = false;
    v.expr = 'hurt'; v.exprT = 1;
    if (a) v.lastHitBy = a;
  }
  // Used by shockwaves, bursts and thrown bodies.
  knock(v, vx, vy, stun, a, hp = 0) {
    if (!v.alive || v.inv > 0 || v.link) return;
    this.damage(v, hp, stun, a, {});
    if (v.st === 'KO') return;
    if (v.stun <= 0) { this.m.stun.breakStun(v, a, vx, vy, sgn(vx)); return; }
    this.launch(v, vx / Math.sqrt(v.stats.kbr), vy, sgn(vx) * 3, a);
  }
  stunOnly(v, stun, a) { v.stun -= stun; v.regenDelay = B.stunRegenDelay; if (v.stun <= 0) this.m.stun.breakStun(v, a, 0, -120, 1); else { v.hs = .22; v.hsKind = 'stand'; v.set('HITSTUN', { force: true, clip: 'hitLow' }); } }
  stagger(v, t, a) { v.hs = t; v.set('STAGGER', { force: true }); v.vx *= .3; v.expr = 'dizzy'; v.exprT = t; if (a) v.lastHitBy = a; this.m.emit('stagger', { f: v }); }
  stale(a, id) {
    const n = a.staleList.filter(x => x === id).length;
    a.staleList.push(id);
    if (a.staleList.length > B.staleMemory) a.staleList.shift();
    return Math.max(B.staleMin, 1 - Math.max(0, n - 1) * B.staleStep);
  }
  // a critical hit: the attacker's chance (stats.crit, else B.critBase), drawn from the match's random stream
  rollCrit(a) { if (!a || !a.alive) return false; const p = a.stats.crit != null ? a.stats.crit : B.critBase; return p > 0 && this.m.rng.next() < p; }
  damage(v, hp, stun, a, o = {}) {
    if (!v.alive) return;
    const real = Math.min(v.hp, hp);
    v.hp = Math.max(0, v.hp - hp); v.dmgTaken += real;
    if (a) { a.dmgDealt += real; v.lastHitBy = a; }
    if (stun > 0) { v.stun -= stun; v.regenDelay = B.stunRegenDelay; }
    if (real > 0) this.addFin(v, real * B.finTaken);
    if (v.hp <= 0 && !o.noKO) this.m.onZeroHp(v, a);
  }
}
