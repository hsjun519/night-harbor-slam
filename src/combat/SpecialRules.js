// Special matches: the ladder match (a folding A-frame ladder and a case hanging over the ring), the steel cage (climb
// the wall and get over the top), hell in a cell (walls round the whole floor), best of three falls and the iron man,
// and a boss that grows stronger as the match turns against it. The match manager asks this before it ends the match
// or calls time. Climbing is one system for the ladder and the cage: punch the one level with you, kick the one below,
// pull the one above down by the leg; a fall from up there keeps you down a long while.
import { sgn, clamp } from '../core/util.js';
import { BALANCE as B, ATTACKS } from '../data/balance.js';
import { STATES } from './StateMachine.js';

export const SPECIAL = {
  ladder: { name: '래더 매치', short: '래더', desc: '링 중앙의 접이식 사다리를 펼쳐 오르고, 꼭대기에서 타이밍을 맞춰 매달린 가방을 떼어 내면 승리.', rules: { ko: false, pin: false, ringOut: 'none', time: 480, ladder: true } },
  cage: { name: '스틸 케이지', short: '케이지', desc: '철창 안의 승부. KO·핀폴, 또는 철창 벽을 올라 꼭대기를 넘으면 승리.', rules: { ko: true, pin: true, ringOut: 'none', leave: false, ringOutThrow: false, time: 480, cage: true } },
  cell: { name: '헬 인 어 셀', short: '셀', desc: '링 밖 바닥까지 덮은 거대한 철창. 장외 카운트가 없다. KO나 핀폴만이 끝.', rules: { ko: true, pin: true, ringOut: 'none', time: 480, cell: true } },
};
export function specialRules(cfg) {
  const S = SPECIAL[cfg.special], r = {};
  if (S) Object.assign(r, S.rules);
  if (cfg.falls || cfg.iron) Object.assign(r, { ko: true, pin: true });
  if (cfg.iron) r.time = cfg.iron;
  return r;
}
const NAMES = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째', '일곱 번째'];
const CLIMB = new Set(['LADDER', 'CAGE_CLIMB']);

