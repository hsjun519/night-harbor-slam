// Follow-ups (연계) after a move lets go, upgrades pressed early in a move (연속 저먼, 슈퍼 파워밤), the Space specials
// in a front hold (로프 회전 킥, 어깨 메기), the foe sitting on the top turnbuckle, and the counters that cost energy.
// Humans and the computer go through the same calls; the computer decides through its reaction delay.
import { sgn, clamp } from '../core/util.js';
import { BALANCE as B, ATTACKS } from '../data/balance.js';
import { MOVES } from '../data/moves.js';
import { FOLLOW, UPGRADE, COUNTERS, SPECIALS, SIGNATURES, COMBO } from '../data/combos.js';
import { J } from '../anim/skeleton.js';

const KEYBUF = { atk: 'atk', grab: 'grab', fin: 'fin', down: 'downEdge' };
export const KEYNAME = { atk: 'atk', grab: 'grab', fin: 'fin', down: 'down' };

export class ComboSystem {
  constructor(m) {
    this.m = m;
    m.on('moveStart', e => this.onMoveStart(e));
    m.on('release', e => this.onRelease(e));
    m.on('moveEnd', e => this.onMoveEnd(e));
    m.on('landAttack', e => { if (e.ok && e.def.id === 'springMoon') { const v = e.f.nearestFoe(80, o => o.st === 'DOWN' || (o.st === 'HITSTUN' && o.hsKind === 'lie')); this.chainPush(e.f, 'springMoon'); if (v) this.open(e.f, v, 'springMoon'); } });
  }
  // ---- per fighter, after its input is read and before its state runs. True: this frame is used up.
  pre(f, dt) {
    const L = f.link;
    if (L && L.kind === 'move' && L.a === f && L.up) return this.upgradeTick(f, L);
    if (f.follow) return this.followTick(f, dt);
    return false;
  }
  // ---- 이어 걸기: pressed while a move is still early
  onMoveStart(e) {
    const { a, L } = e, U = UPGRADE[e.mv.id];
    if (U && !e.fin && !L.counter && L.parts.length === 1) {
      L.up = U;
      if (a.ai && a.ctrl === 'ai') { const D = a.ai.D, o = U.find(o => !o.cost || a.fin >= o.cost); if (o && a.ai.rng.chance(D.pick * (o.cost ? .55 : .45))) L.upAi = { o, at: .04 + a.ai.rng.next() * Math.max(.02, o.until - .08) }; }
    }
    // the chain this move belongs to
    const ch = a.comboSeq || (a.comboSeq = []);
    if (!L.follow && !L.upgraded) ch.length = 0;
    ch.push(e.mv.id);
    if (L.follow) this.signature(a);
  }
  upgradeTick(f, L) {
    const U = L.up;
    if (L.part !== 0 || !U) { L.up = null; return false; }
    for (const o of U) {
      if (L.t > o.until) continue;
      const ai = L.upAi && L.upAi.o === o && L.t >= L.upAi.at;
      const want = ai || (f.ctrl !== 'ai' && f.has(KEYBUF[o.key]));
      if (!want) continue;
      if (!ai) f.consume(KEYBUF[o.key]);
      if (o.cost && f.fin < o.cost) { this.m.emit('deny', { f, why: `에너지 ${o.cost} 필요`, mv: MOVES[o.to[o.to.length - 1]] }); continue; }
      this.upgrade(f, L, o);
      return false;
    }
    if (U.every(o => L.t > o.until)) L.up = null;
    return false;
  }
  upgrade(a, L, o) {
    const m = this.m, mv = MOVES[o.to[0]];
    if (o.cost) a.fin -= o.cost;
    L.parts = o.to.slice(); L.part = 0; L.move = mv; L.up = null; L.upAi = null; L.upgraded = o.name;
    L.evI = 0; while (L.evI < mv.ev.length && mv.ev[L.evI][0] <= L.t) L.evI++;
    m.anim.freezeBlend(a, .06); if (L.v) m.anim.freezeBlend(L.v, .06);
    if (a.comboSeq) { a.comboSeq.pop(); for (const id of o.to) a.comboSeq.push(id); }
    m.addHype(o.cost ? 10 : 5);
    m.emit('upgrade', { a, v: L.v, o, L });
    this.signature(a);
  }
  // ---- 연계: a window after a move lets go
  onRelease(e) {
    const { a, v, move } = e;
    if (!a || !v || !a.alive || !v.alive || v.st !== 'DOWN' || a.ctrl === 'dummy') return;
    this.open(a, v, move.id);
  }
  open(a, v, id) {
    const m = this.m, list = FOLLOW[id];
    if (!list || !list.length || m.phase !== 'fight') { a.follow = null; return; }
    // a chain ends: after COMBO.maxChain moves only the pin is left, and the same move only COMBO.maxSame times in a row
    const seq = (a.comboSeq || []).filter(x => x !== 'pin');
    let same = 0; for (let i = seq.length - 1; i >= 0 && seq[i] === id; i--) same++;
    const opts = list.filter(o => (!o.pin || (m.rules.pin && v.side === 'in' && !(m.mode === 'tag' && !v.legal))) && (o.pin || o.spring || (seq.length < COMBO.maxChain && !(o.id === id && same >= COMBO.maxSame))));
    if (!opts.length) { a.follow = null; return; }
    const spring = opts.some(o => o.spring);
    a.follow = { from: id, v, opts, t: 0, life: spring ? COMBO.springWindow : COMBO.window, want: null, ai: null };
    m.emit('followOpen', { a, v, opts, from: id });
  }
  followTick(f, dt) {
    const F = f.follow, m = this.m, v = F.v;
    F.t += dt;
    const lying = v.alive && (v.st === 'DOWN' || (v.st === 'HITSTUN' && v.hsKind === 'lie'));
    if (F.t > F.life || !lying || !f.alive || m.phase !== 'fight' || (f.link && f.link.kind === 'hold')) { if (!(f.link && f.link.a === f && f.link.kind === 'move')) this.close(f); return false; }
    if (!F.want) {
      if (f.ctrl === 'ai' && f.ai) {
        if (F.ai == null) F.ai = f.ai.D.react + f.ai.rng.next() * .35;
        if (F.t >= F.ai) F.want = this.aiPick(f, F) || 'none';
      } else for (const o of F.opts) {
        if (o.spring) continue;   // J from the apron does it
        if (f.has(KEYBUF[o.key])) { f.consume(KEYBUF[o.key]); F.want = o; break; }
      }
    }
    const o = F.want;
    if (!o || o === 'none') return false;
    if (o.spring) { if (f.st === 'APRON' && f.ctrl === 'ai') { f.intent.atk = true; f.buf.atk = B.inputBuffer; } return false; }
    if (o.direct && f.link && f.link.kind === 'move' && f.link.a === f) return false;   // done when the move ends (onMoveEnd)
    const free = f.fsm.is('IDLE', 'MOVE', 'GUARD') || (o.pin && (f.st === 'GET_UP' || (f.st === 'HITSTUN' && f.hsKind === 'lie')));
    if (!free || f.link || !f.ground) return false;
    if (v.rag && !v.rag.ground && v.rag.t < .45) return false;
    return this.run(f, v, o);
  }
  close(f) { if (f.follow) { f.follow = null; } }
  aiPick(f, F) {
    const D = f.ai.D, v = F.v, r = f.ai.rng;
    const pin = F.opts.find(o => o.pin), mv = F.opts.find(o => o.id || o.spring);
    if (pin && v.hp < v.maxHp * (.35 + D.pick * .15) && r.chance(.55 + D.pick * .35)) return pin;
    if (mv && r.chance(D.pick * .7)) return mv;
    if (pin && v.hp < v.maxHp * .55 && r.chance(D.pick * .4)) return pin;
    return null;
  }
  run(a, v, o) {
    const m = this.m;
    this.close(a);
    if (o.pin) {
      if (Math.abs(v.x - a.x) > 130) return false;
      v.dropRag(); if (v.st !== 'DOWN') v.set('DOWN', { force: true });
      m.startPin(a, v, { bonus: o.pin, follow: true });
      if (a.pin) { m.emit('followUp', { a, v, o, name: '연계 핀' }); this.chainPush(a, 'pin'); return true; }
      return false;
    }
    const mv = MOVES[o.id];
    if (!mv) return false;
    const c = m.grapple.check(a, v, mv);
    if (!c.ok) { m.emit('deny', { f: a, why: c.why, mv }); return false; }
    // stand at the head end of the body, looking down it
    v.dropRag();
    const hx = v.joints.x(J.head), px = v.joints.x(J.pelvis), side = sgn(hx - px) || -a.face, k = a.dims.height / 94 * .75 + .25;
    a.face = side; a.x = clamp(px - side * 34 * k, m.arena.x0 + 20, m.arena.x1 - 20); v.x = px;
    if (m.arena.hasRing && a.side === 'in') a.x = clamp(a.x, m.arena.ropeL + 14, m.arena.ropeR - 14);
    const parts = o.lift ? ['liftUp', o.id] : [o.id];
    if (!m.wrestle.begin(a, v, parts, { noReverse: !o.lift && !mv.roll, follow: true })) return false;
    a.link.follow = true;
    m.emit('followUp', { a, v, o, name: o.name || mv.name });
    return true;
  }
  chainPush(a, id) { const ch = a.comboSeq || (a.comboSeq = []); ch.push(id); this.signature(a); }
  onMoveEnd(e) {
    const { a, move } = e, m = this.m;
    // a cover straight out of the move's last pose (roll-up, anchor hammer)
    const F = a.follow;
    if ((move.toPin || (F && F.want && F.want.direct)) && a.alive) {
      const auto = move.id === 'rollUp' || !!move.autoPin, want = auto || (F && F.want && F.want.direct);
      const v = F ? F.v : a.nearestFoe(70, o => o.st === 'DOWN');
      if (want && v && v.alive && m.rules.pin && v.side === 'in' && !m.pin) {
        this.close(a);
        v.dropRag(); v.set('DOWN', { force: true });
        a.set('IDLE', { force: true }); a.gettingUp = null;
        m.startPin(a, v, { bonus: auto ? move.autoPin || 1.35 : (F.want.pin || 1.3), follow: true, quick: auto });
        if (a.pin) { m.emit('followUp', { a, v, o: { pin: 1 }, name: move.id === 'rollUp' ? '기습 핀' : move.autoPin ? move.name + ' 핀!' : '그대로 누르기' }); this.chainPush(a, 'pin'); }
      }
    }
    void move;
  }
  signature(a) {
    const ch = a.comboSeq; if (!ch || ch.length < 2) return;
    for (const s of SIGNATURES) {
      const n = s.seq.length; if (ch.length < n) continue;
      let ok = true; for (let i = 0; i < n; i++) if (ch[ch.length - n + i] !== s.seq[i]) { ok = false; break; }
      if (ok && a.lastSig !== s.name + ch.length) { a.lastSig = s.name + ch.length; this.m.addHype(14); this.m.combat.addFin(a, 8); this.m.emit('signature', { a, name: s.name }); return; }
    }
    if (ch.length >= 2) this.m.emit('comboStep', { a, n: ch.length });
  }
  // ---- Space in a front hold, energy not full
  holdSpecial(f, L) {
    const m = this.m, ar = m.arena, v = L.v;
    if (L.pos !== 'front') { m.emit('deny', { f, why: '정면 잡기에서만', mv: MOVES.shoulderLift }); return false; }
    const id = this.holdSpecialId(f);
    const mv = MOVES[id], cost = SPECIALS[id];
    if (f.fin < cost) { m.emit('deny', { f, why: `에너지 ${cost} 필요`, mv }); return false; }
    const c = m.grapple.check(f, v, mv);
    if (!c.ok) { m.emit('deny', { f, why: c.why, mv }); return false; }
    f.fin -= cost;
    m.emit('special', { a: f, v, id, cost });
    return m.wrestle.startFromHold(L, id);
    void ar;
  }
  holdSpecialId(f) {
    const ar = this.m.arena;
    const toRope = ar.hasRing && f.side === 'in' ? (f.face > 0 ? ar.ropeR - f.x : f.x - ar.ropeL) : 1e9;
    return toRope <= 150 && !this.m.rules.cage ? 'ropeKick' : 'shoulderLift';
  }
  // ---- carrying somebody on the shoulders: K drops them
  carryDrop(f, L) {
    const m = this.m, ar = m.arena;
    const toRope = ar.hasRing && f.side === 'in' ? (f.face > 0 ? ar.ropeR - f.x : f.x - ar.ropeL) : 1e9;
    const id = toRope <= 74 ? 'turnbuckleDrop' : 'elecChair';
    return m.wrestle.startFromHold(L, id);
  }
  carryToCorner(f) { const ar = this.m.arena; return ar.hasRing && f.side === 'in' ? (f.face > 0 ? ar.ropeR - f.x : f.x - ar.ropeL) : 1e9; }
  // ---- the foe sitting on the top turnbuckle
  seatedFoe(f, range = 60) {
    if (f.side !== 'in') return null;
    for (const o of this.m.fighters) if (f.isFoe(o) && o.st === 'SEATED' && o.seat && sgn(o.x - f.x) === f.face && Math.abs(o.x - f.x) > 8 && Math.abs(o.x - f.x) <= range) return o;
    return null;
  }
  seatedMove(f, v, sup) {
    const m = this.m, id = sup ? 'superGerman' : 'cornerBackdrop', mv = MOVES[id];
    if (sup && f.fin < SPECIALS.superGerman) { m.emit('deny', { f, why: `에너지 ${SPECIALS.superGerman} 필요`, mv }); return false; }
    if (!f.set('WRESTLING_MOVE', { force: f.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK') })) return false;
    f.face = sgn(v.x - f.x) || f.face;
    v.seat = null;
    if (sup) f.fin -= SPECIALS.superGerman;
    const ok = m.wrestle.begin(f, v, [id], { state: 'WRESTLING_MOVE', noReverse: !sup ? false : false });
    if (!ok) { f.set('IDLE', { force: true }); return false; }
    m.emit('special', { a: f, v, id, cost: sup ? SPECIALS.superGerman : 0 });
    return true;
  }
  seat(v, a) {
    const m = this.m, ar = m.arena, left = v.x < ar.mid, rx = left ? ar.ropeL : ar.ropeR, out = left ? -1 : 1;
    v.dropRag();
    v.seat = { x: rx - out * 7, y: ar.matY - ar.ropeH - 5, face: out, t: 2.6 + (v.ai ? 0 : .4) };
    v.x = v.seat.x; v.y = v.seat.y; v.vx = v.vy = 0; v.side = 'in'; v.ground = true; v.face = out;
    v.set('SEATED', { force: true });
    m.emit('seated', { v, a });
  }
  // ---- counters that cost energy. Strikes: L inside the counter window.
  strikeCounter(v, a, d) {
    if (v.st !== 'DODGE' || !v.invDodge || v.t > COMBO.counterWindow || v.dodge.dir || v.counterCd > 0 || this.m.phase !== 'fight') return false;
    const kind = d.run ? 'run' : (d.air && d.topStand) ? 'dash' : (!d.air && !d.ground && d.lv >= 3) ? 'heavy' : null;
    return kind ? this.counter(v, a, kind) : false;
  }
  // a dash move coming in at somebody who has just pressed L
  dashCounter(f) {
    const cv = f.nearestFoe(62, o => o.side === f.side && sgn(o.x - f.x) === f.face && o.st === 'DODGE' && o.invDodge && o.t <= COMBO.counterWindow + .06 && !o.dodge.dir && Math.abs(o.y - f.y) < 20);
    return cv ? this.counter(cv, f, 'dash') : false;
  }
  stompCounter(v, a, d) {
    if (v.st !== 'DOWN' || v.rag || !d.ground || d.air || !v.has('dodge') || v.counterCd > 0 || this.m.phase !== 'fight') return false;
    if (v.ctrl === 'ai' && !v.wantStompCounter) return false;
    return this.counter(v, a, 'stomp');
  }
  counter(v, a, kind) {
    const m = this.m, C = COUNTERS[kind];
    if (!C || v.fin < C.cost || !v.alive || !a.alive || a.link) return false;
    v.consume('dodge'); v.wantStompCounter = false;
    v.fin -= C.cost; v.counterCd = B.counterCd;
    v.dropRag();
    if (v.st === 'DOWN') v.set('IDLE', { force: true });
    v.face = sgn(a.x - v.x) || v.face;
    if (!v.set('COUNTER', { force: true })) return false;
    a.atk = null; a.dash = false;
    if (!m.wrestle.begin(v, a, C.parts || [C.id], { state: 'COUNTER', noReverse: true, counter: true })) { v.set('IDLE', { force: true }); return false; }
    v.counters++;
    m.addHype(10); m.hitstop(.15);
    m.emit('sCounter', { f: v, a, name: C.name, kind, cost: C.cost });
    return true;
  }
}
export function springboard(f) {
  const ar = f.arena, m = f.match, left = f.x < ar.mid, inward = left ? 1 : -1;
  if (!ar.hasRing || m.rules.climb === false) return false;
  const t = f.nearestFoe(300, o => o.side === 'in' && sgn(o.x - f.x) === inward && (o.st === 'DOWN' || o.st === 'PINNED' || o.st === 'GET_UP' || (o.st === 'HITSTUN' && o.hsKind === 'lie')));
  if (!t) return false;
  const d = ATTACKS.springMoon, rx = left ? ar.ropeL : ar.ropeR;
  f.x = rx + inward * 6; f.y = ar.matY - ar.ropeH - 2; f.face = inward; f.side = 'in';
  const dx = Math.max(20, Math.abs(t.x - f.x)), T = .6;
  f.set('JUMP', { force: true });
  f.vy = -230; f.vx = inward * clamp(dx / T, 80, 330); f.ground = false;
  ar.press(left ? 'L' : 'R', 12);
  f.atk = null;
  f.set('AIR_ATTACK', { force: true });
  f.atk = { def: d, t: 0, hit: new Set(), connected: false, chain: -1, boost: 1, done: false };
  m.emit('swing', { f, def: d });
  m.emit('dive', { f, spring: true });
  m.emit('springboard', { f, t });
  return true;
}
