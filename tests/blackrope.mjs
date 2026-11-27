// BLACK ROPE: when they first show up, joining the league, growing on their own losses to you, the lobby raid (when it
// may come, what a win or a loss leaves behind, the repair), their special match, run-ins on official matches (in from
// the aisle, a chair, now and then a no contest), their finishers and theme, and the cutscene's branch steps.
// Run: node tests/blackrope.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { CHARACTERS } from '../src/data/characters.js';
import { FINISHERS, MOVES } from '../src/data/moves.js';
import { TRACKS } from '../src/core/AudioManager.js';
import { Career } from '../src/world/CareerManager.js';
import { BR, brState, brRival, brMeetDue, brMeet, brActivate, brAfterMatch, brMods, brRaidDue, brRaidLineup, brRaidResult, brRunInDue, brRunInMark, brOffer } from '../src/world/blackRope.js';
import { Cutscene } from '../src/world/Cutscene.js';
import { Actor } from '../src/world/Actor.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
for (const k of ['save3', 'save3.chk']) Save.del(k);
const c = Career.create(3, { name: '파도', style: 'all', look }), d = c.d, B = brState(d);

// ---- five different wrestlers
const S = BR.ids.map(id => CHARACTERS[id]);
check(S.every(ch => ch && ch.br && FINISHERS[ch.finisher]) && new Set(S.map(ch => ch.finisher)).size === 5 && new Set(S.map(ch => ch.style)).size >= 4, 'five members, each with a finisher of their own and a different style');
check(S[1].stats.hp > S[0].stats.hp && S[2].stats.spd > S[0].stats.spd && S[3].stats.grp >= 1.2 && S[4].ai.taunt > .8, 'roles: the wall is toughest, the swallow fastest, the needle the most technical, the showman taunts');
// ---- the first meeting
check(!brMeetDue(c), 'not on day one');
d.day = 4; d.fame = 12;
check(brMeetDue(c), 'from day 4 with a little name');
d.flags.gangDay = 4; check(!brMeetDue(c), 'not on a day the dock gang came'); d.flags.gangDay = 0;
brMeet(c);
check(B.stage === 'MET' && BR.ids.every(id => d.league.some(e => e.id === id)), 'after meeting them they are in the league');
check(c.newLeague(2).some(e => e.id === 'brLeader'), 'and stay in it next season');
// ---- growth on their own losses
const R = brRival(d, 'brLeader');
let lines = brAfterMatch(c, 'brLeader', true, false);
check(B.stage === 'ACTIVE' && R.l === 1 && R.hostility > 20 && !lines.length, 'the first match with one of them makes it serious');
lines = brAfterMatch(c, 'brLeader', true, false);
check(R.learned.includes('dragonSuplex') && lines.length === 1, 'beaten twice, the leader learns a new move', JSON.stringify(lines));
const M = brMods(c, 'brLeader');
check(M.moves.rear.n === 'dragonSuplex' && M.stats.hp > CHARACTERS.brLeader.stats.hp && M.growth >= 1, 'and brings it to the next match, a little stronger', JSON.stringify({ slot: M.moves.rear.n, hp: Math.round(M.stats.hp), g: M.growth }));
check(CHARACTERS.brLeader.moves.rear.n === 'german', "the character's own data is untouched");
brAfterMatch(c, 'brLeader', false, false);
check(R.w === 1 && R.recent.slice(-1)[0] === '승', 'their wins are remembered too');
// ---- the raid
d.day = 9; d.fame = 30; R.hostility = 50; B.lastRaid = -99;
check(brRaidDue(c), 'a raid may come when they are wound up and it has been a while');
d.flags.gangDay = 9; check(!brRaidDue(c), 'never on the same day as the dock gang'); d.flags.gangDay = 0;
const lu = brRaidLineup(c);
check(lu.who[0] === 'brLeader' && lu.who.length === 2 && !lu.late, 'the leader and one more come in', JSON.stringify(lu));
d.money = 500000;
let out = brRaidResult(c, false);
check(out.loss === BR.raid.lossCap && B.lobby === 'damaged' && B.fixAt === 9 + BR.raid.fixDays && B.rematch, 'lost: money taken (capped), the lobby wrecked for a few days, a rematch offered', JSON.stringify(out));
check(!brRaidDue(c), 'no new raid while the lobby is wrecked');
d.day = 10; d.contract = null; d.offers = []; d.offersDay = 0;
const offers = c.makeOffers(), bo = offers.find(o => o.kind === 'brmatch');
check(bo && bo.opp === 'brLeader' && bo.br, 'their special match is in the boss office', JSON.stringify(offers.map(o => o.kind + ':' + o.opp)));
d.day = 11; c.nextDay(); c.nextDay();
check(B.lobby === 'ok', 'a few days on the janitor has fixed the lobby', JSON.stringify({ day: d.day, fixAt: B.fixAt, lobby: B.lobby }));
d.day = 30; B.lastRaid = 25; check(!brRaidDue(c), 'long gaps between raids'); B.lastRaid = -99;
const money0 = d.money; out = brRaidResult(c, true);
check(d.money === money0 + out.money && out.fame > 0 && B.lobby === 'ok', 'won: prize money, name, the lobby stays whole');
// a result in their special match clears the rematch
d.contract = Object.assign({}, bo); c.applyResult('official', { human: { dmgTaken: 20, finishersTaken: 0, ko: false, ringOuts: 0, moves: 3, counters: 0, uses: {} }, won: true, draw: false, result: { how: 'pin', winner: null } }, {});
check(!B.rematch && B.lastOffer === d.day, 'the rematch is played out');
// ---- run-ins
B.lastRunIn = -99; R.hostility = 80; d.day = 40;
let hits = 0; for (let k = 0; k < 40; k++) { d.day = 40 + k; B.lastRunIn = -99; if (brRunInDue(c, 'official', { opp: 'taesan' })) hits++; }
check(hits > 4 && hits < 25, `run-ins happen sometimes (${hits}/40)`);
check(!brRunInDue(c, 'free', { opp: 'taesan' }) && !brRunInDue(c, 'official', { opp: 'brPower' }), 'only on official matches, not on their own');
d.day = 80; B.lastRunIn = 79; check(!brRunInDue(c, 'official', { opp: 'taesan' }), 'not twice in a row');
{
  let nc = 0, seen = 0, threw = 0;
  for (let s = 1; s <= 8; s++) {
    const m = new MatchManager({ mode: 'single', arena: 'hall', seed: s, skipIntro: true, career: 1, entrants: [{ char: 'rookie', ctrl: 'ai', difficulty: 'normal' }, { char: 'taesan', ctrl: 'ai', difficulty: 'normal' }], events: [{ kind: 'rivalRunIn', who: 'brLeader', at: 6, noContest: .35 }] });
    m.fighters[0].ctrl = 'human';   // the run-in looks for the human
    let t = 0; m.on('cameoIn', e => { if (e.c.who === 'rival') seen++; }); m.on('cameoThrow', () => threw++);
    while (m.phase !== 'end' && t < 200) { m.fighters[0].ai.update && 0; m.update(1 / 60); t += 1 / 60; }
    if (m.result && m.result.how === 'nocontest') nc++;
  }
  check(seen >= 6 && threw >= 6, `the rival walks in from the aisle and throws a chair (${seen} walk-ins, ${threw} chairs)`);
  check(nc < 8, `a no contest only sometimes (${nc}/8)`);
  // with the referee watching and the chance at 100%, a chair that floors you always ends it as a no contest
  let hitN = 0, ncN = 0;
  for (let s = 1; s <= 16; s++) {
    const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 50 + s, skipIntro: true, career: 1, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'taesan', ctrl: 'dummy' }], events: [{ kind: 'rivalRunIn', who: 'brLeader', at: 3, noContest: 1 }] });
    if (m.fighters[1].ai) m.fighters[1].ai.behavior = 'idle';
    let t = 0; while (m.phase !== 'end' && t < 30) { m.update(1 / 60); t += 1 / 60; }
    if (m.runIn && m.runIn.hit) hitN++;
    if (m.result && m.result.how === 'nocontest' && m.result.draw) ncN++;
  }
  check(hitN > 0 && ncN === hitN, `a floored player in front of the referee: no contest (${ncN} of ${hitN} hits)`);
}
// ---- their finishers play
for (const id of BR.ids) {
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 3, skipIntro: true, entrants: [{ char: id, ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }] });
  const a = m.fighters[0], v = m.fighters[1]; if (v.ai) v.ai.behavior = 'idle';
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  a.x = 400; v.x = 424; a.face = 1; v.face = -1;
  const hp0 = v.hp, F = FINISHERS[CHARACTERS[id].finisher];
  const ok = F.type === 'dive' || F.type === 'strike' ? true : m.finisher.connect(a, v, F, false);
  let bad = false; for (let i = 0; i < 240; i++) { m.update(1 / 60); if (!Number.isFinite(v.x) || m.faults) bad = true; }
  check(ok && !bad && (F.type === 'dive' || F.type === 'strike' || hp0 - v.hp > 25), `${CHARACTERS[id].name}: ${F.name}`, JSON.stringify({ dmg: Math.round(hp0 - v.hp), bad }));
}
// ---- the theme and the cutscene branches
{
  const T = TRACKS.rival;
  check(T && T.lead.length === 8 && T.lead.every(l => l.split(/\s+/).length === 16) && T.bass.split(/\s+/).length === 16 && T.drums.split(/\s+/).length === 16, 'the rival theme is a full eight-bar loop');
  const W = { npcs: [], loc: 'lobby', camX: 0, dialog: null, player: new Actor(look, { x: 300 }), c, game: { audio: { sfx() {}, music() {} }, screen: { shake() {}, flash() {} }, input: { down: () => false } }, say(st) { this.dialog = { st, update() {} }; }, enter() {} };
  const log = [];
  const Sx = new Cutscene(W, [{ act: () => log.push('a') }, { act: () => log.push('no'), when: () => false }, { act: () => log.push('yes'), when: () => true }, { act: () => log.push('z') }]);
  Sx.start(); for (let i = 0; i < 20 && !Sx.done; i++) Sx.update(1 / 60);
  check(log.join(',') === 'a,yes,z', 'steps for the other branch are skipped', log.join(','));
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
