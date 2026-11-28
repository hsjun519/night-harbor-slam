// 선항 레슬링, chapter one: the first belt sets the invasion for exactly three days later, the dome is wrecked after
// it and the belt moves to the basement; the champion earns royalties; the cutscene engine runs its steps, waits for
// walks and talks, and a skip still applies what the story changes. Run: node tests/ow.mjs
import { Career, OW } from '../src/world/CareerManager.js';
import { Cutscene } from '../src/world/Cutscene.js';
import { Actor } from '../src/world/Actor.js';
import { LOOKS } from '../src/data/looks.js';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVES, FINISHERS } from '../src/data/moves.js';
import { MatchManager } from '../src/combat/MatchManager.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
for (const k of ['save3', 'save3.chk']) Save.del(k);
const c = Career.create(3, { name: '파도', style: 'all', look }), d = c.d;
check(d.ow.state === 'LOCKED' && c.titleVenue.arena === 'dome', 'no belt yet: no invasion, the belt is fought in the dome');
// win the title
d.day = 12; d.fame = 60; d.flags.rankPts = 400;
d.contract = { opp: 'fogking', oppName: '안개왕', kind: 'title', title: 1, reward: 300000, fame: 40, day: 14 };
const res = { human: { dmgTaken: 30, finishersTaken: 0, ko: false, ringOuts: 0, moves: 4, counters: 0, uses: {} }, won: true, draw: false, result: { how: 'falls', winner: null } };
c.applyResult('title', res, {});
check(d.flags.champion && d.ow.state === 'SIGNS' && d.ow.champDay === 12 && d.ow.at === 12 + OW.delay, 'the first belt: the invasion is set for exactly three days later', JSON.stringify(d.ow));
// royalties while champion
const m0 = d.money; const msgs = c.nextDay();
check(d.money > m0 && msgs.some(t => t.includes('로열티')), 'the champion earns royalties each day', JSON.stringify(msgs));
// after the invasion
d.ow.state = 'INVADED';
check(c.titleVenue.arena === 'basement' && c.titleVenue.loc === 'basement', 'after the invasion the belt is fought in the basement');
d.offers = []; d.offersDay = 0; d.contract = null; d.flags.lastDefense = 0; d.day = 15;
c.makeOffers();
const def = d.offers.find(o => o.title);
check(def && def.arena === 'basement', 'a title defence is booked in the basement', JSON.stringify(def && { arena: def.arena, opp: def.opp }));
// an old champion's save gets the story too
const old = Career.create(3, { name: '옛 챔피언', style: 'all', look }); delete old.d.ow; old.d.titles.push({ name: 'x', season: 1, day: 5 }); old.d.flags.champion = true; old.d.day = 9; old.migrate();
check(old.d.ow.state === 'SIGNS' && old.d.ow.at === 9 + OW.delay, 'a save from before the story starts it from the next load', JSON.stringify(old.d.ow));
const ex = Career.create(3, { name: '전 챔피언', style: 'all', look }); delete ex.d.ow; ex.d.titles.push({ name: 'x', season: 1, day: 5 }); ex.d.day = 9; ex.migrate();
check(ex.d.ow.state === 'LOCKED', 'a former champion without the belt is not their target', JSON.stringify(ex.d.ow));
// the belt lost (to a cash-in) before they arrive: they do not come
{ const k = Career.create(3, { name: '파도', style: 'all', look }), e = k.d; e.flags.champion = true; e.day = 10; k.owBegin(); e.contract = { opp: 'neon', oppName: '네온', title: 1, cashIn: 'neon', kind: 'title', reward: 0, fame: 0, day: 10 };
  k.applyResult('title', { human: { dmgTaken: 10, finishersTaken: 0, ko: false, ringOuts: 0 }, won: false, draw: false, result: { how: 'pin', winner: null } }, {});
  e.day = 13; check(!e.flags.champion && e.ow.state === 'LOCKED' && !k.owDue('lobby') && !k.owDue('street'), 'a belt lost to a cash-in before the invasion: 선항 레슬링 does not come', JSON.stringify(e.ow));
  e.flags.champion = true; k.owBegin(); check(e.ow.state === 'SIGNS', 'winning it back starts the story again'); }
// the new faces play
for (const id of ['whiteivory', 'godong', 'owsailor']) check(CHARACTERS[id] && CHARACTERS[id].thug && FINISHERS[CHARACTERS[id].finisher], `${CHARACTERS[id].name}: a wrestler with a finisher, kept out of the league`);
{
  const m = new MatchManager({ mode: 'single', arena: 'pier', seed: 4, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'ai', difficulty: 'hard' }, { char: 'whiteivory', ctrl: 'ai', difficulty: 'hard' }] });
  let t = 0, fin = 0; m.on('finisherHit', () => fin++);
  while (m.phase !== 'end' && t < 300) { m.update(1 / 60); t += 1 / 60; }
  check(m.phase === 'end' && !m.faults, `쇄파 plays a full match (${Math.round(t)} s, ${m.result && m.result.how}, finishers ${fin})`);
}
// ---- the cutscene engine on a stand-in town
{
  const W = { npcs: [], loc: 'lobby', camX: 0, dialog: null, player: new Actor(look, { x: 300 }), c, game: { audio: { sfx() {}, music() {} }, screen: { shake() {}, flash() {} }, input: { down: () => false } },
    say(steps) { this.dialog = { steps, update() {} }; }, enter(id, x) { this.loc = id; this.player.x = x; } };
  const log = [];
  const S = new Cutscene(W, [
    { bars: 1 }, { spawn: 'whiteivory', x: 40, face: 1 },
    { walk: 'whiteivory', to: 200, speed: 200 }, { act: () => log.push('walked') },
    { say: [{ who: 'whiteivory', text: '…' }] }, { act: () => log.push('talked') },
    { title: '선항 레슬링', dur: .3 }, { act: () => log.push('end') },
  ]);
  S.start();
  let t = 0; while (!S.done && t < 10) { S.update(1 / 60); t += 1 / 60; if (W.dialog && t > 2) W.dialog = null; }
  const a = W.npcs.find(n => n.id === 'whiteivory');
  check(S.done && log.join(',') === 'walked,talked,end' && a && a.gone, 'a script plays in order: walk, talk, card, and its people leave', JSON.stringify({ log, t: t.toFixed(1) }));
  const log2 = [];
  const S2 = new Cutscene(W, [{ wait: 5 }, { say: [{ act: () => log2.push('talk-act') }, { who: 'me', text: '…' }] }, { act: () => log2.push('story') }, { wait: 5 }]);
  S2.start(); S2.update(1 / 60); S2.skip();
  check(S2.done && log2.includes('story') && log2.includes('talk-act'), 'skipping still applies the story', JSON.stringify(log2));
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
