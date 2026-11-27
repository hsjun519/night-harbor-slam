// One wrestler: stats, gauges, input buffer and the per-state control code. The same code drives humans and AI;
// both only write an Intent.
import { clamp, approach, sgn } from '../core/util.js';
import { BALANCE as B, ATTACKS } from '../data/balance.js';
import { FINISHERS } from '../data/moves.js';
import { dimsFor, Joints } from '../anim/skeleton.js';
import { Ragdoll } from '../anim/ragdoll.js';
import { StateMachine, STATES } from './StateMachine.js';
import { keepsProp } from './Props.js';
import { springboard } from './ComboSystem.js';

export function newIntent() { return { mx: 0, up: false, down: false, downEdge: false, jump: false, atk: false, grab: false, dodge: false, fin: false }; }
const BUF_KEYS = ['jump', 'atk', 'grab', 'dodge', 'fin', 'downEdge'];

export class Fighter {
  constructor(match, char, o = {}) {
    this.match = match; this.idx = o.idx || 0; this.team = o.team != null ? o.team : this.idx; this.char = char; this.charId = char.id;
    this.name = o.name || char.name; this.look = o.look || char.look; this.ctrl = o.ctrl || 'ai'; this.difficulty = o.difficulty || 'normal';
    this.dims = dimsFor(this.look.build, this.look.scale || 1);
    const s = this.stats = Object.assign({}, char.stats, o.stats || {});
    this.maxHp = s.hp * (B.hpScale || 1); this.maxStun = s.stun; this.hp = this.maxHp * (o.hpStart != null ? o.hpStart : 1); this.stun = this.maxStun; this.fin = o.fin || 0;
    this.moves = o.moves || char.moves; this.chain = o.chain || char.chain; this.finisherId = o.finisher || char.finisher; this.equip = o.equip || null;
    this.downs = 0; this.falls = 0; this.dmgTaken = 0; this.dmgDealt = 0; this.finishersTaken = 0; this.ringOuts = 0; this.kills = 0; this.hitsLanded = 0; this.movesDone = new Set(); this.counters = 0;
    this.moveUses = {}; this.mastery = o.mastery || null;   // career move mastery: landed uses this match, damage bonus per move
    this.x = o.x || 450; this.y = o.y || 0; this.vx = 0; this.vy = 0; this.face = o.face || 1; this.side = o.side || 'in'; this.ground = true; this.lane = o.lane || 0;
    this.fsm = new StateMachine(this);
    this.fsm.onChange = (a, b, opt) => this.onState(a, b, opt);
    this.intent = newIntent(); this.buf = {}; for (const k of BUF_KEYS) this.buf[k] = 0;
    this.joints = new Joints(); this.poseT = 0; this.gait = 0; this.clipName = null; this.clipT = 0; this.blend = null;
    this.rag = null; this.link = null; this.atk = null; this.target = null;
    this.inv = 0; this.grabImm = 0; this.dodgeCd = 0; this.counterCd = 0; this.burstCd = 0; this.regenDelay = 0; this.flash = 0; this.hitShake = 0; this.landT = 0; this.boost = 0; this.staleList = []; this.moveStale = {};
    this.combo = { n: 0, t: 0, dmg: 0 }; this.chainN = 0; this.chainT = 0; this.holdT = 0; this.running = false; this.lastTap = { dir: 0, t: -9 }; this.prevMx = 0; this.guardT = 0; this.whip = null; this.expr = 'neutral'; this.exprT = 0; this.mash = 0; this.escape = 0; this.protect = 0;
    this.outCount = 0; this.eliminated = false; this.tagged = true; this.partner = null; this.legal = true; this.ai = null; this.tails = null; this.sweat = 0; this.touchRope = null; this.gettingUp = null; this.pinTries = 0; this.tagRecover = 0; this.kills = 0; this.perfects = 0;
    this.cpuTime = 0; this.prop = null; this.dash = false; this.sigCd = 0; this.boss = !!o.boss; this.climb = null; this.aiBoost = o.aiBoost || 0; this.waitTurn = o.waitTurn || 0;
  }
  get st() { return this.fsm.cur; }
  get t() { return this.fsm.t; }
  get arena() { return this.match.arena; }
  get h() { return this.dims.height; }
  get alive() { return !this.eliminated && this.st !== 'KO' && this.st !== 'OUT'; }
  get airborne() { return !this.ground; }
  get standing() { return this.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK', 'TAUNT', 'DODGE', 'ROPE'); }
  get exhausted() { return this.hp <= this.maxHp * .22; }
  get grabbable() { return this.alive && this.grabImm <= 0 && !this.link && ((this.st === 'DOWN' && (!this.rag || this.rag.ground)) || this.st === 'STAGGER' || (this.st === 'WHIPPED' && this.whip && this.whip.back)) && this.ground !== false; }
  get finisher() { return FINISHERS[this.finisherId]; }
  isFoe(o) { return o !== this && o.team !== this.team; }
  // ---- state changes ----
  set(to, opt) { return this.fsm.set(to, opt); }
  onState(from, to, opt) {
    this.match.anim.changed(this, from, to, opt);
    if (to !== 'ATTACK' && to !== 'AIR_ATTACK' && to !== 'FINISHER') this.atk = null;
    if (to !== 'HITSTUN' && to !== 'DOWN' && to !== 'KO' && to !== 'OUT' && to !== 'PINNED') this.dropRag();
    if (to === 'IDLE' || to === 'MOVE') this.whip = null;
    if (to !== 'LADDER' && to !== 'CAGE_CLIMB') this.climb = null;
    if (to !== 'CASE_HANG') this.hang = null;
    if (to !== 'GUARD') this.guardT = 0;
    if (this.prop && !keepsProp(to)) this.match.props.drop(this, to);
    this.match.emit('state', { f: this, from, to });
  }
  dropRag() { if (this.rag) { this.match.anim.freezeBlend(this, .16); this.rag = null; } }
  ragdoll(vx, vy, spin = 0, over = false) {
    const r = new Ragdoll(this.joints, this.dims, this.face);
    r.side = this.side; r.over = over;
    r.kick(vx, vy, spin);
    this.rag = r; this.ground = false;
    return r;
  }
  // ---- input ----
  readIntent(dt) {
    const I = this.intent;
    for (const k of BUF_KEYS) { if (I[k]) this.buf[k] = B.inputBuffer; else if (this.buf[k] > 0) this.buf[k] -= dt; }
    const m = Math.abs(I.mx) > .3 ? sgn(I.mx) : 0;
    if (m !== 0 && m !== this.prevMx) {
      if (this.lastTap.dir === m && this.match.time - this.lastTap.t < B.doubleTap) { this.running = true; if (!this.dash && this.ground) { this.dash = true; this.match.emit('dashStart', { f: this }); } }
      this.lastTap = { dir: m, t: this.match.time };
      this.holdT = 0;
    }
    if (m === 0) { this.holdT = 0; if (this.prevMx !== 0) this.runStop = this.match.time; if (this.match.time - (this.runStop || 0) > .1) { this.running = false; this.dash = false; } } else { this.holdT += dt; if (this.holdT > B.runAfter) this.running = true; if (m !== this.prevMx && this.prevMx !== 0) { this.running = false; this.dash = false; } }
    if (this.dash && !this.fsm.is('IDLE', 'MOVE', 'ATTACK', 'JUMP', 'FALL', 'AIR_ATTACK', 'ROPE')) this.dash = false;
    this.prevMx = m;
  }
  has(k) { return this.buf[k] > 0; }
  consume(k) { if (this.buf[k] > 0) { this.buf[k] = 0; return true; } return false; }
  clearBuf() { for (const k of BUF_KEYS) this.buf[k] = 0; }
  // ---- targeting ----
  nearestFoe(max = 1e9, test) {
    let best = null, bd = max;
    for (const o of this.match.fighters) {
      if (!this.isFoe(o) || !o.alive || o.st === 'TAGWAIT' || o.st === 'INTRO') continue;
      if (test && !test(o)) continue;
      const d = Math.abs(o.x - this.x) + Math.abs(o.y - this.y) * .6;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  updateTarget() {
    const cur = this.target;
    if (cur && cur.alive && this.isFoe(cur) && cur.st !== 'TAGWAIT' && this.ctrl === 'ai') { const n = this.nearestFoe(); if (n && n !== cur && Math.abs(n.x - this.x) + 60 < Math.abs(cur.x - this.x)) this.target = n; return; }
    this.target = this.nearestFoe();
  }
  faceFoe(range = 90) { const n = this.nearestFoe(range, o => o.side === this.side || Math.abs(o.x - this.x) < 60); if (n && Math.abs(n.x - this.x) > 4) this.face = sgn(n.x - this.x); }
  // ---- per frame ----
  tick(dt) {
    this.fsm.t += dt; this.clipT += dt; this.poseT += dt;
    for (const k of ['inv', 'grabImm', 'dodgeCd', 'counterCd', 'burstCd', 'regenDelay', 'flash', 'hitShake', 'landT', 'boost', 'exprT', 'protect', 'sigCd', 'chairImm']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chainN = 0; }
    if (this.standing) { this.freeT = (this.freeT || 0) + dt; if (this.freeT > 1.6) this.grabCount = 0; } else this.freeT = 0;
    if (this.combo.t > 0) { this.combo.t -= dt; if (this.combo.t <= 0) { this.combo.n = 0; this.combo.dmg = 0; } }
    this.readIntent(dt);
    this.updateTarget();
    if (this.rag) { this.x = this.rag.cx; this.side = this.rag.side; }
    if (this.match.combo && this.match.combo.pre(this, dt)) return;
    const fn = CONTROL[this.st];
    if (fn) fn(this, this.intent, dt);
  }
}

// ---- shared pieces -------------------------------------------------------------------------------------
function groundMove(f, I, dt, scale = 1) {
  const run = f.running && Math.abs(I.mx) > .3;
  const spd = (run ? (f.dash ? B.dash : B.run) : B.walk) * f.stats.spd * scale * (f.boost > 0 ? B.ropeBoost : 1) * (f.exhausted ? .9 : 1);
  const want = Math.abs(I.mx) > .3 ? sgn(I.mx) * spd : 0;
  f.vx = approach(f.vx, want, (want ? B.accel : B.decel) * dt);
  if (want && scale > 0) f.face = sgn(want);
}
function friction(f, dt, k = 1) { f.vx = approach(f.vx, 0, B.decel * k * dt); }
function toFall(f) { if (!f.ground && !f.rag && !f.link) { f.set('FALL'); return true; } return false; }
function recover(f) { f.set(f.ground ? 'IDLE' : 'FALL'); }

export function startAttack(f, def, o = {}) {
  if (!f.set(def.air ? 'AIR_ATTACK' : 'ATTACK')) return false;
  f.atk = { def, t: 0, hit: new Set(), connected: false, chain: o.chain != null ? o.chain : -1, boost: f.boost > 0 ? 1.25 : 1, done: false };
  f.match.emit('swing', { f, def });
  return true;
}
function chooseAttack(f, I) {
  const dirHeld = Math.abs(I.mx) > .3;
  // a chair in the hands: every J is a chair shot (on a standing or a downed foe)
  if (f.prop) {
    if (dirHeld) f.face = sgn(I.mx); else { const n = f.nearestFoe(90, o => o.side === f.side); if (n && Math.abs(n.x - f.x) > 4) f.face = sgn(n.x - f.x); }
    if (startAttack(f, ATTACKS.chairShot)) { f.vx = dirHeld ? f.face * 70 : f.vx * .3; if (f.prop) { f.prop.uses--; f.prop.swung = true; } }   // every swing wears the chair: three and it is gone
    return;
  }
  // a downed foe in reach and nobody standing closer: ground attack
  const downed = f.nearestFoe(54, o => (o.st === 'DOWN' || o.st === 'PINNED') && o.side === f.side && Math.abs(o.y - f.y) < 30);
  const standing = f.nearestFoe(62, o => o.st !== 'DOWN' && o.st !== 'PINNED');
  if (dirHeld) f.face = sgn(I.mx);
  else if (standing && Math.abs(standing.x - f.x) < 62) f.face = sgn(standing.x - f.x) || f.face;
  else if (downed) f.face = sgn(downed.x - f.x) || f.face;
  if ((f.running || f.boost > 0) && Math.abs(f.vx) > 110 && sgn(f.vx) === f.face) { const d = ATTACKS[f.char.run]; f.vx = f.face * Math.max(Math.abs(f.vx), B.run * f.stats.spd) * (f.boost > 0 ? 1.1 : 1); if (startAttack(f, d)) { if (f.dash) f.atk.boost = Math.max(f.atk.boost, 1.15); if (d.hop) { f.vy = -d.hop; f.ground = false; } } return; }
  if (downed && !(standing && Math.abs(standing.x - f.x) < Math.abs(downed.x - f.x) + 8)) { startAttack(f, ATTACKS[f.char.ground || 'stomp']); f.vx = clamp((downed.x - f.x) * 2.4, -90, 90); return; }
  const n = f.chainT > 0 ? f.chainN : 0;
  const def = ATTACKS[f.chain[Math.min(n, f.chain.length - 1)]];
  if (startAttack(f, def, { chain: Math.min(n, f.chain.length - 1) })) {
    f.chainN = n + 1 >= f.chain.length ? 0 : n + 1; f.chainT = B.comboWindow;
    if (dirHeld) f.vx = Math.max(Math.abs(f.vx), 60 * f.stats.spd) * f.face * (def.lv >= 3 ? 1.5 : 1.1); else f.vx *= .4;
  }
}
function startJump(f, I) {
  const ar = f.arena, m = f.match;
  if (m.special && (m.special.ladderClimb(f) || m.special.cageClimbStart(f, I))) return;   // up the ladder, up the cage wall
  // contextual W: climb the corner, enter the ring
  if (ar.hasRing && f.side === 'in') {
    const nr = ar.nearRope(f.x);
    if (nr.dist < 34 && sgn(I.mx || f.face) === nr.dir && m.rules.climb !== false) { f.climbDir = nr.dir; f.face = nr.dir; if (f.set('CLIMB')) { f.vx = 0; m.emit('climb', { f }); return; } }
  }
  if (ar.hasRing && f.side === 'out' && f.y > ar.matY + 4) {
    const dl = Math.abs(f.x - (ar.ropeL - ar.apron)), dr = Math.abs(f.x - (ar.ropeR + ar.apron));
    if (Math.min(dl, dr) < 46) { beginEnter(f); return; }
  }
  f.vy = -B.jump * Math.sqrt(f.stats.jump) * (f.boost > 0 ? 1.06 : 1); f.ground = false;
  // Vaulting over the top rope is a choice: running at the ropes and jumping, where the rules allow leaving.
  f.vault = false;
  if (ar.hasRing && f.side === 'in' && m.rules.ringOut === 'count' && Math.abs(f.vx) > 120) { const nr = ar.nearRope(f.x); if (nr.dist < 70 && sgn(f.vx) === nr.dir) f.vault = true; }
  f.set('JUMP');
  m.emit('jump', { f });
}
export function beginEnter(f) {
  const ar = f.arena, left = f.x < ar.mid;
  f.enter = { x0: f.x, y0: f.y, x1: left ? ar.ropeL + 26 : ar.ropeR - 26, left };
  f.face = left ? 1 : -1; f.vx = f.vy = 0;
  f.set('ENTER_RING', { force: f.st === 'INTRO' || f.st === 'TAGWAIT' });
}
function beginExit(f, dir) {
  const ar = f.arena;
  f.enter = { x0: f.x, y0: f.y, x1: dir < 0 ? ar.ropeL - ar.apron - 18 : ar.ropeR + ar.apron + 18, left: dir < 0 };
  f.face = dir; f.vx = f.vy = 0;
  f.set('EXIT_RING');
}
function startDodge(f, I) {
  if (f.dodgeCd > 0) return false;
  const dir = Math.abs(I.mx) > .3 ? sgn(I.mx) : 0;
  if (!dir) f.faceFoe(140); // facing the danger makes the counter possible
  if (!f.set('DODGE')) return false;
  f.dodge = { dir, dodged: false, back: !dir };
  f.dodgeCd = B.dodgeCd;
  f.vx = dir ? dir * B.dodgeSpeed * (.85 + .15 * f.stats.spd) : -f.face * 190;
  if (dir) f.face = dir;
  f.match.emit('dodgeStart', { f });
  return true;
}
// S + L: burst out of trouble. Costs finisher gauge and has a long cooldown.
export function tryBurst(f) {
  if (f.burstCd > 0 || f.fin < B.burstCost || f.st === 'KO') return false;
  if (f.link && f.link.kind === 'move') return false;
  f.fin -= B.burstCost; f.burstCd = B.burstCd;
  const m = f.match;
  if (f.link) m.grapple.breakLink(f.link, 'burst');
  if (f.rag) { f.x = f.rag.cx; f.y = f.arena.ground(f.x, f.rag.cy, f.side); f.dropRag(); }
  f.inv = .9; f.grabImm = 1; f.stun = Math.max(f.stun, f.maxStun * .35);
  f.set('JUMP', { force: true });
  f.ground = false; f.vy = -190; f.vx = 0;
  for (const o of m.fighters) if (f.isFoe(o) && o.alive && !o.link && Math.abs(o.x - f.x) < B.burstRange && Math.abs(o.y - f.y) < 70 && STATES[o.st].hit) m.combat.knock(o, sgn(o.x - f.x) * 260, -150, 3, f);
  m.emit('burst', { f });
  return true;
}
function burstInput(f, I) { return I.down && f.has('dodge'); }
function mashInput(f) { let n = 0; for (const k of ['atk', 'grab', 'dodge', 'jump']) if (f.buf[k] >= B.inputBuffer - 1e-6) n++; return n; }

// ---- state control table -------------------------------------------------------------------------------
export const CONTROL = {
  IDLE: neutral, MOVE: neutral,
  JUMP(f, I, dt) { air(f, I, dt); if (f.vy > 0 && f.st === 'JUMP') f.set('FALL'); },
  FALL: air,
  ATTACK(f, I, dt) {
    const a = f.atk;
    if (!a) { recover(f); return; }
    const d = a.def;
    a.t += dt;
    if (d.run) { const k = d.carry || .8; if (a.t < d.startup + d.active) f.vx = f.face * Math.max(Math.abs(f.vx) * (1 - dt * .9), 120 * k); else friction(f, dt, .55); }
    else if (d.step && a.t < d.startup + d.active) f.vx = f.face * d.step * f.stats.spd; // pushing strikes walk the body forward
    else if (a.t > d.startup * .6) friction(f, dt, .6);
    let rec = d.recover;
    const repeats = f.staleList.filter(x => x === d.id).length;
    if (repeats >= 3 && !d.run) rec *= B.repeatRecover;
    if (!a.connected && d.lv >= 3) rec *= 1.18;
    const total = d.startup + d.active + rec;
    if (a.connected && a.chain >= 0 && a.t > d.startup + d.active + .03 && a.chain < f.chain.length - 1 && f.has('atk')) { f.consume('atk'); f.set('IDLE', { force: true }); chooseAttack(f, I); return; }
    if (a.connected && a.t > d.startup + d.active + .02) {
      if (f.has('fin') && f.fin >= B.finMax && f.match.finisher.start(f)) { f.consume('fin'); return; }
      if (f.has('dodge') && !I.down && startDodge(f, I)) { f.consume('dodge'); return; }
    }
    if (a.t >= total) recover(f);
  },
  AIR_ATTACK(f, I, dt) {
    const a = f.atk;
    if (!a) { f.set('FALL', { force: true }); return; }
    a.t += dt;
    if (f.ground && a.t > .05) { landAttack(f, a); return; }
  },
  GUARD(f, I, dt) {
    f.guardT += dt; friction(f, dt, 1.2);
    if (toFall(f)) return;
    if (Math.abs(I.mx) > .3) f.face = sgn(I.mx);
    if (f.consume('dodge')) { if (startDodge(f, I)) return; }
    if (f.consume('grab')) { if (f.match.grapple.tryGrab(f, I)) return; }
    if (f.consume('atk')) { chooseAttack(f, Object.assign({}, I, { mx: 0 })); return; }
    const ar = f.arena;
    if (ar.hasRing && f.side === 'in' && Math.abs(I.mx) > .3) { const nr = ar.nearRope(f.x); if (nr.dist < 30 && sgn(I.mx) === nr.dir && f.guardT > .22 && f.match.rules.leave !== false) { beginExit(f, nr.dir); return; } }
    if (!I.down) f.set('IDLE');
  },
  DODGE(f, I, dt) {
    const T = f.dodge.back ? B.backstepTime : B.dodgeTime;
    const [a, b] = B.dodgeInv;
    f.invDodge = f.t >= a && f.t <= b;
    if (f.t > T * .62) friction(f, dt, .8);
    if (f.t >= T) { f.invDodge = false; recover(f); }
  },
  HITSTUN(f, I, dt) {
    if (burstInput(f, I) && tryBurst(f)) { f.clearBuf(); return; }
    const k = f.hsKind;
    if (k === 'launch') {
      if (f.rag && f.rag.done()) { settle(f); standUp(f, f.hp <= 0 ? .5 : 0); }
      else if (!f.rag) standUp(f, 0);
      return;
    }
    friction(f, dt, k === 'lie' ? .7 : .45);
    if (f.t >= f.hs) { if (k === 'lie') standUp(f, 0, f.lieClip); else recover(f); }
  },
  STAGGER(f, I, dt) {
    if (burstInput(f, I) && tryBurst(f)) { f.clearBuf(); return; }
    friction(f, dt, .5);
    f.hs -= mashInput(f) * .035;
    if (f.t >= f.hs) { f.grabImm = .6; recover(f); }
  },
  DOWN(f, I, dt) {
    if (f.rag) {
      if (f.rag.done()) { settle(f); f.downClock = 0; }
      else if (f.rag.t > .5 && burstInput(f, I) && tryBurst(f)) f.clearBuf();
      return;
    }
    if (burstInput(f, I) && tryBurst(f)) { f.clearBuf(); return; }
    friction(f, dt, 1);
    f.downClock = (f.downClock || 0) + dt * (.75 + .25 * f.stats.down) * (f.match.special ? f.match.special.rally(f) : 1) + mashInput(f) * B.mashDown;
    if (f.downClock >= f.downTime) standUp(f, 0);
  },
  GET_UP(f, I, dt) {
    friction(f, dt, 1.5);
    if (f.gettingUp.wait > 0) { f.gettingUp.wait -= dt; f.clipT = 0; return; }
    if (f.clipT >= f.gettingUp.dur) { f.inv = Math.max(f.inv, f.gettingUp.prot); f.protect = f.gettingUp.prot; f.gettingUp = null; recover(f); }
  },
  GRAB(f, I, dt) { f.match.grapple.holdControl(f, I, dt); },
  GRABBED(f, I, dt) { f.match.grapple.heldControl(f, I, dt); },
  FINISHER(f, I, dt) { f.match.finisher.control(f, I, dt); },
  ROPE(f, I, dt) {
    const r = f.ropeRun;
    const k = clamp(f.t / B.ropeLean, 0, 1);
    f.x = r.x + r.dir * Math.sin(k * Math.PI) * 13;
    f.arena.press(r.dir < 0 ? 'L' : 'R', Math.sin(k * Math.PI) * 17);
    f.vx = 0; f.face = f.t > B.ropeLean * .5 ? -r.dir : r.dir;
    if (f.t >= B.ropeLean) {
      f.x = r.x; f.face = -r.dir; f.vx = -r.dir * B.run * f.stats.spd * B.ropeBoost; f.boost = B.ropeBoostTime; f.running = true;
      f.arena.twang(r.dir < 0 ? 'L' : 'R', -190);
      f.match.emit('rope', { f, side: r.dir < 0 ? 'L' : 'R' });
      f.set('MOVE');
      f.ropeGo = { dir: -r.dir, t: .34 };
    }
  },
  WHIPPED(f, I, dt) {
    const w = f.whip;
    if (!w) { recover(f); return; }
    w.t += dt;
    f.vx = w.dir * w.speed; f.face = w.dir;
    if (w.lean > 0) {
      w.lean -= dt; const k = 1 - w.lean / B.ropeLean;
      f.vx = 0; f.x = w.rx + w.rd * Math.sin(clamp(k, 0, 1) * Math.PI) * 15;
      f.arena.press(w.rd < 0 ? 'L' : 'R', Math.sin(clamp(k, 0, 1) * Math.PI) * 19);
      if (w.lean <= 0) { w.dir = -w.rd; w.back = true; w.t = 0; w.speed = 262; f.x = w.rx; f.arena.twang(w.rd < 0 ? 'L' : 'R', -200); f.match.emit('rope', { f, side: w.rd < 0 ? 'L' : 'R', whip: true }); }
      return;
    }
    if (!w.back && f.touchRope) { w.lean = B.ropeLean; w.rd = f.touchRope === 'L' ? -1 : 1; w.rx = f.x; return; }
    if (!w.back && w.t > 1.6) { recover(f); return; }
    if (w.back) {
      if (w.t > .2 && f.consume('dodge')) { f.grabImm = .5; recover(f); return; }
      if (w.t > .3 && f.consume('atk')) { f.running = true; f.set('IDLE', { force: true }); f.vx = w.dir * 230; startAttack(f, ATTACKS[f.char.run]); return; }
      if (w.t > w.max || (f.touchRope && w.t > .2)) { f.grabImm = .3; f.vx *= .4; recover(f); }
    }
  },
  CLIMB(f, I, dt) {
    const ar = f.arena, k = clamp(f.t / .44, 0, 1), d = f.climbDir;
    const tx = d < 0 ? ar.ropeL + 4 : ar.ropeR - 4;
    f.x = f.x + (tx - f.x) * Math.min(1, dt * 9); f.y = ar.matY - (ar.ropeH + 3) * k; f.vx = f.vy = 0; f.ground = true;
    if (f.t >= .44) { f.face = -d; f.x = tx; f.set('PERCH'); }
  },
  // On the turnbuckle: A/D turns, J dives the way you face. Facing out means over the top rope to the floor.
  PERCH(f, I, dt) {
    const ar = f.arena, m = f.match, out = f.climbDir || (f.x < ar.mid ? -1 : 1);
    f.vx = f.vy = 0; f.y = ar.matY - ar.ropeH - 3; f.ground = true;
    if (Math.abs(I.mx) > .3 && sgn(I.mx) !== f.face) { f.face = sgn(I.mx); m.emit('perchTurn', { f, out: f.face === out }); }
    if (f.t < .12) return;
    if (f.consume('atk')) {
      if (f.face !== out) { const pk = topPick(f); if (pk.kind === 'stand') topStand(f, I, pk.t); else dive(f, I); return; }
      if (m.rules.ringOut === 'elim' || m.rules.cage) { f.face = -out; m.emit('perchDeny', { f, cage: !!m.rules.cage }); return; }   // over the top = eliminated
      diveOut(f, I, out); return;
    }
    if (f.consume('jump')) { f.face = -out; f.vy = -B.jump * .8; f.vx = -out * 120; f.ground = false; f.set('JUMP'); m.emit('jump', { f }); return; }
    if (I.down || f.t > B.perchTime || f.consume('grab') || f.consume('dodge')) { f.face = -out; f.vy = -60; f.vx = -out * 60; f.ground = false; f.set('FALL', { force: true }); }
  },
  HANG(f, I, dt) {
    const ar = f.arena, left = f.x < ar.mid;
    f.x = left ? ar.ropeL - 9 : ar.ropeR + 9; f.y = ar.matY + 26; f.vx = f.vy = 0; f.ground = true; f.face = left ? 1 : -1;
    f.hangT -= dt;
    f.hangMash = (f.hangMash || 0) + mashInput(f) * .14 + ((I.up || sgn(I.mx) === f.face && Math.abs(I.mx) > .3) ? dt * .9 : 0);
    if (f.t > .25 && f.hangMash >= 1) { f.hangMash = 0; beginEnter(f); return; }
    if (f.hangT <= 0 || (I.down && f.t > .4)) { f.hangMash = 0; f.ground = false; f.vy = 20; f.side = 'out'; f.set('FALL', { force: true }); f.match.emit('hangFail', { f }); }
  },
  APRON(f, I, dt) {
    const ar = f.arena, left = f.x < ar.mid, inward = left ? 1 : -1;
    f.vx = f.vy = 0; f.y = ar.matY; f.ground = true; f.face = inward;
    if (f.t < .1) return;
    if (f.consume('atk') && springboard(f)) return;   // J: springboard onto somebody lying in the ring
    if (f.consume('jump') || sgn(I.mx) === inward && Math.abs(I.mx) > .3 && f.t > .18) { beginEnter(f); return; }
    if (I.down || (sgn(I.mx) === -inward && Math.abs(I.mx) > .3)) { f.ground = false; f.vx = -inward * 90; f.vy = -60; f.set('FALL'); }
  },
  LADDER(f, I, dt) { const S = f.match.special; if (!S || !S.climbTick(f, I, dt)) { f.climb = null; f.ground = false; f.vy = 20; f.set('FALL', { force: true }); } },
  CAGE_CLIMB(f, I, dt) { const S = f.match.special; if (!S || !S.climbTick(f, I, dt)) { f.climb = null; f.ground = false; f.vy = 20; f.set('FALL', { force: true }); } },
  CASE_HANG(f, I, dt) { const S = f.match.special; if (!S || !S.hangTick(f, I, dt)) { f.hang = null; f.ground = false; f.set('FALL', { force: true }); } },
  SEATED(f, I, dt) {
    const s = f.seat;
    if (!s) { f.ground = false; f.set('FALL', { force: true }); return; }
    f.vx = f.vy = 0; f.x = s.x; f.y = s.y; f.ground = true; f.face = s.face; f.side = 'in';
    s.t -= dt + mashInput(f) * .1;   // mashing gets you down sooner
    if (s.t <= 0) { f.seat = null; f.ground = false; f.vy = -60; f.vx = -s.face * 80; f.y -= 2; f.set('FALL', { force: true }); f.inv = Math.max(f.inv, .3); f.match.emit('seatOff', { f }); }
  },
  ENTER_RING(f, I, dt) {
    const ar = f.arena, e = f.enter, k = clamp(f.t / .55, 0, 1), s = k * k * (3 - 2 * k);
    f.x = e.x0 + (e.x1 - e.x0) * s; f.y = e.y0 + (ar.matY - e.y0) * Math.min(1, s * 1.7) - Math.sin(k * Math.PI) * 14; f.vx = f.vy = 0; f.ground = true; f.side = k > .5 ? 'in' : f.side;
    if (k >= 1) { f.side = 'in'; f.y = ar.matY; f.x = e.x1; f.inv = Math.max(f.inv, .25); f.enter = null; f.set('IDLE'); }
  },
  EXIT_RING(f, I, dt) {
    const ar = f.arena, e = f.enter, k = clamp(f.t / .5, 0, 1), s = k * k * (3 - 2 * k);
    const ty = f.exitTo === 'apron' ? ar.matY : ar.floorY;
    f.x = e.x0 + (e.x1 - e.x0) * s; f.y = e.y0 + (ty - e.y0) * Math.max(0, s * 2 - 1) - Math.sin(k * Math.PI) * 16; f.vx = f.vy = 0; f.ground = true; f.side = k > .45 ? 'out' : f.side;
    if (k >= 1) { f.side = 'out'; f.y = ty; f.x = e.x1; f.enter = null; if (f.exitTo === 'apron') { f.exitTo = null; f.set('TAGWAIT', { force: true }); } else f.set('IDLE'); }
  },
  PIN(f, I, dt) { f.match.pinControl(f, I, dt); },
  PINNED(f, I, dt) { },
  TAUNT(f, I, dt) {
    friction(f, dt, 1.2);
    if (f.t > .15 && f.has('dodge') && !I.down) { f.consume('dodge'); if (startDodge(f, I)) return; }
    if (f.t >= B.tauntTime) { f.match.combat.addFin(f, B.finTaunt); f.match.addHype(7); f.match.emit('tauntDone', { f }); recover(f); }
  },
  TAGWAIT(f, I, dt) { const ar = f.arena; f.vx = f.vy = 0; f.y = ar.matY; f.ground = true; f.face = f.x < ar.mid ? 1 : -1; },
  KO(f, I, dt) { if (f.rag && f.rag.done()) settle(f); else if (!f.rag) friction(f, dt, 1); },
  OUT(f, I, dt) { if (f.rag && f.rag.done()) settle(f); },
};
function neutral(f, I, dt) {
  const m = f.match;
  if (toFall(f)) return;
  if (f.ropeGo) { // carried by the rope for a moment
    f.ropeGo.t -= dt;
    f.vx = f.ropeGo.dir * Math.max(Math.abs(f.vx), B.run * f.stats.spd * 1.1); f.face = f.ropeGo.dir; f.running = true;
    if (f.consume('atk')) { f.ropeGo = null; chooseAttack(f, Object.assign({}, I, { mx: 0 })); return; }
    if (f.consume('jump')) { f.ropeGo = null; startJump(f, I); return; }
    if (f.consume('dodge')) { f.ropeGo = null; startDodge(f, I); return; }
    if (f.consume('grab')) { f.ropeGo = null; if (m.grapple.tryGrab(f, I)) return; }
    if (f.ropeGo && (f.ropeGo.t <= 0 || f.touchRope || sgn(I.mx) === -f.ropeGo.dir && Math.abs(I.mx) > .3)) f.ropeGo = null;
    return;
  }
  if (f.landT > 0) { friction(f, dt, 1); if (f.landT > .06) return; }
  if (m.phase !== 'fight' && !(m.entrance && !m.entrance.done && m.entrance.drives(f))) { friction(f, dt, 1); if (f.st === 'MOVE') f.set('IDLE'); return; }   // before the bell only an entrance walk moves
  if (f.has('fin')) { const sv = m.combo.seatedFoe(f); if (sv) { f.consume('fin'); if (m.combo.seatedMove(f, sv, true)) return; } }
  if (f.has('fin')) { f.consume('fin'); if (f.fin >= B.finMax) { if (m.finisher.start(f)) return; } else if (Math.abs(f.vx) < 60) { if (f.set('TAUNT')) { f.vx = 0; m.emit('taunt', { f }); return; } } }
  if (f.has('dodge') && !I.down) { f.consume('dodge'); if (startDodge(f, I)) return; }
  if (f.has('grab')) { f.consume('grab'); if (m.grapple.tryGrab(f, I)) return; }
  if (f.has('atk')) { f.consume('atk'); chooseAttack(f, I); return; }
  if (f.has('jump')) { f.consume('jump'); startJump(f, I); return; }
  if (f.has('downEdge') && m.contextS(f, I)) { f.consume('downEdge'); return; }
  if (I.down) { f.faceFoe(120); if (f.set('GUARD')) { f.running = false; return; } }
  groundMove(f, I, dt);
  if (f.touchRope && f.side === 'in' && f.arena.hasRing) {
    const dir = f.touchRope === 'L' ? -1 : 1;
    if (Math.abs(f.lastVx || 0) > 150 && sgn(f.lastVx) === dir && f.running) { f.ropeRun = { dir, x: f.x }; if (f.set('ROPE')) { m.emit('ropeHit', { f, side: f.touchRope }); return; } }
    else if (Math.abs(I.mx) > .3 && sgn(I.mx) === dir) f.arena.press(f.touchRope, 5);
  }
  if (Math.abs(f.vx) > 8) { if (f.st !== 'MOVE') f.set('MOVE'); } else if (f.st !== 'IDLE') f.set('IDLE');
}
function air(f, I, dt) {
  const want = Math.abs(I.mx) > .3 ? sgn(I.mx) * B.walk * 1.35 * f.stats.spd : 0;
  if (want) f.vx = approach(f.vx, Math.abs(f.vx) > Math.abs(want) && sgn(f.vx) === sgn(want) ? f.vx : want, B.airAccel * dt);
  if (f.ground) {
    f.landT = .12; f.match.emit('land', { f });
    if (f.arena.hasRing && f.side === 'out' && f.y <= f.arena.matY + 2 && f.arena.overMat(f.x)) { f.set('APRON', { force: true }); return; }
    f.set('IDLE');
    return;
  }
  if (f.has('atk') && f.match.phase === 'fight') {
    f.consume('atk');
    if (Math.abs(I.mx) > .3) f.face = sgn(I.mx);
    else { const n = f.nearestFoe(150); if (n && Math.abs(n.x - f.x) > 10) f.face = sgn(n.x - f.x); }
    const d = ATTACKS[f.char.air];
    if (startAttack(f, d)) { f.vx = f.face * Math.max(Math.abs(f.vx), d.push * 1.1) + f.face * d.push * .35; f.vy = Math.min(f.vy, -60) + (f.vy > 60 ? 0 : -30); }
  }
}
// What a J from the corner would do right now, by the state of the foe in front.
export function topPick(f) {
  const t = f.nearestFoe(250, o => o.side === f.side && sgn(o.x - f.x) === f.face && Math.abs(o.x - f.x) > 18);
  if (!t) return { kind: 'none' };
  if (t.st === 'DOWN' || t.st === 'PINNED' || (t.st === 'HITSTUN' && t.hsKind === 'lie')) return { kind: 'down', t };
  if (t.st === 'GET_UP') return { kind: 'rising', t };
  if (t.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK', 'TAUNT', 'STAGGER', 'HITSTUN', 'WHIPPED', 'ROPE')) return { kind: 'stand', t };
  return { kind: 'none', t };
}
function topStand(f, I, t) {
  const d = ATTACKS[f.char.topStand] || ATTACKS.missileDropkick, dx = Math.max(0, Math.abs(t.x - f.x) - 18), T = .6;
  f.vy = -230; f.vx = f.face * clamp(dx / T, 70, 320); f.ground = false;
  if (startAttack(f, d)) f.match.emit('dive', { f, stand: true, id: d.id });
}
function dive(f, I) {
  const d = ATTACKS[f.char.dive], n = f.nearestFoe(330, o => Math.abs(o.x - f.x) > 20 && sgn(o.x - f.x) === f.face);
  const dx = n ? Math.abs(n.x - f.x) : 130;
  const T = .69;
  f.vy = -250; f.vx = f.face * clamp(dx / T * (Math.abs(I.mx) > .3 ? 1.12 : 1), 70, 330); f.ground = false;
  if (startAttack(f, d)) f.match.emit('dive', { f });
}
// Dive from the corner over the top rope onto the floor outside. The flight is longer (the floor is lower than
// the mat) and must clear the apron; `vault` lets the body pass the ropes, physics flips it to the outside.
function diveOut(f, I, out) {
  const ar = f.arena, m = f.match, d = ATTACKS[f.char.dive];
  const edge = out < 0 ? ar.ropeL - ar.apron - 16 : ar.ropeR + ar.apron + 16;
  const n = f.nearestFoe(380, o => o.side === 'out' && sgn(o.x - f.x) === out && Math.abs(o.x - f.x) > 30);
  const tx = n ? n.x : edge + out * 60;
  const dx = Math.max(Math.abs(tx - f.x), Math.abs(edge - f.x) + 8);
  const T = .82;
  f.vault = true;
  f.vy = -270; f.vx = out * clamp(dx / T * (Math.abs(I.mx) > .3 && sgn(I.mx) === out ? 1.1 : 1), 90, 340); f.ground = false;
  if (startAttack(f, d)) { m.addHype(6); m.emit('dive', { f, out: true }); }
}
function landAttack(f, a) {
  const d = a.def, ok = a.connected;
  f.match.emit('landAttack', { f, def: d, ok });
  if (d.quake && !ok) { for (const o of f.match.fighters) if (f.isFoe(o) && o.alive && o.ground && Math.abs(o.x - f.x) < d.quake * .5 && STATES[o.st].hit && o.inv <= 0 && !o.link) f.match.combat.stunOnly(o, 8, f); }
  f.hs = d.recover * (ok ? .62 : d.dive ? 1.5 : 1.1);
  const lie = d.fallBack ? 'downSup' : d.fallFront ? 'downProne' : d.fallSit ? 'sit' : null;
  f.vx *= .5;
  if (lie) { f.lieClip = lie; f.hsKind = 'lie'; } else { f.hsKind = 'landlag'; f.hs = Math.min(f.hs, .22); }
  f.set('HITSTUN', { force: true, clip: lie || 'land' });
}
// Ragdoll came to rest: hand the body back to animation.
export function settle(f) {
  const r = f.rag;
  f.x = r.cx; f.side = r.side; f.y = f.arena.ground(f.x, r.cy, f.side); f.ground = true; f.vx = f.vy = 0;
  f.lieClip = r.faceUp() ? 'downSup' : 'downProne';
  f.match.anim.freezeBlend(f, .22);
  f.rag = null;
}
export function standUp(f, wait = 0, lie) {
  const L = lie || f.lieClip || 'downSup', pro = L === 'downProne';
  const quick = f.stats.spd * f.stats.jump > 1.25 && !pro && L !== 'sit';
  f.gettingUp = { wait, dur: .56, prot: f.st === 'DOWN' ? B.getUpProtect : B.hitGetUpProtect, clip: L === 'sit' ? 'getupProne' : quick ? 'kipup' : pro ? 'getupProne' : 'getupSup' };
  const wasDown = f.st === 'DOWN' || f.st === 'PINNED';
  if (wasDown && f.chairDazed) { f.chairDazed = false; f.stun = Math.max(f.stun, f.maxStun * .6); f.chairImm = B.chairImmune; }   // for a moment another chair only rocks them
  f.set('GET_UP', { force: true });
  f.inv = Math.max(f.inv, .6);
  if (wasDown) { f.stun = Math.max(f.stun, f.maxStun * Math.max(B.stunAfterDownMin, B.stunAfterDown - B.stunAfterDownLoss * (f.downs - 1))); f.grabImm = 0; f.combo.n = 0; f.grabCount = 0; f.postMove = false; f.moveChain = 0; }
}
