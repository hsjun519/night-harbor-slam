// Computer wrestler. It only writes an Intent, sees the world through a reaction delay, and picks goals by
// utility. Difficulty changes reaction time, accuracy and variety, not health or damage.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B, ATTACKS } from '../data/balance.js';
import { MOVES } from '../data/moves.js';
import { SPECIALS, COUNTERS } from '../data/combos.js';

export const DIFFICULTY = {
  easy: { name: '쉬움', punish: .06, react: .48, err: .38, guard: .12, dodge: .05, counter: 0, rev: .03, mash: 3.2, hang: .12, plan: .9, aggr: .62, combo: .3, pick: .45, pinKick: .55, spacing: 1.25 },
  normal: { name: '보통', punish: .3, react: .3, err: .18, guard: .32, dodge: .13, counter: .04, rev: .1, mash: 5.6, hang: .32, plan: .5, aggr: .9, combo: .65, pick: .7, pinKick: .75, spacing: 1.05 },
  hard: { name: '어려움', punish: .66, react: .2, err: .09, guard: .38, dodge: .27, counter: .14, rev: .22, mash: 8, hang: .55, plan: .34, aggr: 1, combo: .85, pick: .88, pinKick: .88, spacing: 1 },
  expert: { name: '전문가', punish: .88, react: .145, err: .04, guard: .46, dodge: .36, counter: .3, rev: .36, mash: 10.5, hang: .74, plan: .24, aggr: 1.06, combo: .95, pick: .97, pinKick: .95, spacing: .95 },
};

