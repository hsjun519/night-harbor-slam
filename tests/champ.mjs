// The champion's belt (worn in, the referee holds it, the winner of a title match gets it), Money in the Bank cashed
// in right in the same ring (only the holder walks out), 서도현 booking the rival match himself, the chair's reach,
// tag partners tagging out, and the event prizes. Run: node tests/champ.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { ATTACKS } from '../src/data/balance.js';
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';
import '../src/combat/Props.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const run = (m, t, until) => { for (let i = 0; i < t * 60 && !(until && until(m)); i++) m.update(1 / 60); };
// ---- the belt
{
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 4, career: 1, title: 1, beltHolder: 'player', entrances: { player: { stage: 'champion' }, belt: 'player' }, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'taesan', ctrl: 'ai', difficulty: 'expert' }] });
  const h = m.fighters[0], v = m.fighters[1], ev = [];
  m.on('beltRef', () => ev.push('ref')); m.on('beltTo', e => ev.push(e.f === v ? 'foe' : e.f === h ? 'me' : '?'));
  check(m.belt && m.belt.on === h, 'the champion walks out wearing the belt');
  run(m, 40, x => x.phase === 'fight');
  check(m.belt.on === 'ref' && ev[0] === 'ref', 'at the bell the referee holds it');
  h.hp = 1; run(m, 120, x => x.phase === 'end');
  check(m.phase === 'end' && m.belt.on === (m.result.winner === v ? v : h) && ev.length === 2, `after a title match the winner gets it (${ev.join(' → ')})`);
  const n = new MatchManager({ mode: 'single', arena: 'hall', seed: 4, career: 1, beltHolder: 'player', skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'taesan', ctrl: 'ai', difficulty: 'expert' }] });
  n.fighters[0].hp = 1; run(n, 120, x => x.phase === 'end');
  check(n.belt.on === n.fighters[0], 'after a non-title match it goes back to the champion, win or lose');
}
// ---- the cash-in: only the holder walks out, the champion is already in the ring
{
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 4, career: 1, title: 1, entrances: { short: 1, only: ['neon'] }, introTime: 1.4, entrants: [{ char: 'rookie', ctrl: 'human', hpStart: .45 }, { char: 'neon', ctrl: 'ai', difficulty: 'hard' }] });
  const h = m.fighters[0], v = m.fighters[1];
  check(h.side === 'in' && !h.hidden && v.hidden && v.side === 'out', 'the champion waits in the ring; the holder is behind the curtain');
  let entered = false; const t0 = m.time;
  run(m, 30, x => { if (v.st === 'ENTER_RING') entered = true; return x.phase === 'fight'; });
  check(entered && m.phase === 'fight' && m.time - t0 < 14 && Math.abs(h.hp / h.maxHp - .45) < .01, `the holder runs down and climbs in, the bell goes (${(m.time - t0).toFixed(1)} s), the champion still worn out`);
}
// ---- 서도현 books it himself
{
  for (const k of ['save2', 'save2.chk']) Save.del(k);
  const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
  const c = Career.create(2, { name: '파도', style: 'all', look }), d = c.d;
  d.day = 12; d.flags.rankPts = d.league.find(e => e.id === 'dohyun').pts + 1;
  const offers = c.makeOffers();
  check(!offers.some(o => o.kind === 'rival'), 'the rival match is no longer in the boss\'s list');
  c.sleep();
  check(d.rivalCall && d.rivalCall.opp === 'dohyun' && d.rivalCall.kind === 'rival' && d.rivalCall.arena === 'pier', '서도현 comes to book it himself (the next morning)', JSON.stringify(d.rivalCall));
  d.rivalCall = null; d.contract = { opp: 'x', day: d.day + 2 }; c.rivalCall();
  check(!d.rivalCall, 'not while another contract is booked');
}
// ---- the chair, tag partners, event prizes
{
  check(ATTACKS.chairShot.reach === 55, 'a chair shot reaches 20% further (46 → 55)');
  let tags = 0;
  for (const seed of [1, 2, 3]) {
    const m = new MatchManager({ mode: 'tag', arena: 'hall', seed, skipIntro: true, entrants: ['taesan', 'haneul', 'neon', 'dueok'].map(id => ({ char: id, ctrl: 'ai', difficulty: 'hard' })) });
    m.on('tag', () => tags++); run(m, 90, x => x.phase === 'end');
  }
  check(tags >= 3, `tag partners tag out (${tags} tags in three matches)`);
  const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
  const c = Career.create(2, { name: '파도', style: 'all', look }), d = c.d, prizes = {};
  for (const day of [7, 12, 19]) { d.day = day; d.offers = []; d.offersDay = 0; d.contract = null; for (const o of c.makeOffers()) if (o.kind === 'event') prizes[o.oppName] = o.reward; }
  check(Object.keys(prizes).length >= 3 && Object.values(prizes).every(p => p >= 200000 && p <= 300000), 'events pay 200,000-300,000 in season 1', JSON.stringify(prizes));
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
