// 시너지 and 연계: a career only chains what it has learned (the computer and quick matches chain everything); a
// learned 시너지 hits harder and is called out; a whip 시너지 turns the catch off the ropes into its move; a 연계 is
// the same move again (at most twice); the three-move special hits hardest; old careers keep what used to be free;
// a move that completes a 시너지 brings news. Run: node tests/synergy.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { SYNERGY, synergyOf, needMoves } from '../src/data/synergy.js';
import { Career, OLD_FREE } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const KEYS = ['up', 'down', 'downEdge', 'jump', 'atk', 'grab', 'dodge', 'fin'];
function setup(syn, foe = 'dohyun') {
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 3, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human', synergies: syn }, { char: foe, ctrl: 'dummy' }] });
  const h = m.fighters[0], v = m.fighters[1];
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  h.face = 1; h.x = 380; v.x = 404; v.face = -1;
  const ev = { synergy: [], followOpen: [], moveStart: [], power: {} };
  const b0 = m.wrestle.begin.bind(m.wrestle); m.wrestle.begin = (a, v, parts, o = {}) => { if (a === h) ev.power[parts[parts.length - 1]] = o.power || 1; return b0(a, v, parts, o); };
  for (const k in ev) m.on(k, e => ev[k].push(e));
  const step = (n = 1, press = []) => { for (let i = 0; i < n; i++) { for (const k of KEYS) h.intent[k] = i === 0 && press.includes(k); h.intent.mx = 0; m.update(1 / 60); } };
  return { m, h, v, ev, step };
}
const opened = (ev, from) => (ev.followOpen.find(e => e.from === from) || { opts: [] }).opts.map(o => o.id || (o.pin ? 'pin' : '?'));
// ---- body slam: what opens after it
{
  const A = setup([]); A.m.wrestle.start(A.h, A.v, 'bodySlam', { noReverse: true }); A.step(110);
  const B = setup(['slamElbow']); B.m.wrestle.start(B.h, B.v, 'bodySlam', { noReverse: true }); B.step(110);
  const Q = setup(null); Q.m.wrestle.start(Q.h, Q.v, 'bodySlam', { noReverse: true }); Q.step(110);
  check(!opened(A.ev, 'bodySlam').includes('fElbow') && !opened(A.ev, 'bodySlam').includes('bodySlam'), 'a career that has learned nothing: no elbow, no second slam after a body slam', JSON.stringify(opened(A.ev, 'bodySlam')));
  check(opened(B.ev, 'bodySlam').includes('fElbow') && !opened(B.ev, 'bodySlam').includes('bodySlam'), 'with 항구의 밤 learned: the elbow, not the 연계', JSON.stringify(opened(B.ev, 'bodySlam')));
  check(opened(Q.ev, 'bodySlam').includes('fElbow') && opened(Q.ev, 'bodySlam').includes('bodySlam'), 'a quick match (or the computer) has every chain', JSON.stringify(opened(Q.ev, 'bodySlam')));
  // do it: J in the window
  for (let i = 0; i < 60 && !B.ev.moveStart.some(e => e.mv.id === 'fElbow'); i++) B.step(2, i === 0 ? ['atk'] : []);
  const st = B.ev.moveStart.find(e => e.mv.id === 'fElbow');
  check(!!st && B.ev.power.fElbow === SYNERGY.slamElbow.power && B.ev.synergy.some(e => e.id === 'slamElbow'), `the 시너지 runs, hits ${SYNERGY.slamElbow.power}x and is called out`, B.ev.power.fElbow);
}
// ---- the whip: a learned whip 시너지 turns the catch into its move
function whip(syn) {
  const S = setup(syn); S.h.x = 520; S.v.x = 544;
  S.m.wrestle.start(S.h, S.v, 'irishWhip', { noReverse: true });
  let caught = null;
  for (let i = 0; i < 400 && !caught; i++) {
    const near = S.v.st === 'WHIPPED' && S.v.whip && S.v.whip.back && Math.abs(S.v.x - S.h.x) < 60;
    S.step(1, near ? ['grab'] : []);
    caught = S.ev.moveStart.find(e => e.mv.id !== 'irishWhip');
  }
  return { caught, S };
}
{
  const plain = whip([]), syn = whip(['whipBomb']);
  check(plain.caught && plain.caught.mv.id === (plain.S.h.moves.catch || 'backBody'), 'without the 시너지 the catch is the catch move', plain.caught && plain.caught.mv.id);
  check(syn.caught && syn.caught.mv.id === 'powerbomb' && syn.S.ev.synergy.some(e => e.id === 'whipBomb') && syn.S.ev.power.powerbomb === SYNERGY.whipBomb.power, `with 파워밤 받아치기: a powerbomb off the ropes, ${SYNERGY.whipBomb.power}x`, syn.caught && syn.caught.mv.id);
}
// ---- 연속 저먼 is learned too
{
  const A = setup([]); A.m.wrestle.start(A.h, A.v, 'german', { noReverse: true }); A.step(2);
  const B = setup(['german2']); B.m.wrestle.start(B.h, B.v, 'german', { noReverse: true }); B.step(2);
  check(!A.h.link.up && B.h.link.up, '연속 저먼 can only be pressed once it is learned at 파식대 학원');
}
// ---- the same move twice at most (the old endless suplex)
{
  const Q = setup(null); let n = 0; Q.m.on('release', e => { if (e.move && e.move.id === 'suplex') n++; });
  Q.m.wrestle.start(Q.h, Q.v, 'suplex', { noReverse: true });
  for (let i = 0; i < 600; i++) Q.step(1, i % 20 === 0 ? ['grab'] : []);
  check(n === 2, `suplex into suplex, then it stops (${n})`);
}
// ---- the three-move special: whip, the catch, the elbow
{
  const S = setup(['harborStorm', 'busterElbow']); S.h.moves = Object.assign({}, S.h.moves, { catch: 'spinebuster' }); S.h.x = 520; S.v.x = 544;
  S.m.wrestle.start(S.h, S.v, 'irishWhip', { noReverse: true });
  let elbow = null;
  for (let i = 0; i < 700 && !elbow; i++) {
    const near = S.v.st === 'WHIPPED' && S.v.whip && S.v.whip.back && Math.abs(S.v.x - S.h.x) < 60, spined = S.ev.moveStart.some(e => e.mv.id === 'spinebuster');
    S.step(1, near ? ['grab'] : spined && S.h.follow && i % 4 === 0 ? ['atk'] : []);
    elbow = S.ev.moveStart.find(e => e.mv.id === 'bigElbow');
  }
  check(!!elbow && S.ev.synergy.some(e => e.id === 'harborStorm') && S.ev.power.bigElbow === SYNERGY.harborStorm.power, `부두의 폭풍: whip → spinebuster → elbow, the last one ${SYNERGY.harborStorm.power}x`, JSON.stringify({ elbow: !!elbow, syn: S.ev.synergy.map(e => e.id) }));
}
// ---- the career side
{
  for (const k of ['save2', 'save2.chk']) Save.del(k);
  const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
  const c = Career.create(2, { name: '파도', style: 'all', look });
  check(Array.isArray(c.d.syn) && c.d.syn.length === 0 && c.entrant('human').synergies.length === 0, 'a new career has learned no 시너지');
  const old = Career.create(2, { name: '옛 선수', style: 'all', look }); old.d.record.w = 5; delete old.d.syn; old.save();
  const k = Career.load(2);
  check(OLD_FREE.every(id => k.d.syn.includes(id)), 'an old career keeps the chains that used to be free', JSON.stringify(k.d.syn));
  c.d.known = c.d.known.filter(id => id !== 'irishWhip'); if (!c.d.known.includes('powerbomb')) c.d.known.push('powerbomb');
  c.learn('irishWhip');
  check((c.d.synNews || []).includes('whipBomb'), 'learning the whip with a powerbomb already known: "시너지가 추가되었습니다"', JSON.stringify(c.d.synNews));
  check(needMoves(SYNERGY.slamElbow).join() === 'bodySlam', 'the elbow drop comes with its 시너지 (only the body slam is needed)');
  check(synergyOf('irishWhip', 'powerbomb', 'catch') === 'whipBomb' && synergyOf('bodySlam', 'fElbow', 'follow') === 'slamElbow', 'the chains know their 시너지');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
