// Money in the Bank (the case, the cash-in either way), title defences, and the career rubber band.
// Run: node tests/mitb.mjs
import { Career } from '../src/world/CareerManager.js';
import { MatchManager } from '../src/combat/MatchManager.js';
import { AIController, DIFFICULTY } from '../src/combat/AIController.js';
import { CHARACTERS } from '../src/data/characters.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const fresh = () => Career.create(1, { name: '파도', style: 'brawl', look: null });
const res = (won, how = 'pin', winner = null) => ({ human: { dmgTaken: 10, ko: false, finishersTaken: 0, ringOuts: 0 }, won, draw: false, result: { how, winner } });

// ---- rubber band
{
  const c = fresh(), d = c.d;
  d.contract = null;
  for (let i = 0; i < 4; i++) { d.record.streak = i; c.applyResult('free', res(true), { offer: { opp: 'dohyun', oppName: '서도현' } }); }
  const up = d.dda;
  check(up > .04, 'four wins in a row sharpen the opponents (level-ups ease it a little)', `dda=${up}`);
  const st = c.ddaFor('taesan');
  check(st.stats && st.stats.hp > CHARACTERS.taesan.stats.hp && st.aiBoost > 0 && st.aiBoost <= up + 1e-9, 'their health and attack go up with it (never past the band)', JSON.stringify(st));
  const f = { aiBoost: st.aiBoost, char: { ai: {} } }, ai = new AIController(f, 'normal', { next: () => .5, chance: () => false });
  check(ai.D.react < DIFFICULTY.normal.react && ai.D.pick > DIFFICULTY.normal.pick, 'and the computer reads faster', `react=${ai.D.react}`);
  c.applyResult('free', res(false), { offer: { opp: 'dohyun', oppName: '서도현' } });
  c.applyResult('free', res(false), { offer: { opp: 'dohyun', oppName: '서도현' } });
  check(d.dda < up - .1, 'losses ease them off again', `dda=${d.dda}`);
  for (let i = 0; i < 20; i++) c.applyResult('free', res(false), { offer: { opp: 'dohyun', oppName: '서도현' } });
  check(d.dda >= -.3 - 1e-9, 'with a floor', `dda=${d.dda}`);
}
// ---- the event appears, and what winning or losing it gives
{
  const c = fresh(), d = c.d; d.day = 7;
  const o = c.makeOffers().find(x => x.mitb);
  check(!!o && o.special === 'ladder', 'Money in the Bank is offered on days 6-10 to a challenger', JSON.stringify(c.d.offers.map(x => x.oppName)));
  check(o.mode === 'single' && CHARACTERS[o.mitbFoe] && o.mitbFoe !== c.champion && o.desc.includes(CHARACTERS[o.mitbFoe].name), 'one on one: a single opponent from the top of the ranking, named in the offer', o.mitbFoe);
  d.contract = o; c.applyResult('event', res(true, 'ladder'), {});
  check(d.mitb && d.mitb.holder === 'player' && d.mitb.until === d.day + 7, 'winning it gives the case for seven days', JSON.stringify(d.mitb));
  const c2 = fresh(); c2.d.day = 7; const o2 = c2.makeOffers().find(x => x.mitb); c2.d.contract = o2;
  c2.applyResult('event', res(false, 'ladder', { charId: 'neon' }), {});
  check(c2.d.mitb && c2.d.mitb.holder === 'neon', 'losing it gives the case to the winner', JSON.stringify(c2.d.mitb));
}
// ---- your cash-in: a title match you start whenever you like; it becomes the belt
{
  const c = fresh(), d = c.d; d.mitb = { holder: 'player', until: d.day + 7 };
  c.applyResult('title', res(true), { offer: { opp: 'fogking', oppName: '안개왕', kind: 'title', title: 1, cashIn: 'player', reward: 200000, fame: 30 } });
  check(d.flags.champion && !d.mitb, 'cashing in and winning makes you champion, the case is spent', JSON.stringify({ ch: d.flags.champion, m: d.mitb }));
}
// ---- as champion: defences on offer; somebody takes the case and comes for you; losing it costs the belt
{
  const c = fresh(), d = c.d; d.flags.champion = true; d.day = 9;
  const offs = c.makeOffers();
  check(offs.some(o => o.defense && o.title), 'a champion gets title defences', JSON.stringify(offs.map(o => o.desc.slice(0, 10))));
  const msgs = c.nextDay(false);
  check(d.mitb && d.mitb.holder !== 'player' && msgs.some(m => m.includes('머니 인 더 뱅크')), 'while you hold the belt somebody else wins the case', JSON.stringify(msgs));
  const h = d.mitb.holder;
  c.applyResult('title', res(false, 'pin', { charId: h }), { offer: { opp: h, oppName: CHARACTERS[h].name, kind: 'title', title: 1, cashIn: h, reward: 80000, fame: 20 } });
  check(!d.flags.champion && d.champ === h && !d.mitb, 'their cash-in won: they hold the belt now', JSON.stringify({ ch: d.flags.champion, champ: d.champ }));
  d.fame = 80; d.flags.rankPts = 999;
  const t = c.makeOffers().find(o => o.title && !o.defense);
  check(!t || t.opp === h, 'and the next title shot is against them', t ? t.opp : 'no title offer yet (rank)');
}
// ---- the case runs out
{
  const c = fresh(), d = c.d; d.mitb = { holder: 'player', until: d.day };
  const msgs = c.nextDay(false);
  check(!d.mitb && msgs.some(m => m.includes('기한')), 'an unused case expires', JSON.stringify(msgs));
}
// ---- the match itself: one on one, one ladder, the case decides it
{
  let byCase = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const m = new MatchManager({ mode: 'single', special: 'ladder', arena: 'dome', seed, skipIntro: true, entrants: [['taesan', 'haneul'], ['neon', 'dueok'], ['dohyun', 'baekpa'], ['bjorn', 'mandeok']][seed - 1].map(id => ({ char: id, ctrl: 'ai', difficulty: 'hard' })) });
    let t = 0; while (m.phase !== 'end' && t < 480) { m.update(1 / 60); t += 1 / 60; }
    if (m.result && m.result.how === 'ladder') byCase++;
  }
  check(byCase >= 3, 'a one-on-one ladder match ends with somebody taking the case', `${byCase}/4`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
