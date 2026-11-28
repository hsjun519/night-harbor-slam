// The wrestlers in the lobby ask for things now and then: bring them something from a shop ("이봐, 붕대 하나 사다 줄
// 수 있겠나?"), be their sparring partner in the underground ring, or show them one of your moves in the gym ring.
// Doing it raises their liking (호감도, 0..100); at 30, 60 and 90 they come back with something: an item, money,
// a move of their own. A fish from the dock is a small present too. 호감도 안경 (worn) shows the hearts in town.
//   d.quest = { id, kind: 'item' | 'spar' | 'teach', item, move, day, until, done }   d.aff = { id: 0..100 }
import { CHARACTERS } from '../data/characters.js';
import { MOVES } from '../data/moves.js';

export const QUEST = { from: 3, chance: .35, days: 3, gain: { item: 18, spar: 22, teach: 20 }, sparWin: 8, fish: 6, bigFish: 14, steps: [30, 60, 90] };
export const QUEST_ITEMS = [{ id: 'bandage', name: '붕대', where: '돛대 상회' }, { id: 'drink', name: '이온 음료', where: '돛대 상회' }];
export const affOf = (d, id) => (d.aff && d.aff[id]) || 0;
export function addAff(d, id, n) {
  const A = d.aff || (d.aff = {}), before = A[id] || 0;
  A[id] = Math.max(0, Math.min(100, before + n));
  return QUEST.steps.filter(s => before < s && A[id] >= s);   // the thresholds crossed: gifts are due
}
const hash = (...a) => { let h = 2166136261; for (const x of a) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } } return ((h >>> 0) % 100003) / 100003; };
// one of the wrestlers in the lobby today asks for something (one quest at a time)
export function questDue(d, here) {
  const q = d.quest;
  if ((d.season || 1) === 1 && d.day < QUEST.from) return null;   // not in the first days of a career
  if (d.contract && d.contract.day === d.day) return null;          // nor on the day of a contract match
  if (q && !q.done && d.day <= q.until) return null;
  if (q && q.day === d.day) return null;
  const ids = here.filter(id => CHARACTERS[id] && !CHARACTERS[id].thug && !CHARACTERS[id].boss);
  if (!ids.length || hash(d.season, d.day, 'quest') >= QUEST.chance) return null;
  return ids[Math.floor(hash(d.day, 'who') * ids.length) % ids.length];
}
export function makeQuest(d, id, equipped) {
  const r = hash(d.season, d.day, id), moves = equipped.filter(m => MOVES[m] && MOVES[m].pos !== 'dash');
  const kind = r < .4 ? 'item' : r < .7 || !moves.length ? 'spar' : 'teach';
  const q = { id, kind, day: d.day, until: d.day + QUEST.days, done: 0 };
  if (kind === 'item') q.item = QUEST_ITEMS[Math.floor(hash(d.day, id, 'item') * QUEST_ITEMS.length) % QUEST_ITEMS.length].id;
  if (kind === 'teach') q.move = moves[Math.floor(hash(d.day, id, 'move') * moves.length) % moves.length];
  d.quest = q;
  return q;
}
export function questAsk(q) {
  const it = QUEST_ITEMS.find(i => i.id === q.item);
  if (q.kind === 'item') return `이봐, ${it.name} 하나 사다 줄 수 있겠나? ${it.where}에 있을 거야. 내가 오늘 다리가 좀 무거워서.`;
  if (q.kind === 'spar') return '나의 연습 상대가 되어 주게. 지하 격투장에서 한 판. 승패는 상관없어, 땀이 필요하거든.';
  return `자네의 '${MOVES[q.move].name}', 나한테도 좀 알려 주게. 훈련장 링에서 나한테 한 번만 걸어 줘.`;
}
export const questText = q => (!q ? '' : q.kind === 'item' ? `${CHARACTERS[q.id].name}에게 ${QUEST_ITEMS.find(i => i.id === q.item).name} 갖다주기` : q.kind === 'spar' ? `지하 격투장에서 ${CHARACTERS[q.id].name}의 연습 상대` : `훈련장 링에서 ${CHARACTERS[q.id].name}에게 '${MOVES[q.move].name}' 걸어 주기`);
// what they give back when their liking crosses 30, 60, 90
export function questReward(c, id, step) {
  const d = c.d, ch = CHARACTERS[id];
  if (step === 30) { d.items.bandage = (d.items.bandage || 0) + 2; return { text: '붕대 두 개를 챙겨 줬다', line: '이거 받아. 링에서 다치지 말라고.' }; }
  if (step === 60) { const m = 30000 + (d.season || 1) * 10000; c.earn(m); return { text: `용돈 ${m.toLocaleString()}원을 받았다`, line: '지난번 고마웠어. 얼마 안 되지만 밥이나 사 먹어.' }; }
  const pool = [...Object.values(ch.moves.front || {}), ...Object.values(ch.moves.rear || {})].filter((m, i, a) => MOVES[m] && !d.known.includes(m) && a.indexOf(m) === i);
  if (pool.length) { const m = pool[0]; c.learn(m); return { text: `기술의 서: ${MOVES[m].name}`, line: `내 비장의 기술 '${MOVES[m].name}', 너한테만 알려 주지.`, move: m }; }
  d.items.champBandage = (d.items.champBandage || 0) + 1; return { text: '챔피언의 붕대를 받았다', line: '가르칠 건 없지만, 이건 정말 귀한 거야.' };
}
