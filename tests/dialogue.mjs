// Conversations that open conversations: a choice whose action starts the next one (백 관장 → 시너지, 훈련기구 바꾸기,
// 사장 → 커리어 마무리) must leave the new one on screen when the old one closes. Run: node tests/dialogue.mjs
import { WorldScene } from '../src/world/WorldScene.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
let confirm = false;
const game = { input: { pressed: () => false, menuPressed: k => k === 'confirm' && confirm, down: () => false, label: () => 'E', device: 'kb' }, audio: { sfx() {} }, settings: { typeSpeed: 1 } };
const W = { game, player: null, dialog: null };
const say = (steps, o) => WorldScene.prototype.say.call(W, steps, o);
const press = () => { confirm = true; W.dialog.update(1 / 60); confirm = false; };
// a choice that opens the next conversation
{
  let after = 0;
  say([{ who: 'trainer', choice: [{ label: '시너지', act: () => say([{ who: 'trainer', text: '기술은 하나씩 따로 놀면 반쪽이다.' }, { who: 'trainer', text: '두 번째 줄' }]) }, { label: '그만', go: [] }] }], { after: () => after++ });
  const outer = W.dialog;
  press();
  check(W.dialog && W.dialog !== outer && W.dialog.cur && W.dialog.cur.text.startsWith('기술은'), 'the choice opens the next conversation and it stays on screen', W.dialog && JSON.stringify(W.dialog.cur));
  check(outer.done && after === 1, 'the one that asked is over (and its after-hook ran)');
  W.dialog.shown = 999; press(); W.dialog.shown = 999; press();
  check(W.dialog === null, 'the new conversation closes normally at its end');
}
// a choice that opens a choice (훈련기구 바꾸기: the list of stations)
{
  let bought = null;
  say([{ choice: [{ label: '훈련기구 바꾸기', act: () => say([{ who: 'trainer', text: '어느 걸 바꿀래?' }, { choice: [{ label: '벤치', act: () => { bought = 'bench'; } }, { label: '그만두기', go: [] }] }]) }] }]);
  press(); W.dialog.shown = 999; press();
  check(W.dialog && W.dialog.cur && W.dialog.cur.choice, 'the station list is up');
  press();
  check(bought === 'bench' && W.dialog === null, 'picking one buys it and the talk ends');
}
// conversations that are over before they start do not take the slot
{
  W.dialog = null; let ran = 0;
  say([{ act: () => ran++ }]);
  check(ran === 1 && W.dialog === null, 'an act-only conversation runs and leaves nothing behind');
  say([{ act: () => say([{ who: 'trainer', text: '안쪽' }]) }]);
  check(W.dialog && W.dialog.cur && W.dialog.cur.text === '안쪽', 'one whose act opens another hands the slot to it');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
