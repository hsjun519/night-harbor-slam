// Run-ins during career matches. cfg.events is a list of plans:
//   { kind: 'bossChair', at }               the boss walks up to the ring and tosses a chair at the player
//   { kind: 'coachChair', when, below, at } the opponent's coach distracts the referee and slides a chair in
//   { kind: 'chairs', xs: [x, ...] }        chairs lying around from the start
// The people who run in are "cameos": not fighters, no hit boxes. MatchScene draws them and their speech.
import { CHARACTERS } from '../data/characters.js';
import { clamp, sgn, pick } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';
import { LOOKS } from '../data/looks.js';

const LINES = {
  bossShout: ['관객이 하품한다! 자, 선물이다!', '쇼는 이렇게 하는 거야! 받아라!', '표 값은 해야지! 이거나 먹게!'],
  bossHit: ['하하! 시청률 폭발이다!', '바로 그거야! 신문 1면이다!', '좋아, 관객이 일어섰어!'],
  bossMiss: ['…피하면 어떡하나! 의자 값이 얼만데!', '어허, 몸놀림은 좋군!', '그 의자, 써먹기라도 하게!'],
  bossCatch: ['오호, 받아 냈군! 쓸 줄은 알지?', '역시 내가 고른 선수야!'],
  rivalIn: ['BLACK ROPE를 잊었나?', '재밌어 보이는군. 끼워 줘야지!', '이건 축하 선물이다!'],
  rivalHit: ['다음은 링 위에서 보자.', '이게 BLACK ROPE다!', '박수! 박수!'],
  rivalMiss: ['…쳇, 운 좋은 녀석.', '피했다고? 다음엔 안 놓친다.'],
  rivalCatch: ['내 의자를…?!', '…돌려줘라, 그거.'],
  coachIn: ['심판님! 저기 관객석에 흉기가!', '심판! 신발 끈 풀렸어요, 신발 끈!', '심판님, 저 사람 손에 기름 발랐어요!'],
  coachSlide: ['받아! 이걸로 끝내 버려!', '지금이야! 의자!'],
  coachCheer: ['때려! 때려!', '그렇지! 그거야!', '심판은 내가 붙잡고 있을게!'],
  coachSad: ['아이고, 그걸 뺏기면 어떡해!', '…난 아무것도 안 했다.'],
};

