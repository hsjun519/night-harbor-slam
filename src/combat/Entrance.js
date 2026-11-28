// Ring entrances, played in the match's intro before the bell. One wrestler at a time, weakest first: lights and
// their music (pre), they appear at the end of the aisle (with anyone who walks out with them), walk the aisle on
// their own feet, climb in at the apron, walk to their corner, pose, and wait there while the next one comes out.
// Nobody can hit anybody: the director writes every entrant's intent until the last one is in. Enter skips it all.
// MatchScene draws the light, mist, flames, the big screen and the crowd from the events this emits.
import { clamp, sgn } from '../core/util.js';
import { BALANCE as B } from '../data/balance.js';
import { CHARACTERS } from '../data/characters.js';
import { resolveEntrance, TIER_RANK } from '../data/entrances.js';

export class EntranceDirector {
  constructor(m, opt = {}) {
    this.m = m; this.done = false; this.t = 0; this.groups = []; this.i = -1; this.cur = null;
    const ar = m.arena, h = m.human;
    // who walks out how, and in which order: stronger tiers last; on a tie the belt holder, then you, come last
    for (const f of m.fighters) {
      if (opt.only && !opt.only.includes(f.charId)) continue;   // the others stay where they are
      const player = f.ctrl === 'human' && !!opt.player;
      const E = resolveEntrance(f.charId, { player, stage: player && opt.player ? opt.player.stage : null, belt: opt.belt === (player ? 'player' : f.charId), seen: opt.seen && opt.seen[f.charId], short: opt.short });
      const right = f.x > ar.mid;
      this.groups.push({ f, E, right, spot: f.x, face: f.face, rank: TIER_RANK[E.tier] + (E.belt ? .5 : 0) + (f === h ? .25 : 0), stage: 'wait', t: 0, fin0: f.fin });
    }
    this.groups.sort((a, b) => a.rank - b.rank);
    // everybody waits behind the curtain at the end of their side's aisle
    for (const g of this.groups) this.hide(g);
    m.holdIntro = true;   // the first one starts on the first update, once the scene listens
  }
  get current() { return this.cur; }
  drives(f) { return !this.done && this.groups.some(g => g.f === f); }
  hide(g) {
    const ar = this.m.arena, f = g.f;
    f.side = 'out'; f.y = ar.floorY; f.ground = true; f.vx = f.vy = 0; f.hidden = true;
    f.x = g.right ? ar.x1 - 18 : ar.x0 + 18; f.face = g.right ? -1 : 1;
    f.set('IDLE', { force: true });
  }
  next() {
    this.i++;
    this.cur = this.groups[this.i] || null;
    if (!this.cur) { this.finish(); return; }
    const g = this.cur; g.stage = 'pre'; g.t = 0;
    this.m.emit('entranceStart', { f: g.f, E: g.E, i: this.i, n: this.groups.length });
  }
  // the intent of every entrant while the director runs: only the one walking out moves
  drive(f, dt) {
    const I = f.intent; I.mx = 0; I.up = I.down = I.downEdge = I.jump = I.atk = I.grab = I.dodge = I.fin = false;
    const g = this.cur;
    if (!g || g.f !== f) return;
    const ar = this.m.arena;
    if (g.stage === 'walk') {
      const apron = g.right ? ar.ropeR + ar.apron + 16 : ar.ropeL - ar.apron - 16, d = apron - f.x;
      if (f.side === 'out' && Math.abs(d) > 20) { I.mx = sgn(d) * clamp(g.E.walk / (B.walk || 150), .35, 1); f.running = false; }
      else if (f.side === 'out' && f.st !== 'ENTER_RING' && f.ground) { I.jump = true; I.up = true; f.buf.jump = B.inputBuffer; }
    } else if (g.stage === 'corner') {
      const d = g.spot - f.x;
      if (Math.abs(d) > 6) I.mx = sgn(d) * .7;
    } else if (g.stage === 'pose' && !g.posed && g.t > .15) {
      g.posed = true;
      if (g.E.pose !== 'none' && f.fin < B.finMax) { I.fin = true; f.buf.fin = B.inputBuffer; }   // the taunt is their pose
    }
  }
  update(dt) {
    if (this.done) return;
    if (this.i < 0) { this.next(); return; }
    const g = this.cur, m = this.m, ar = m.arena;
    if (!g) return;
    const f = g.f;
    g.t += dt; this.t += dt;
    switch (g.stage) {
      case 'pre':
        if (g.t >= g.E.pre) { g.stage = 'walk'; g.t = 0; f.hidden = false; if (g.E.escort && g.E.escort.length) m.events.escort(f, g.E.escort, g.right); m.emit('entranceAppear', { f, E: g.E }); }
        break;
      case 'walk':
        if (f.side === 'in' && f.st !== 'ENTER_RING') { g.stage = 'corner'; g.t = 0; m.emit('entranceInRing', { f, E: g.E }); }
        else if (g.t > 12) this.place(g);   // never stuck in the aisle
        break;
      case 'corner':
        if (Math.abs(g.spot - f.x) <= 6 || g.t > 3) { f.x = g.spot; f.vx = 0; f.face = g.right ? -1 : 1; g.stage = 'pose'; g.t = 0; m.emit('entrancePose', { f, E: g.E }); }
        break;
      case 'pose':
        if (g.t >= g.E.hold && !['ATTACK', 'TAUNT'].includes(f.st)) { this.settle(g); this.next(); }
        break;
    }
  }
  // straight to their corner, standing, gauge as it was
  place(g) {
    const f = g.f, ar = this.m.arena;
    f.hidden = false; f.side = 'in'; f.y = ar.matY; f.x = g.spot; f.ground = true; f.vx = f.vy = 0; f.enter = null; f.entering = null; f.face = g.right ? -1 : 1;
    f.set('IDLE', { force: true });
  }
  settle(g) {
    const f = g.f;
    if (f.side !== 'in' || f.st === 'ENTER_RING') this.place(g);
    f.fin = g.fin0; g.stage = 'done';
    f.set('INTRO', { force: true });   // stands in the corner (the intro idle) until the bell
  }
  skipAll() {
    if (this.done) return;
    for (const g of this.groups) if (g.stage !== 'done') { this.place(g); this.settle(g); }
    this.finish(true);
  }
  finish(skipped) {
    if (this.done) return;
    this.done = true; this.cur = null;
    const m = this.m;
    for (const g of this.groups) g.f.hidden = false;
    m.holdIntro = false;
    m.introT = (m.cfg.introTime || 3.2) - .1;   // the face to face (if any) and the bell come next
    m.emit('entrancesDone', { skipped: !!skipped });
  }
}
export const entranceName = f => (CHARACTERS[f.charId] ? CHARACTERS[f.charId].name : f.name);
