// 선항 레슬링, chapter two: the beats come in order (signal, invasion, second wave four days on, the captain four
// days after that, a rematch the next day after a loss, five days of rebuilding, the route opens), the belt stays in
// the basement while the dome is down and goes back to the dome after; 고동 is a boss in three phases.
// Run: node tests/ow2.mjs
import { Career, OW } from '../src/world/CareerManager.js';
import { MatchManager } from '../src/combat/MatchManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
for (const k of ['save3', 'save3.chk']) Save.del(k);
const c = Career.create(3, { name: '파도', style: 'all', look }), d = c.d;
d.day = 10; d.flags.champion = true; c.owBegin();
const beats = [];
const walkIn = loc => { const b = c.owDue(loc); if (b) beats.push(`${d.day}:${loc}:${b}`); return b; };
check(!walkIn('lobby') && !walkIn('street'), 'the day of the belt: nothing yet');
d.day = 11; check(walkIn('street') === 'signal' && !walkIn('lobby'), 'the next day the foghorn is heard on the street only');
d.ow.heard = 1;
d.day = 12; check(!walkIn('street'), 'then quiet');
d.day = 13; check(walkIn('lobby') === 'invasion1', 'exactly three days after the belt: the invasion');
check(!c.owDue('arena') && !c.owDue('gym'), 'only the lobby and the street start it');
c.owAfterMatch('invasion', true);
check(d.ow.state === 'INVADED' && c.titleVenue.loc === 'basement', 'after it the dome is down and the belt is fought in the basement');
d.day = 13 + OW.gap - 1; check(!walkIn('street'), 'a few quiet days');
d.day = 13 + OW.gap; check(walkIn('street') === 'invasion2', 'the second wave');
c.owAfterMatch('invasion2', false);
check(d.ow.state === 'REGROUP' && c.titleVenue.loc === 'basement', 'win or lose, they regroup');
d.day += OW.gap; check(walkIn('lobby') === 'invasion3', 'the captain comes');
c.owAfterMatch('invasion3', false);
check(d.ow.state === 'CAPTAIN' && !c.owDue('lobby'), 'a loss: he waits');
d.day += 1; check(walkIn('street') === 'invasion3', 'the next day: a rematch');
c.owAfterMatch('invasion3', true);
check(d.ow.state === 'REBUILD' && c.titleVenue.loc === 'basement', 'he sails away; the dome is being rebuilt');
d.day += OW.rebuild - 1; check(!walkIn('street'), 'still rebuilding');
d.day += 1; check(walkIn('street') === 'rebuilt', 'the dome reopens');
c.owRebuilt();
check(d.ow.state === 'INTERNATIONAL_ROUTE_OPEN' && c.titleVenue.loc === 'dome' && !c.owDue('street'), 'the route is open and the belt is back in the dome');
// 고동 as a boss: the phases come at 70% and 35%
{
  const m = new MatchManager({ mode: 'single', arena: 'pier', seed: 6, skipIntro: true, bossPhases: { by: ['hp'], max: 3 }, entrants: [{ char: 'rookie', ctrl: 'ai', difficulty: 'expert' }, { char: 'godong', ctrl: 'ai', difficulty: 'hard', boss: true }] });
  const g = m.fighters[1]; const phases = [];
  m.on('bossPhase', e => phases.push(Math.round(g.hp / g.maxHp * 100)));
  g.hp = g.maxHp * .69; for (let i = 0; i < 30; i++) m.update(1 / 60);
  g.hp = g.maxHp * .34; for (let i = 0; i < 30; i++) m.update(1 / 60);
  check(phases.length === 2 && phases[0] <= 70 && phases[1] <= 35, '고동 turns up at 70% and 35%', JSON.stringify(phases));
}
{
  const m = new MatchManager({ mode: 'tag', arena: 'pier', seed: 7, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'ai', difficulty: 'hard' }, { char: 'dohyun', ctrl: 'ai', difficulty: 'hard' }, { char: 'whiteivory', ctrl: 'ai', difficulty: 'hard' }, { char: 'owsailor', ctrl: 'ai', difficulty: 'hard' }] });
  let t = 0; while (m.phase !== 'end' && t < 400) { m.update(1 / 60); t += 1 / 60; }
  check(m.phase === 'end' && !m.faults, `the second-wave tag match plays to the end (${Math.round(t)} s, ${m.result && m.result.how})`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