export class MatchEvents {
  constructor(m, plan) {
    this.m = m; this.cameos = [];
    this.plan = (plan || []).map(e => Object.assign({}, e, { done: false }));
    const pre = this.plan.find(e => e.kind === 'chairs');
    if (pre) { pre.done = true; this.chairs(pre); }
  }
  get busy() { return this.cameos.length > 0; }
  foeOf(f) { return f && this.m.fighters.find(o => o.isFoe(f) && o.alive && o.st !== 'TAGWAIT'); }
  due(e) {
    const m = this.m, h = m.human;
    if (m.phase !== 'fight' || m.pin || !h || this.busy) return false;
    if (m.clock < (e.at || 0)) return false;
    if (e.when === 'foeLosing') { const foe = this.foeOf(h); return !!foe && foe.hp < foe.maxHp * (e.below || .6) && foe.side === 'in' && !foe.prop; }
    if (e.when === 'humanLosing') return h.hp < h.maxHp * (e.below || .5);
    return h.side === 'in' && h.fsm.is('IDLE', 'MOVE', 'GUARD', 'ATTACK');
  }
  update(dt) {
    for (const e of this.plan) if (!e.done && this.due(e)) { e.done = true; this.begin(e); }
    for (const c of this.cameos) this.tick(c, dt);
    if (this.cameos.some(c => c.gone)) this.cameos = this.cameos.filter(c => !c.gone);
  }
  chairs(e) { const ar = this.m.arena; for (const x of e.xs || [ar.ropeL + 40, ar.ropeR - 40]) this.m.props.spawn(x, 0, { side: ar.inside(x) ? 'in' : 'out', state: 'floor' }); }
  begin(e) {
    const m = this.m, ar = m.arena, h = m.human;
    if (e.kind === 'bossChair') this.walkIn({ who: 'boss', name: '구만석 사장', look: LOOKS.boss, target: h, e, speed: 120, stance: 'arms' });
    else if (e.kind === 'rivalRunIn') { const C = CHARACTERS[e.who]; if (C && h) { m.runIn = { who: e.who, hit: false, nc: false }; this.walkIn({ who: 'rival', id: e.who, name: C.name, look: C.look, target: h, e, speed: 200, stance: 'street' }); } }
    else if (e.kind === 'coachChair') { const foe = this.foeOf(h); if (foe) this.walkIn({ who: 'coach', name: e.coachName || '상대 코치', look: LOOKS.coach || LOOKS.foreman, target: foe, e, speed: 230, stance: 'calm' }); }
    void ar;
  }
  // Come in from the near end of the hall to the floor beside the ring, on the target's side.
  walkIn(o) {
    const ar = this.m.arena, left = o.target.x < ar.mid;
    const spot = left ? ar.ropeL - ar.apron - 44 : ar.ropeR + ar.apron + 44;
    const from = left ? ar.x0 + 6 : ar.x1 - 6;
    const c = Object.assign({ x: from, y: ar.floorY, face: left ? 1 : -1, vx: 0, act: 'enter', t: 0, spot, home: from, say: null, gone: false }, o);
    this.cameos.push(c);
    this.m.emit('cameoIn', { c });
    return c;
  }
  escort(f, ids, right) {
    const ar = this.m.arena;
    ids.forEach((id, k) => {
      const C = CHARACTERS[id]; if (!C) return;
      const off = (30 + k * 34) * (right ? 1 : -1);
      this.cameos.push({ who: 'escort', id, name: C.name, look: C.look, x: f.x + off, y: ar.floorY, face: f.face, vx: 0, act: 'escort', t: 0, target: f, off, spot: right ? ar.ropeR + ar.apron + 44 + k * 26 : ar.ropeL - ar.apron - 44 - k * 26, home: right ? ar.x1 - 6 : ar.x0 + 6, speed: 110, stance: 'arms', say: null, gone: false });
    });
  }
  say(c, text, life = 1.8) { c.say = { text, t: 0, life }; this.m.emit('cameoSay', { c, text }); }
  go(c, act) { c.act = act; c.t = 0; }
  tick(c, dt) {
    const m = this.m, ar = m.arena;
    c.t += dt;
    if (c.say) { c.say.t += dt; if (c.say.t > c.say.life) c.say = null; }
    const ended = m.phase !== 'fight';
    if (c.who === 'escort') { if ((m.phase === 'fight' || m.phase === 'end') && c.act !== 'leave') this.go(c, 'leave'); }
    else if (ended && c.act !== 'leave') this.go(c, 'leave');
    const walk = (to, spd) => { const d = to - c.x; if (Math.abs(d) < 3) { c.vx = 0; return true; } c.vx = sgn(d) * spd; c.x += c.vx * dt; if (Math.abs(to - c.x) < 3 || sgn(to - c.x) !== sgn(d)) { c.x = to; c.vx = 0; return true; } return false; };
    const T = c.target;
    switch (c.act) {
      case 'escort': {   // a step behind their wrestler down the aisle, then at ringside facing the ring
        const f = c.target;
        if (f && f.side === 'out' && !f.hidden) walk(f.x + c.off, Math.max(c.speed, Math.abs(f.vx) + 20));
        else if (f && f.side === 'in' && walk(c.spot, c.speed)) c.face = sgn(ar.mid - c.x) || c.face;
        break;
      }
      case 'enter':
        if (c.who === 'rival') { if (walk(c.spot, c.speed)) { c.face = sgn(ar.mid - c.x) || c.face; this.go(c, 'shout'); this.say(c, pick(LINES.rivalIn), 1.4); } break; }
        if (walk(c.spot, c.speed)) { c.face = sgn(ar.mid - c.x) || c.face; this.go(c, c.who === 'boss' ? 'shout' : 'distract'); if (c.who === 'boss') this.say(c, pick(LINES.bossShout), 1.5); else { this.say(c, pick(LINES.coachIn), 1.6); m.ref.distract = { t: 3.2, x: c.x }; m.emit('refDistract', { c }); } }
        break;
      // ---- the boss ----
      case 'shout': if (c.t > 1.05) { this.go(c, 'windup'); m.emit('chairWarn', { f: T, c }); } break;
      case 'windup': if (c.t > .6) { this.throwAt(c, T); this.go(c, 'watch'); } break;
      case 'watch': {
        const p = c.prop;
        if (p && !c.reacted && (p.state !== 'fly' || p.hit.size)) {
          c.reacted = true;
          const caught = p.state === 'held' && p.holder === T, hit = p.hit.has(T) && T.st === 'DOWN';
          const rv = c.who === 'rival';
          this.say(c, pick(rv ? (caught ? LINES.rivalCatch : hit ? LINES.rivalHit : LINES.rivalMiss) : caught ? LINES.bossCatch : hit ? LINES.bossHit : LINES.bossMiss), 1.8);
          m.emit('bossReact', { c, caught, hit });
          // a rival's chair that lands in front of the referee ends it: no contest (the run-in never decides a winner)
          if (rv && m.runIn) { m.runIn.hit = hit; if (hit && !(m.ref.distract && m.ref.distract.t > 0) && m.phase === 'fight' && m.rng.chance(c.e.noContest || .35)) { m.runIn.nc = true; m.emit('noContest', { c }); m.end({ draw: true, how: 'nocontest', team: null }); } }
        }
        if (c.t > 2.6) this.go(c, 'leave');
        break;
      }
      // ---- the opponent's coach ----
      case 'distract': if (c.t > 1.3) { this.slideTo(c, T); this.say(c, pick(LINES.coachSlide), 1.3); this.go(c, 'cheer'); } break;
      case 'cheer':
        if (c.t > 1.4 && !c.cheered) { c.cheered = true; const stolen = c.prop && c.prop.holder && c.prop.holder !== T; this.say(c, pick(stolen ? LINES.coachSad : LINES.coachCheer), 1.6); }
        if (c.t > 3.2) this.go(c, 'leave');
        break;
      case 'leave':
        c.face = sgn(c.home - c.x) || c.face;
        if (walk(c.home, c.speed * 1.2)) { c.gone = true; m.emit('cameoOut', { c }); }
        break;
    }
  }
  // Ballistic toss that clears the top rope and arrives at (tx, ty).
  arc(x0, y0, tx, ty, Ts) {
    const ar = this.m.arena, g = B.gravity, ropeX = x0 < ar.mid ? ar.ropeL : ar.ropeR, top = ar.matY - ar.ropeH - 14;
    let best = null;
    for (const T of Ts) {
      const vx = (tx - x0) / T, vy = (ty - y0 - .5 * g * T * T) / T;
      const tc = Math.abs(vx) > 1 ? (ropeX - x0) / vx : 0, yc = y0 + vy * tc + .5 * g * tc * tc;
      best = { vx, vy };
      if (tc <= 0 || yc < top) break;
    }
    return best;
  }
  throwAt(c, T) {
    const m = this.m, ar = m.arena;
    if (!T || !T.alive) return;
    const x0 = c.x + c.face * 10, y0 = c.y - 64;
    const tx = clamp(T.x + (T.vx || 0) * .35, ar.ropeL + 26, ar.ropeR - 26), ty = T.y - T.h * .55;
    const v = this.arc(x0, y0, tx, ty, [.85, 1, 1.15, 1.3]);
    c.prop = m.props.spawn(x0, y0, { state: 'fly', vx: v.vx, vy: v.vy, side: 'out', aim: T, spin: c.face * 9 });
    m.emit('cameoThrow', { c, p: c.prop });
  }
  slideTo(c, T) {
    const m = this.m, ar = m.arena;
    if (!T || !T.alive) return;
    const x0 = c.x + c.face * 10, y0 = c.y - 40;
    const tx = clamp(T.x - c.face * 28, ar.ropeL + 24, ar.ropeR - 24), ty = ar.matY - 10;
    const v = this.arc(x0, y0, tx, ty, [.7, .85, 1]);
    c.prop = m.props.spawn(x0, y0, { state: 'fly', vx: v.vx, vy: v.vy, side: 'out', spin: c.face * 6 });
    m.emit('cameoThrow', { c, p: c.prop, slide: true });
  }
}
