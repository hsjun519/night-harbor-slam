// The new basics steps can be done with plain inputs: a follow-up after a move, putting a hold on (backbreaker then
// K), mashing out of a hold, and leaving the ring and coming back. Run: node tests/tutorial.mjs
import { MatchManager } from '../src/combat/MatchManager.js';
import { Tutorial, TUTORIAL } from '../src/scenes/Tutorial.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
const KEYS = ['up', 'down', 'downEdge', 'jump', 'atk', 'grab', 'dodge', 'fin'];
function at(goal) {
  const m = new MatchManager({ mode: 'practice', arena: 'gym', seed: 3, skipIntro: true, tutorial: true, entrants: [{ char: 'rookie', ctrl: 'human' }, { char: 'dohyun', ctrl: 'dummy' }], practice: { infinite: true } });
  const scene = { m, game: { audio: { sfx() {} }, input: { label: k => k } }, tutorialDone() {} };
  const T = new Tutorial(scene), i = TUTORIAL.findIndex(s => s.goal === goal);
  for (let k = 0; k < 20; k++) m.update(1 / 60);
  T.begin(i);
  const h = m.fighters[0], v = m.fighters[1];
  // press: { key: true } for one frame; hold: keys held; mx
  const step = (n = 1, o = {}) => { for (let k = 0; k < n; k++) { const I = h.intent; I.mx = o.mx || 0; for (const key of KEYS) I[key] = !!(o.hold && o.hold.includes(key)) || (k === 0 && !!(o.press && o.press.includes(key))); m.update(1 / 60); T.update(1 / 60); } };
  return { m, T, h, v, step, i, done: () => T.i > i || T.doneT > 0 };
}
// grab the foe in front: knock them dizzy, walk in, K
function grabFoe(S) {
  const { m, h, v, step } = S;
  h.x = 400; v.x = 428; h.face = 1; v.face = -1; m.combat.stagger(v, 3, h); step(2);
  step(1, { press: ['grab'] }); step(14);
  return h.link && h.link.kind === 'hold';
}
{
  const S = at('기술 뒤 연계 1번');
  const held = grabFoe(S);
  S.step(1, { press: ['grab'] });   // K: body slam
  let n = 0; while (S.h.link && n++ < 200) S.step(1);
  for (let k = 0; k < 40 && !S.done(); k++) S.step(1, { press: k % 6 === 0 ? ['atk'] : [] });   // J in the window
  for (let k = 0; k < 200 && !S.done(); k++) S.step(1);
  check(held && S.done(), 'follow-up step: body slam, then J for the elbow drop', JSON.stringify({ held, i: S.T.i, n: S.T.n }));
}
{
  const S = at('백브레이커 뒤 K로 조르기 걸기');
  const held = grabFoe(S);
  S.step(1, { press: ['grab'] });   // K: the backbreaker lent for this step
  let started = null; S.m.on('moveStart', e => { if (e.a === S.h) started = e.mv.id; });
  for (let k = 0; k < 220 && !S.done(); k++) S.step(1, { press: k % 8 === 0 ? ['grab'] : [] });
  check(held && S.done() && started === 'backStretch', 'hold step: backbreaker, then K puts on the back stretch', JSON.stringify({ held, started, i: S.T.i }));
}
{
  const S = at('연타로 조르기 풀기');
  let holds = 0; S.m.on('moveStart', e => { if (e.a === S.v && e.mv.sub) holds++; });
  for (let k = 0; k < 600 && !S.done(); k++) S.step(1, { press: [['atk'], ['grab'], ['dodge'], ['jump']][k % 4] });
  check(holds >= 1 && S.done(), 'escape step: 도현 puts a hold on, mashing breaks it', JSON.stringify({ holds, i: S.T.i, n: S.T.n }));
}
{
  const S = at('링 밖으로 나갔다가 다시 들어오기'), { m, h } = S, ar = m.arena;
  h.x = ar.ropeR - 120; h.face = 1; S.step(5);
  for (let k = 0; k < 90; k++) S.step(1, { mx: 1 });   // walk up to the ropes
  const atRope = Math.round(ar.ropeR - h.x);
  for (let k = 0; k < 90 && h.side === 'in'; k++) S.step(1, { hold: ['down'], mx: 1 });   // S held, toward the ropes
  const out = h.side === 'out';
  for (let k = 0; k < 60; k++) S.step(1);
  // walk to the apron and W
  for (let k = 0; k < 120 && Math.abs(h.x - (ar.ropeR + ar.apron)) > 30; k++) S.step(1, { mx: h.x > ar.ropeR + ar.apron ? -1 : 1 });
  for (let k = 0; k < 120 && !S.done(); k++) S.step(1, { press: k % 10 === 0 ? ['jump', 'up'] : [] });
  check(out && S.done(), 'ring step: S + toward the ropes goes out, W by the apron comes back', JSON.stringify({ atRope, out, side: h.side, st: h.st, i: S.T.i, n: S.T.n }));
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
