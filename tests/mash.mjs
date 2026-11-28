// Mashing out: J only (K and L do nothing, a wrong key costs a little), the key jumps to K or L against a bigger foe,
// a boss, after a big move, and most of all up on the shoulders for an electric chair; the computer copes with it
// too; a hold in a tag match can be mashed out of. Run: node tests/mash.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { holdStrength } from '../src/combat/Mash.js';
import { BALANCE as B } from '../src/data/balance.js';
import { CHARACTERS } from '../src/data/characters.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
// the human held by an AI that only holds (no move); press(k, t) picks the keys pressed this frame
function held(o = {}) {
  const ents = o.tag ? [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'ai', difficulty: 'normal' }, { char: o.foe || 'taesan', ctrl: 'ai', difficulty: 'normal', boss: o.boss }, { char: 'haneul', ctrl: 'ai', difficulty: 'normal' }]
    : [{ char: 'rookie', ctrl: 'human' }, { char: o.foe || 'taesan', ctrl: 'dummy', boss: o.boss, stats: o.foeStats ? Object.assign({}, CHARACTERS[o.foe || 'taesan'].stats, o.foeStats) : undefined }];
  const m = new MatchManager({ mode: o.tag ? 'tag' : 'single', arena: 'hall', seed: 2, skipIntro: true, entrants: ents });
  const h = m.fighters[0], a = o.tag ? m.fighters.find(f => f.team !== h.team && f.legal) : m.fighters[1];
  if (a.ai) a.ai.behavior = 'idle';
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  a.x = h.x + 30; a.face = -1; h.face = 1;
  if (o.carry) m.grapple.beginCarry(a, h); else m.grapple.beginHold(a, h, 'front');
  const L = h.link; if (L) { L.hold = 99; L.phase = 'hold'; }
  const keys = new Set(); let t = 0, free = null;
  for (; t < (o.max || 8); t += 1 / 60) {
    const ks = o.press ? o.press(Math.round(t * 60), h) : [];
    for (const k of ['atk', 'grab', 'dodge', 'jump']) h.intent[k] = ks.includes(k);
    if (a.link && a.link.kind === 'hold') { a.link.hold = 99; if (a.ai) a.intent.grab = a.intent.atk = false; }
    m.update(1 / 60);
    if (h.mash) keys.add(h.mash.key);
    if (!h.link && free == null) { free = t; break; }
  }
  return { m, h, a, free, keys: [...keys], strength: holdStrength(a, h, { carry: !!o.carry }) };
}
const J = (n, h) => (n % 6 === 0 ? ['atk'] : []), KL = n => (n % 6 === 0 ? ['grab', 'dodge'] : []);
const smart = (n, h) => (n % 6 === 0 ? [h.mash ? h.mash.key : 'atk'] : []);
{
  const a = held({ foe: 'galchi', press: J }), b = held({ foe: 'galchi', press: KL, max: 6 });
  check(a.free != null && a.free < 4, `J mashing gets out of an ordinary hold (${a.free && a.free.toFixed(1)} s)`);
  check(b.free == null && b.h.escape === 0, 'K and L do nothing (a wrong key only costs)', `escape ${b.h.escape}`);
  check(a.keys.join() === 'atk' && a.strength < B.mashShiftFrom, 'against a smaller foe the key stays J', JSON.stringify({ k: a.keys, s: a.strength }));
}
{
  const big = held({ foe: 'taesan', boss: true, press: smart, max: 12 });
  check(big.strength >= .5 && big.keys.length >= 2, `a boss: the key jumps (${big.keys.join(' ')}, strength ${big.strength.toFixed(2)})`);
  check(big.free != null, `following the key still gets you out (${big.free && big.free.toFixed(1)} s)`);
  const stub = held({ foe: 'taesan', boss: true, press: J, max: 12 });
  check(stub.free == null || stub.free > big.free + .5, 'pressing J alone against a boss is slower or hopeless', JSON.stringify({ follow: big.free, jOnly: stub.free }));
}
{
  const c = held({ foe: 'galchi', carry: true, press: smart, max: 14 }), g = held({ foe: 'galchi', press: smart, max: 14 });
  check(c.strength > g.strength + .5 && c.keys.length >= 2, `up on the shoulders is the hardest hold to read (strength ${c.strength.toFixed(2)} vs ${g.strength.toFixed(2)})`);
  check(c.free == null || c.free > g.free * 1.5, 'and the slowest to get out of', JSON.stringify({ carry: c.free, hold: g.free }));
}
{
  const t = held({ tag: true, foe: 'taesan', press: smart, max: 10 });
  check(t.free != null, `in a tag match a hold can be mashed out of (${t.free && t.free.toFixed(1)} s)`);
}
{
  // the computer, held by the human, still gets out (it reads the key a beat late after a jump)
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 2, skipIntro: true, entrants: [{ char: 'taesan', ctrl: 'human', boss: true }, { char: 'dohyun', ctrl: 'ai', difficulty: 'hard' }] });
  const h = m.fighters[0], v = m.fighters[1];
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  v.x = h.x + 30; v.face = -1; h.face = 1;
  m.grapple.beginHold(h, v, 'front'); h.link.hold = 99; h.link.phase = 'hold';
  let t = 0; for (; t < 15 && v.link; t += 1 / 60) { if (h.link) h.link.hold = 99; for (const k of ['atk', 'grab', 'dodge', 'jump']) h.intent[k] = false; m.update(1 / 60); }
  check(!v.link, `the computer mashes out against the same rules (${t.toFixed(1)} s)`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