export class AIController {
  constructor(f, level, rng) {
    this.f = f; this.level = level; this.D = DIFFICULTY[level] || DIFFICULTY.normal; this.rng = rng;
    // the career form of the opponents: sharper after the player's wins, slower after the losses
    const k = f.aiBoost || 0;
    if (k) { const D = Object.assign({}, this.D), c = (v, lo, hi) => Math.max(lo, Math.min(hi, v)); D.react = c(D.react * (1 - k * .6), .1, .7); D.err = c(D.err - k * .2, 0, .6); D.pick = c(D.pick + k * .3, .2, 1); D.counter = c(D.counter + k * .15, 0, .5); D.guard = c(D.guard + k * .2, .05, .6); D.dodge = c(D.dodge + k * .15, 0, .5); D.punish = c(D.punish + k * .3, 0, .95); D.aggr = c(D.aggr + k * .25, .4, 1.3); D.rev = c(D.rev + k * .15, 0, .5); this.D = D; }
    this.tr = f.char.ai || {};
    this.goal = null; this.goalT = 0; this.planT = .2 + rng.next() * .3; this.mem = new Map(); this.note = '';
    this.guardT = 0; this.wait = 0; this.comboWant = 0; this.lastSeenAtk = null; this.dodgeT = 0; this.mashT = 0; this.revPlanned = null; this.climbPlan = 0; this.behavior = null;
  }
  // ---- perception with reaction delay ----
  observe() {
    const now = this.f.match.time;
    for (const o of this.f.match.fighters) {
      if (o === this.f) continue;
      let h = this.mem.get(o);
      if (!h) { h = []; this.mem.set(o, h); }
      h.push({ t: now, x: o.x, y: o.y, st: o.st, face: o.face, atk: o.atk ? { id: o.atk.def.id, t: o.atk.t, d: o.atk.def, hit: o.atk.connected } : null, vx: o.vx, side: o.side, fin: o.fin, finPhase: o.finPhase ? o.finPhase.stage : null });
      while (h.length > 2 && now - h[1].t > this.D.react) h.shift();
    }
  }
  seen(o) { const h = this.mem.get(o); if (!h || !h.length) return { t: 0, x: o.x, y: o.y, st: o.st, face: o.face, atk: null, vx: 0, side: o.side }; return h[0]; }
  update(dt) {
    const f = this.f, I = f.intent, m = f.match;
    I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
    this.observe();
    if (f.ctrl === 'dummy' || this.behavior) { this.dummy(dt); return; }
    if (f.st === 'INTRO') return;
    this.goalT += dt; this.planT -= dt; if (this.defHeat > 0) this.defHeat = Math.max(0, this.defHeat - dt * .3);
    if (this.wait > 0) { this.wait -= dt; }
    // situations that are not choices
    if (f.st === 'GRABBED') { this.grabbed(dt); return; }
    if (f.st === 'PINNED' || f.st === 'KO' || f.st === 'OUT' || f.st === 'TAGWAIT') return;
    if (f.st === 'DOWN' && !f.rag && this.stompCounterCheck()) return;
    if (f.st === 'DOWN' || f.st === 'STAGGER' || f.st === 'HITSTUN') { this.mash(dt, .55); this.burstCheck(); return; }
    if (f.st === 'SEATED') { this.mash(dt, .7); return; }
    if (f.st === 'HANG') { if (this.rng.chance(dt * (2 + this.D.mash * .3))) I.up = true; this.mash(dt, .8); return; }
    if (f.st === 'APRON') {   // springboard onto somebody lying in the ring, or climb back in
      if (f.t < .1) this.apronPick = null;
      if (this.apronPick == null) this.apronPick = f.nearestFoe(300, o => o.side === 'in' && o.st === 'DOWN') && this.rng.chance(.45 + this.D.pick * .4) ? 'spring' : 'in';
      if (f.t > .2 + this.D.react) { if (this.apronPick === 'spring') { this.tap('atk'); this.apronPick = 'in'; } else I.jump = true; }
      return;
    }
    if (f.st === 'LADDER' || f.st === 'CAGE_CLIMB') { this.onClimb(); return; }
    if (f.st === 'CASE_HANG') return;
    if (f.st === 'PERCH') { this.perch(dt); return; }
    if (f.st === 'WHIPPED') { this.whipped(); return; }
    if (f.st === 'GRAB') { this.holdThink(dt); return; }
    if (f.st === 'PIN') { return; }
    if (f.entering) { this.enterRing(); return; }
    // defence reads the delayed picture
    if (this.defend(dt)) return;
    if (m.rules.ringOut === 'elim' && f.side === 'in' && (!this.goal || this.goal.name !== 'knockOff') && this.planT > .05) {
      for (const o of m.fighters) { if (!f.isFoe(o) || o.eliminated) continue; const s = this.seen(o); if ((s.st === 'HANG' || s.st === 'APRON') && Math.abs(o.x - f.x) < 260) { this.planT = 0; break; } }
    }
    if (this.planT <= 0 || !this.goal) this.plan();
    this.execute(dt);
  }
  tap(k) { this.f.intent[k] = true; }
  // ---- defence ----
  defend(dt) {
    const f = this.f, D = this.D;
    if (this.guardT > 0) { this.guardT -= dt; f.intent.down = true; this.faceTo(this.lastThreat); if (this.guardT <= 0) this.lastThreat = null; return true; }
    if (!f.fsm.is('IDLE', 'MOVE', 'GUARD')) return false;
    const myReach = ATTACKS[f.chain[0]].reach * (f.dims.reach / 35) + 10;
    for (const o of f.match.fighters) {
      if (!f.isFoe(o) || !o.alive) continue;
      const s = this.seen(o);
      // a whiffed blow leaves a window: step in and hit while they recover
      if (s.atk && !s.atk.hit && s.atk.t > s.atk.d.startup + s.atk.d.active && Math.abs(s.x - f.x) < myReach + 24 && s.side === f.side) {
        const key = 'p' + o.idx + ':' + s.atk.id + ':' + Math.round(s.t * 2);
        if (this.lastPunish !== key) { this.lastPunish = key; if (this.rng.chance(D.punish)) { this.guardT = 0; f.face = Math.sign(o.x - f.x) || f.face; if (Math.abs(o.x - f.x) > myReach - 6) f.intent.mx = f.face; this.tap('atk'); this.note = '헛친 틈 응징'; return true; } }
      }
      if (s.atk && s.atk.d.shove && Math.abs(s.x - f.x) < 70 && s.side === f.side) {
        const key = 's' + o.idx + ':' + Math.round(s.t * 4);
        if (this.lastShove !== key) { this.lastShove = key; if (this.rng.chance(D.punish * .8)) { this.guardT = 0; f.face = Math.sign(o.x - f.x) || f.face; this.tap('atk'); this.note = '밀치기 끊기'; return true; } }
        continue;
      }
      if (!s.atk || s.atk.d.ground || s.side !== f.side) continue;
      const d = s.atk.d, dist = Math.abs(s.x - f.x), toward = sgn(f.x - s.x) === s.face;
      if (!toward || dist > d.reach + 40 + (d.run ? 120 : 0) + (d.air ? 60 : 0)) continue;
      const key = o.idx + ':' + s.atk.id + ':' + Math.round((f.match.time - s.atk.t) * 4);
      if (this.lastSeenAtk === key) continue;
      this.lastSeenAtk = key;
      const r = this.rng.next() * (1 + (this.defHeat || 0) * .75), lowSt = f.stun < f.maxStun * .35;
      // time left before the blow lands, as far as this wrestler can know: the picture is D.react old
      const left = d.startup - s.atk.t - D.react;
      // a chair coming up: sometimes step in and take it
      if (d.chair && dist < 66 && f.fsm.is('IDLE', 'MOVE', 'GUARD') && r < D.counter * 2 + .12) { this.faceTo(o); this.tap('grab'); this.note = '의자 받아치기'; return true; }
      // with energy: the counter for blows a plain counter cannot take (running, from the corner), and the big ones
      const sk = d.run ? 'run' : (d.air && d.topStand) ? 'dash' : (!d.air && !d.ground && d.lv >= 3) ? 'heavy' : null;
      if (sk && f.fin >= COUNTERS[sk].cost && f.dodgeCd <= 0 && f.counterCd <= 0 && left > .01 && left < .12 && r < D.counter * 1.4 + .015) { this.faceTo(o); f.intent.mx = 0; this.tap('dodge'); this.defHeat = (this.defHeat || 0) + 1; this.note = COUNTERS[sk].name; return true; }
      const canCounter = left > .03 && left < .15 && !d.air && !d.run && f.dodgeCd <= 0;
      if (canCounter && r < D.counter * (f.char.style === 'tech' ? 1.4 : 1) * 1.7) { this.faceTo(o); this.tap('dodge'); this.defHeat = (this.defHeat || 0) + 1; this.note = '반격 노림'; return true; }
      if (r < D.counter + D.dodge * (lowSt ? 1.3 : 1) && f.dodgeCd <= 0) { this.defHeat = (this.defHeat || 0) + .7; f.intent.mx = sgn(f.x - o.x) * (this.rng.chance(.5) ? 1 : -1); if (d.run || d.air) f.intent.mx = 0; this.tap('dodge'); this.note = '회피'; return true; }
      if (r < D.counter + D.dodge + D.guard * (lowSt ? .7 : 1) * (.6 + (this.tr.def || .5) * .8)) { this.guardT = d.startup + d.active + .06 + this.rng.next() * .2 * (1 - D.punish * .7); this.lastThreat = o; f.intent.down = true; this.faceTo(o); this.note = '방어'; return true; }
    }
    // a dash move coming: L just before it lands turns it into a cutter (energy 25)
    if (f.fin >= COUNTERS.dash.cost && f.dodgeCd <= 0 && f.counterCd <= 0) for (const o of f.match.fighters) {
      if (!f.isFoe(o) || !o.dash || o.side !== f.side || Math.abs(o.vx) < 150) continue;
      const s = this.seen(o), dist = Math.abs(s.x - f.x);
      if (sgn(f.x - s.x) === o.face && dist > 36 && dist < 84 && this.rng.chance(D.counter * .7)) { this.faceTo(o); f.intent.mx = 0; this.tap('dodge'); this.note = COUNTERS.dash.name; return true; }
    }
    // finisher coming in
    for (const o of f.match.fighters) {
      if (!f.isFoe(o) || !o.finPhase) continue;
      const s = this.seen(o);
      if (s.finPhase === 'charge' || s.finPhase === 'lunge' || s.finPhase === 'leap') {
        const dist = Math.abs(o.x - f.x);
        if (dist < 160 && this.rng.chance(this.D.dodge * 2.2 * dt * 10)) { if (o.finisher.type === 'strike' && this.rng.chance(.5)) { this.guardT = .5; this.lastThreat = o; } else { f.intent.mx = sgn(f.x - o.x); this.tap('dodge'); } this.note = '피니셔 피하기'; return true; }
      }
    }
    return false;
  }
  // lying down with a foot coming: L with energy grabs the leg
  stompCounterCheck() {
    const f = this.f, D = this.D;
    if (f.fin < COUNTERS.stomp.cost || f.counterCd > 0) return false;
    for (const o of f.match.fighters) {
      if (!f.isFoe(o) || !o.alive) continue;
      const s = this.seen(o);
      if (!s.atk || !s.atk.d.ground || s.atk.d.air || Math.abs(s.x - f.x) > 56) continue;
      const key = 'st' + o.idx + ':' + Math.round(s.t * 4);
      if (this.lastStomp === key) continue;
      this.lastStomp = key;
      if (this.rng.chance(D.counter * .9 + .02)) { f.wantStompCounter = true; this.tap('dodge'); this.note = COUNTERS.stomp.name; return true; }
    }
    return false;
  }
  faceTo(o) { if (o && Math.abs(o.x - this.f.x) > 4) this.f.intent.mx = 0, this.f.face = sgn(o.x - this.f.x); }
  burstCheck() {
    const f = this.f;
    if (f.burstCd > 0 || f.fin < B.burstCost) return;
    const danger = f.hp < f.maxHp * .35 || f.combo.n >= 4;
    if (danger && this.rng.chance(this.D.rev * .05)) { f.intent.down = true; this.tap('dodge'); this.note = '긴급 탈출'; }
  }
  mash(dt, k) {
    this.mashT -= dt;
    if (this.mashT <= 0) { this.mashT = 1 / (this.D.mash * k * (.8 + this.rng.next() * .4)); this.tap(this.rng.pick(['atk', 'grab', 'jump'])); }
  }
  grabbed(dt) {
    const f = this.f, L = f.link;
    if (!L) return;
    if (L.kind === 'hold') {
      this.mash(dt, 1);
      if (L.a && L.a.fin >= B.finMax && f.fin >= B.burstCost && this.rng.chance(this.D.rev * .04)) { f.intent.down = true; this.tap('dodge'); }
      return;
    }
    // reversal: press L inside the window if we noticed it in time
    if (!L.rev.tried && !L.committed && !L.noReverse && !L.move.roll) {
      const mv = L.move, lead = mv.revAt ? mv.revAt[0] : B.reversalLead, win = mv.revAt ? mv.revAt[1] - mv.revAt[0] : B.reversalWindow;
      if (this.revPlanned == null) this.revPlanned = (!mv.revMove || f.fin >= (mv.revCost || 0)) && this.rng.chance(this.D.rev * (L.fin ? .5 : 1) * (f.char.style === 'tech' ? 1.3 : 1) * (mv.revMove ? 1.6 : 1)) ? lead + this.D.react * .4 + this.rng.next() * win * .8 : -1;
      if (this.revPlanned > 0 && L.t >= this.revPlanned) { this.tap('dodge'); this.revPlanned = null; }
    } else this.revPlanned = null;
  }
  onPinned(p) { this.kickAt = this.rng.chance(this.D.pinKick * (p.v.hp / p.v.maxHp * .5 + .62) / Math.pow(p.bonus || 1, 1.3)) ? .6 + this.rng.next() * 1.6 : 99; }
  pinMash(p, dt) { if (p.t > (this.kickAt || 99)) return this.rng.chance(dt * this.D.mash * 1.4) ? 1 : 0; return this.rng.chance(dt * this.D.mash * .25) ? 1 : 0; }
  wantsHang() { const f = this.f; return this.rng.chance(this.D.hang * .5 * (.55 + f.hp / f.maxHp * .7)); }
  // ---- goals ----
  plan() {
    const f = this.f, m = f.match, D = this.D, tr = this.tr;
    this.planT = D.plan * (.6 + this.rng.next() * .8);
    const t = this.pickTarget();
    f.target = t || f.target;
    const opts = [];
    const add = (name, w, data) => { if (w > 0) opts.push({ name, w, data }); };
    if (!t) { this.goal = { name: 'idle' }; return; }
    const dist = Math.abs(t.x - f.x), ar = m.arena;
    const tDown = t.st === 'DOWN' && !t.rag, tGrab = t.grabbable && t.side === f.side;
    const tUp = !!t.climb || t.st === 'CASE_HANG';   // up a ladder or a wall: only the special goals reach them
    const hpK = f.hp / f.maxHp, stK = f.stun / f.maxStun;
    // chairs: swing the one in hand; otherwise fetch a loose one or take it off the foe
    if (f.prop && f.side === t.side) { if (!this.goal || this.goal.name !== 'chairSwing' || this.goal.data !== t) { this.goal = { name: 'chairSwing', data: t, t: 0 }; this.goalT = 0; } this.note = '체어샷'; return; }
    const loose = m.props.any && !f.prop ? m.props.loose(f, 260) : null;
    if (loose && !t.prop) { const mine = Math.abs(loose.x - f.x) < Math.abs(loose.x - t.x) + 40; add('chair', (mine ? 4.5 : 1.2) * (.6 + (tr.dirty || .3)) * D.pick, loose); }
    if (t.prop && dist < 170 && t.side === f.side) add('steal', 3 * D.pick, t);
    if (!f.prop && !tDown && t.side === f.side && dist > 90 && dist < 260 && f.fin >= B.dashSigCost && f.sigCd <= 0 && t.fsm.is('IDLE', 'MOVE', 'GUARD', 'TAUNT', 'STAGGER')) add('dashSig', 2.2 * D.pick * (.6 + (tr.aggr || .5)), t);
    // outside with the foe out there too: fight first, get back in before the count runs out
    const bothOut = t.side === 'out' && f.side === 'out' && !t.entering && t.st !== 'ENTER_RING';
    if (f.side === 'out' && ar.hasRing && m.rules.ringOut !== 'none') add('return', (bothOut && f.outCount < 6 ? .25 : 3) + (f.outCount > 5 ? 6 : 0), null);
    // the foe went out of the ring: go after them (not where leaving the ring eliminates you)
    if (ar.hasRing && f.side === 'in' && t.side === 'out' && m.rules.ringOut !== 'elim' && m.rules.leave !== false && !t.entering && t.st !== 'ENTER_RING') add('chaseOut', 5, t);
    if (m.rules.ringOut === 'elim' && ar.hasRing && f.side === 'in') for (const o of m.fighters) {
      if (!f.isFoe(o) || o.eliminated || (o.st !== 'HANG' && o.st !== 'APRON')) continue;
      add('knockOff', 14 - Math.abs(o.x - f.x) * .012, o);
    }
    // special matches: the case over the ring, the cage wall. B.climbAiInterfere weighs stopping the other one against going up yourself
    const SP = m.special, KI = B.climbAiInterfere;
    if (SP && SP.ladder && f.side === 'in') {
      const L = SP.ladder, cl = m.fighters.find(o => f.isFoe(o) && (o.st === 'LADDER' || o.st === 'CASE_HANG'));
      if (cl && cl.st === 'CASE_HANG') add('hitHanger', 10, cl);
      if (L.state === 'folded') add('setLadder', 3 + (tDown || t.st === 'STAGGER' ? 6 : 0) + (Math.abs(L.x - f.x) < 90 ? 2 : 0), null);
      else if (L.state === 'open') {
        if (cl && cl.st === 'LADDER') {
          if (cl.climb.p <= B.climbPullMax) add('pullClimber', 14 * KI, cl);
          if (L.foldCd <= 0) add('foldLadder', (cl.climb.p >= 1 ? 12 : 4) * KI, cl);
          add('chaseClimb', (cl.climb.p >= .6 ? 10 : 4) * (1.4 - KI), cl);
        } else if (!cl) add('climbLadder', (dist < 120 && !tDown && t.st !== 'STAGGER' ? .3 : 1.2) + (tDown || t.st === 'STAGGER' || t.st === 'GET_UP' ? 9 : 0) + (dist > 170 ? 2.5 : 0) + (SP.prize.hits >= SP.prize.need * .6 ? 3 : 0), null);
      }
    }
    if (SP && m.rules.cage && f.side === 'in') {
      const cl = m.fighters.find(o => f.isFoe(o) && o.st === 'CAGE_CLIMB');
      if (cl) { if (cl.climb.p <= B.climbPullMax) add('pullClimber', 14 * KI, cl); add('chaseClimb', (cl.climb.p > .4 ? 12 : 4) * (1.4 - KI), cl); }
      else { const worn = 1 - t.hp / t.maxHp; add('cageEscape', (tDown ? 2 + worn * 6 : 0) + (t.st === 'STAGGER' ? 1 + worn * 3 : 0) + (f.hp > t.hp * 1.3 && worn > .35 && this.rng.chance(.3) ? 2 : 0), null); }
    }
    const sf = f.side === 'in' && ar.hasRing ? m.fighters.find(o => f.isFoe(o) && o.st === 'SEATED' && o.seat && Math.abs(o.x - f.x) < 280) : null;
    if (sf) add('seated', 10, sf);
    if (tGrab) add('grab', 4 * (.6 + (tr.grab || .5)) * D.pick, t);
    if (tDown && !tGrab && !tUp) {
      add('stomp', 1.2 * (tr.dirty || .2) * 3 + .4, t);
      if (m.rules.pin && t.hp < t.maxHp * .45 && t.side === 'in') add('pin', 2.5 + (1 - t.hp / t.maxHp) * 3, t);
      if (ar.hasRing && f.side === 'in' && (tr.air || 0) > .3 && dist > 90 && m.rules.climb !== false) add('climb', (tr.air || .3) * 2.2, t);
      add('taunt', (tr.taunt || .2) * 1.5, t);
    }
    if (f.fin >= B.finMax) add('finisher', 5 * D.pick, t);
    if (!tDown && !tUp) {
      add('pressure', 3 * (tr.aggr || .5) * D.aggr * (.5 + stK * .7), t);
      if (dist > 110) add('approach', 1.5, t);
      if (stK < .4 || hpK < .25) add('retreat', (1 - stK) * 2.5 * (tr.def || .5) * (D.plan > .4 ? .6 : 1), t);
      const byApron = ar.hasRing && f.side === 'out' && Math.min(Math.abs(f.x - (ar.ropeL - ar.apron)), Math.abs(f.x - (ar.ropeR + ar.apron))) < 64;   // W there climbs back in
      if (dist > 70 && dist < 170 && !byApron) add('jumpAttack', (tr.air || .3) * 1.4, t);
      if (ar.hasRing && f.side === 'in' && dist > 110 && (tr.rope || .3) > .2) add('ropeRun', (tr.rope || .3) * 1.6, t);
      if (t.st === 'GUARD' && dist < 70) add('shove', 3 * D.pick, t);
    }
    if (m.mode === 'tag' && f.legal && f.partner && f.partner.st === 'TAGWAIT' && (hpK < .38 || stK < .2)) add('tagOut', 5 * (1 - hpK), null);
    if (m.mode === 'tag' && m.pin && m.pin.v.team === f.team && m.pin.v !== f) add('save', 9, m.pin.a);
    if (!opts.length) add('approach', 1, t);
    // easier levels pick more randomly
    const temp = 1 + D.err * 3;
    const pickd = this.rng.weighted(opts, o => Math.pow(o.w, 1 / temp));
    if (!this.goal || this.goal.name !== pickd.name || this.goal.data !== pickd.data) { this.goal = { name: pickd.name, data: pickd.data, t: 0 }; this.goalT = 0; }
    this.note = { pressure: '압박', approach: '접근', retreat: '후퇴', grab: '잡기', stomp: '짓밟기', pin: '핀폴', climb: '코너 다이브', taunt: '도발', finisher: '피니셔', jumpAttack: '공중 공격', ropeRun: '로프 반동', shove: '가드 깨기', return: '링 복귀', tagOut: '교대', save: '핀 끊기', idle: '대기', chaseOut: '링 밖 추격', seated: '코너 공격', climbLadder: '사다리 오르기', setLadder: '사다리 펼치기', chaseClimb: '쫓아 오르기', pullClimber: '끌어내리기', foldLadder: '사다리 접기', hitHanger: '매달린 상대 치기', cageEscape: '철창 탈출', knockOff: '매달린 상대 떨어뜨리기', dashSig: '돌진 기술', chair: '의자 줍기', steal: '의자 뺏기', chairSwing: '체어샷' }[this.goal.name] || this.goal.name;
  }
  pickTarget() {
    const f = this.f, m = f.match;
    let best = null, bs = -1e9;
    for (const o of m.fighters) {
      if (!f.isFoe(o) || !o.alive || o.st === 'TAGWAIT' || o.eliminated || o.entering) continue;
      let s = -Math.abs(o.x - f.x) * .02 - Math.abs(o.y - f.y) * .03;
      if (o.side !== f.side) s -= 1.5;
      if (o.grabbable) s += 1.6;
      if (o === f.lastHitBy) s += .8;
      s += (1 - o.hp / o.maxHp) * .9;
      if (m.rules.ringOut === 'elim' && m.arena.nearRope(o.x).dist < 80) s += .9;
      if (o === f.target) s += .5;
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  }
  move(to, stopAt = 4, run = false) {
    const f = this.f, d = to - f.x;
    if (Math.abs(d) <= stopAt) return true;
    f.intent.mx = sgn(d) * (Math.abs(d) < 26 ? .6 : 1);
    if (run && Math.abs(d) > 120 && !f.running && this.rng.chance(.05)) f.running = true;
    return false;
  }
  execute(dt) {
    const f = this.f, g = this.goal, m = f.match, ar = m.arena, D = this.D;
    if (!g) return;
    g.t = (g.t || 0) + dt;
    if (g.name === 'chair') {
      const c = g.data;
      if (!c || c.gone || c.state !== 'floor' || f.prop) { this.planT = 0; this.goal = null; return; }
      if (Math.abs(c.x - f.x) > 22) this.move(c.x, 16, Math.abs(c.x - f.x) > 120);
      else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { this.tap('grab'); this.wait = .35; }
      if (g.t > 5) this.planT = 0;
      return;
    }
    const t = g.data && g.data.alive ? g.data : f.target;
    if (!t && g.name !== 'return' && g.name !== 'tagOut') { this.goal = null; return; }
    const dist = t ? Math.abs(t.x - f.x) : 0, dir = t ? sgn(t.x - f.x) : f.face;
    const reach = ATTACKS[f.chain[0]].reach * (f.dims.reach / 35);
    switch (g.name) {
      case 'approach': this.move(t.x, reach + 14, true); if (dist < reach + 20) this.planT = 0; break;
      case 'pressure': {
        if (t.side !== f.side) { this.goal = null; break; }
        const want = reach * .85 * D.spacing;
        if (dist > want + 6) this.move(t.x - dir * want, 3, dist > 160);
        else if (dist < want * .55) f.intent.mx = -dir * .7;
        else { f.face = dir; }
        if (dist < reach + 4 && this.wait <= 0 && f.fsm.is('IDLE', 'MOVE', 'ATTACK')) {
          if (this.rng.chance(D.combo) || f.st !== 'ATTACK') this.tap('atk');
          this.wait = (f.st === 'ATTACK' ? .12 : .18) + this.rng.next() * .25 * (1 + D.err * 2);
          if (f.chainN === 0 && this.rng.chance(.35 * (1 - D.combo))) this.wait += .4; // breathe between strings
        }
        if (g.t > 2.6) this.planT = 0;
        break;
      }
      case 'retreat': {
        const away = clamp(f.x - dir * 140, ar.ropeL + 40, ar.ropeR - 40);
        this.move(away, 8);
        if (dist < 60 && this.rng.chance(.08)) this.guardT = .4;
        if (g.t > 1.6 || f.stun > f.maxStun * .65) this.planT = 0;
        break;
      }
      case 'grab':
        if (!t.grabbable) { this.planT = 0; break; }
        if (dist > B.grabRange - 10) this.move(t.x - dir * 30, 4, dist > 120);
        else if (this.wait <= 0) { f.face = dir; this.tap('grab'); this.wait = .3; }
        break;
      case 'stomp':
        if (t.st !== 'DOWN') { this.planT = 0; break; }
        if (dist > 40) this.move(t.x - dir * 30, 3); else if (this.wait <= 0) { f.face = dir; this.tap('atk'); this.wait = .55 + this.rng.next() * .4; }
        break;
      case 'pin':
        if (t.st !== 'DOWN' || t.rag) { this.planT = 0; break; }
        if (dist > 50) this.move(t.x - dir * 34, 3); else { f.intent.down = true; f.intent.downEdge = true; this.goal = null; }
        break;
      case 'climb': {
        const nr = ar.nearRope(f.x), side = Math.abs(t.x - ar.ropeL) > Math.abs(t.x - ar.ropeR) ? -1 : 1, cx = side < 0 ? ar.ropeL + 20 : ar.ropeR - 20;
        if (t.st !== 'DOWN' && t.st !== 'STAGGER') { this.planT = 0; break; }
        if (this.move(cx, 8, true)) { f.intent.mx = side; this.tap('jump'); this.goal = null; }
        void nr;
        break;
      }
      case 'dashSig': {
        if (f.fin < B.dashSigCost || f.sigCd > 0 || t.st === 'DOWN' || t.side !== f.side) { this.planT = 0; break; }
        f.intent.mx = dir; f.running = true; if (!f.dash && f.ground) { f.dash = true; m.emit('dashStart', { f }); }
        if (dist < 56 && f.dash && Math.abs(f.vx) > 150) { this.tap('grab'); this.goal = null; }
        if (g.t > 2.5) this.planT = 0;
        break;
      }
      case 'setLadder': {
        const L = m.special && m.special.ladder;
        if (!L || L.state !== 'folded') { this.planT = 0; break; }
        if (Math.abs(f.x - L.x) > 44) this.move(L.x - sgn(L.x - f.x) * 32, 8, Math.abs(f.x - L.x) > 120);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { this.tap('grab'); this.wait = 1.3; }
        if (g.t > 4) this.planT = 0;
        break;
      }
      case 'climbLadder': case 'chaseClimb': {
        if (m.rules.cage) {   // up the cage wall where the other one climbs, or the nearest one
          if (g.name === 'chaseClimb' && t.st !== 'CAGE_CLIMB') { this.planT = 0; break; }
          const side = g.name === 'chaseClimb' && t.climb ? t.climb.side : ar.nearRope(f.x).dir, cx = side < 0 ? ar.ropeL + 16 : ar.ropeR - 16;
          if (this.move(cx, 6, true)) { f.intent.mx = side; this.tap('jump'); this.planT = 0; }
          if (g.t > 4) this.planT = 0;
          break;
        }
        const L = m.special && m.special.ladder;
        if (!L || L.state !== 'open' || (g.name === 'chaseClimb' && t.st !== 'LADDER')) { this.planT = 0; break; }
        const taken = s2 => m.fighters.some(o => o !== f && o.st === 'LADDER' && o.climb && o.climb.side === s2);
        let side = f.x < L.x ? -1 : 1;
        if (taken(side)) side = -side;
        if (taken(side)) { this.planT = 0; break; }
        const tx = L.x + side * (B.ladderSpread + 10);
        if (Math.abs(f.x - tx) > 6) this.move(tx, 4, Math.abs(f.x - tx) > 120);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { this.tap('jump'); this.wait = .3; }
        if (g.t > 4) this.planT = 0;
        break;
      }
      case 'pullClimber': {
        if (!t.climb || (t.st !== 'LADDER' && t.st !== 'CAGE_CLIMB') || t.climb.p > B.climbPullMax) { this.planT = 0; break; }
        if (Math.abs(f.x - t.x) > 26) this.move(t.x, 20, Math.abs(f.x - t.x) > 100);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { f.face = sgn(t.x - f.x) || f.face; this.tap('grab'); this.wait = .45; }
        if (g.t > 3) this.planT = 0;
        break;
      }
      case 'foldLadder': {
        const L = m.special && m.special.ladder;
        if (!L || L.state !== 'open' || L.foldCd > 0) { this.planT = 0; break; }
        const tx = L.x + (f.x < L.x ? -1 : 1) * (B.ladderSpread + 8);
        if (Math.abs(f.x - tx) > 8) this.move(tx, 6, Math.abs(f.x - tx) > 100);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { this.tap('grab'); this.wait = .5; }
        if (g.t > 3) this.planT = 0;
        break;
      }
      case 'hitHanger': {
        if (t.st !== 'CASE_HANG') { this.planT = 0; break; }
        if (Math.abs(f.x - t.x) > 26) this.move(t.x - sgn(t.x - f.x) * 20, 6, true);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE', 'ATTACK')) { f.face = sgn(t.x - f.x) || f.face; this.tap('atk'); this.wait = .2; }
        if (g.t > 3) this.planT = 0;
        break;
      }
      case 'cageEscape': {
        if (!m.rules.cage) { this.planT = 0; break; }
        const dir = ar.nearRope(f.x).dir, cx = dir < 0 ? ar.ropeL + 16 : ar.ropeR - 16;
        if (this.move(cx, 6, true)) { f.intent.mx = dir; this.tap('jump'); this.planT = 0; }
        if (g.t > 5) this.planT = 0;
        break;
      }
      case 'seated': {
        if (t.st !== 'SEATED' || !t.seat) { this.planT = 0; break; }
        const bx = t.seat.x - t.seat.face * 36;   // behind them, inside the ring
        if (Math.abs(f.x - bx) > 6) this.move(bx, 4, Math.abs(f.x - bx) > 100);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) {
          f.face = t.seat.face;
          const push = m.rules.ringOut === 'elim' || (m.rules.ringOut === 'count' && this.rng.chance(.15));
          this.tap(push ? 'atk' : f.fin >= SPECIALS.superGerman && this.rng.chance(.45 + D.pick * .45) ? 'fin' : 'grab');
          this.wait = .45;
        }
        if (g.t > 3) this.planT = 0;
        break;
      }
      case 'knockOff': {
        if (t.st !== 'HANG' && t.st !== 'APRON') { this.planT = 0; break; }
        const left = t.x < ar.mid, sx = left ? ar.ropeL + 15 : ar.ropeR - 15;
        if (Math.abs(f.x - sx) > 8) this.move(sx, 6, Math.abs(f.x - sx) > 110);
        else { f.face = left ? -1 : 1; if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE', 'ATTACK')) { this.tap('atk'); this.wait = .16 + this.rng.next() * .12 * (1 + D.err * 3); } }
        if (g.t > 3.2) this.planT = 0;
        break;
      }
      case 'chaseOut': {
        if (t.side === f.side || f.side !== 'in' || t.st === 'ENTER_RING') { this.planT = 0; break; }
        const left = t.x < ar.mid, rx = left ? ar.ropeL + 18 : ar.ropeR - 18;
        if (Math.abs(f.x - rx) > 12) this.move(rx, 8, Math.abs(f.x - rx) > 140);
        else { f.intent.down = true; f.intent.mx = left ? -1 : 1; }   // S toward the ropes: step through them
        if (g.t > 5) this.planT = 0;
        break;
      }
      case 'chairSwing': {
        if (!f.prop) { this.planT = 0; break; }
        const want = 36;
        if (dist > want + 4) this.move(t.x - dir * want, 4, dist > 140);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { f.face = dir; this.tap('atk'); this.wait = .8 + this.rng.next() * .6; }
        if (g.t > 6) this.planT = 0;
        break;
      }
      case 'steal': {
        if (!t.prop) { this.planT = 0; break; }
        if (dist > 42) this.move(t.x - dir * 36, 4, dist > 120);
        else if (this.wait <= 0 && f.fsm.is('IDLE', 'MOVE')) { f.face = dir; this.tap('grab'); this.wait = .5; }
        if (g.t > 3) this.planT = 0;
        break;
      }
      case 'taunt': if (dist > 90 && f.fsm.is('IDLE', 'MOVE') && f.fin < B.finMax) { this.tap('fin'); this.goal = null; } else if (dist <= 90) f.intent.mx = -dir; break;
      case 'finisher': this.finisher(t, dist, dir); break;
      case 'jumpAttack':
        if (dist < 150 && dist > 60 && f.ground && f.fsm.is('IDLE', 'MOVE')) { f.intent.mx = dir; this.tap('jump'); g.jumped = 1; }
        else if (!f.ground && g.jumped && Math.abs(t.x - f.x) < 90) { this.tap('atk'); this.goal = null; }
        else if (dist >= 150) this.move(t.x - dir * 120, 6);
        else if (g.t > 1.2) this.planT = 0;
        break;
      case 'ropeRun': {
        const away = -dir, rx = away < 0 ? ar.ropeL + 12 : ar.ropeR - 12;
        if (!g.go) { f.intent.mx = away; f.running = true; if (f.st === 'ROPE') g.go = 1; if (g.t > 2) this.planT = 0; }
        else { f.intent.mx = dir; if (dist < 60) { this.tap(this.rng.chance(.25 + (this.tr.air || 0) * .4) ? 'jump' : 'atk'); if (!f.ground) this.tap('atk'); this.goal = null; } }
        void rx;
        break;
      }
      case 'shove': if (dist > 34) this.move(t.x - dir * 30, 3); else { f.face = dir; this.tap('grab'); this.goal = null; } break;
      case 'return': {
        if (f.side === 'in') { this.goal = null; break; }
        const tx = f.x < ar.mid ? ar.ropeL - ar.apron - 14 : ar.ropeR + ar.apron + 14;
        if (this.move(tx, 20)) { this.tap('jump'); }
        break;
      }
      case 'tagOut': {
        const cx = f.team === 0 ? ar.ropeL + 24 : ar.ropeR - 24;
        if (this.move(cx, 14, true)) { f.intent.down = true; f.intent.downEdge = true; this.goal = null; }
        break;
      }
      case 'save': {
        const p = m.pin;
        if (!p) { this.goal = null; break; }
        if (f.st === 'TAGWAIT') break;
        if (Math.abs(p.a.x - f.x) > 30) this.move(p.a.x, 20, true); else { this.tap('atk'); }
        break;
      }
      default: this.move(t ? t.x - dir * 60 : f.x, 6);
    }
    // in elimination modes, a foe at the ropes is a chance
    void dt;
  }
  finisher(t, dist, dir) {
    const f = this.f, F = f.finisher;
    if (!F || f.fin < B.finMax) { this.goal = null; return; }
    if (t.grabbable && dist < B.grabRange) { f.face = dir; this.tap('fin'); this.goal = null; return; }
    const want = F.type === 'dive' ? 120 : F.type === 'strike' ? 50 : F.type === 'quake' ? 40 : F.type === 'stance' ? 60 : 32;
    if (F.type === 'stance') { if (dist < 90 && t.fsm.is('ATTACK', 'MOVE')) { this.tap('fin'); this.goal = null; } else this.move(t.x - dir * want, 10); return; }
    if (Math.abs(dist - want) < 18 && t.fsm.is('IDLE', 'MOVE', 'ATTACK', 'GUARD', 'STAGGER', 'TAUNT', 'HITSTUN') && (F.type !== 'grab' || t.st !== 'DODGE')) { f.face = dir; this.tap('fin'); this.goal = null; }
    else this.move(t.x - dir * want, 6, dist > 140);
  }
  holdThink(dt) {
    const f = this.f, L = f.link, m = f.match, D = this.D;
    if (!L || L.kind !== 'hold' || L.phase !== 'hold' || L.switchT > 0 || L.strikeT > 0) return;
    if (L.pos === 'carry') {
      if (!this.carryPlan) { const ar = m.arena, toL = f.x - ar.ropeL, toR = ar.ropeR - f.x; this.carryPlan = { corner: ar.hasRing && f.side === 'in' && Math.min(toL, toR) < 240 && this.rng.chance(.45 + D.pick * .4), dir: toL < toR ? -1 : 1, at: .25 + this.rng.next() * .35 }; }
      const C = this.carryPlan;
      if (L.t < C.at) return;
      if (C.corner && m.combo.carryToCorner(f) > 60 && L.hold > .6) { f.intent.mx = C.dir; return; }
      this.tap('grab'); this.carryPlan = null; return;
    }
    this.carryPlan = null;
    if (!this.holdPlan) {
      const v = L.v, ar = m.arena;
      const choices = [];
      if (f.fin >= B.finMax && this.rng.chance(D.pick)) { this.holdPlan = { fin: 1, at: .25 + this.rng.next() * .3 }; return; }
      const slots = ['n', 'f', 'b', 'u', 'd'];
      for (const pos of ['front', 'rear']) for (const s of slots) {
        const id = f.moves[pos] && f.moves[pos][s], mv = MOVES[id];
        if (!mv) continue;
        const ringOut = mv.tags && mv.tags.includes('ringout'), elim = m.rules.ringOut === 'elim';
        const ok = m.grapple.check(f, v, mv).ok || (ringOut && elim && ar.hasRing && f.side === 'in');   // far from the ropes: it drags them there first
        if (!ok) continue;
        let w = 1 + mv.hp * .08;
        if (ringOut) w = elim ? 14 : m.rules.ringOut === 'count' ? .4 : .1;
        if (mv.tags && mv.tags.includes('whip')) w = (this.tr.rope || .3) * 2;
        if (pos === 'rear') w *= .8;
        w *= 1 / (1 + (f.moveStale[id] || 0) * 1.2);
        if (mv.lift > f.stats.lift) w *= .5;
        choices.push({ pos, s, id, w });
      }
      if (L.pos === 'front' && f.fin < B.finMax) {   // Space: 로프 회전 킥 near the ropes, 어깨 메기 elsewhere
        const id = m.combo.holdSpecialId(f), cost = SPECIALS[id];
        if (f.fin >= cost && m.grapple.check(f, v, MOVES[id]).ok) choices.push({ pos: 'front', s: 'sp', id, special: 1, w: (id === 'ropeKick' ? 2.4 * (.5 + (this.tr.air || .3)) : 1.8 * (.5 + (this.tr.grab || .5))) * (f.fin >= cost * 2 ? 1.3 : .8) });
      }
      if (!choices.length) { this.holdPlan = { strike: 1, at: .3 }; return; }
      const c = this.rng.weighted(choices, o => Math.pow(o.w, 1 + D.pick));
      this.holdPlan = Object.assign(c, { at: .2 + this.rng.next() * .45 * (1 + D.err * 2), strikes: this.rng.chance(.35) ? this.rng.int(1, 2) : 0 });
      void ar;
    }
    const P = this.holdPlan;
    if (L.t < P.at) return;
    if (P.fin) { this.tap('fin'); this.holdPlan = null; return; }
    if (P.strikes > 0 && L.strikes < P.strikes) { this.tap('atk'); P.at = L.t + .3; return; }
    if (P.strike) { this.tap('atk'); this.holdPlan = null; return; }
    if (P.pos !== L.pos) { if (L.switches < 2) this.tap('dodge'); else this.holdPlan = null; P.at = L.t + .28; return; }
    if (P.special) { this.tap('fin'); this.holdPlan = null; return; }
    // rope moves need the ropes: drag the foe there first
    if (MOVES[P.id] && MOVES[P.id].need === 'rope') { const nr = m.arena.nearRope(f.x); if (nr.dist > 100 && L.hold > .35) { f.intent.mx = nr.dir; return; } }
    const I = f.intent;
    if (P.s === 'u') I.up = true; else if (P.s === 'd') I.down = true; else if (P.s === 'f') I.mx = f.face; else if (P.s === 'b') I.mx = -f.face;
    if (P.id === 'ringOut' || P.id === 'cornerSmash') { const nr = m.arena.nearRope(f.x); I.mx = P.s === 'f' ? f.face : P.s === 'b' ? -f.face : I.mx; void nr; }
    this.tap('grab');
    this.holdPlan = null;
  }
  // on the ladder or the cage wall: the one above by the leg, the one level with you a punch, the one below a kick; otherwise climb
  onClimb() {
    const f = this.f, c = f.climb, m = f.match, D = this.D, SP = m.special;
    if (!c || !SP) return;
    const foes = SP.climbers(f, c.kind).filter(o => f.isFoe(o));
    if (this.wait <= 0) {
      const above = foes.find(o => o.climb.p > c.p + .06 && o.climb.p - c.p <= B.climbReach + .1);
      const level = foes.find(o => Math.abs(o.climb.p - c.p) <= B.climbReach * .5);
      const below = foes.find(o => o.climb.p < c.p && c.p - o.climb.p <= B.climbReach);
      if (above && this.rng.chance(.5 + D.pick * .4)) { this.tap('grab'); this.wait = .45 + D.react; return; }
      if (level && this.rng.chance(.45 + D.aggr * .3)) { this.tap('atk'); this.wait = .4 + D.react; return; }
      if (below && this.rng.chance(.3 + D.aggr * .3)) { this.tap('atk'); this.wait = .5 + D.react; return; }
      const g = c.p < .7 ? m.fighters.find(o => f.isFoe(o) && o.alive && !o.climb && o.ground && Math.abs(o.x - f.x) < 36 && o.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK')) : null;
      if (g && this.rng.chance(.4)) { this.tap('atk'); this.wait = .6; return; }
      if (c.kind === 'ladder' && c.p >= 1 && !foes.length && SP.prize.hits < SP.prize.need - 3) {   // somebody lying below: a big dive now and then
        const n = f.nearestFoe(300, o => !o.climb && o.st === 'DOWN' && Math.abs(o.x - f.x) > 30);
        if (n && this.rng.chance(.12 * (.5 + (this.tr.air || .3)))) { f.intent.mx = sgn(n.x - f.x); this.tap('atk'); this.wait = 1; return; }
        this.wait = .5;
      }
    }
    if (c.kind === 'cage' || c.p < 1) f.intent.up = true;   // the case meter at the top is pressed by the rules for the computer
  }
  perch() {
    const f = this.f, m = f.match, ar = m.arena, out = f.climbDir || (f.x < ar.mid ? -1 : 1);
    // a foe lying or reeling on the floor outside, on this side: turn round and dive over the top
    const below = m.rules.ringOut !== 'elim' && f.nearestFoe(300, o => o.side === 'out' && sgn(o.x - f.x) === out && (o.st === 'DOWN' || o.st === 'STAGGER' || o.st === 'IDLE' || o.st === 'MOVE'));
    const inside = f.nearestFoe(320, o => o.side === 'in' && sgn(o.x - f.x) === -out);
    if (below && (!inside || inside.st !== 'DOWN')) {
      if (f.face !== out) { f.intent.mx = out; return; }
      if (f.t > .35 + this.D.react) this.tap('atk');
      return;
    }
    if (f.face !== -out) { f.intent.mx = -out; return; }
    const n = f.nearestFoe(320, o => sgn(o.x - f.x) === f.face);
    if (n && f.t > .3 + this.D.react && (n.st === 'DOWN' || n.st === 'STAGGER' || this.rng.chance(.3))) this.tap('atk');
    else if (f.t > 1.4) this.tap('atk');
  }
  whipped() {
    const f = this.f, w = f.whip;
    if (!w || !w.back) return;
    const a = w.by;
    if (a && Math.abs(a.x - f.x) < 80 && w.t > .3) {
      if (this.rng.chance(this.D.dodge * .6)) this.tap('dodge');
      else if (this.rng.chance(this.D.counter * 1.2 + .05)) this.tap('atk');
    }
  }
  enterRing() {
    const f = this.f, ar = f.match.arena;
    if (f.side === 'in') { f.entering = null; return; }
    if (f.st === 'ENTER_RING') return;
    const tx = f.entering.left ? ar.ropeL - ar.apron - 16 : ar.ropeR + ar.apron + 16;
    if (this.move(tx, 16)) this.tap('jump');
    else f.running = true;
  }
  // Practice-mode dummies.
  dummy(dt) {
    const f = this.f, b = this.behavior || 'idle', I = f.intent, t = f.nearestFoe();
    if (f.st === 'GRABBED') { if (b === 'escape') this.grabbed(dt); return; }
    if (f.st === 'DOWN' || f.st === 'STAGGER') { if (b === 'escape') this.mash(dt, .6); return; }
    if (b === 'guard') { I.down = true; if (t) f.face = sgn(t.x - f.x) || f.face; }
    else if (b === 'attack') { if (t && Math.abs(t.x - f.x) < 60) { f.face = sgn(t.x - f.x); if (this.rng.chance(dt * 3)) this.tap('atk'); } }
    else if (b === 'dodge') { if (this.defend(dt)) return; }
    else if (b === 'ai') { this.behavior = null; }
  }
}
