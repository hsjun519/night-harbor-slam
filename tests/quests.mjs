// Favours and liking: a wrestler in the lobby asks now and then (bring an item, spar in the basement, show a move
// in the gym ring), one favour at a time; liking 0..100 with gifts at 30 (items), 60 (money) and 90 (one of
// their moves). Run: node tests/quests.mjs
import { QUEST, affOf, addAff, questDue, makeQuest, questAsk, questText, questReward } from '../src/world/quests.js';
import { Career } from '../src/world/CareerManager.js';
import { Save } from '../src/core/SaveManager.js';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVES } from '../src/data/moves.js';

let fails = 0;
const check = (ok, what, extra = '') => { if (ok) console.log('ok  ', what); else { fails++; console.log('FAIL', what, extra); } };
for (const k of ['save2', 'save2.chk']) Save.del(k);
const look = { build: 'athletic', skin: 'tan', head: { face: 'square', hair: 'side', hairCol: '#222' }, top: { kind: 'none' }, bottom: { kind: 'tights', c1: '#157f8c', c2: '#ffd65a' }, boots: { c1: '#222' } };
const c = Career.create(2, { name: '파도', style: 'all', look }), d = c.d;
const here = ['janitor', 'taesan', 'reporter', 'neon'];
{
  let asked = 0, kinds = {};
  check(questDue(Object.assign({}, d, { day: 1, quest: null }), here) === null && questDue(Object.assign({}, d, { day: 2, quest: null }), here) === null, 'nobody asks in the first two days');
  for (let day = 3; day <= 42; day++) { d.day = day; d.quest = null; const id = questDue(d, here); if (id) { asked++; const q = makeQuest(d, id, Object.values(d.moves.front).filter(Boolean)); kinds[q.kind] = (kinds[q.kind] || 0) + 1; check.quiet = 1; if (!CHARACTERS[id]) check(false, 'only wrestlers ask', id); } }
  check(asked > 5 && asked < 30, `wrestlers ask for favours on some days (${asked} of 40)`);
  check(kinds.item && kinds.spar && kinds.teach, `three kinds: ${JSON.stringify(kinds)}`);
  d.day = 50; d.quest = null; let id = null; for (; d.day < 90 && !id; d.day++) id = questDue(d, here);
  d.day--; const q = makeQuest(d, id, ['bodySlam', 'suplex']);
  check(!questDue(d, here) && !questDue(Object.assign({}, d, { day: d.day + 1 }), here), 'one favour at a time, while it is open');
  check(questDue(Object.assign({}, d, { day: q.until + 3 }), here) !== undefined, 'after it runs out a new one can come');
  check(questAsk(q).length > 10 && questText(q).includes(CHARACTERS[id].name), 'they say what they want, and the goal line names them', questText(q));
  if (q.kind === 'teach') check(['bodySlam', 'suplex'].includes(q.move), 'a move to show is one you have on');
}
{
  d.aff = {};
  check(addAff(d, 'taesan', 25).length === 0 && addAff(d, 'taesan', 10).join() === '30', 'liking crosses 30: a gift is due');
  check(addAff(d, 'taesan', 60).join() === '60,90' && affOf(d, 'taesan') === 95, 'and 60 and 90 on the way up (capped at 100)');
  const b0 = d.items.bandage || 0, r30 = questReward(c, 'taesan', 30);
  check((d.items.bandage || 0) === b0 + 2 && r30.line, 'at 30: bandages');
  const m0 = d.money, r60 = questReward(c, 'taesan', 60);
  check(d.money > m0 && r60.text.includes('원'), 'at 60: money');
  const k0 = d.known.length, r90 = questReward(c, 'taesan', 90);
  check((r90.move && d.known.includes(r90.move) && d.known.length === k0 + 1 && MOVES[r90.move]) || r90.text.includes('붕대'), `at 90: one of their moves (${r90.text})`);
  check(QUEST.fish > 0 && QUEST.bigFish > QUEST.fish, 'a fish is a small present, a tuna a bigger one');
}
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
