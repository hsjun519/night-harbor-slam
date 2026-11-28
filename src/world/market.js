// 상인: every seller in town (돛대 상회, 항구의원, 자판기, 순덕 포차, 떠돌이 상인 보부, 웨이브 상회). Prices move a
// little every day (MARKET.swing), everything creeps up every three days (MARKET.rise), some goods sell out or
// come in short for the day, a regular (MARKET.loyal buys) gets a discount now and then, and a good customer
// (MARKET.visit buys) has the seller come by the lobby with something for the next match. 웨이브 상회 docks from
// day 10: the expensive, better versions of things, the F+K grab slot and books of finishers.
import { FINISHERS } from '../data/moves.js';

export const MARKET = { swing: .12, rise: .02, every: 3, soldOut: .1, short: .25, loyal: 5, loyalChance: .3, loyalCut: .15, visit: 12, visitGap: 4, visitChance: .4, waveDay: 10 };
export const SELLERS = {
  shop: { name: '돛대 상회', npc: 'shop', who: '리키', gift: { buff: 'atk', v: 1.12, text: '황금 너클 (다음 경기 공격력 +12%)' } },
  clinic: { name: '항구의원', npc: 'nurse', who: '간호사 미소', gift: { buff: 'guard', v: .7, text: '보호대 (다음 경기 부상 -30%)' } },
  vending: { name: '자판기' },
  food: { name: '순덕 포차', npc: 'auntie', who: '순덕 이모', gift: { buff: 'finStart', v: 30, text: '든든한 도시락 (피니셔 게이지 30으로 시작)' } },
  merchant: { name: '떠돌이 상인', npc: 'merchant', who: '보부', gift: { buff: 'chair', v: 1, text: '행운의 의자 (경기 시작 때 옆에 의자)' } },
  wave: { name: '웨이브 상회' },
};
// a small deterministic hash: the same day gives the same prices and stock on every reload
function hash(...a) { let h = 2166136261; for (const x of a) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } } return ((h >>> 0) % 100003) / 100003; }
export const marketOf = d => d.market || (d.market = { buys: {}, sold: {}, visit: null, gifts: {} });
const dayKey = d => `${d.season || 1}-${d.day || 1}`;
export const dayIndex = d => ((d.season || 1) - 1) * 28 + (d.day || 1) - 1;
export const inflation = d => 1 + MARKET.rise * Math.floor(dayIndex(d) / MARKET.every);
export const swing = (d, shop, key) => 1 + (hash(dayKey(d), shop, key) * 2 - 1) * MARKET.swing;
export const loyalToday = (d, shop) => (marketOf(d).buys[shop] || 0) >= MARKET.loyal && hash(dayKey(d), shop, 'loyal') < MARKET.loyalChance;
// today's price of something that costs base
export function price(d, shop, key, base) {
  if (!base) return 0;
  const p = base * inflation(d) * swing(d, shop, key) * (loyalToday(d, shop) ? 1 - MARKET.loyalCut : 1);
  return Math.max(100, Math.round(p / 100) * 100);
}
// up or down from the usual (the creeping rise is not counted)
export const trend = (d, shop, key) => { const s = swing(d, shop, key); return s > 1.04 ? 'up' : s < .96 ? 'down' : ''; };
// today's stock: null (plenty), 0 (sold out) or how many are left
export function stock(d, shop, key) {
  const r = hash(dayKey(d), shop, key, 'stock'), M = marketOf(d), sold = M.sold[shop + ':' + key] || 0;
  if (r < MARKET.soldOut) return 0;
  if (r < MARKET.soldOut + MARKET.short) return Math.max(0, 1 + Math.floor(hash(dayKey(d), key, shop) * 3) - sold);
  return null;
}
export function bought(d, shop, key) { const M = marketOf(d); M.buys[shop] = (M.buys[shop] || 0) + 1; M.sold[shop + ':' + key] = (M.sold[shop + ':' + key] || 0) + 1; }
// a line for the top of a shop: today's market
export function marketNote(d, shop) {
  const up = Math.round((inflation(d) - 1) * 100), parts = [];
  if (up > 0) parts.push(`물가 +${up}% (3일마다 오른다)`);
  if (loyalToday(d, shop)) parts.push(`단골 할인 -${Math.round(MARKET.loyalCut * 100)}%!`);
  else if ((marketOf(d).buys[shop] || 0) >= MARKET.loyal) parts.push('단골 손님');
  return parts.join(' · ');
}
// the morning: yesterday's counts go; a good customer's seller may come by the lobby; the rise is announced
export function marketMorning(d, dayBefore) {
  const M = marketOf(d), msgs = [];
  M.sold = {}; M.visit = null;
  for (const s in SELLERS) {
    const S = SELLERS[s];
    if (!S.gift || (M.buys[s] || 0) < MARKET.visit || dayIndex(d) - (M.gifts[s] != null ? M.gifts[s] : -99) < MARKET.visitGap) continue;
    if (hash(dayKey(d), s, 'visit') < MARKET.visitChance) { M.visit = s; break; }
  }
  if (dayBefore != null && Math.floor(dayIndex(d) / MARKET.every) > Math.floor(dayBefore / MARKET.every)) msgs.push(`물가가 조금 올랐다 (평소보다 +${Math.round((inflation(d) - 1) * 100)}%)`);
  return msgs;
}
export const visitor = d => { const M = marketOf(d); return M.visit && M.visit !== 'done' && SELLERS[M.visit] ? Object.assign({ id: M.visit }, SELLERS[M.visit]) : null; };
export function takeGift(d) { const M = marketOf(d), V = visitor(d); if (!V) return null; d.buffs = d.buffs || {}; d.buffs[V.gift.buff] = V.gift.v; M.gifts[V.id] = dayIndex(d); M.visit = 'done'; return V; }
// ---- 웨이브 상회 (from day 10): the better, dearer versions, the F+K slot, finishers
export const waveOpen = d => (d.season || 1) > 1 || (d.day || 1) >= MARKET.waveDay;
export const WAVE_ITEMS = [
  { id: 'slotF', name: 'F+K 잡기 칸', price: 450000, desc: '정면 잡기에 F+K 칸이 생긴다. Tab → 기술에서 기술을 넣자.', once: 1 },
  { id: 'champBandage', name: '챔피언의 붕대', price: 46000, desc: '부상 -40. 소지품에 넣어 둔다. (붕대의 상위 호환)', give: 'champBandage', many: 1 },
  { id: 'waveKnuckle', name: '웨이브 너클', price: 62000, desc: '다음 경기 공격력 +35%. (황금 너클의 상위 호환)', buff: { atk: 1.35 } },
  { id: 'titanGuard', name: '티타늄 보호대', price: 58000, desc: '다음 경기에서 쌓이는 부상 -70%. (강철 보호대의 상위 호환)', buff: { guard: .3 } },
  { id: 'stormCharm', name: '폭풍 부적', price: 54000, desc: '다음 경기를 피니셔 게이지 80으로 시작. (파도 부적의 상위 호환)', buff: { finStart: 80 } },
  { id: 'eelGold', name: '황금 장어즙', price: 42000, desc: '피로 0, 부상 -12. 바로 마신다. (장어즙의 상위 호환)', now: { fat: 100, inj: 12 } },
];
// two books of finishers a day, from the ones the career does not know yet
export function waveBooks(d, known) {
  const pool = ['dawn', 'container', 'typhoon', 'anchor', 'weld', 'tsunami', 'swallow', 'quarry', 'encore', 'stitch'].filter(id => FINISHERS[id] && !known.includes(id));
  pool.sort((a, b) => hash(dayKey(d), a) - hash(dayKey(d), b));
  return pool.slice(0, 2).map(id => ({ id: 'fin_' + id, name: `필살기의 서: ${FINISHERS[id].name}`, price: 380000, desc: '피니셔를 하나 더 배운다. Tab → 기술에서 F로 바꾼다.', fin: id, once: 1 }));
}
