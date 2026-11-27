// Online lockstep without a network: two matches joined by an in-memory link with random delays must stay identical
// frame for frame, for every match type the lobby offers. Run: node tests/online.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { Lockstep, pack, unpack } from '../src/net/Lockstep.js';
import { onlineConfig, NET_TYPES } from '../src/scenes/OnlineScene.js';
import { RNG } from '../src/core/util.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };

// two ends of a fake link: messages arrive after 0-6 frames, in order, as JSON copies
class FakeNet {
  constructor(rng) { this.handlers = {}; this.other = null; this.q = []; this.rng = rng; this.now = 0; this.connected = true; }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
  send(o) { const at = Math.max(this.other.lastAt || 0, this.now + this.rng.int(0, 6)); this.other.lastAt = at; this.other.q.push({ at, d: JSON.parse(JSON.stringify(o)) }); }
  tick(now) { this.now = now; while (this.q.length && this.q[0].at <= now) { const { d } = this.q.shift(); for (const fn of this.handlers.data || []) fn(d); } }
  pingNow() {}
}
check(unpack(pack({ mx: -1, up: true, down: false, downEdge: true, jump: false, atk: true, grab: false, dodge: true, fin: true }), {}).mx === -1, 'inputs pack into one number and back');

function duel(type, frames, seed) {
  const r0 = new RNG(seed), a = new FakeNet(new RNG(seed + 1)), b = new FakeNet(new RNG(seed + 2));
  a.other = b; b.other = a;
  const start = { seed: 1000 + seed, type, arena: (NET_TYPES.find(t => t.id === type).cfg.arena) || 'hall', chars: ['taesan', 'haneul'] };
  const mA = new MatchManager(onlineConfig(start, 0, a)), mB = new MatchManager(onlineConfig(start, 1, b));
  const LA = new Lockstep(a, 0, 4), LB = new Lockstep(b, 1, 4);
  // each side plays: a little script of moves (deterministic per side) so the match is busy
  const play = (rng, m, me) => { const I = { mx: 0, up: false, down: false, downEdge: false, jump: false, atk: false, grab: false, dodge: false, fin: false }, f = m.fighters[me], o = m.fighters[1 - me]; I.mx = rng.chance(.7) ? Math.sign(o.x - f.x) : rng.pick([-1, 0, 1]); if (rng.chance(.12)) I.atk = true; if (rng.chance(.06)) I.grab = true; if (rng.chance(.03)) I.dodge = true; if (rng.chance(.02)) I.jump = true; if (rng.chance(.02)) I.fin = true; if (rng.chance(.05)) I.down = true; if (rng.chance(.03)) I.downEdge = true; if (rng.chance(.05)) I.up = true; return I; };
  const ra = new RNG(seed + 7), rb = new RNG(seed + 9), traceA = new Map(), traceB = new Map();
  const snap = m => m.fighters.map(f => `${f.st}:${f.x.toFixed(3)}:${f.y.toFixed(3)}:${f.hp.toFixed(3)}:${f.stun.toFixed(3)}`).join('|') + `|${m.phase}|${m.result ? m.result.how : ''}`;
  let stalls = 0;
  for (let t = 0; t < frames * 3 && (LA.frame < frames || LB.frame < frames); t++) {
    a.tick(t); b.tick(t);
    for (const [L, m, rng, tr, me] of [[LA, mA, ra, traceA, 0], [LB, mB, rb, traceB, 1]]) {
      if (L.frame >= frames) continue;
      L.input(play(rng, m, me));
      L.push();
      if (!L.ready()) { stalls++; continue; }
      L.apply(m.fighters); m.update(1 / 60); L.sum(m);
      if (L.frame % 30 === 0) tr.set(L.frame, snap(m));
    }
  }
  let same = true, first = null;
  for (const [f, s] of traceA) if (traceB.has(f) && traceB.get(f) !== s) { same = false; first = first || `${f}: ${s} vs ${traceB.get(f)}`; }
  void r0;
  return { same, first, frames: Math.min(LA.frame, LB.frame), stalls, desync: LA.desync || LB.desync, end: mA.phase === 'end' ? mA.result.how : mA.phase, hp: mA.fighters.map(f => Math.round(f.hp)).join('/') };
}
for (const T of NET_TYPES) {
  const r = duel(T.id, 2400, 3 + T.id.length);
  check(r.same && !r.desync && r.frames >= 2400, `${T.name}: both screens stay identical for 40 s of play (${r.end}, stalls ${r.stalls}, hp ${r.hp})`, JSON.stringify(r));
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
