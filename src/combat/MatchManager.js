// One match: owns the fighters and systems, runs the rules of each mode, the referee and the win conditions.
import { Emitter, RNG, clamp, sgn } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';
import { CHARACTERS } from '../data/characters.js';
import { Arena, ARENAS } from './arena.js';
import { Fighter, beginEnter, standUp } from './CharacterController.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { StunSystem } from './StunSystem.js';
import { GrappleSystem } from './GrappleSystem.js';
import { WrestlingMoveSystem } from './WrestlingMoveSystem.js';
import { FinisherSystem } from './FinisherSystem.js';
import { AnimationSystem } from '../anim/AnimationSystem.js';
import { AIController } from './AIController.js';

export const MODES = {
  single: { name: '싱글 매치', desc: '1대1. 상대의 체력을 0으로 만들면 KO 승리.', rules: { ko: true, pin: false, ringOut: 'count', time: 300 } },
  pin: { name: '핀폴 매치', desc: '다운된 상대를 S로 눌러 3카운트를 세면 승리. 체력이 0이 되어도 끝나지 않는다.', rules: { ko: false, pin: true, ringOut: 'count', time: 360 } },
  rumble: { name: '로얄럼블', desc: '일정 시간마다 새 선수가 입장. 톱로프 너머로 떨어지면 탈락, 마지막 1명이 승리.', rules: { ko: false, pin: false, ringOut: 'elim', time: 0 } },
  tag: { name: '태그팀 매치', desc: '2대2. 자기 코너에서 S로 동료와 교대. KO 또는 핀폴로 승리.', rules: { ko: true, pin: true, ringOut: 'count', time: 420 } },
  royal: { name: '배틀로얄', desc: '모두가 처음부터 링에. KO 또는 톱로프 너머로 떨어지면 탈락.', rules: { ko: true, pin: false, ringOut: 'elim', time: 0 } },
  practice: { name: '연습 모드', desc: '상대 행동과 체력을 바꿔 가며 기술을 시험한다. 기록에 남지 않는다.', rules: { ko: false, pin: true, ringOut: 'none', time: 0 } },
  street: { name: '길거리 승부', desc: '링 없는 뒷골목. 쓰러뜨리면 끝.', rules: { ko: true, pin: false, ringOut: 'none', time: 240 } },
};

