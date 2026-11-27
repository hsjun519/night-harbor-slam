// 골목 영감 and the weekly finals: daily help (coins or the scrap job) adds up, the alley opens at 5, one lesson a
// day once the help is there (스몰 패키지, two moves he still remembers, then his finisher 검은 파도), and the
// three bonus matches a week whose beaten finalist teaches a move. Run: node tests/beggar.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { MOVES, FINISHERS } from '../src/data/moves.js';
import { Career, weeklyOn } from '../src/world/CareerManager.js';
import { BEGGAR, beggarState, beggarTalk, lessonReady, thanksSteps } from '../src/world/beggar.js';
import { Save } from '../src/core/SaveManager.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
for (const k of ['save2', 'save2.chk']) Save.del(k);
const c = Career.create(2, { name: '파도', style: 'all', look }), d = c.d;
d.money = 60000;
const toasts = [];
const W = { loc: 'street', c, toast: t => toasts.push(t), game: { audio: { sfx() {} } }, startTraining: id => { W.started = id; }, say: steps => play(steps, []) };
// a tiny dialogue runner: text is skipped, acts run, ifs branch, choices take the next index from `pick`
function play(steps, pick) {
  const q = steps.slice(), said = [];
  while (q.length) {
    const s = q.shift();
    if (s.act) { s.act(); continue; }
    if (s.if) { q.unshift(...(s.if() ? s.then || [] : s.else || [])); continue; }
    if (s.choice) { const ch = s.choice[pick.length ? pick.shift() : s.choice.length - 1]; if (ch.go) q.unshift(...ch.go); if (ch.act) ch.act(); continue; }
    if (s.text) said.push(s.text);
  }
  return said;
}
const B = beggarState(d);
const day = n => { d.day = n; };
day(2);
let said = play(beggarTalk(c, W), [0]);
check(B.help === 1 && B.day === 2 && d.money === 60000 - BEGGAR.coin, 'a coin: help +1 for the day', JSON.stringify({ help: B.help, money: d.money }));
said = play(beggarTalk(c, W), []);
check(B.help === 1 && said.length === 1, 'once a day: he only thanks you again');
for (let n = 3; n <= 5; n++) { day(n); play(beggarTalk(c, W), [0]); }
check(B.help === 4 && !d.flags.hideout, 'four coins: not yet');
day(6); W.started = null; play(beggarTalk(c, W), [1]);
check(W.started === 'scrap', 'the scrap job starts the crane game');
said = play(thanksSteps(c, W, 0), []);   // (the help is added by the world after the game; simulate a B grade)
B.help += 2; B.day = 6; said = play(thanksSteps(c, W, 2), []);
check(d.flags.hideout === 1 && said.some(t => t.includes('따라오게')), 'help 5+: he takes you to the alley', JSON.stringify({ help: B.help, hideout: d.flags.hideout }));
W.loc = 'hideout';
check(lessonReady(d), 'in his gym the first lesson is due');
said = play(beggarTalk(c, W), []);
check(d.known.includes('smallPackage') && B.lessons === 1 && said.some(t => t.includes('검은 파도')), 'lesson 1: 스몰 패키지, and who he was', JSON.stringify({ lessons: B.lessons }));
check(!lessonReady(d), 'one lesson a day');
// keep helping: lessons at 9, 13, 18
const taught = [];
d.money = 1e6;   // plenty of coins from here
for (let n = 7; n <= 40 && B.lessons < BEGGAR.lessons.length; n++) {
  day(n);
  if (lessonReady(d)) { const before = d.known.length, fb = c.finKnown().length; play(beggarTalk(c, W), []); if (d.known.length > before) taught.push(d.known[d.known.length - 1]); if (c.finKnown().length > fb) taught.push('fin:' + c.finKnown()[c.finKnown().length - 1]); continue; }
  play(beggarTalk(c, W), [0]);
}
check(taught.length === 3 && MOVES[taught[0]] && MOVES[taught[1]] && taught[2] === 'fin:blackwave', 'lessons 2-4: two moves he remembers, then his finisher', JSON.stringify(taught));
check(B.lessons === BEGGAR.lessons.length && !lessonReady(d), 'nothing left to teach');
check(toasts.some(t => t.includes('정면 잡기') || t.includes('뒤 잡기')), 'the toast says where the move went', JSON.stringify(toasts.slice(-3)));

// ---- his moves in the ring
{
  const m = new MatchManager({ mode: 'pin', arena: 'hall', seed: 2, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }] });
  const h = m.fighters[0], v = m.fighters[1]; if (v.ai) v.ai.behavior = 'idle';
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  h.x = 400; v.x = 424; h.face = 1; v.face = -1;
  m.wrestle.start(h, v, 'smallPackage', { noReverse: true });
  for (let i = 0; i < 70; i++) m.update(1 / 60);
  check(!!m.pin && m.pin.a === h, '스몰 패키지 rolls straight into a cover', JSON.stringify({ pin: !!m.pin, st: [h.st, v.st] }));
}
{
  const m = new MatchManager({ mode: 'single', arena: 'hall', seed: 2, skipIntro: true, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }] });
  const h = m.fighters[0], v = m.fighters[1]; if (v.ai) v.ai.behavior = 'idle';
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  h.x = 400; v.x = 424; h.face = 1; v.face = -1;
  const hp0 = v.hp, ok = m.finisher.connect(h, v, FINISHERS.blackwave, false);
  let rel = null; m.on('release', e => { if (e.a === h) rel = { ahead: Math.sign(v.x - h.x), vFace: v.face }; });
  for (let i = 0; i < 200; i++) m.update(1 / 60);
  check(ok && hp0 - v.hp > 30 && rel && rel.ahead === 1 && rel.vFace === 1, '검은 파도: overhead, spun, driven face first in front', JSON.stringify({ ok, dmg: hp0 - v.hp, rel }));
}
// ---- weekly finals
{
  const days = []; for (let n = 1; n <= 14; n++) { d.day = n; if (weeklyOn(d)) days.push(n); }
  check(JSON.stringify(days) === '[2,4,6,9,11,13]', 'three a week', JSON.stringify(days));
  d.day = 9; d.events = {};
  const o = c.weeklyOffer();
  check(o && o.kind === 'weekly' && o.opp !== c.champion && o.rank <= 6 && o.difficulty === 'hard', 'a top-ranked wrestler, hard AI', JSON.stringify(o));
  d.events[o.event] = 'win';
  check(!c.weeklyOffer(), 'one a day');
  const L = c.weeklyLesson(o.opp);
  check(L && (L.move ? !d.known.includes(L.move) : !!FINISHERS[L.fin]), 'the finalist has something to teach', JSON.stringify(L));
  d.day = 10; check(!c.weeklyOffer(), 'not on other days');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
