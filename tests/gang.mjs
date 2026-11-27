// The dock gang in the lobby: tiers by level and wins over them, a chair in hand from the bell, a third man who runs
// in later (or as soon as a mate is down) and keeps the brawl going until he is beaten too.
// Run: node tests/gang.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { Career, GANG } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
for (const k of ['save3', 'save3.chk']) Save.del(k);
const c = Career.create(3, { name: 'P', style: 'all', look });
const tierAt = (level, beaten) => { c.d.level = level; c.d.flags.gangBeaten = beaten; return c.gangTier(); };
check(tierAt(1, 0) === 0 && tierAt(5, 0) === 1 && tierAt(9, 0) === 2 && tierAt(13, 0) === 3 && tierAt(30, 0) === 3, 'tiers follow the level');
check(tierAt(1, 2) === 1 && tierAt(5, 2) === 2, 'every win over them brings them back stronger');
const brawl = (level) => {
  c.d.level = level; c.d.flags.gangBeaten = 0;
  const B = c.gangMatch(), me = Object.assign(c.entrant('human'), { team: 0 });
  return { B, m: new MatchManager({ mode: 'street', arena: 'lobby', seed: 5, skipIntro: true, career: 1, entrants: [me, ...B.gang] }) };
};
{
  const { m, B } = brawl(1);
  check(m.fighters.length === 3 && !m.fighters.some(f => f.prop) && B.gang.every(g => g.stats.hp < 90), 'tier 0: two of them, empty-handed, weaker than before', JSON.stringify(B.gang.map(g => Math.round(g.stats.hp))));
}
{
  const { m } = brawl(5);
  const g = m.fighters.find(f => f.charId === 'galchi');
  check(g && g.prop && g.prop.state === 'held', 'tier 1: 갈치 walks in holding a chair');
}
{
  const { m } = brawl(9), h = m.fighters[0];
  let entered = 0; m.on('lateEntry', () => entered++);
  check(m.fighters.length === 3 && m.lateQ.length === 1 && m.lateQ[0].char === 'kkongchi', 'tier 2: the third man is not there at the bell');
  for (let i = 0; i < 30; i++) m.update(1 / 60);
  const kid = m.fighters.find(f => f.charId === 'myeolchi');
  m.knockOut(kid, h, 0, -40, 0);
  for (let i = 0; i < 30; i++) m.update(1 / 60);
  const kk = m.fighters.find(f => f.charId === 'kkongchi');
  check(entered === 1 && kk && kk.team === 1 && m.phase === 'fight', 'a mate down: 꽁치 runs in', JSON.stringify({ entered, n: m.fighters.length }));
  for (const f of m.fighters) if (f.team === 1 && f !== kk && f.st !== 'KO') m.knockOut(f, h, 0, -40, 0);
  for (let i = 0; i < 60; i++) m.update(1 / 60);
  check(m.phase === 'fight', 'the brawl goes on while 꽁치 stands', m.phase);
  m.knockOut(kk, h, 0, -40, 0);
  for (let i = 0; i < 90; i++) m.update(1 / 60);
  check(m.phase === 'end' && m.result.team === 0, 'all three down: the player wins', JSON.stringify(m.result && { team: m.result.team, how: m.result.how }));
}
{
  // both down before the timer: he still comes, the match does not end early
  const { m } = brawl(9), h = m.fighters[0];
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  for (const f of m.fighters.slice(1)) m.knockOut(f, h, 0, -40, 0);
  for (let i = 0; i < 60; i++) m.update(1 / 60);
  check(m.phase === 'fight' && m.fighters.some(f => f.charId === 'kkongchi' && f.alive), 'both down at once: 꽁치 still comes and the brawl is not over');
}
{
  const { m } = brawl(13);
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  check(!m.fighters.some(f => f.charId === 'kkongchi'), 'tier 3: not yet at the start');
  m.lateT = GANG[3].late.kkongchi - .05;   // his time comes
  for (let i = 0; i < 10; i++) m.update(1 / 60);
  const kk = m.fighters.find(f => f.charId === 'kkongchi');
  check(kk && kk.prop && kk.prop.state === 'held', 'tier 3: on time 꽁치 comes in with a chair of his own');
}
check(GANG.every((G, i) => !i || G.who.length >= GANG[i - 1].who.length), 'tiers never lose members');
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