export class MatchManager extends Emitter {
  constructor(cfg) {
    super();
    this.cfg = cfg; this.mode = cfg.mode || 'single';
    const M = MODES[this.mode] || MODES.single;
    this.rules = Object.assign({}, M.rules, cfg.rules || {});
    const ad = ARENAS[cfg.arena || 'hall'] || ARENAS.hall;
    this.arenaDef = ad; this.arena = new Arena(ad);
    if (!this.arena.hasRing) { this.rules.ringOut = 'none'; this.rules.climb = false; }
    this.rng = new RNG(cfg.seed || (Date.now() & 0xffffff));
    this.physics = new PhysicsSystem(this); this.combat = new CombatSystem(this); this.stun = new StunSystem(this);
    this.grapple = new GrappleSystem(this); this.wrestle = new WrestlingMoveSystem(this); this.finisher = new FinisherSystem(this); this.anim = new AnimationSystem(this);
    this.fighters = []; this.links = []; this.queue = []; this.time = 0; this.clock = 0; this.phase = 'intro'; this.result = null;
    this.freeze = 0; this.slowT = 0; this.slowK = 1; this.hype = 25; this.pin = null; this.endT = 0; this.introT = 0;
    this.ref = { x: this.arena.mid, y: this.arena.matY, face: 1, act: 'watch', t: 0, count: 0, target: null, vx: 0, gait: 0, raise: null };
    this.practice = cfg.practice || null;
    this.log = []; this.faults = 0; this.stats = { finishers: 0, reversals: 0, counters: 0, moves: 0 };
    this.on('fault', () => this.faults++);
    this.on('overRope', e => this.onOverRope(e.f));
    this.setup();
  }
  // ---- creation ----
  addFighter(e, i, pos) {
    const c = typeof e.char === 'string' ? CHARACTERS[e.char] : e.char;
    const f = new Fighter(this, c, Object.assign({ idx: this.fighters.length, team: e.team != null ? e.team : i }, e, pos));
    if (f.ctrl === 'ai' || f.ctrl === 'dummy') f.ai = new AIController(f, e.difficulty || 'normal', this.rng);
    this.fighters.push(f);
    this.anim.solo(f, 0);
    return f;
  }
  setup() {
    const ar = this.arena, E = this.cfg.entrants || [];
    const L = ar.ropeL + 110, R = ar.ropeR - 110;
    if (this.mode === 'rumble') {
      const n = Math.min(B.rumbleStart, E.length);
      E.forEach((e, i) => { e.team = e.team != null ? e.team : i; });
      for (let i = 0; i < n; i++) this.addFighter(E[i], i, { x: i ? R : L, y: ar.matY, face: i ? -1 : 1, side: 'in' });
      this.queue = E.slice(n);
      this.nextEntry = this.cfg.interval || B.rumbleInterval;
      this.total = E.length;
    } else if (this.mode === 'tag') {
      // entrants: [p, partner, foe, foePartner]
      const spots = [{ x: L, face: 1 }, { x: ar.ropeL - 9, face: 1, apron: 1 }, { x: R, face: -1 }, { x: ar.ropeR + 9, face: -1, apron: 1 }];
      E.slice(0, 4).forEach((e, i) => {
        const s = spots[i], f = this.addFighter(Object.assign({}, e, { team: i < 2 ? 0 : 1 }), i, { x: s.x, y: ar.matY, face: s.face, side: s.apron ? 'out' : 'in' });
        f.legal = !s.apron;
        if (s.apron) { f.fsm.set('TAGWAIT', { force: true }); f.y = ar.matY; }
      });
      const F = this.fighters;
      if (F.length === 4) { F[0].partner = F[1]; F[1].partner = F[0]; F[2].partner = F[3]; F[3].partner = F[2]; }
    } else {
      const n = E.length;
      const xs = n === 2 ? [L, R] : Array.from({ length: n }, (_, i) => ar.ropeL + 60 + (ar.ropeR - ar.ropeL - 120) * (n === 1 ? .5 : i / (n - 1)));
      E.forEach((e, i) => this.addFighter(e, i, { x: xs[i], y: ar.matY, face: xs[i] < ar.mid ? 1 : -1, side: 'in', lane: n > 2 ? (i % 3) * 3 - 3 : 0 }));
    }
    for (const f of this.fighters) { if (f.st !== 'TAGWAIT') f.fsm.set('INTRO', { force: true }); }
    if (this.cfg.skipIntro) this.beginFight(true);
  }
  get human() { return this.fighters.find(f => f.ctrl === 'human' && (f.legal || this.mode !== 'tag')) || this.fighters.find(f => f.ctrl === 'human'); }
  beginFight(instant) {
    this.phase = instant ? 'fight' : 'ready'; this.introT = 0;
    for (const f of this.fighters) if (f.st === 'INTRO') f.set('IDLE', { force: true });
    if (instant) this.emit('bell', { start: true });
  }
  // ---- feedback hooks ----
  hitstop(s) { this.freeze = Math.max(this.freeze, Math.min(.2, s)); }
  slowmo(k, t) { this.slowK = Math.min(this.slowK, k); this.slowT = Math.max(this.slowT, t); }
  addHype(v) { this.hype = clamp(this.hype + v, 0, 100); }
  // ---- per frame ----
  update(dtReal) {
    dtReal = Math.min(dtReal, 1 / 20);
    if (this.freeze > 0) { this.freeze -= dtReal; this.emit('frozen', dtReal); this.anim.update(0); return; }
    if (this.slowT > 0) { this.slowT -= dtReal; if (this.slowT <= 0) this.slowK = 1; }
    const dt = dtReal * this.slowK;
    this.time += dt;
    this.arena.update(dt);
    if (this.phase === 'intro' || this.phase === 'ready') this.introTick(dt);
    if (this.phase === 'fight') { this.clock += dt; this.hype = Math.max(10, this.hype - dt * .8); }
    for (const f of this.fighters) {
      if (f.gone) continue;
      if (f.ai && (this.phase === 'fight' || f.st === 'INTRO')) f.ai.update(dt);
      else if (f.ctrl !== 'human' || this.phase !== 'fight') this.blankIntent(f);
      if (this.practice && f.ctrl !== 'human') this.practiceTick(f, dt);
      f.tick(dt);
    }
    this.grapple.update(dt);
    this.wrestle.update(dt);
    this.physics.update(dt);
    this.combat.update();
    this.stun.update(dt);
    if (this.pin) this.pinTick(dt);
    this.rulesTick(dt);
    this.refTick(dt);
    this.anim.update(dt);
    // keep broken numbers from spreading: report once and put the body back together
    for (const f of this.fighters) {
      const P = f.joints.p;
      let bad = false;
      for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) { bad = true; break; }
      if (bad) { this.emit('fault', { f, why: 'joints', info: { st: f.st, prev: f.fsm.prev, rag: !!f.rag, link: f.link && f.link.kind, move: f.link && f.link.move && f.link.move.id, clip: f.clipName, hs: f.hsKind, x: f.x, y: f.y } }); f.rag = null; f.blend = null; if (!f.link) { f.x = Number.isFinite(f.x) ? f.x : this.arena.mid; f.y = this.arena.ground(f.x, f.y, f.side); this.anim.solo(f, 0); } }
    }
  }
  blankIntent(f) { const I = f.intent; I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false; }
  introTick(dt) {
    this.introT += dt;
    if (this.phase === 'intro' && this.introT > (this.cfg.introTime || 3.2)) { this.phase = 'ready'; this.introT = 0; this.emit('ready', {}); }
    if (this.phase === 'ready' && this.introT > 1.3) { this.phase = 'fight'; for (const f of this.fighters) if (f.st === 'INTRO') f.set('IDLE', { force: true }); this.emit('bell', { start: true }); }
  }
  practiceTick(f, dt) {
    const P = this.practice;
    if (P.infinite) { f.hp = Math.max(f.hp, f.maxHp * .05); if (f.st === 'IDLE' && f.t > 1) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * dt * .5); }
    if (P.stunLock) f.stun = Math.min(f.stun, f.maxStun * .02 + (f.st === 'DOWN' ? 0 : f.stun));
    const h = this.human;
    if (P.fullFin && h) h.fin = B.finMax;
    void dt;
  }
  // S pressed on the ground: pin, tag, or nothing.
  contextS(f, I) {
    const ar = this.arena;
    if (this.rules.pin && f.side === 'in') {
      const v = f.nearestFoe(58, o => o.st === 'DOWN' && !o.rag && o.side === 'in' && (!this.mode === 'tag' || o.legal));
      if (v && !this.pin && !(this.mode === 'tag' && !v.legal)) { this.startPin(f, v); return true; }
    }
    if (this.mode === 'tag' && f.legal && f.partner && f.partner.st === 'TAGWAIT') {
      const cx = f.team === 0 ? ar.ropeL : ar.ropeR;
      if (Math.abs(f.x - cx) < B.tagRange) { this.tag(f); return true; }
    }
    void I;
    return false;
  }
  // ---- pinfall ----
  startPin(a, v) {
    if (!a.set('PIN')) return;
    v.set('PINNED', { force: true });
    a.face = sgn(v.x - a.x) || a.face; a.x = v.x - a.face * 34; a.vx = 0;
    v.pinTries = (v.pinTries || 0) + 1;
    const need = B.pinBase + B.pinPerHp * (1 - v.hp / v.maxHp) + B.pinPerTry * (v.pinTries - 1);
    this.pin = { a, v, t: 0, count: 0, next: .55, kick: 0, need, struggle: 0 };
    a.pin = v.pin = this.pin;
    this.ref.act = 'count'; this.ref.target = v;
    if (v.ai) v.ai.onPinned(this.pin);
    this.emit('pin', { a, v });
  }
  pinControl(a, I, dt) {
    const p = this.pin;
    if (!p || p.a !== a) { a.set('IDLE', { force: true }); return; }
    if (a.consume('dodge') || a.consume('grab')) this.breakPin('let');
    void I; void dt;
  }
  pinTick(dt) {
    const p = this.pin, { a, v } = p;
    p.t += dt;
    if (!a.alive || !v.alive || a.st !== 'PIN' || v.st !== 'PINNED') { this.breakPin('state'); return; }
    let n = 0;
    for (const k of ['atk', 'grab', 'dodge', 'jump']) if (v.buf[k] >= B.inputBuffer - 1e-6) n++;
    if (v.ai) n += v.ai.pinMash(p, dt);
    p.kick += n * B.pinMash * (.7 + .3 * v.stats.down) - dt * 6;
    p.kick = Math.max(0, p.kick);
    p.struggle = Math.max(0, p.struggle - dt * 4) + n * .35;
    if (p.kick >= p.need) { this.emit('kickout', { a, v, count: p.count }); this.breakPin('kickout'); return; }
    if (p.t >= p.next) {
      p.count++; p.next += B.pinStep;
      this.emit('count', { n: p.count, pin: true, a, v });
      if (p.count >= 3) { this.end({ winner: a, loser: v, how: 'pin', team: a.team }); }
    }
  }
  breakPin(why) {
    const p = this.pin;
    if (!p) return;
    this.pin = null; p.a.pin = p.v.pin = null;
    this.ref.act = 'watch'; this.ref.target = null;
    if (this.phase === 'end') return;
    const { a, v } = p;
    if (v.alive && v.st === 'PINNED') { v.stun = Math.max(v.stun, v.maxStun * .3); v.downClock = 0; v.downTime = why === 'kickout' ? .25 : .5; v.set('DOWN', { force: true }); v.grabImm = 60; v.postMove = true; }
    if (a.alive && a.st === 'PIN') { a.lieClip = 'downProne'; standUp(a, 0, 'downProne'); a.inv = .3; if (why === 'kickout') a.vx = -a.face * 40; }
    this.emit('pinBreak', { a, v, why });
  }
  // ---- tag team ----
  tag(f) {
    const p = f.partner, ar = this.arena;
    f.legal = false; p.legal = true;
    if (f.ctrl === 'human') { p.ctrl = 'human'; f.ctrl = 'ai'; if (!f.ai) f.ai = new AIController(f, 'normal', this.rng); p.ai = null; }
    else if (p.ctrl === 'ai' && !p.ai) p.ai = new AIController(p, this.cfg.entrants[p.idx].difficulty || 'normal', this.rng);
    f.exitTo = 'apron';
    f.enter = { x0: f.x, y0: f.y, x1: f.team === 0 ? ar.ropeL - 9 : ar.ropeR + 9, left: f.team === 0 };
    f.set('EXIT_RING', { force: true });
    p.inv = .8;
    beginEnter(p);
    p.wantTag = false;
    this.addHype(10);
    this.emit('tag', { f, p });
  }
  // ---- rules ----
  koAllowed() { return !!this.rules.ko; }
  onZeroHp(v, a) {
    if (this.phase === 'end') return;
    if (this.practice) { v.hp = this.practice.infinite ? v.maxHp * .05 : 0; return; }
    if (!this.rules.ko) { v.hp = 0; return; }
    if (v.link) { v.koPending = a; return; }
    if (v.rag && (v.st === 'HITSTUN' || v.st === 'DOWN')) { v.set('KO', { force: true }); v.koBy = a; this.afterKO(v, a); return; }
    this.knockOut(v, a, (a ? sgn(v.x - a.x) : 1) * 140, -160, 3);
  }
  knockOut(v, a, vx, vy, spin) {
    if (v.st === 'KO') return;
    if (v.link) { v.koPending = a; return; }
    v.set('KO', { force: true });
    if (!v.rag) v.ragdoll(vx, vy, spin);
    v.koBy = a;
    this.afterKO(v, a);
  }
  afterKO(v, a) {
    v.expr = 'ko'; v.exprT = 99;
    this.emit('ko', { v, a });
    if (a) a.kills++;
    if (this.mode === 'royal' || this.mode === 'tag' && false) this.eliminate(v, 'ko');
    this.checkWin();
  }
  eliminate(f, how) {
    if (f.eliminated) return;
    f.eliminated = true; f.outHow = how; f.outAt = this.clock;
    if (f.st !== 'KO') f.set('OUT', { force: true });
    if (f.lastHitBy && f.lastHitBy !== f) f.lastHitBy.kills++;
    if (f.link) { if (f.link.kind === 'hold') this.grapple.breakLink(f.link, 'out'); }
    this.emit('eliminated', { f, how, left: this.alive().length });
    this.checkWin();
  }
  alive() { return this.fighters.filter(f => !f.eliminated && f.st !== 'KO'); }
  rulesTick(dt) {
    const ar = this.arena;
    for (const f of this.fighters) {
      if (f.gone) continue;
      // over the top rope and onto the floor
      if (ar.hasRing && f.side === 'out' && !f.eliminated && this.phase === 'fight') {
        const onFloor = f.y >= ar.floorY - 2 && (f.ground || (f.rag && f.rag.ground));
        if (this.rules.ringOut === 'elim' && onFloor && f.wasIn && f.st !== 'ENTER_RING' && f.st !== 'TAGWAIT') { f.ringOuts++; this.eliminate(f, 'ringout'); continue; }
        if (this.rules.ringOut === 'count' && onFloor && this.mode !== 'practice' && f.st !== 'TAGWAIT' && (this.mode !== 'tag' || f.legal)) {
          f.outCount += dt / B.countStep;
          if (Math.floor(f.outCount) !== Math.floor(f.outCount - dt / B.countStep)) this.emit('count', { n: Math.floor(f.outCount), out: true, f });
          if (f.outCount >= B.countMax) this.countOut(f);
        }
      } else if (f.side === 'in') { f.outCount = Math.max(0, f.outCount - dt * 4); f.wasIn = true; }
      // a ragdoll flying over the ropes may grab the top rope
      if (f.ropeChance > 0) { f.ropeChance -= dt; if (f.rag && f.has('dodge') && f.hp > 0) { f.ropeChance = 0; this.toHang(f); } else if (f.rag && f.ai && f.ai.wantsHang()) { f.ropeChance = 0; this.toHang(f); } }
    }
    // rumble entries
    if (this.mode === 'rumble' && this.phase === 'fight' && this.queue.length) {
      this.nextEntry -= dt;
      const inRing = this.alive().length;
      if (this.nextEntry <= 0 && inRing < B.rumbleMaxInRing || inRing < 2) { this.nextEntry = this.cfg.interval || B.rumbleInterval; this.rumbleEntry(); }
    }
    // tag partners heal on the apron
    if (this.mode === 'tag') for (const f of this.fighters) if (f.st === 'TAGWAIT' && f.alive) {
      const cap = f.maxHp * (1 - B.tagMaxHeal * 0) - 0;
      f.hp = Math.min(cap, f.hp + B.tagHeal * dt * (f.hp < f.maxHp * .5 ? 1.3 : 1) * .5); f.stun = Math.min(f.maxStun, f.stun + B.tagStun * dt);
      const mate = f.partner;
      f.wantTag = mate && mate.legal && mate.alive && Math.abs(mate.x - f.x) < 90;
    }
    if (this.rules.time && this.phase === 'fight' && this.clock >= this.rules.time) this.timeUp();
    // last two standing who cannot finish each other: the referee calls it after a long stalemate
    if ((this.mode === 'rumble' || this.mode === 'royal') && this.phase === 'fight' && !this.queue.length && this.alive().length === 2) {
      this.stalemate = (this.stalemate || 0) + dt;
      if (this.stalemate > 100) { const [x, y] = this.alive(), sc = f => f.hp / f.maxHp * 2 + Math.max(0, f.stun) / f.maxStun - f.downs * .02; const w = sc(x) >= sc(y) ? x : y; this.end({ winner: w, loser: w === x ? y : x, how: 'decision', team: w.team }); }
    } else this.stalemate = 0;
  }
  toHang(f) {
    const ar = this.arena;
    f.x = f.x < ar.mid ? ar.ropeL - 9 : ar.ropeR + 9;
    f.dropRag(); f.side = 'out'; f.hangT = B.hangTime; f.hangMash = 0;
    f.set('HANG', { force: true });
    this.emit('hang', { f });
  }
  onOverRope(f) { if (this.rules.ringOut === 'elim' && f.rag && !f.eliminated) f.ropeChance = .32; }
  rumbleEntry() {
    const e = this.queue.shift(), ar = this.arena;
    const left = this.rng.chance(.5);
    const f = this.addFighter(e, this.fighters.length, { x: left ? ar.x0 + 30 : ar.x1 - 30, y: ar.floorY, face: left ? 1 : -1, side: 'out' });
    f.inv = 1.5;
    f.fsm.set('IDLE', { force: true });
    f.entering = { left, t: 0 };
    this.emit('entry', { f, left: this.queue.length });
  }
  countOut(f) {
    if (this.phase === 'end') return;
    const foes = this.fighters.filter(o => o.isFoe(f) && !o.eliminated && o.st !== 'KO');
    const inside = foes.filter(o => o.side === 'in');
    if (!inside.length && foes.every(o => o.outCount >= B.countMax - .05)) { this.end({ draw: true, how: 'double countout' }); return; }
    const w = inside[0] || foes[0];
    this.end({ winner: w, loser: f, how: 'countout', team: w ? w.team : null });
  }
  timeUp() {
    // decision: health percentage
    const teams = new Map();
    for (const f of this.fighters) { const t = teams.get(f.team) || { s: 0, f }; t.s += f.eliminated ? 0 : f.hp / f.maxHp; teams.set(f.team, t); }
    const list = [...teams.values()].sort((a, b) => b.s - a.s);
    if (list.length < 2 || Math.abs(list[0].s - list[1].s) < .04) { this.end({ draw: true, how: 'time' }); return; }
    const w = list[0].f;
    this.end({ winner: w, loser: list[1].f, how: 'decision', team: w.team });
  }
  checkWin() {
    if (this.phase === 'end' || this.practice) return;
    if (this.mode === 'tag') {
      for (const f of this.fighters) if (f.st === 'KO' && f.legal) { const w = this.fighters.find(o => o.team !== f.team && o.legal) || this.fighters.find(o => o.team !== f.team); this.end({ winner: w, loser: f, how: 'ko', team: w.team }); return; }
      return;
    }
    const alive = this.alive();
    if (this.mode === 'rumble' && this.queue.length) return;
    const teams = new Set(alive.map(f => f.team));
    if (teams.size <= 1) {
      const w = alive[0] || null, loser = this.fighters.filter(f => f !== w).sort((a, b) => (b.outAt || 9999) - (a.outAt || 9999))[0];
      const how = loser ? (loser.st === 'KO' ? 'ko' : loser.outHow || 'ko') : 'ko';
      this.end({ winner: w, loser, how, team: w ? w.team : null });
    }
  }
  end(r) {
    if (this.phase === 'end') return;
    this.phase = 'end'; this.result = r; this.endT = 0;
    if (this.pin) this.breakPin('end');
    this.slowmo(.3, 1.3);
    this.emit('end', r);
    this.ref.act = 'raise'; this.ref.raise = r.winner || null;
  }
  // ---- referee ----
  refTick(dt) {
    const r = this.ref, ar = this.arena;
    if (!ar.hasRing) return;
    r.t += dt;
    let tx = r.x;
    if (r.act === 'count' && r.target) tx = r.target.x + (r.target.x < ar.mid ? 40 : -40);
    else if (r.act === 'raise' && r.raise) tx = r.raise.x + (r.raise.x < ar.mid ? 30 : -30);
    else {
      const act = this.fighters.filter(f => f.alive && f.side === 'in');
      if (act.length) {
        const cx = act.reduce((s, f) => s + f.x, 0) / act.length;
        // stand clear of the action, on the emptier side
        const left = cx - ar.ropeL, right = ar.ropeR - cx;
        tx = Math.abs(r.x - (cx - 100)) < Math.abs(r.x - (cx + 100)) && left > 120 ? cx - 100 : right > 120 ? cx + 100 : cx - 100;
        for (let it = 0; it < 3; it++) for (const f of act) if (Math.abs(f.x - tx) < 46) tx = f.x + (tx >= f.x ? 48 : -48);
      }
    }
    tx = clamp(tx, ar.ropeL + 22, ar.ropeR - 22);
    const d = tx - r.x;
    const crowded = this.fighters.some(f => f.alive && f.side === 'in' && Math.abs(f.x - r.x) < 36);
    r.vx = Math.abs(d) > 6 ? sgn(d) * Math.min(crowded ? 210 : 150, Math.abs(d) * 4) : 0;
    r.x += r.vx * dt;
    if (r.vx) r.face = sgn(r.vx); else if (r.target) r.face = sgn(r.target.x - r.x) || r.face;
    r.gait += Math.abs(r.vx) * dt * .07;
  }
  summary() {
    return this.fighters.map(f => ({ name: f.name, char: f.charId, team: f.team, hp: f.hp, maxHp: f.maxHp, dmgTaken: f.dmgTaken, dmgDealt: f.dmgDealt, downs: f.downs, ko: f.st === 'KO', out: f.eliminated, finishersTaken: f.finishersTaken, ringOuts: f.ringOuts, kills: f.kills, perfects: f.perfects, counters: f.counters, hits: f.hitsLanded, moves: f.movesDone.size }));
  }
}