export class SpecialRules {
  constructor(m, cfg) {
    this.m = m; this.type = SPECIAL[cfg.special] ? cfg.special : null; this.def = SPECIAL[this.type] || null;
    this.falls = cfg.falls || 0; this.iron = cfg.iron || 0; this.score = {}; this.fallN = 0; this.sudden = false;
    this.boss = cfg.bossPhases ? Object.assign({ by: ['fall', 'kickout'], max: 3 }, typeof cfg.bossPhases === 'object' ? cfg.bossPhases : {}) : null;
    const ar = m.arena;
    if (this.type === 'ladder') {
      // folded and lying in the middle of the ring: somebody has to stand it up
      this.ladder = { x: ar.mid, state: 'folded', k: 0, t: 0, by: null, dir: 1, foldCd: 0 };
      this.prize = { x: ar.mid, y: ar.matY - B.ladderPrizeY, hits: 0, need: B.ladderHits, sway: 0, taken: null };
    }
    if (this.type === 'cage') { ar.cageH = B.cageH; m.on('ropeBody', e => this.wallHit(e.f, 3, 8, 'cageHit')); }
    if (this.type === 'cell') m.on('wall', e => this.wallHit(e.f, 4, 10, 'cellHit'));
    if (this.boss) m.on('kickout', e => { if (this.boss.by.includes('kickout') && e.v.boss) this.bossUp(e.v, 'kickout'); });
  }
  get multi() { return this.falls > 0 || this.iron > 0; }
  // ---- per frame
  update(dt) {
    const m = this.m;
    for (const f of m.fighters) if (f.cageCd > 0) f.cageCd -= dt;
    const L = this.ladder;
    if (L) {
      this.prize.sway += dt;
      if (L.foldCd > 0) L.foldCd -= dt;
      if (L.state === 'rising') {
        L.t += dt; L.k = Math.min(1, L.t / B.ladderSet);
        const by = L.by;
        if (!by || !by.alive || !by.fsm.is('IDLE', 'MOVE')) { L.state = 'folded'; L.k = 0; L.by = null; m.emit('ladderDrop', {}); }   // knocked away from it: it falls flat again
        else if (L.k >= 1) { L.state = 'open'; L.by = null; m.emit('ladderUp', { by }); }
      } else if (L.state === 'closing') {
        L.t += dt; L.k = Math.max(0, 1 - L.t / .55);
        if (L.k <= 0) { L.state = 'folded'; L.k = 0; }
      }
    }
    if (this.boss && this.boss.by.includes('hp') && m.phase === 'fight') for (const f of m.fighters) if (f.boss) { const k = f.hp / f.maxHp, want = 1 + (k <= .7 ? 1 : 0) + (k <= .35 ? 1 : 0); while ((f.bossPhase || 1) < Math.min(want, this.boss.max)) this.bossUp(f, 'hp'); }
  }
  win(f, how) {
    const m = this.m, loser = m.fighters.find(o => o.isFoe(f) && !o.eliminated) || null;
    m.end({ winner: f, loser, how, team: f.team, final: true, score: this.multi ? Object.assign({}, this.score) : null });
  }
  // ---- falls: the match manager asks before it ends the match
  onEnd(r) {
    const m = this.m;
    if (!this.multi || r.final || !r.winner || r.draw) return false;
    if (!['ko', 'pin', 'countout', 'ringout', 'escape'].includes(r.how)) return false;
    const t = r.winner.team;
    this.score[t] = (this.score[t] || 0) + 1; this.fallN++;
    r.score = Object.assign({}, this.score);
    m.emit('fall', { r, score: r.score, n: this.fallN, name: NAMES[this.fallN - 1] || `${this.fallN}번째`, winner: r.winner, loser: r.loser });
    if (this.falls && this.score[t] >= this.falls) { r.final = true; return false; }
    if (this.iron && this.sudden) { r.final = true; return false; }
    this.nextFall(r);
    return true;
  }
  onTimeUp() {
    const m = this.m;
    if (!this.multi) return false;
    const teams = [...new Set(m.fighters.map(f => f.team))], sc = teams.map(t => this.score[t] || 0);
    const best = Math.max(...sc), lead = teams.filter((t, i) => sc[i] === best);
    if (lead.length === 1 && best > 0) {
      const w = m.fighters.find(f => f.team === lead[0]), l = m.fighters.find(f => f.team !== lead[0]);
      m.end({ winner: w, loser: l, how: this.iron ? 'iron' : 'falls', team: w.team, final: true, score: Object.assign({}, this.score) });
      return true;
    }
    if (this.iron && !this.sudden) { this.sudden = true; m.rules.time = 0; m.emit('suddenDeath', {}); return true; }
    return false;
  }
  // a short break, both back on their feet in their corners, the loser of the fall with a little breath back
  nextFall(r) {
    const m = this.m, ar = m.arena, l = r.loser;
    if (m.pin) { const p = m.pin; m.pin = null; p.a.pin = p.v.pin = null; m.ref.act = 'watch'; m.ref.target = null; }
    for (const L of m.links.slice()) { if (L.kind === 'hold') m.grapple.breakLink(L, 'fall'); else m.wrestle.unlink(L); }
    for (const f of m.fighters) if (f.prop) m.props.drop(f, 'fall', -f.face);
    for (const f of m.fighters) {
      if (f.eliminated) continue;
      f.dropRag(); f.atk = null; f.follow = null; f.seat = null; f.climb = null; f.hang = null; f.koPending = null; f.link = null; f.pin = null;
      if (f === l) { f.hp = Math.min(f.maxHp, Math.max(f.hp, f.maxHp * .25) + f.maxHp * .15); f.stun = f.maxStun * .75; }
      else { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * .06); f.stun = Math.max(f.stun, f.maxStun * .6); }
      f.side = ar.hasRing ? 'in' : f.side; f.y = ar.hasRing ? ar.matY : ar.ground(f.x, f.y, f.side); f.vx = f.vy = 0; f.ground = true; f.outCount = 0;
      f.x = f.team === 0 ? ar.mid - 100 : ar.mid + 100; f.face = f.team === 0 ? 1 : -1;
      f.expr = 'neutral'; f.exprT = 0; f.moveChain = 0; f.postMove = false; f.grabImm = 0; f.inv = .5;
      f.set('IDLE', { force: true });
    }
    if (this.boss && this.boss.by.includes('fall') && l && l.boss) this.bossUp(l, 'fall');
    m.phase = 'ready'; m.introT = -1.2;
    m.emit('fallReset', { score: Object.assign({}, this.score) });
  }
  // ---- the boss
  bossUp(f, why) {
    const k = (f.bossPhase || 1) + 1;
    if (!this.boss || k > this.boss.max) return;
    f.bossPhase = k;
    const s = f.stats;
    s.atk *= 1.12; s.kbr *= 1.08; s.rec *= 1.1; s.grp *= 1.06;
    f.maxStun *= 1.1; f.stun = Math.max(f.stun, f.maxStun * .55);
    if (f.ai) { const D = Object.assign({}, f.ai.D); D.react *= .85; D.counter = Math.min(.5, D.counter + .05); D.aggr = Math.min(1.35, D.aggr + .1); D.pick = Math.min(1, D.pick + .05); D.punish = Math.min(.95, D.punish + .08); D.rev = Math.min(.5, D.rev + .04); f.ai.D = D; }
    this.m.emit('bossPhase', { f, phase: k, why, names: this.boss.names || null });
  }
  // ---- walls
  wallHit(f, hp, stun, ev) {
    if (!f || f.cageCd > 0 || !f.alive) return;
    f.cageCd = .7;
    this.m.combat.damage(f, hp, stun, f.lastHitBy || null, { src: 'wall' });
    this.m.emit(ev, { f });
  }
  // somebody is getting away with it: the one on the floor finds the strength to get up sooner
  rally(f) {
    if (!this.type) return 1;
    for (const o of this.m.fighters) if (f.isFoe(o) && ((o.climb && (o.st === 'CAGE_CLIMB' ? o.climb.p > .3 : o.st === 'LADDER' && o.climb.p >= 1)) || o.st === 'CASE_HANG')) return B.climbRally;
    return 1;
  }
  // ==================================================================== climbing (ladder and cage)
  climbers(f, kind) { return this.m.fighters.filter(o => o !== f && o.alive && o.climb && o.st === (kind === 'ladder' ? 'LADDER' : 'CAGE_CLIMB') && (kind === 'ladder' || o.climb.side === f.climb.side)); }
  place(f) {
    const c = f.climb, ar = this.m.arena;
    if (c.kind === 'ladder') {
      const L = this.ladder, top = c.p >= 1;
      f.x = L.x + c.side * (B.ladderSpread * (1 - c.p) + 13); f.y = ar.matY - c.p * B.ladderH;
      f.face = top ? (c.aim || -c.side) : -c.side;
    } else {
      const rx = c.side < 0 ? ar.ropeL : ar.ropeR, over = c.over != null ? Math.min(1, c.over / B.cageOver) : 0;
      f.x = rx - c.side * (4 + c.slot * 26) + c.side * over * 26; f.y = ar.matY - c.p * B.cageH - over * 8;
      f.face = c.look || c.side;
    }
    f.vx = f.vy = 0; f.ground = true; f.side = 'in';
  }
  // W next to the open ladder: up the free side nearest to you
  ladderClimb(f) {
    const L = this.ladder;
    if (!L || L.state !== 'open' || f.side !== 'in' || this.m.phase !== 'fight' || Math.abs(f.x - L.x) > B.ladderSpread + 22) return false;
    let side = sgn(f.x - L.x) || -f.face;
    const taken = s => this.m.fighters.some(o => o !== f && o.st === 'LADDER' && o.climb && o.climb.side === s);
    if (taken(side)) { if (taken(-side)) return false; side = -side; }
    f.climb = { kind: 'ladder', p: 0, side, aim: 0, rock: 0, meter: null };
    f.set('LADDER', { force: true }); this.place(f);
    this.m.emit('ladderClimb', { f });
    return true;
  }
  // W against the ropes in the cage: up the wall (two can climb one wall)
  cageClimbStart(f, I) {
    const m = this.m, ar = m.arena;
    if (!m.rules.cage || f.side !== 'in' || m.phase !== 'fight') return false;
    const nr = ar.nearRope(f.x);
    if (nr.dist > 32 || (Math.abs(I.mx) > .3 ? sgn(I.mx) : f.face) !== nr.dir) return false;
    const used = m.fighters.filter(o => o !== f && o.st === 'CAGE_CLIMB' && o.climb && o.climb.side === nr.dir).map(o => o.climb.slot);
    const slot = used.includes(0) ? (used.includes(1) ? -1 : 1) : 0;
    if (slot < 0) return false;
    f.climb = { kind: 'cage', p: 0, side: nr.dir, slot, rock: 0, over: null, look: nr.dir };
    f.set('CAGE_CLIMB', { force: true }); this.place(f);
    m.emit('cageClimb', { f });
    return true;
  }
  // one frame on the ladder or the cage; false: they come off
  climbTick(f, I, dt) {
    const c = f.climb, m = this.m;
    if (!c) return false;
    if (c.kind === 'ladder' && (!this.ladder || this.ladder.state !== 'open')) return false;
    if (c.rock > 0) c.rock -= dt;
    if (f.climbAnim > 0) f.climbAnim -= dt;
    const top = c.kind === 'ladder' ? c.p >= 1 : c.over != null;
    // facing: at the top of the ladder A/D picks the side to come down; on the cage A/D looks in or out
    if (Math.abs(I.mx) > .3) { if (c.kind === 'ladder' && top) c.aim = sgn(I.mx); else if (c.kind === 'cage' && c.over == null) c.look = sgn(I.mx); }
    this.place(f);   // face the new way before an attack this frame
    if (f.consume('atk')) this.climbAttack(f);
    else if (f.consume('grab')) this.climbGrab(f);
    if (f.climb !== c || !CLIMB.has(f.st)) return true;   // the attack sent them off (a dive)
    const rate = c.kind === 'ladder' ? B.ladderClimb : B.cageClimb;
    if (c.over != null) {
      c.over += dt;
      if (c.over >= B.cageOver) { const ar = m.arena, rx = c.side < 0 ? ar.ropeL : ar.ropeR; f.climb = null; f.side = 'out'; f.x = rx + c.side * 34; f.y = ar.floorY; f.ground = true; f.set('IDLE', { force: true }); m.emit('cageEscape', { f }); this.win(f, 'escape'); return true; }
    } else if (I.down && !I.up) {
      if (c.kind === 'ladder' && c.p >= 1 && c.aim && c.aim !== c.side && !this.climbers(f, 'ladder').some(o => o.climb.side === c.aim)) { c.side = c.aim; c.meter = null; m.emit('ladderCross', { f }); }   // over the top to the other side
      c.p -= dt * 1.7;
      if (c.p <= 0) { f.climb = null; this.place0(f, c); f.set('IDLE', { force: true }); return true; }
    } else if (I.up && c.rock <= 0 && !(c.kind === 'ladder' && c.p >= 1)) {
      c.p = Math.min(1, c.p + dt / rate * (.85 + .15 * f.stats.spd));
      if (c.kind === 'cage' && c.p >= 1) { c.over = 0; m.emit('cageTop', { f }); }
    } else if (c.kind === 'cage') c.p = Math.max(0, c.p - dt * .03);
    if (c.kind === 'ladder' && c.p >= 1) this.meterTick(f, dt);
    this.place(f);
    return true;
  }
  place0(f, c) { const ar = this.m.arena; f.y = ar.matY; f.ground = true; f.side = 'in'; if (c.kind === 'ladder') f.x = this.ladder.x + c.side * (B.ladderSpread + 14); else f.x = (c.side < 0 ? ar.ropeL : ar.ropeR) - c.side * 16; }
  // J up there: punch the one level with you, kick the one below, kick somebody on the floor underneath, or dive
  climbAttack(f) {
    const c = f.climb, m = this.m, others = this.climbers(f, c.kind).filter(o => f.isFoe(o));
    const level = others.find(o => Math.abs(o.climb.p - c.p) <= B.climbReach * .5);
    if (level) { this.climbHit(f, level, 'punch'); return; }
    const below = others.find(o => o.climb.p < c.p && c.p - o.climb.p <= B.climbReach);
    if (below) { this.climbHit(f, below, 'kick'); return; }
    if (c.p < .7) {
      const g = m.fighters.find(o => f.isFoe(o) && o.alive && !o.climb && o.ground && o.side === 'in' && Math.abs(o.x - f.x) < 36 && STATES[o.st].hit && !o.link);
      if (g) { f.climbAnim = .3; m.combat.damage(g, 4, 10, f, { src: 'climb' }); if (g.alive && g.st !== 'KO') { m.combat.stagger(g, B.climbKickStagger, f); g.vx = (sgn(g.x - f.x) || -f.face) * 140; } m.emit('climbKick', { a: f, v: g }); return; }
    }
    if (c.p >= .3 && c.over == null) this.climbDive(f);
  }
  // K up there: the one above you by the leg; at the top of the ladder, the case
  climbGrab(f) {
    const c = f.climb, m = this.m;
    const above = this.climbers(f, c.kind).find(o => f.isFoe(o) && o.climb.p > c.p + .06 && o.climb.p - c.p <= B.climbReach + .1);
    if (above) { f.climbAnim = .35; this.knockOff(above, f, sgn(above.x - f.x) || c.side); c.p = Math.max(0, c.p - B.climbPullSlip); c.rock = .4; if (c.over != null) c.over = null; m.emit('legPull', { a: f, v: above }); return; }
    if (c.kind === 'ladder' && c.p >= 1) this.casePress(f);
  }
  // a blow up there: the first rocks them and they slip down; the second (or a kick low down) knocks them off
  climbHit(a, v, kind) {
    const vc = v.climb, m = this.m;
    a.climbAnim = .3;
    m.combat.damage(v, kind === 'punch' ? 4 : 5, 12, a, { src: 'climb' });
    if (v.st === 'KO' || !v.climb) return;
    if (vc.rock > 0 || vc.p < .2 || (kind === 'kick' && vc.p < .4)) this.knockOff(v, a, sgn(v.x - a.x) || -a.face);
    else { vc.rock = B.climbRock; vc.p = Math.max(.05, vc.p - (kind === 'kick' ? .28 : .16)); if (vc.over != null) vc.over = null; v.flash = .1; v.hitShake = .2; }
    m.hitstop(.06);
    m.emit('climbHit', { a, v, kind });
  }
  climbDive(f) {
    const m = this.m, c = f.climb;
    const n = f.nearestFoe(320, o => o.side === 'in' && !o.climb && sgn(o.x - f.x) === f.face && Math.abs(o.x - f.x) > 24);
    if (!n) return false;
    const down = n.st === 'DOWN' || n.st === 'GET_UP' || (n.st === 'HITSTUN' && n.hsKind === 'lie');
    const d = down ? (ATTACKS[f.char.dive] || ATTACKS.diveElbow) : (ATTACKS[f.char.topStand] || ATTACKS.missileDropkick);
    const h = c.kind === 'ladder' ? c.p * B.ladderH : c.p * B.cageH, dx = Math.abs(n.x - f.x), T = .62 + h / 400;
    f.climb = null;
    f.set('JUMP', { force: true });
    f.vy = -180; f.vx = f.face * clamp(dx / T, 60, 320); f.ground = false;
    f.set('AIR_ATTACK', { force: true });
    f.atk = { def: d, t: 0, hit: new Set(), connected: false, chain: -1, boost: 1 + h / 100 * B.climbDiveBoost, done: false };
    m.addHype(8);
    m.emit('dive', { f, high: true });
    m.emit('climbDive', { f, h });
    return true;
  }
  // off the ladder or the wall: hurt by the height, and down for a long while
  knockOff(v, a, dir) {
    const m = this.m, c = v.climb, h = c ? c.p : .5;
    v.climb = null; v.hang = null;
    m.combat.damage(v, 3 + h * 7, 8 + h * 18, a, { src: 'fall' });
    if (v.st === 'KO' || !v.alive) return;
    v.atk = null;
    v.set('DOWN', { force: true });
    v.ragdoll(dir * 110, -70, dir * 2.5);
    v.downClock = 0; v.downTime = B.climbFallDown * (.5 + .5 * h); v.grabImm = 1.2; v.postMove = true; v.downs++;
    m.hitstop(.08);
    m.emit('climbFall', { v, a, h });
  }
  // ---- from the floor: K stands the folded ladder up, folds it under the climbers, or (see pullDown) takes a low climber
  ladderGrab(f) {
    const L = this.ladder, m = this.m;
    if (!L || f.side !== 'in') return false;
    if (L.state === 'folded' && Math.abs(f.x - L.x) < 64) { L.state = 'rising'; L.t = 0; L.by = f; f.landT = B.ladderSet + .05; f.vx = 0; f.face = sgn(L.x - f.x) || f.face; m.emit('ladderRaise', { f }); return true; }
    if (L.state === 'open' && Math.abs(f.x - L.x) < B.ladderSpread + 26 && L.foldCd <= 0) {
      L.state = 'closing'; L.t = 0; L.dir = sgn(L.x - f.x) || 1; L.foldCd = B.ladderFoldCd; f.landT = .35;
      for (const o of m.fighters) if (o.st === 'LADDER' && o.climb) {
        if (o.climb.p >= 1 && o.climb.meter && o.climb.meter.used) this.toHang(o);   // hands on the case: left hanging from it
        else this.knockOff(o, f, o.climb.side);
      }
      m.emit('ladderFold', { by: f });
      return true;
    }
    return false;
  }
  pullDown(f) {
    const m = this.m;
    for (const o of m.fighters) {
      if (!f.isFoe(o) || !CLIMB.has(o.st) || !o.climb || o.climb.p > B.climbPullMax || Math.abs(o.x - f.x) > 46) continue;
      f.face = sgn(o.x - f.x) || f.face; f.landT = .35;
      this.knockOff(o, f, o.st === 'CAGE_CLIMB' ? -o.climb.side : sgn(o.x - f.x) || f.face);
      m.emit('pullDown', { a: f, v: o });
      return true;
    }
    return false;
  }
  // ==================================================================== the case: a timing meter whose count stays with the case
  meterTick(f, dt) {
    const c = f.climb;
    if (!c.meter) c.meter = { n: 0, dir: 1, z: this.zone(), fumble: 0, used: false };
    this.meterRun(f, c.meter, dt);
  }
  meterRun(f, M, dt) {
    const P = this.prize;
    if (M.fumble > 0) M.fumble -= dt;
    M.n += M.dir * (B.caseSpeed + P.hits * B.caseSpeedUp) * dt;
    if (M.n > 1) { M.n = 2 - M.n; M.dir = -1; } else if (M.n < 0) { M.n = -M.n; M.dir = 1; }
    if (f.ctrl === 'ai' && f.ai && M.fumble <= 0 && !P.taken) {   // the computer presses when it sees the needle in the zone, and sometimes too early
      const D = f.ai.D, inZ = M.n >= M.z[0] && M.n <= M.z[1];
      if (inZ && f.ai.rng.chance(dt * (1.2 + D.pick * 3))) this.casePress(f);
      else if (!inZ && f.ai.rng.chance(dt * D.err * 1.4)) this.casePress(f);
    }
  }
  zone() {
    const P = this.prize, w = Math.max(B.caseZoneMin, B.caseZone - P.hits * B.caseZoneStep), r = this.m.rng.next();
    const c = .1 + w / 2 + r * (.8 - w);
    return [c - w / 2, c + w / 2];
  }
  casePress(f) {
    const c = f.climb || f.hang, P = this.prize, m = this.m;
    const M = c && c.meter;
    if (!M || M.fumble > 0 || P.taken) return;
    M.used = true;
    if (M.n >= M.z[0] && M.n <= M.z[1]) {
      P.hits++; M.z = this.zone();
      m.emit('caseHit', { f, hits: P.hits, need: P.need });
      if (P.hits >= P.need) { P.taken = f; this.win(f, 'ladder'); }
    } else { M.fumble = B.caseFumble; m.emit('caseMiss', { f, hits: P.hits }); }
  }
  // the ladder folded under you while your hands were on the case: you hang there a while, and can still finish it
  toHang(f) {
    const c = f.climb;
    f.climb = null;
    f.hang = { t: B.caseHang, meter: c.meter };
    f.set('CASE_HANG', { force: true });
    this.hangPlace(f);
    this.m.emit('caseHang', { f });
  }
  hangPlace(f) { const P = this.prize; f.x = P.x; f.y = P.y + 16 + f.dims.height * .95; f.vx = f.vy = 0; f.ground = true; f.side = 'in'; }
  hangTick(f, I, dt) {
    const H = f.hang;
    if (!H) return false;
    H.t -= dt;
    if (H.meter) { this.meterRun(f, H.meter, dt); if (f.consume('grab')) this.casePress(f); }
    if (this.prize.taken) return true;
    this.hangPlace(f);
    if (H.t <= 0) this.dropHang(f, null);
    return true;
  }
  dropHang(f, a) {
    f.hang = null;
    f.set('DOWN', { force: true });
    f.ragdoll(0, 40, 0);
    f.downClock = 0; f.downTime = B.climbFallDown * .5; f.grabImm = .8; f.postMove = true;
    this.m.emit('climbFall', { v: f, a, h: .5 });
  }
}
